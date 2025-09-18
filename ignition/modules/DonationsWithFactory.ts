import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DonationsWithFactoryModule = buildModule("DonationsWithFactoryModule", (m) => {
    // Parameters for the campaign to create via the factory
    const name         = m.getParameter<string>("name", "Community Playground");
    const orgName      = m.getParameter<string>("orgName", "Friends of Aguada");
    const description  = m.getParameter<string>("description", "Build a local playground");
    const goal         = m.getParameter<bigint>("goal", 10n ** 18n); // 1 ETH
    const durationDays = m.getParameter<number>("durationDays", 30);

    // 1) Deploy the factory
    const factory = m.contract("DonationsFactory", []);

    // 2) Immediately call the factory to create a campaign
    //    (the new campaign address is not directly capturable here)
    m.call(factory, "create", [name, orgName, description, goal, durationDays]);

    return { factory };
});

export default DonationsWithFactoryModule;
