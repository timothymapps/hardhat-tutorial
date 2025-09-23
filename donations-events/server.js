// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { db, insertEvt, lastNByName, recentConfirmed } from './db.js';

const log = pino({ level: 'info' });

const {
    ETH_HTTP,
    ETH_WS,
    CONTRACT_ADDRESS,
    BACKFILL_FROM = '0',
    MIN_CONFIRMATIONS = '3',
    PORT = '4000',
} = process.env;

if (!ETH_HTTP || !CONTRACT_ADDRESS) {
    throw new Error('Missing ETH_HTTP and/or CONTRACT_ADDRESS in .env');
}

// --- Providers (WS for live, HTTP for backfills)
// Ethers v6 providers doc. :contentReference[oaicite:3]{index=3}
const http = new ethers.JsonRpcProvider(
    ETH_HTTP,
    undefined,
    { batchMaxCount: 1 }
);
const wss = ETH_WS ? new ethers.WebSocketProvider(ETH_WS) : null;

// --- Load ABI (Hardhat artifact)
const artifact = JSON.parse(
    fs.readFileSync(
        new URL('../artifacts/contracts/Donations.sol/Donations.json', import.meta.url),
        'utf8'
    )
);
const ABI = artifact.abi;

// --- Contract instances
const contractHttp = new ethers.Contract(CONTRACT_ADDRESS, ABI, http);
const contractSub = new ethers.Contract(CONTRACT_ADDRESS, ABI, wss ?? http);

// --- Events we care about (from Donations.sol)
const EVENTS = {
    Donated: 'Donated(address,uint256)',
    Refunded: 'Refunded(address,uint256)',
    Withdrawn: 'Withdrawn(address,uint256)',
    StateChanged: 'StateChanged(uint8,uint8)',      // enum -> uint8
    DeadlineExtended: 'DeadlineExtended(uint256)',
};

// Precompute topic0 (signature hash) for backfill filters
const topics = Object.fromEntries(
    Object.entries(EVENTS).map(([k, sig]) => [k, ethers.id(sig)])
);

// --- In-memory ring buffer (global) & per-event buckets
const MAX_GLOBAL = 5000;
const MAX_PER_EVENT = 2000;
const events = [];
const buckets = Object.fromEntries(Object.keys(EVENTS).map(k => [k, []]));

function pushEvent(e) {
    events.push(e);
    if (events.length > MAX_GLOBAL) events.shift();
}
function pushBucket(name, e) {
    const b = buckets[name];
    b.push(e);
    if (b.length > MAX_PER_EVENT) b.shift();
}

// --- SSE clients
const sseClients = new Set();
function broadcast(data) {
    const line = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(line);
}

// --- Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (req, res) => res.json({ ok: true, address: CONTRACT_ADDRESS }));

// Recent, confirmed (mix of all events)
app.get('/events', async (req, res) => {
    const minConf = Number(req.query.minConfirmations ?? MIN_CONFIRMATIONS);
    const limit = Number(req.query.limit ?? 500);
    const tip = await http.getBlockNumber();

    const rows = recentConfirmed.all({ tip, minConf, limit });
    const out = rows.map(r => ({ ...r, args: JSON.parse(r.jsonArgs) }));
    res.json({ ok: true, tip, count: out.length, events: out });
});

