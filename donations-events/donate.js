// donate.js (ESM; your package.json has "type": "module")
import 'dotenv/config';
import { ethers } from 'ethers';
import artifact from '../artifacts/contracts/Donations.sol/Donations.json' with { type: 'json' };

const RPC = process.env.ETH_HTTP;                  // e.g. https://sepolia.infura.io/v3/...
const CONTRACT = process.env.CONTRACT_ADDRESS;     // 0xd165c...
const RAW_PK = process.env.SEPOLIA_PRIVATE_KEY;    // raw hex private key (no quotes)

if (!RPC || !CONTRACT) {
    throw new Error('Missing ETH_HTTP or CONTRACT_ADDRESS in .env');
}
if (!RAW_PK) {
    throw new Error('Missing SEPOLIA_PRIVATE_KEY in .env');
}

// ---- sanitize & validate private key
let pk = RAW_PK.trim()
    // strip accidental surrounding quotes
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '');
// add 0x if missing
if (!pk.startsWith('0x')) pk = '0x' + pk;
// validate: 0x + 64 hex
if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error(
        `SEPOLIA_PRIVATE_KEY has invalid format. Expected 0x + 64 hex chars; got length=${pk.length}.`
    );
}

// ---- wire up ethers v6
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(pk, provider); // will still throw if truly invalid per ethers
const contract = new ethers.Contract(CONTRACT, artifact.abi, wallet);

// ---- send donate()
const value = ethers.parseEther('0.01');
console.log('From:', await wallet.getAddress());
console.log('Sending donate() with value', value.toString(), 'wei…');

const tx = await contract.donate({ value });
console.log('tx hash:', tx.hash);

const rcpt = await tx.wait();
console.log('mined in block:', rcpt.blockNumber);

process.exit(0);
