import { ethers } from "hardhat";

async function main() {
    // 1) Pick a salt (must be 32 bytes)
    const SALT = ethers.id("DonationsFund_Salt_1");
    if (ethers.dataLength(SALT) !== 32) throw new Error("salt must be 32 bytes");

    // 2) CreateX (the factory used by Ignition’s create2 strategy)
    // Canonical deployment address across many chains:
    const CREATEX = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed"; // createx.rocks
    // (For localhost, if you need to be 100% certain, read the factory
    // address from your Ignition artifacts after a run.)

    // 3) Build init code for your Donations constructor args
    const Donations = await ethers.getContractFactory("Donations");
    const encodedArgs = Donations.interface.encodeDeploy([
        "Scholarship Fund",
        "CS Dept",
        "Support student scholarships",
        BigInt("5000000000000000000"),
        45,
        "0x1234567890abcdef1234567890abcdef12345678",
    ]);
    const initCode  = ethers.concat([Donations.bytecode, encodedArgs]);
    const initHash  = ethers.keccak256(initCode);

    // 4) Standard CREATE2 formula
    const packed    = ethers.solidityPacked(
        ["bytes1", "address", "bytes32", "bytes32"],
        ["0xff", CREATEX, SALT, initHash]
    );
    const fullHash  = ethers.keccak256(packed);
    const predicted = "0x" + fullHash.slice(26);

    console.log("Predicted Donations address:", predicted);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
