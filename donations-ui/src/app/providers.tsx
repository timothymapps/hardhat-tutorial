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
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

const chains = [chainId === 1 ? mainnet : sepolia] as const;

const config = getDefaultConfig({
    appName: 'Donations dApp',
    projectId,
    chains,
    transports: {
        [chains[0].id]: http(), // use default public RPC; swap to your own if needed
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
