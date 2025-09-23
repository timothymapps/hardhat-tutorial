import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DonationsFactoryModule = buildModule("DonationsFactoryModule", (m) => {
    const factory = m.contract("DonationsFactory", []); // no constructor args
    return { factory };
});

export default DonationsFactoryModule;
