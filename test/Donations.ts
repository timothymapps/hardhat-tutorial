import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Donations", () => {
    async function deployFixture() {
        const [owner, alice, bob, other] = await ethers.getSigners();

        const name = "Save The Turtles";
        const orgName = "Ocean Org";
        const description = "Help us clean beaches.";
        const goal = ethers.parseEther("10"); // bigint in ethers v6
        const durationDays = 7;

        const Donations = await ethers.getContractFactory("Donations");
        const donations = await Donations.deploy(
            name,
            orgName,
            description,
            goal,                // uint256 in contract; ethers v6 passes bigint
            durationDays,        // uint16 in contract ctor
            owner.address
        );
        await donations.waitForDeployment();

        return { donations, owner, alice, bob, other, goal, durationDays };
    }

    it("deploys with correct initial state", async () => {
        const { donations, goal, durationDays } = await loadFixture(deployFixture);


        expect(await donations.name()).to.equal("Save The Turtles");
        expect(await donations.orgName()).to.equal("Ocean Org");
        expect(await donations.description()).to.equal("Help us clean beaches.");
        expect(await donations.goal()).to.equal(goal);
        expect(await donations.totalRaised()).to.equal(0n);

        const nowNum = await time.latest();               // number (per docs)
        const now = BigInt(nowNum);                       // convert → bigint
        const deadline = BigInt(await donations.deadline()); // ABI returns numeric; normalize → bigint

        // deadline ≈ now + durationDays * 1 day (loose lower bound)
        const oneDay = 24n * 60n * 60n;
        const expectedMin = now + BigInt(durationDays - 1) * oneDay;
        expect(deadline).to.be.gte(expectedMin);

        // state 0 = Active
        expect(await donations.state()).to.equal(0);
        expect(await donations.getCampaignStatus()).to.equal(0);
    });

    it("reverts donate() with ZeroAmount", async () => {
        const { donations, alice } = await loadFixture(deployFixture);
        await expect(donations.connect(alice).donate({ value: 0n }))
            .to.be.revertedWithCustomError(donations, "ZeroAmount");
    });

    it("accepts donations, updates totals, and emits Donated", async () => {
        const { donations, alice } = await loadFixture(deployFixture);

        const amount = ethers.parseEther("1"); // bigint
        await expect(donations.connect(alice).donate({ value: amount }))
            .to.emit(donations, "Donated")
            .withArgs(alice.address, amount);

        expect(await donations.contributions(alice.address)).to.equal(amount);
        expect(await donations.totalRaised()).to.equal(amount);
        expect(await donations.getBalance()).to.equal(amount);
    });

    it("owner can pause/unpause; donate reverts while paused with EnforcedPause()", async () => {
        const { donations, owner, alice } = await loadFixture(deployFixture);

        // Non‑owner cannot pause
        await expect(donations.connect(alice).pause())
            .to.be.revertedWithCustomError(donations, "OwnableUnauthorizedAccount")
            .withArgs(alice.address);

        await donations.connect(owner).pause();

        // OZ v5 Pausable uses custom error `EnforcedPause()`
        await expect(
            donations.connect(alice).donate({ value: ethers.parseEther("1") })
        ).to.be.revertedWithCustomError(donations, "EnforcedPause"); // whenNotPaused check
        // (OZ Pausable custom errors are documented in v5 utils.) :contentReference[oaicite:1]{index=1}

        await donations.connect(owner).unpause();

        await expect(
            donations.connect(alice).donate({ value: ethers.parseEther("0.5") })
        ).to.emit(donations, "Donated");
    });

    it("becomes Successful immediately when goal is reached", async () => {
        const { donations, alice } = await loadFixture(deployFixture);

        await donations.connect(alice).donate({ value: ethers.parseEther("10") });

        expect(await donations.getCampaignStatus()).to.equal(1); // Successful
        expect(await donations.state()).to.equal(1);
    });

    it("owner can withdraw only when Successful", async () => {
        const { donations, owner, alice, other } = await loadFixture(deployFixture);

        // Reach goal
        await donations.connect(alice).donate({ value: ethers.parseEther("10") });
        expect(await donations.getCampaignStatus()).to.equal(1);

        // Non‑owner blocked
        await expect(donations.connect(other).withdraw(other.address))
            .to.be.revertedWithCustomError(donations, "OwnableUnauthorizedAccount")
            .withArgs(other.address);


        const contractBalBefore = await donations.getBalance();
        expect(contractBalBefore).to.equal(ethers.parseEther("10"));

        const tx = await donations.connect(owner).withdraw(owner.address);
        await expect(tx)
            .to.emit(donations, "Withdrawn")
            .withArgs(owner.address, contractBalBefore);

        expect(await donations.getBalance()).to.equal(0n);
    });

    it("after deadline, becomes Failed if goal not met and donors can refund()", async () => {
        const { donations, alice, bob } = await loadFixture(deployFixture);

        const a = ethers.parseEther("2");
        const b = ethers.parseEther("3");
        await donations.connect(alice).donate({ value: a });
        await donations.connect(bob).donate({ value: b });

        // Jump to just after deadline
        const deadline = BigInt(await donations.deadline());
        await time.increaseTo(Number(deadline + 1n)); // helper expects number; convert back safely. :contentReference[oaicite:2]{index=2}

        // Status should be Failed (2)
        expect(await donations.getCampaignStatus()).to.equal(2);

        // Each donor refunds exactly what they contributed
        await expect(donations.connect(alice).refund())
            .to.emit(donations, "Refunded")
            .withArgs(alice.address, a);

        await expect(donations.connect(bob).refund())
            .to.emit(donations, "Refunded")
            .withArgs(bob.address, b);

        expect(await donations.contributions(alice.address)).to.equal(0n);
        expect(await donations.contributions(bob.address)).to.equal(0n);
    });

    it("refund() reverts when not Failed and when contribution is zero", async () => {
        const { donations, alice } = await loadFixture(deployFixture);

        // No contribution -> NotRefundable
        await expect(donations.connect(alice).refund())
            .to.be.revertedWithCustomError(donations, "NotRefundable");

        // Contribute (still Active) -> NotRefundable
        await donations.connect(alice).donate({ value: ethers.parseEther("1") });
        await expect(donations.connect(alice).refund())
            .to.be.revertedWithCustomError(donations, "NotRefundable");
    });

    it("withdraw() reverts when not Successful", async () => {
        const { donations, owner, alice } = await loadFixture(deployFixture);

        await donations.connect(alice).donate({ value: ethers.parseEther("1") });
        await expect(donations.connect(owner).withdraw(owner.address))
            .to.be.revertedWithCustomError(donations, "CampaignNotFinished");

        // Move past deadline (still below goal -> Failed)
        const deadline = BigInt(await donations.deadline());
        await time.increaseTo(Number(deadline + 1n));
        await expect(donations.connect(owner).withdraw(owner.address))
            .to.be.revertedWithCustomError(donations, "CampaignNotFinished");
    });

    it("extendDeadline only owner, only while Active & before deadline; emits event", async () => {
        const { donations, owner, alice } = await loadFixture(deployFixture);

        await expect(donations.connect(alice).extendDeadline(3))
            .to.be.revertedWithCustomError(donations, "OwnableUnauthorizedAccount")
            .withArgs(alice.address);

        const oldDeadline = BigInt(await donations.deadline());
        await expect(donations.connect(owner).extendDeadline(3))
            .to.emit(donations, "DeadlineExtended");
        const newDeadline = BigInt(await donations.deadline());
        const oneDay = 24n * 60n * 60n;
        expect(newDeadline).to.equal(oldDeadline + 3n * oneDay);

        // Move past new deadline; extending should revert with CampaignNotActive
        await time.increaseTo(Number(newDeadline + 1n));
        await expect(donations.connect(owner).extendDeadline(1))
            .to.be.revertedWithCustomError(donations, "CampaignNotActive");
    });

    it("receive/fallback revert when sending Ether directly", async () => {
        const { donations, alice } = await loadFixture(deployFixture);
        await expect(
            alice.sendTransaction({ to: await donations.getAddress(), value: ethers.parseEther("1") })
        ).to.be.revertedWith("Use donate()");
    });

    it("state cache updates after goal is reached", async () => {
        const { donations, alice } = await loadFixture(deployFixture);
        expect(await donations.state()).to.equal(0); // Active
        await donations.connect(alice).donate({ value: ethers.parseEther("10") });
        expect(await donations.state()).to.equal(1); // Successful
        expect(await donations.getCampaignStatus()).to.equal(1);
    });
});
