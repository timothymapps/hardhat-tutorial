'use client';

import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseUnits, zeroAddress } from 'viem';
import { AAVE_POOL_ABI, AAVE_POOL_ADDRESS_SEPOLIA, ERC20_ABI } from '../../../lib/aave';

const POOL = AAVE_POOL_ADDRESS_SEPOLIA; // Sepolia Pool (verified)

export default function AavePage() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync, data: pendingTx, isPending } = useWriteContract();
    const tx = useWaitForTransactionReceipt({ hash: pendingTx });

    // Simple form state
    const [asset, setAsset] = useState<`0x${string}` | undefined>(undefined);         // ERC-20 token address (e.g., WETH on Sepolia)
    const [decimals, setDecimals] = useState<number>(18);   // cache once fetched
    const [symbol, setSymbol] = useState<string>('TOKEN');
    const [amount, setAmount] = useState<string>('0.1');    // human units

    // Read ERC-20 metadata and allowance/balance (lazy: only when asset changes)
    const allow = useReadContract({
        address: asset as `0x${string}` | undefined,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && asset ? [address, POOL] : undefined,
        query: { enabled: Boolean(isConnected && address && asset) },
    });

    const bal = useReadContract({
        address: asset as `0x${string}` | undefined,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address && asset ? [address] : undefined,
        query: { enabled: Boolean(isConnected && address && asset) },
    });

    const tokenDecimals = useReadContract({
        address: asset as `0x${string}` | undefined,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: Boolean(asset) },
    });

    const tokenSymbol = useReadContract({
        address: asset as `0x${string}` | undefined,
        abi: ERC20_ABI,
        functionName: 'symbol',
        query: { enabled: Boolean(asset) },
    });

    useMemo(() => {
        if (tokenDecimals.data !== undefined) setDecimals(Number(tokenDecimals.data));
        if (tokenSymbol.data) setSymbol(String(tokenSymbol.data));
    }, [tokenDecimals.data, tokenSymbol.data]);

    const allowance = BigInt(allow.data ?? 0n);
    const balance = BigInt(bal.data ?? 0n);

    // Helpers
    const parsed = useMemo(() => {
        try { return parseUnits(amount || '0', decimals); } catch { return 0n; }
    }, [amount, decimals]);

    const canSupply = isConnected && asset && parsed > 0n;
    const needsApprove = canSupply && allowance < parsed;

    async function approve() {
        if (!asset || parsed === 0n) return;
        await writeContractAsync({
            address: asset as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [POOL, parsed],
        });
    }

    async function supply() {
        if (!address || !asset || parsed === 0n) return;
        // supply(asset, amount, onBehalfOf, referralCode=0)
        await writeContractAsync({
            address: POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'supply',
            args: [asset, parsed, address, 0],
        });
    }

    async function withdraw() {
        if (!address || !asset || parsed === 0n) return;
        // withdraw(asset, amount, to)
        await writeContractAsync({
            address: POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'withdraw',
            args: [asset, parsed, address],
        });
    }

    async function borrowVariable() {
        if (!address || !asset || parsed === 0n) return;
        // borrow(asset, amount, interestRateMode=2, referralCode=0, onBehalfOf)
        await writeContractAsync({
            address: POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'borrow',
            args: [asset, parsed, 2n, 0, address],
        });
    }

    async function repayVariable() {
        if (!address || !asset || parsed === 0n) return;
        // repay(asset, amount, interestRateMode=2, onBehalfOf)
        await writeContractAsync({
            address: POOL,
            abi: AAVE_POOL_ABI,
            functionName: 'repay',
            args: [asset, parsed, 2n, address],
        });
    }

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Aave v3 — Pool (Sepolia)</h1>
                <ConnectButton />
            </header>

            <section className="rounded-2xl border border-zinc-800 p-6 space-y-3">
                <div className="text-sm text-zinc-400">
                    Pool: <span className="font-mono">{POOL}</span>
                </div>

                <label className="block">
                    <span className="text-sm text-zinc-400">Asset (ERC‑20 address)</span>
                    <input
                        className="mt-1 w-full rounded-lg bg-white border border-zinc-700 px-3 py-2"
                        placeholder="0x... (e.g., WETH on Sepolia)"
                        value={asset}
                        onChange={(e) => setAsset(e.target.value.trim())}
                    />
                </label>

                <label className="block">
                    <span className="text-sm text-zinc-400">Amount ({symbol})</span>
                    <input
                        className="mt-1 w-full rounded-lg bg-white border border-zinc-700 px-3 py-2"
                        placeholder="0.10"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </label>

                <div className="text-sm text-zinc-500">
                    Your balance: {balance > 0n ? `${formatEther(balance)} (wei scaled, decimals ${decimals})` : '—'}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        onClick={approve}
                        disabled={!needsApprove}
                        className="rounded-lg bg-zinc-700 px-4 py-2 disabled:opacity-50"
                    >
                        Approve {symbol} to Pool
                    </button>

                    <button
                        onClick={supply}
                        disabled={!canSupply || needsApprove}
                        className="rounded-lg bg-emerald-600 px-4 py-2 disabled:opacity-50"
                    >
                        Supply
                    </button>

                    <button
                        onClick={withdraw}
                        disabled={!isConnected || !asset || parsed === 0n}
                        className="rounded-lg bg-indigo-600 px-4 py-2 disabled:opacity-50"
                    >
                        Withdraw
                    </button>

                    <button
                        onClick={borrowVariable}
                        disabled={!isConnected || !asset || parsed === 0n}
                        className="rounded-lg bg-amber-600 px-4 py-2 disabled:opacity-50"
                    >
                        Borrow (variable)
                    </button>

                    <button
                        onClick={repayVariable}
                        disabled={!isConnected || !asset || parsed === 0n}
                        className="rounded-lg bg-pink-600 px-4 py-2 disabled:opacity-50"
                    >
                        Repay (variable)
                    </button>
                </div>

                {isPending && <div className="text-sm text-zinc-400">Submitting transaction…</div>}
                {tx.isLoading && <div className="text-sm text-zinc-400">Waiting for confirmation…</div>}
                {tx.isSuccess && <div className="text-sm text-emerald-400">Success: {tx.data?.transactionHash}</div>}
                {tx.isError && <div className="text-sm text-red-400">Tx failed</div>}

                <div className="text-xs text-zinc-500 pt-2">
                    Tips: For **supply**, the Pool must have allowance to spend your token (approve first), per Aave docs. Use referralCode **0**.
                    For **borrow/repay**, use **interestRateMode = 2** for variable rate. You can pass <code>2**256-1</code> (i.e., <code>MaxUint256</code>) to withdraw/repay all.
                </div>
            </section>
        </main>
    );
}
