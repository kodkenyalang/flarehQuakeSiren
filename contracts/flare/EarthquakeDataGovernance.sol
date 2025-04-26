// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EarthquakeDataGovernance
 * @dev Governance contract for decentralized verification of earthquake data on Flare Network
 * @author QuakeSiren Team
 */
contract EarthquakeDataGovernance {
    // Structures
    struct Proposal {
        uint256 id;
        string earthquakeId;
        address proposer;
        string description;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool approved;
        mapping(address => bool) hasVoted;
    }

    struct Validator {
        address account;
        uint256 reputation;
        bool active;
        uint256 joinedAt;
    }

    // State variables
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Validator) public validators;
    address[] public validatorAddresses;
    uint256 private nextProposalId;
    address public owner;
    address public dataContract;
    uint256 public minVotesRequired;
    uint256 public votingPeriod;
    uint256 public validatorCount;
    
    // Events
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ProposalCreated(uint256 indexed proposalId, string earthquakeId, address indexed proposer);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool approved);
    event ProposalExecuted(uint256 indexed proposalId, bool approved);
    event DataContractChanged(address indexed newDataContract);
    event MinVotesRequiredChanged(uint256 newMinVotes);
    event VotingPeriodChanged(uint256 newPeriod);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "EarthquakeDataGovernance: caller is not the owner");
        _;
    }
    
    modifier onlyValidator() {
        require(validators[msg.sender].active, "EarthquakeDataGovernance: caller is not an active validator");
        _;
    }
    
    modifier validProposal(uint256 _proposalId) {
        require(_proposalId < nextProposalId, "EarthquakeDataGovernance: proposal does not exist");
        _;
    }

    /**
     * @dev Constructor to set the owner and initial parameters
     * @param _votingPeriodInDays Voting period for proposals in days
     */
    constructor(uint256 _votingPeriodInDays) {
        owner = msg.sender;
        nextProposalId = 1;
        minVotesRequired = 3; // Default minimum votes required
        votingPeriod = _votingPeriodInDays * 1 days;
        
        // Add the contract creator as the first validator
        _addValidator(msg.sender);
    }

    /**
     * @dev Adds a new validator
     * @param _validator Address of the validator to add
     */
    function addValidator(address _validator) external onlyOwner {
        _addValidator(_validator);
    }

    /**
     * @dev Removes a validator
     * @param _validator Address of the validator to remove
     */
    function removeValidator(address _validator) external onlyOwner {
        require(validators[_validator].active, "EarthquakeDataGovernance: not an active validator");
        
        validators[_validator].active = false;
        validatorCount--;
        
        emit ValidatorRemoved(_validator);
    }

    /**
     * @dev Creates a new proposal for earthquake data verification
     * @param _earthquakeId ID of the earthquake to verify
     * @param _description Description of the proposal
     * @return Proposal ID
     */
    function createProposal(string memory _earthquakeId, string memory _description) external onlyValidator returns (uint256) {
        uint256 proposalId = nextProposalId++;
        Proposal storage newProposal = proposals[proposalId];
        
        newProposal.id = proposalId;
        newProposal.earthquakeId = _earthquakeId;
        newProposal.proposer = msg.sender;
        newProposal.description = _description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + votingPeriod;
        
        // Proposer automatically votes for the proposal
        newProposal.approvalCount = 1;
        newProposal.hasVoted[msg.sender] = true;
        
        emit ProposalCreated(proposalId, _earthquakeId, msg.sender);
        
        return proposalId;
    }

    /**
     * @dev Casts a vote on an existing proposal
     * @param _proposalId ID of the proposal
     * @param _approve Whether to approve or reject the proposal
     */
    function vote(uint256 _proposalId, bool _approve) external onlyValidator validProposal(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(!proposal.executed, "EarthquakeDataGovernance: proposal already executed");
        require(block.timestamp < proposal.endTime, "EarthquakeDataGovernance: voting period has ended");
        require(!proposal.hasVoted[msg.sender], "EarthquakeDataGovernance: already voted");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (_approve) {
            proposal.approvalCount++;
        } else {
            proposal.rejectionCount++;
        }
        
        emit VoteCast(_proposalId, msg.sender, _approve);
        
        // Auto-execute if threshold is reached
        if (proposal.approvalCount + proposal.rejectionCount >= validatorCount || 
            proposal.approvalCount >= minVotesRequired) {
            _executeProposal(_proposalId);
        }
    }

    /**
     * @dev Executes a proposal after voting period has ended
     * @param _proposalId ID of the proposal
     */
    function executeProposal(uint256 _proposalId) external validProposal(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(!proposal.executed, "EarthquakeDataGovernance: proposal already executed");
        require(block.timestamp >= proposal.endTime, "EarthquakeDataGovernance: voting period not ended");
        
        _executeProposal(_proposalId);
    }

    /**
     * @dev Sets the earthquake data contract address
     * @param _dataContract Address of the data contract
     */
    function setDataContract(address _dataContract) external onlyOwner {
        require(_dataContract != address(0), "EarthquakeDataGovernance: zero address");
        dataContract = _dataContract;
        emit DataContractChanged(_dataContract);
    }

    /**
     * @dev Sets the minimum votes required for proposal execution
     * @param _minVotesRequired New minimum votes threshold
     */
    function setMinVotesRequired(uint256 _minVotesRequired) external onlyOwner {
        require(_minVotesRequired > 0, "EarthquakeDataGovernance: min votes must be greater than 0");
        minVotesRequired = _minVotesRequired;
        emit MinVotesRequiredChanged(_minVotesRequired);
    }

    /**
     * @dev Sets the voting period duration
     * @param _votingPeriodInDays New voting period in days
     */
    function setVotingPeriod(uint256 _votingPeriodInDays) external onlyOwner {
        require(_votingPeriodInDays > 0, "EarthquakeDataGovernance: voting period must be greater than 0");
        votingPeriod = _votingPeriodInDays * 1 days;
        emit VotingPeriodChanged(votingPeriod);
    }

    /**
     * @dev Gets all active validator addresses
     * @return Array of active validator addresses
     */
    function getActiveValidators() external view returns (address[] memory) {
        address[] memory activeValidators = new address[](validatorCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < validatorAddresses.length; i++) {
            address valAddr = validatorAddresses[i];
            if (validators[valAddr].active) {
                activeValidators[index++] = valAddr;
            }
        }
        
        return activeValidators;
    }

    /**
     * @dev Gets proposal details
     * @param _proposalId ID of the proposal
     * @return Proposal details (id, earthquakeId, proposer, description, approvalCount, rejectionCount, startTime, endTime, executed, approved)
     */
    function getProposalDetails(uint256 _proposalId) external view validProposal(_proposalId) returns (
        uint256 id,
        string memory earthquakeId,
        address proposer,
        string memory description,
        uint256 approvalCount,
        uint256 rejectionCount,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool approved
    ) {
        Proposal storage proposal = proposals[_proposalId];
        
        return (
            proposal.id,
            proposal.earthquakeId,
            proposal.proposer,
            proposal.description,
            proposal.approvalCount,
            proposal.rejectionCount,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.approved
        );
    }

    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "EarthquakeDataGovernance: zero address");
        owner = _newOwner;
    }

    /**
     * @dev Internal function to add a validator
     * @param _validator Address of the validator to add
     */
    function _addValidator(address _validator) private {
        require(_validator != address(0), "EarthquakeDataGovernance: zero address");
        require(!validators[_validator].active, "EarthquakeDataGovernance: already an active validator");
        
        if (validators[_validator].account == address(0)) {
            // New validator
            validators[_validator] = Validator({
                account: _validator,
                reputation: 0,
                active: true,
                joinedAt: block.timestamp
            });
            validatorAddresses.push(_validator);
        } else {
            // Reactivate existing validator
            validators[_validator].active = true;
        }
        
        validatorCount++;
        emit ValidatorAdded(_validator);
    }

    /**
     * @dev Internal function to execute a proposal
     * @param _proposalId ID of the proposal
     */
    function _executeProposal(uint256 _proposalId) private {
        Proposal storage proposal = proposals[_proposalId];
        
        proposal.executed = true;
        proposal.approved = proposal.approvalCount > proposal.rejectionCount;
        
        // If data contract is set and proposal is approved, verify the earthquake there
        if (dataContract != address(0) && proposal.approved) {
            // In a real implementation, this would call the data contract to verify the earthquake
            // For example: IEarthquakeData(dataContract).verifyEarthquake(proposal.earthquakeId);
        }
        
        emit ProposalExecuted(_proposalId, proposal.approved);
    }
}