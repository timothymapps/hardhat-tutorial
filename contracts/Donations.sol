// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Donations is Ownable {
    string public name; // Name of the donation campaign
    string public org_name; // Name of the organization of the campaign
    string public description; // Description of the donation campaign
    uint32 public goal; // Goal(monetary) of the campaign
    uint16 public deadline; // Deadline of the campaign

    enum CampaignState { Active, Paused, Successful, Failed }
    CampaignState public state;

    struct Tier {
        string name;
        string description;
        uint256 amount;
        uint256 donators;
    }

    struct Donator {
        uint256 totalContribution;
        mapping(uint256 => bool) fundedTiers;
    }

    Tier[] public tiers;
    mapping(address => Donator) public donators;

    modifier campaignOpen() {
        require(state == CampaignState.Active, "Campaign is not active.");
        _;
    }

    modifier notPaused() {
        require(!state == CampaignState.Paused, "Campaign is paused.");
        _;
    }

    constructor(
        string memory _name,
        string memory _org_name,
        string memory _description,
        uint32 _goal,
        uint16 _duration_in_days,
        address initialOwner
    ) Ownable(initialOwner) {
        name = _name;
        org_name = _org_name;
        description = _description;
        goal = _goal;
        deadline = block.timestamp + (_duration_in_days * 1 days);
        state = CampaignState.Active;
    }

    function checkAndUpdateCampaignState() internal {
        if(state == CampaignState.Active){
            if(block.timestamp >= deadline){
                state = address(this).balance >= goal ? CampaignState.Successful : CampaignState.Failed;
            } else {
                state = address(this).balance >= goal ? CampaignState.Successful : CampaignState.Active;
            }
        }
    }

    function fund(uint256 _tier_index) public payable campaignOpen notPaused {
        require(_tier_index < tiers.length, "Invalid tier.");
        require(msg.value == tiers[_tier_index].amount, "Incorrect amount.");

        tiers[_tier_index].donators++;
        donators[msg.sender].totalContribution += msg.value;
        donators[msg.sender].fundedTiers[_tier_index] = true;

        checkAndUpdateCampaignState();
    }

    function withdraw() public onlyOwner {
        checkAndUpdateCampaignState();
        require(state == CampaignState.Successful || state == CampaignState.Failed, "Campaign not successful or not over yet.");

        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw.");

        payable(owner).transfer(balance);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function addTier(string memory _name, string memory _description, uint256 _amount) public onlyOwner {
        require(_amount > 0, "Amount must be greater than 0.");

        tiers.push(Tier(_name, _description, _amount, 0));
    }

    function removeTier(uint256 _index) public onlyOwner {
        require(_index < tiers.length, "Tier does not exist.");

        tiers[_index] = tiers[tiers.length -1];
        tiers.pop();
    }

    function getTiers() public view returns (Tier[] memory) {
        return tiers;
    }

    function hasFundedTier(address _donator, uint256 _tier_index) public view returns (bool) {
        return donators[_donator].fundedTiers[_tier_index];
    }

    function togglePause() public onlyOwner {
        if(state == CampaignState.Paused) {
            state = CampaignState.Active;
        }
        if(state == CampaignState.Active) {
            state = CampaignState.Paused;
        }
    }

    function getCampaignStatus() public view returns (CampaignState) {
        if(state == CampaignState.Active && block.timestamp > deadline){
            return address(this).balance >= goal ? CampaignState.Successful : CampaignState.Failed;
        }
        return state;
    }

    function extendDeadline(uint256 _days_to_add) public onlyOwner campaignOpen {
        deadline += _days_to_add * 1 days;
    }
}