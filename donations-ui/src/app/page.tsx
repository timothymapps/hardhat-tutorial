'use client';

import {ConnectButton} from '@rainbow-me/rainbowkit';
import {useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt} from 'wagmi';
import {formatEther, parseEther} from 'viem';
import {DONATIONS_ADDRESS} from '../../lib/contract';
import {abi as DONATIONS_ABI} from '../../../artifacts/contracts/Donations.sol/Donations.json'
import {useEffect, useMemo, useState} from 'react';

function useDonationsReads() {
    const name = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'name'});
    const orgName = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'orgName'});
    const description = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'description'});
    const goal = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'goal'});
    const totalRaised = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'totalRaised'});
    const deadline = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'deadline'});
    const status = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'getCampaignStatus'});
    const owner = useReadContract({address: DONATIONS_ADDRESS, abi: DONATIONS_ABI, functionName: 'owner'});

    return {name, orgName, description, goal, totalRaised, deadline, status, owner};
}

export default function Home() {
    const {address, isConnected} = useAccount();
    const {name, orgName, description, goal, totalRaised, deadline, status, owner} = useDonationsReads();
    console.log(
        {name, orgName, description, goal, totalRaised, deadline, status, owner}
    )

    const [amount, setAmount] = useState<string>('0.1');
    const {writeContractAsync, data: txHash, isPending} = useWriteContract();
    const tx = useWaitForTransactionReceipt({hash: txHash});

    const isOwner = useMemo(() => {
        if (!owner.data || !address) return false;
        return String(owner.data).toLowerCase() === address.toLowerCase();
    }, [owner.data, address]);


    const progress = useMemo(() => {
        try {
            // @ts-ignore
            const g = BigInt(goal.data ?? 0n);
            // @ts-ignore
            const r = BigInt(totalRaised.data ?? 0n);
            // @ts-ignore
            if (g === 0n) return 0;
            // @ts-ignore
            return Math.min(100, Number((r * 100n) / g));
        } catch {
            return 0;
        }
    }, [goal.data, totalRaised.data]);

    const deadlineDate = useMemo(() => {
        // @ts-ignore
        const d = BigInt(deadline.data ?? 0n);
        // @ts-ignore
        if (d === 0n) return '—';
        return new Date(Number(d) * 1000).toLocaleString();
    }, [deadline.data]);

    const statusLabel = useMemo(() => {
        const s = Number(status.data ?? 0);
        return s === 0 ? 'Active' : s === 1 ? 'Successful' : 'Failed';
    }, [status.data]);

    async function donate() {
        const value = parseEther(amount || '0');
        // wagmi v2 write to payable function; value passed here
        // (useWriteContract docs) :contentReference[oaicite:6]{index=6}
        await writeContractAsync({
            address: DONATIONS_ADDRESS,
            abi: DONATIONS_ABI,
            functionName: 'donate',
            value,
        });
    }

    async function refund() {
        await writeContractAsync({
            address: DONATIONS_ADDRESS,
            abi: DONATIONS_ABI,
            functionName: 'refund',
        });
    }

    async function withdraw() {
        if (!isOwner) return;
        await writeContractAsync({
            address: DONATIONS_ADDRESS,
            abi: DONATIONS_ABI,
            functionName: 'withdraw',
            args: [address!],
        });
    }

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Donations</h1>
                <ConnectButton/>
            </header>

            <section className="rounded-2xl border border-zinc-800 p-6 space-y-4">
                <h2 className="text-xl font-medium">{name.data as string ?? '...'}</h2>
                <p className="text-sm text-zinc-400">{orgName.data as string ?? '...'}</p>
                <p className="text-zinc-200">{description.data as string ?? '...'}</p>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                        <div className="text-sm text-zinc-400">Goal</div>
                        <div className="text-lg">{goal.data ? `${formatEther(goal.data as bigint)} ETH` : '...'}</div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-400">Raised</div>
                        <div
                            className="text-lg">{totalRaised.data ? `${formatEther(totalRaised.data as bigint)} ETH` : '...'}</div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-400">Deadline</div>
                        <div className="text-lg">{deadlineDate}</div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-400">Status</div>
                        <div className="text-lg">{statusLabel}</div>
                    </div>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                        className="bg-emerald-500 h-2 transition-all"
                        style={{width: `${progress}%`}}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 p-6 space-y-3">
                <h3 className="font-medium">Donate</h3>
                <div className="flex gap-3">
                    <input
                        className="flex-1 rounded-lg bg-white border border-zinc-700 px-3 py-2 outline-none"
                        placeholder="0.10"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <button
                        onClick={donate}
                        disabled={!isConnected || isPending}
                        className="rounded-lg bg-emerald-600 px-4 py-2 disabled:opacity-50"
                    >
                        {isPending ? 'Sending…' : 'Donate ETH'}
                    </button>
                </div>
                {tx.isLoading && <div className="text-sm text-zinc-400">Waiting for confirmation…</div>}
                {tx.isSuccess && <div className="text-sm text-emerald-400">Success: {tx.data?.transactionHash}</div>}
                {tx.isError && <div className="text-sm text-red-400">Tx failed</div>}
            </section>

            <section className="rounded-2xl border border-zinc-800 p-6 space-y-3">
                <h3 className="font-medium">Actions</h3>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={refund}
                        disabled={!isConnected || statusLabel !== 'Failed'}
                        className="rounded-lg bg-zinc-700 px-4 py-2 disabled:opacity-50"
                    >
                        Refund (Failed only)
                    </button>

                    <button
                        onClick={withdraw}
                        disabled={!isConnected || !isOwner || statusLabel !== 'Successful'}
                        className="rounded-lg bg-indigo-600 px-4 py-2 disabled:opacity-50"
                    >
                        Owner Withdraw (Successful only)
                    </button>
                </div>
                <div className="text-xs text-zinc-500">
                    Connected: {address ?? '—'} {isOwner && '(owner)'}
                </div>
            </section>
        </main>
    );
}
