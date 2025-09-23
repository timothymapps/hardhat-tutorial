'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useWatchContractEvent } from 'wagmi';
import type { Address } from 'viem';

// ---- Aave v3 Pool events we care about ----
// (Minimal ABI: only event fragments)
const AAVE_POOL_EVENTS_ABI = [
    {
        type: 'event',
        name: 'Supply',
        inputs: [
            { indexed: true, name: 'reserve', type: 'address' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'onBehalfOf', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: false, name: 'referralCode', type: 'uint16' },
        ],
    },
    {
        type: 'event',
        name: 'Withdraw',
        inputs: [
            { indexed: true, name: 'reserve', type: 'address' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'to', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
        ],
    },
    {
        type: 'event',
        name: 'Borrow',
        inputs: [
            { indexed: true, name: 'reserve', type: 'address' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'onBehalfOf', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: false, name: 'interestRateMode', type: 'uint8' }, // 1: stable, 2: variable
            { indexed: false, name: 'borrowRate', type: 'uint256' },
            { indexed: false, name: 'referralCode', type: 'uint16' },
        ],
    },
    {
        type: 'event',
        name: 'Repay',
        inputs: [
            { indexed: true, name: 'reserve', type: 'address' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'repayer', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
        ],
    },
] as const;

// ---- Mainnet Pool address ----
const AAVE_POOL_MAINNET: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

// format helper
const fmt = (n: bigint) => n.toString();

type FeedItem = {
    id: string;
    event: 'Supply' | 'Withdraw' | 'Borrow' | 'Repay';
    blockNumber: bigint;
    txHash: `0x${string}`;
    args: Record<string, unknown>;
    ts: number;
};

export default function AaveEventsPage() {
    const { isConnected } = useAccount();
    const pc = usePublicClient(); // uses your wagmi config (ensure mainnet is in chains)
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const seen = useRef<Set<string>>(new Set());
    const MAX_ROWS = 200;

    const push = (evt: FeedItem) => {
        const key = `${evt.blockNumber}:${evt.txHash}:${evt.event}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        setFeed((prev) => {
            const next = [evt, ...prev];
            if (next.length > MAX_ROWS) next.pop();
            return next;
        });
    };

    // Live watchers
    useWatchContractEvent({
        address: AAVE_POOL_MAINNET,
        abi: AAVE_POOL_EVENTS_ABI,
        eventName: 'Supply',
        onLogs: (logs) => {
            for (const l of logs) {
                push({
                    id: `${l.blockNumber}:${l.transactionHash}:Supply`,
                    event: 'Supply',
                    blockNumber: l.blockNumber!,
                    txHash: l.transactionHash!,
                    args: l.args as any,
                    ts: Date.now(),
                });
            }
        },
    });

    useWatchContractEvent({
        address: AAVE_POOL_MAINNET,
        abi: AAVE_POOL_EVENTS_ABI,
        eventName: 'Withdraw',
        onLogs: (logs) => {
            for (const l of logs) {
                push({
                    id: `${l.blockNumber}:${l.transactionHash}:Withdraw`,
                    event: 'Withdraw',
                    blockNumber: l.blockNumber!,
                    txHash: l.transactionHash!,
                    args: l.args as any,
                    ts: Date.now(),
                });
            }
        },
    });

    useWatchContractEvent({
        address: AAVE_POOL_MAINNET,
        abi: AAVE_POOL_EVENTS_ABI,
        eventName: 'Borrow',
        onLogs: (logs) => {
            for (const l of logs) {
                push({
                    id: `${l.blockNumber}:${l.transactionHash}:Borrow`,
                    event: 'Borrow',
                    blockNumber: l.blockNumber!,
                    txHash: l.transactionHash!,
                    args: l.args as any,
                    ts: Date.now(),
                });
            }
        },
    });

    useWatchContractEvent({
        address: AAVE_POOL_MAINNET,
        abi: AAVE_POOL_EVENTS_ABI,
        eventName: 'Repay',
        onLogs: (logs) => {
            for (const l of logs) {
                push({
                    id: `${l.blockNumber}:${l.transactionHash}:Repay`,
                    event: 'Repay',
                    blockNumber: l.blockNumber!,
                    txHash: l.transactionHash!,
                    args: l.args as any,
                    ts: Date.now(),
                });
            }
        },
    });

    // Tiny backfill (last ~500 blocks per event) so the page isn't empty
    useEffect(() => {
        if (!pc) return;
        let cancelled = false;
        (async () => {
            try {
                const tip = await pc.getBlockNumber();
                const fromBlock = tip > 500n ? tip - 500n : 0n;
                const names = ['Supply', 'Withdraw', 'Borrow', 'Repay'] as const;

                for (const n of names) {
                    const logs = await pc.getLogs({
                        address: AAVE_POOL_MAINNET,
                        event: { abi: AAVE_POOL_EVENTS_ABI, eventName: n },
                        fromBlock,
                        toBlock: tip,
                        chainId: 1, // mainnet
                    });
                    if (cancelled) return;
                    for (const l of logs) {
                        push({
                            id: `${l.blockNumber}:${l.transactionHash}:${n}`,
                            event: n,
                            blockNumber: l.blockNumber!,
                            txHash: l.transactionHash!,
                            args: l.args as any,
                            ts: Date.now(),
                        });
                    }
                }
            } catch {
                // ignore; best-effort
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pc]);

    // Simple “graph”: counts in the last 10 minutes
    const buckets = useMemo(() => {
        const now = Date.now();
        const within = feed.filter((x) => now - x.ts <= 10 * 60 * 1000);
        return within.reduce<Record<string, number>>((acc, x) => {
            acc[x.event] = (acc[x.event] ?? 0) + 1;
            return acc;
        }, {});
    }, [feed]);

    return (
        <main className="mx-auto max-w-5xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Aave v3 Pool — Events (Ethereum Mainnet)</h1>
                <ConnectButton />
            </header>

            <div className="rounded-2xl border border-zinc-800 p-4 text-sm text-zinc-500">
                <div>
                    Tracking <b>Pool</b> events on mainnet (supply / withdraw / borrow / repay). The Pool is Aave’s main user‑facing contract.
                </div>
                <div className="mt-1 font-mono text-[12px] break-all">
                    Address: {AAVE_POOL_MAINNET} (verified Pool V3).
                </div>
            </div>

            {/* Tiny counts “graph” */}
            <section className="rounded-2xl border border-zinc-800 p-4">
                <h2 className="font-medium mb-2">Last 10 minutes (event counts)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {['Supply', 'Withdraw', 'Borrow', 'Repay'].map((k) => (
                        <div key={k} className="rounded-xl border border-zinc-800 p-3">
                            <div className="text-zinc-400">{k}</div>
                            <div className="text-2xl font-semibold">{buckets[k] ?? 0}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Live feed */}
            <section className="rounded-2xl border border-zinc-800 p-4">
                <h2 className="font-medium mb-3">Live feed</h2>
                <div className="space-y-3">
                    {feed.length === 0 && (
                        <div className="text-sm text-zinc-500">
                            Waiting for events… trigger actions on Aave to see updates.
                        </div>
                    )}
                    {feed.map((e) => (
                        <div key={e.id} className="rounded-xl border border-zinc-800 p-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="font-medium">{e.event}</div>
                                <div className="text-zinc-500">
                                    block {e.blockNumber.toString()} · {e.txHash.slice(0, 10)}…{e.txHash.slice(-8)}
                                </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] font-mono">
                                {Object.entries(e.args).map(([k, v]) => (
                                    <div key={k} className="truncate">
                                        {k}: {typeof v === 'bigint' ? fmt(v) : String(v)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
