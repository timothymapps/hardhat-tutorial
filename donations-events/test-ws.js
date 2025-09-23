// test-ws.js  (ESM because package.json sets "type": "module")
import { ethers } from 'ethers';

const url = process.env.ETH_WS;
if (!url) throw new Error('Set ETH_WS in .env');
const provider = new ethers.WebSocketProvider(url);

const n = await provider.getBlockNumber();
console.log('WS ok. Tip:', n);
process.exit(0);
