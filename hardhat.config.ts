import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY as string;

const config: HardhatUserConfig = {
    solidity: "0.8.28",

    networks: {
        // localhost: {
        //     url: "http://127.0.0.1:8545"
        //     // accounts: provided by the local node, no need to define
        // },
        sepolia: {
            chainId: 11155111,
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
        },
        // hardhat: {
        //     forking: {
        //         url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
        //     }
        // }
    },
    ignition: {
        // @ts-ignore
        strategyConfig: {
            create2: {
                salt: "0x0000000000000000000000000000000000000000000000000000000000000001"
            }
        }
    },
};

export default config;

