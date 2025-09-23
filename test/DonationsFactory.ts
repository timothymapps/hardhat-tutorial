import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const ONE_DAY: bigint = 24n * 60n * 60n;

async function deployFactoryFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const DonationsFactory = await ethers.getContractFactory("DonationsFactory", deployer);
    const factory = await DonationsFactory.deploy();
    await factory.waitForDeployment();

    return { deployer, alice, bob, factory };
}

async function getBlockTimestampFromTx(tx: any): Promise<bigint> {
    const rc = await tx.wait();
    const block = await ethers.provider.getBlock(rc!.blockNumber);
    return BigInt(block!.timestamp);
}

describe("DonationsFactory (creation & registry only)", function () {
    describe("createCampaign", function () {
        it("creates a campaign, registers it, and emits CampaignCreated", async function () {
            const { factory, alice } = await loadFixture(deployFactoryFixture);

            const name = "Save The Turtles";
            const orgName = "Ocean Org";
            const description = "Raise funds for turtle conservation.";
            const goal = ethers.parseEther("10"); // bigint
            const durationDays = 30; // uint16

            const tx = await factory.connect(alice).createCampaign(
                name,
                orgName,
                description,
                goal,
                durationDays
            );

            await expect(tx)
                .to.emit(factory, "CampaignCreated")
                .withArgs(
                    alice.address,
                    anyValue,      // deployed campaign
                    name,
                    orgName,
                    description,
                    goal,
                    durationDays,
                    anyValue       // expectedDeadline
                );

            // parse event to get the actual campaign address
            const rc = await tx.wait();
            const parsed = rc!.logs
                .map((l) => {
                    try {
                        return factory.interface.parseLog(l);
                    } catch {
                        return undefined;
                    }
                })
                .filter(Boolean)
                .find((p: any) => p!.name === "CampaignCreated") as any;

            const campaignAddr: string = parsed!.args.campaign;
            expect(campaignAddr).to.properAddress;

            // registry checks
            expect(await factory.isRegisteredCampaign(campaignAddr)).to.eq(true);

            const all = await factory.getAllCampaigns();
            expect(all).to.have.length(1);
            expect(all[0]).to.eq(campaignAddr);

            const byOwner = await factory.getOwnerCampaigns(alice.address);
            expect(byOwner).to.have.length(1);
            expect(byOwner[0]).to.eq(campaignAddr);

            // deadline sanity from Donations instance
            const donations = await ethers.getContractAt("Donations", campaignAddr);
            const onChainDeadline: bigint = await donations.deadline();

            const blockTs = await getBlockTimestampFromTx(tx);
            const expected = blockTs + BigInt(durationDays) * ONE_DAY;

            // allow small tolerance around expected (±5 minutes)
            const lower = expected - 5n * 60n;
            const upper = expected + 5n * 60n;
            expect(onChainDeadline).to.be.gte(lower);
            expect(onChainDeadline).to.be.lte(upper);
        });
    });

    describe("registry views", function () {
        it("tracks multiple campaigns per owner and overall", async function () {
            const { factory, alice, bob } = await loadFixture(deployFactoryFixture);

            // Alice creates two
            const tx1 = await factory.connect(alice).createCampaign(
                "A1",
                "OrgA",
                "DescA1",
                ethers.parseEther("1"),
                3
            );
            const tx2 = await factory.connect(alice).createCampaign(
                "A2",
                "OrgA",
                "DescA2",
                ethers.parseEther("2"),
                4
            );
            await tx1.wait();
            await tx2.wait();

            // Bob creates one
            const tx3 = await factory.connect(bob).createCampaign(
                "B1",
                "OrgB",
                "DescB1",
                ethers.parseEther("3"),
                5
            );
            await tx3.wait();

            // counts
            const all = await factory.getAllCampaigns();
            expect(all.length).to.eq(3);

            const aliceList = await factory.getOwnerCampaigns(alice.address);
            const bobList = await factory.getOwnerCampaigns(bob.address);
            expect(aliceList.length).to.eq(2);
            expect(bobList.length).to.eq(1);

            const allCount = await factory.campaignsCount();
            const aliceCount = await factory.ownerCampaignsCount(alice.address);
            const bobCount = await factory.ownerCampaignsCount(bob.address);

            expect(allCount).to.eq(3n);
            expect(aliceCount).to.eq(2n);
            expect(bobCount).to.eq(1n);

            // membership flags
            for (const addr of all) {
                expect(await factory.isRegisteredCampaign(addr)).to.eq(true);
            }
        });
    });

    describe("deadline math bounds", function () {
        it("deadline ~= block.timestamp + durationDays * 1 day", async function () {
            const { factory, alice } = await loadFixture(deployFactoryFixture);

            const durationDays = 2;
            const tx = await factory.connect(alice).createCampaign(
                "Tight Window",
                "Org",
                "Test",
                ethers.parseEther("0.5"),
                durationDays
            );

            const rc = await tx.wait();
            const evt = rc!.logs
                .map((l) => {
                    try {
                        return factory.interface.parseLog(l);
                    } catch {
                        return undefined;
                    }
                })
                .filter(Boolean)
                .find((p: any) => p!.name === "CampaignCreated") as any;

            const campaignAddr: string = evt!.args.campaign;
            const donations = await ethers.getContractAt("Donations", campaignAddr);
            const deadline: bigint = await donations.deadline();

            const blockTs = await getBlockTimestampFromTx(tx);
            const expected = blockTs + BigInt(durationDays) * ONE_DAY;

            const lower = expected - 5n * 60n;
            const upper = expected + 5n * 60n;
            expect(deadline).to.be.gte(lower);
            expect(deadline).to.be.lte(upper);
        });
    });
});