// SSE stream (all events)
app.get('/events/stream', (req, res) => {
    // MDN SSE: text/event-stream, keep-alive. :contentReference[oaicite:4]{index=4}
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

// Per-event read
app.get('/events/:name', async (req, res) => {
    const { name } = req.params;
    if (!buckets[name]) return res.status(404).json({ ok: false, error: 'unknown event' });

    const minConf = Number(req.query.minConfirmations ?? MIN_CONFIRMATIONS);
    const limit = Number(req.query.limit ?? 500);
    const tip = await http.getBlockNumber();

    const rows = lastNByName.all({ name, limit });
    const filtered = rows.filter(r => !r.removed && tip - r.blockNumber >= minConf);
    const out = filtered.map(r => ({ ...r, args: JSON.parse(r.jsonArgs) }));

    res.json({ ok: true, tip, count: out.length, events: out });
});

// Per-event SSE
app.get('/events/:name/stream', (req, res) => {
    if (!buckets[req.params.name]) return res.status(404).end();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const write = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const client = { write, res };
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

// Backfill (on-demand)
app.post('/backfill', async (req, res) => {
    try {
        const { fromBlock, toBlock } = req.body ?? {};
        const tip = await http.getBlockNumber();
        const from = Number(fromBlock ?? BACKFILL_FROM);
        const to = Number(toBlock ?? tip);
        const got = await backfill(from, to);
        res.json({ ok: true, from, to, fetched: got });
    } catch (err) {
        log.error(err, 'backfill error');
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Start server
app.listen(Number(PORT), () => log.info({ PORT }, 'listening'));

// --------------------
// Live subscriptions
// --------------------
function onEvt(name, parsed, evLog) {
    const packed = {
        name,
        args: Object.fromEntries(parsed.fragment.inputs.map((i, idx) => [i.name || `arg${idx}`, parsed.args[idx]])),
        txHash: evLog.transactionHash,
        blockNumber: Number(evLog.blockNumber),
        logIndex: Number(evLog.index),
        removed: Boolean(evLog.removed),
        ts: Date.now(),
    };

    // persist
    try {
        insertEvt.run({
            name,
            txHash: packed.txHash,
            blockNumber: packed.blockNumber,
            logIndex: packed.logIndex,
            removed: packed.removed ? 1 : 0,
            ts: packed.ts,
            jsonArgs: JSON.stringify(packed.args),
        });
    } catch {}

    // memory + broadcast
    pushEvent(packed);
    pushBucket(name, packed);
    broadcast({ type: 'event', ...packed });
    log.info({ evt: name, block: packed.blockNumber, tx: packed.txHash }, 'event');
}

// subscribe to the five events explicitly (typed args + metadata)
// ethers v6 contract event listeners docs. :contentReference[oaicite:5]{index=5}
for (const name of Object.keys(EVENTS)) {
    contractSub.on(name, (...args) => {
        const payload = args.at(-1); // EventPayload
        const evLog = payload.log;   // EventLog
        const parsed = contractHttp.interface.parseLog(evLog);
        onEvt(name, parsed, evLog);
    });
}

// Optional: handle WSS drops (reconnect)
if (wss && wss._websocket) {
    wss._websocket.on('close', (code) => {
        log.warn({ code }, 'ws closed');
    });
    wss._websocket.on('error', (err) => log.error({ err }, 'ws error'));
}

// --------------------
// Historical backfill
// --------------------
// use provider.getLogs(address + topic) in block chunks.
const BATCH = 5000;

async function backfill(fromBlock, toBlock) {
    let fetched = 0;
    const start = Math.max(0, Number(fromBlock));
    const end = Number(toBlock);

    for (let from = start; from <= end; ) {
        const to = Math.min(end, from + BATCH);

        for (const [name, topic0] of Object.entries(topics)) {
            const logs = await http.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: from,
                toBlock: to,
                topics: [topic0],
            });

            for (const l of logs) {
                const parsed = contractHttp.interface.parseLog(l);
                onEvt(name, parsed, l);
                fetched++;
            }
        }
        log.info({ from, to, fetched }, 'backfill window');
        from = to + 1;
    }
    return fetched;
}

// Kick off initial backfill from BACKFILL_FROM to tip
(async () => {
    const tipNow = await http.getBlockNumber();                 // number (ethers v6)
    const CONFIRM_BUFFER = BigInt(process.env.MIN_CONFIRMATIONS ?? '3'); // bigint

    // Make both sides bigint, then convert back to number for backfill()
    const tipBig = BigInt(tipNow) - CONFIRM_BUFFER;             // bigint - bigint OK
    const tip = Number(tipBig);                                 // back to number

    const from = Number(BACKFILL_FROM);
    await backfill(from, tip);
})();
