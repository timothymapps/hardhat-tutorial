'use client';

import {ReactNode} from 'react';
import {
    RainbowKitProvider,
    getDefaultConfig,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {WagmiProvider, http} from 'wagmi';
import {mainnet, sepolia} from 'wagmi/chains';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);

const chains = [mainnet, sepolia] as const;

const MAINNET_RPC = process.env.NEXT_PUBLIC_MAINNET_RPC;
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC;

const config = getDefaultConfig({
    appName: 'Donations dApp',
    projectId,
    chains,
    transports: {
        [mainnet.id]: http(MAINNET_RPC),   // ← your Infura MAINNET RPC
        [sepolia.id]: http(SEPOLIA_RPC),   // ← optional (falls back to public if removed)
    },
    ssr: true,
});

const queryClient = new QueryClient();

export default function Providers({children}: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme()}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
