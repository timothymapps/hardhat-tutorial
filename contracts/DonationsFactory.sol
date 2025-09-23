// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Donations.sol";

/**
 * @title DonationsFactory
 * @notice Deploys and indexes Donations campaigns.
 * - Tracks all deployed campaign addresses
 * - Tracks campaigns per owner (the owner is set to msg.sender on creation)
 */
contract DonationsFactory {
    /// @dev All campaigns ever created by this factory
    address[] private _allCampaigns;

    /// @dev Owner (creator) => list of their campaigns
    mapping(address => address[]) private _ownerCampaigns;

    /// @dev Quick membership check
    mapping(address => bool) public isRegisteredCampaign;

    event CampaignCreated(
        address indexed owner,
        address campaign,
        string name,
        string orgName,
        string description,
        uint256 goal,
        uint16 durationDays,
        uint256 expectedDeadline
    );

    /**
     * @notice Create a new Donations campaign owned by msg.sender.
     * @param _name         Human-readable campaign name
     * @param _orgName      Organization name
     * @param _description  Campaign description
     * @param _goal         Fundraising goal (wei)
     * @param _durationDays Campaign duration in days
     * @return campaign     Address of the deployed Donations contract
     */
    function createCampaign(
        string memory _name,
        string memory _orgName,
        string memory _description,
        uint256 _goal,
        uint16 _durationDays
    ) external returns (address campaign) {
        Donations d = new Donations(
            _name,
            _orgName,
            _description,
            _goal,
            _durationDays,
            msg.sender // initialOwner
        );

        campaign = address(d);
        _registerCampaign(msg.sender, campaign);

        uint256 expectedDeadline = block.timestamp + (uint256(_durationDays) * 1 days);

        emit CampaignCreated(
            msg.sender,
            campaign,
            _name,
            _orgName,
            _description,
            _goal,
            _durationDays,
            expectedDeadline
        );
    }

    // ----------------------------- Views -----------------------------

    function getAllCampaigns() external view returns (address[] memory) {
        return _allCampaigns;
    }

    function getOwnerCampaigns(address owner) external view returns (address[] memory) {
        return _ownerCampaigns[owner];
    }

    function campaignsCount() external view returns (uint256) {
        return _allCampaigns.length;
    }

    function ownerCampaignsCount(address owner) external view returns (uint256) {
        return _ownerCampaigns[owner].length;
    }

    // --------------------------- Internal ----------------------------

    function _registerCampaign(address owner, address campaign) internal {
        _allCampaigns.push(campaign);
        _ownerCampaigns[owner].push(campaign);
        isRegisteredCampaign[campaign] = true;
    }
}
