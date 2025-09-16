// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Donations is Ownable, Pausable, ReentrancyGuard {

    enum CampaignState { Active, Successful, Failed }

    error ZeroAmount();
    error CampaignNotActive();
    error CampaignNotFinished();
    error NotRefundable();
    error NothingToWithdraw();

    string public name; // Name of the donation campaign
    string public orgName; // Name of the organization of the campaign
    string public description; // Description of the donation campaign
    uint256 public goal; // Goal(monetary) of the campaign
    uint256 public totalRaised;
    uint256 public deadline; // Deadline of the campaign
    CampaignState public state;

    mapping(address => uint256) public contributions; // donor and their totaled contributions

    event Donated(address indexed donor, uint256 amount);
    event Refunded(address indexed donor, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event StateChanged(CampaignState indexed previous, CampaignState indexed current);
    event DeadlineExtended(uint256 newDeadline);

    constructor(
        string memory _name,
        string memory _orgName,
        string memory _description,
        uint32 _goal,
        uint16 _durationDays,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_goal ==0) revert ZeroAmount();
        name = _name;
        orgName = _orgName;
        description = _description;
        goal = _goal;
        deadline = block.timestamp + (_durationDays * 1 days);
        state = CampaignState.Active;
    }

    function getCampaignStatus() public view returns (CampaignState) {
        if(state != CampaignState.Active) return state;
        if(block.timestamp >=deadline) {
            return (totalRaised >= goal) ? CampaignState.Successful : CampaignState.Failed;
        }
        if(totalRaised >= goal) {
            return CampaignState.Successful;
        }

        return CampaignState.Active;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function extendDeadline(uint256 daysToAdd) external onlyOwner {
        _recomputeAndSetState();
        if (getCampaignStatus() != CampaignState.Active || block.timestamp >= deadline) {
            revert CampaignNotActive();
        }
        deadline += daysToAdd * 1 days;
        emit DeadlineExtended(deadline);
    }

    function donate() external payable whenNotPaused nonReentrant {
        _recomputeAndSetState();
        if (getCampaignStatus() != CampaignState.Active) revert CampaignNotActive();
        if (msg.value == 0) revert ZeroAmount();

        // Effects
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit Donated(msg.sender, msg.value);

        _recomputeAndSetState();
    }

    function withdraw(address payable to) external onlyOwner nonReentrant {
        _recomputeAndSetState();
        if (getCampaignStatus() != CampaignState.Successful) revert CampaignNotFinished();

        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH send failed");
        emit Withdrawn(to, amount);
    }

    function refund() external nonReentrant {
        _recomputeAndSetState();
        if (getCampaignStatus() != CampaignState.Failed) revert NotRefundable();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NotRefundable();

        contributions[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH send failed");
        emit Refunded(msg.sender, amount);
    }

    function _recomputeAndSetState() internal {
        CampaignState current = state;
        CampaignState next = getCampaignStatus();
        if (next != current) {
            state = next;
            emit StateChanged(current, next);
        }
    }

    receive() external payable {
        revert("Use donate()");
    }
    fallback() external payable {
        revert("Use donate()");
    }
}