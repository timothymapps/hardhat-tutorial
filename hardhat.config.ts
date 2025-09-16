import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";


const INFURA_API_KEY = process.env.INFURA_API_KEY;

const config: HardhatUserConfig = {
    solidity: "0.8.28",

    networks: {
        localhost: {
            url: "http://127.0.0.1:8545"
            // accounts: provided by the local node, no need to define
        },
        //     hardhat: {
        //         forking: {
        //             url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
        //         }
        //     }
    }
};

export default config;

