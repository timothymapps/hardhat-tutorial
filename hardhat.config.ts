import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";


const INFURA_API_KEY = process.env.INFURA_API_KEY;

const config: HardhatUserConfig = {
    solidity: "0.8.28",

    // networks: {
    //     hardhat: {
    //         forking: {
    //             url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    //         }
    //     }
    // }
};

export default config;
