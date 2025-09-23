// simple-listener.js

import 'dotenv/config';
import fs from 'node:fs';
import { ethers } from 'ethers';

// load config from .env
const {
    ETH_WS,
    CONTRACT_ADDRESS
} = process.env;

if (!ETH_WS || !CONTRACT_ADDRESS) {
    console.error('Please set ETH_WS and CONTRACT_ADDRESS in .env');
    process.exit(1);
}

// load ABI; make sure path is correct
const artifact = JSON.parse(
    fs.readFileSync('../artifacts/contracts/Donations.sol/Donations.json', 'utf8')
);
const ABI = artifact.abi;

// WebSocket provider via ethers v6
const provider = new ethers.WebSocketProvider(ETH_WS);

// contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// list of events to listen to (exact names from Donations.sol)
const events = [
    'Donated',
    'Refunded',
    'Withdrawn',
    'StateChanged',
    'DeadlineExtended'
];

// register listeners
for (const ev of events) {
    contract.on(ev, (...args) => {
        // event object is last argument
        const eventPayload = args[args.length - 1];
        console.log(`\n=== Event: ${ev} ===`);
        console.log('Args:', args.slice(0, -1));
        console.log('Block:', eventPayload.log.blockNumber);
        console.log('TxHash:', eventPayload.log.transactionHash);
    });
}

console.log('Listening for Donations.sol events...');
