// lib/aave.ts
export const AAVE_POOL_ADDRESS_SEPOLIA =
    "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951" as const;

// Only the functions we use (from Aave IPool).
// Source: Aave docs (Pool write methods & signatures).
export const AAVE_POOL_ABI = [
    // supply(asset, amount, onBehalfOf, referralCode)
    {
        type: "function",
        name: "supply",
        stateMutability: "nonpayable",
        inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "onBehalfOf", type: "address" },
            { name: "referralCode", type: "uint16" },
        ],
        outputs: [],
    },
    // withdraw(asset, amount, to) -> uint256
    {
        type: "function",
        name: "withdraw",
        stateMutability: "nonpayable",
        inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "to", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
    },
    // borrow(asset, amount, interestRateMode, referralCode, onBehalfOf)
    {
        type: "function",
        name: "borrow",
        stateMutability: "nonpayable",
        inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "interestRateMode", type: "uint256" }, // use 2 for variable
            { name: "referralCode", type: "uint16" },      // 0 while inactive
            { name: "onBehalfOf", type: "address" },
        ],
        outputs: [],
    },
    // repay(asset, amount, interestRateMode, onBehalfOf) -> uint256
    {
        type: "function",
        name: "repay",
        stateMutability: "nonpayable",
        inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "interestRateMode", type: "uint256" }, // 2 for variable
            { name: "onBehalfOf", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
    },
] as const;

// Tiny ERC-20 ABI (approve/allowance/decimals/symbol/balanceOf)
export const ERC20_ABI = [
    { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
            { name: "spender", type: "address" }, { name: "amount", type: "uint256" }
        ], outputs: [{ type: "bool" }] },
    { type: "function", name: "allowance", stateMutability: "view", inputs: [
            { name: "owner", type: "address" }, { name: "spender", type: "address" }
        ], outputs: [{ type: "uint256" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [
            { name: "account", type: "address" }
        ], outputs: [{ type: "uint256" }] },
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;
