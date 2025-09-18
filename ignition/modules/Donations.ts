import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DonationsDirectModule = buildModule("DonationsDirectModule", (m) => {
    // Parameters, override at deploy-time with --parameters
    const name         = m.getParameter<string>("name", "Community Playground");
    const orgName      = m.getParameter<string>("orgName", "Friends of Aguada");
    const description  = m.getParameter<string>("description", "Build a local playground");
    const goal         = m.getParameter<bigint>("goal", 10n ** 18n); // 1 ETH
    const durationDays = m.getParameter<number>("durationDays", 30);

    // Use the default deployer as the initial owner by default
    const initialOwner = m.getParameter<string>("initialOwner", String(m.getAccount(0)));

    const donations = m.contract("Donations", [
        name,
        orgName,
        description,
        goal,
        durationDays,
        initialOwner,
    ]);

    return { donations };
});

export default DonationsDirectModule;
