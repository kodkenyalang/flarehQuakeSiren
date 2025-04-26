// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnterpriseRiskAssessmentService
 * @dev Contract for managing enterprise subscriptions to the QuakeSiren risk assessment service
 */
contract EnterpriseRiskAssessmentService is Ownable, ReentrancyGuard {
    // FLR token interface
    IERC20 public flareToken;
    
    // Subscription fee in FLR tokens (20,000,000 FLR)
    uint256 public constant SUBSCRIPTION_FEE = 20_000_000 * 10**18;
    
    // Subscription period in seconds (30 days)
    uint256 public constant SUBSCRIPTION_PERIOD = 30 days;
    
    // Management fee in percentage (basis points, 100 = 1%)
    uint16 public managementFeeRate = 1000; // 10% management fee
    
    // Treasury address where management fees are sent
    address public treasury;
    
    // Oracle address for risk assessment verification
    address public riskOracle;
    
    // Struct to represent a subscription
    struct Subscription {
        uint256 startTime;
        uint256 endTime;
        bool active;
        uint256 totalPaid;
        uint256 assessmentCount;
        uint256 lastAssessmentTime;
    }
    
    // Struct to represent a risk assessment
    struct RiskAssessment {
        uint256 id;
        address subscriber;
        uint256 timestamp;
        string financialCenter;
        uint8 riskScore; // 0-100
        uint8 confidenceLevel; // 0-100
        string portfolioType; // "conservative", "diversified", "aggressive"
        string ipfsHash; // Detailed assessment stored on IPFS
        bool verified;
    }
    
    // Mapping from subscriber address to subscription details
    mapping(address => Subscription) public subscriptions;
    
    // Mapping of risk assessment IDs to assessment details
    mapping(uint256 => RiskAssessment) public riskAssessments;
    
    // Next risk assessment ID
    uint256 private nextAssessmentId = 1;
    
    // Events
    event SubscriptionCreated(address indexed subscriber, uint256 startTime, uint256 endTime, uint256 amount);
    event SubscriptionRenewed(address indexed subscriber, uint256 newEndTime, uint256 amount);
    event SubscriptionCancelled(address indexed subscriber, uint256 endTime);
    event RiskAssessmentCreated(uint256 indexed id, address indexed subscriber, string financialCenter, uint8 riskScore);
    event RiskAssessmentVerified(uint256 indexed id, address indexed verifier);
    event ManagementFeeUpdated(uint16 newFeeRate);
    event TreasuryUpdated(address newTreasury);
    event RiskOracleUpdated(address newOracle);
    
    /**
     * @dev Constructor to set up the contract with initial parameters
     * @param _flareToken Address of the FLR token contract
     * @param _treasury Address where management fees will be sent
     * @param _riskOracle Address of the risk assessment oracle
     */
    constructor(address _flareToken, address _treasury, address _riskOracle) {
        require(_flareToken != address(0), "Invalid Flare token address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_riskOracle != address(0), "Invalid oracle address");
        
        flareToken = IERC20(_flareToken);
        treasury = _treasury;
        riskOracle = _riskOracle;
    }
    
    /**
     * @dev Subscribe to the enterprise risk assessment service
     * @return Boolean indicating if subscription was successful
     */
    function subscribe() external nonReentrant returns (bool) {
        require(!hasActiveSubscription(msg.sender), "Active subscription already exists");
        
        // Transfer FLR tokens from subscriber to this contract
        bool transferSuccess = flareToken.transferFrom(msg.sender, address(this), SUBSCRIPTION_FEE);
        require(transferSuccess, "FLR transfer failed");
        
        // Calculate and transfer management fee
        uint256 managementFee = (SUBSCRIPTION_FEE * managementFeeRate) / 10000;
        if (managementFee > 0) {
            bool feeTransferSuccess = flareToken.transfer(treasury, managementFee);
            require(feeTransferSuccess, "Management fee transfer failed");
        }
        
        // Create subscription
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + SUBSCRIPTION_PERIOD;
        
        subscriptions[msg.sender] = Subscription({
            startTime: startTime,
            endTime: endTime,
            active: true,
            totalPaid: SUBSCRIPTION_FEE,
            assessmentCount: 0,
            lastAssessmentTime: 0
        });
        
        emit SubscriptionCreated(msg.sender, startTime, endTime, SUBSCRIPTION_FEE);
        return true;
    }
    
    /**
     * @dev Renew an existing subscription
     * @return Boolean indicating if renewal was successful
     */
    function renewSubscription() external nonReentrant returns (bool) {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.startTime > 0, "No existing subscription");
        
        // Transfer FLR tokens from subscriber to this contract
        bool transferSuccess = flareToken.transferFrom(msg.sender, address(this), SUBSCRIPTION_FEE);
        require(transferSuccess, "FLR transfer failed");
        
        // Calculate and transfer management fee
        uint256 managementFee = (SUBSCRIPTION_FEE * managementFeeRate) / 10000;
        if (managementFee > 0) {
            bool feeTransferSuccess = flareToken.transfer(treasury, managementFee);
            require(feeTransferSuccess, "Management fee transfer failed");
        }
        
        // If subscription is expired, create a new period starting now
        if (block.timestamp > sub.endTime) {
            sub.startTime = block.timestamp;
            sub.endTime = block.timestamp + SUBSCRIPTION_PERIOD;
        } else {
            // Otherwise extend the current subscription
            sub.endTime += SUBSCRIPTION_PERIOD;
        }
        
        sub.active = true;
        sub.totalPaid += SUBSCRIPTION_FEE;
        
        emit SubscriptionRenewed(msg.sender, sub.endTime, SUBSCRIPTION_FEE);
        return true;
    }
    
    /**
     * @dev Cancel a subscription (will remain active until the end of the current period)
     */
    function cancelSubscription() external {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.startTime > 0, "No existing subscription");
        require(sub.active, "Subscription already cancelled");
        
        sub.active = false;
        emit SubscriptionCancelled(msg.sender, sub.endTime);
    }
    
    /**
     * @dev Create a new risk assessment (only callable by active subscribers)
     * @param _financialCenter The financial center being assessed
     * @param _riskScore Risk score from 0-100
     * @param _confidenceLevel Confidence level from 0-100
     * @param _portfolioType Type of portfolio (conservative, diversified, aggressive)
     * @param _ipfsHash IPFS hash pointing to detailed assessment data
     * @return The ID of the newly created risk assessment
     */
    function createRiskAssessment(
        string calldata _financialCenter,
        uint8 _riskScore,
        uint8 _confidenceLevel,
        string calldata _portfolioType,
        string calldata _ipfsHash
    ) external returns (uint256) {
        require(hasActiveSubscription(msg.sender), "No active subscription");
        require(_riskScore <= 100, "Risk score must be 0-100");
        require(_confidenceLevel <= 100, "Confidence level must be 0-100");
        
        uint256 assessmentId = nextAssessmentId++;
        
        riskAssessments[assessmentId] = RiskAssessment({
            id: assessmentId,
            subscriber: msg.sender,
            timestamp: block.timestamp,
            financialCenter: _financialCenter,
            riskScore: _riskScore,
            confidenceLevel: _confidenceLevel,
            portfolioType: _portfolioType,
            ipfsHash: _ipfsHash,
            verified: false
        });
        
        // Update subscriber's assessment count
        Subscription storage sub = subscriptions[msg.sender];
        sub.assessmentCount++;
        sub.lastAssessmentTime = block.timestamp;
        
        emit RiskAssessmentCreated(assessmentId, msg.sender, _financialCenter, _riskScore);
        
        return assessmentId;
    }
    
    /**
     * @dev Verify a risk assessment (only callable by the risk oracle)
     * @param _assessmentId The ID of the risk assessment to verify
     * @return Boolean indicating if verification was successful
     */
    function verifyRiskAssessment(uint256 _assessmentId) external returns (bool) {
        require(msg.sender == riskOracle, "Only oracle can verify assessments");
        require(_assessmentId < nextAssessmentId, "Assessment does not exist");
        
        RiskAssessment storage assessment = riskAssessments[_assessmentId];
        require(!assessment.verified, "Assessment already verified");
        
        assessment.verified = true;
        emit RiskAssessmentVerified(_assessmentId, msg.sender);
        
        return true;
    }
    
    /**
     * @dev Check if an address has an active subscription
     * @param _subscriber The address to check
     * @return Boolean indicating if subscription is active
     */
    function hasActiveSubscription(address _subscriber) public view returns (bool) {
        Subscription storage sub = subscriptions[_subscriber];
        return sub.active && block.timestamp <= sub.endTime;
    }
    
    /**
     * @dev Get subscription details for an address
     * @param _subscriber The address to check
     * @return startTime Subscription start timestamp
     * @return endTime Subscription end timestamp
     * @return active Whether the subscription is marked as active
     * @return isCurrentlyActive Whether the subscription is currently active (active && not expired)
     * @return totalPaid Total amount paid for subscription
     * @return assessmentCount Number of risk assessments created
     * @return lastAssessmentTime Timestamp of the last assessment
     */
    function getSubscriptionDetails(address _subscriber) external view returns (
        uint256 startTime,
        uint256 endTime,
        bool active,
        bool isCurrentlyActive,
        uint256 totalPaid,
        uint256 assessmentCount,
        uint256 lastAssessmentTime
    ) {
        Subscription storage sub = subscriptions[_subscriber];
        return (
            sub.startTime,
            sub.endTime,
            sub.active,
            hasActiveSubscription(_subscriber),
            sub.totalPaid,
            sub.assessmentCount,
            sub.lastAssessmentTime
        );
    }
    
    /**
     * @dev Get risk assessment details
     * @param _assessmentId The ID of the risk assessment
     * @return id Assessment ID
     * @return subscriber Address of the subscriber who created the assessment
     * @return timestamp When the assessment was created
     * @return financialCenter The financial center being assessed
     * @return riskScore Risk score from 0-100
     * @return confidenceLevel Confidence level from 0-100
     * @return portfolioType Type of portfolio
     * @return ipfsHash IPFS hash pointing to detailed assessment data
     * @return verified Whether the assessment has been verified by the oracle
     */
    function getRiskAssessmentDetails(uint256 _assessmentId) external view returns (
        uint256 id,
        address subscriber,
        uint256 timestamp,
        string memory financialCenter,
        uint8 riskScore,
        uint8 confidenceLevel,
        string memory portfolioType,
        string memory ipfsHash,
        bool verified
    ) {
        require(_assessmentId < nextAssessmentId, "Assessment does not exist");
        
        RiskAssessment storage assessment = riskAssessments[_assessmentId];
        return (
            assessment.id,
            assessment.subscriber,
            assessment.timestamp,
            assessment.financialCenter,
            assessment.riskScore,
            assessment.confidenceLevel,
            assessment.portfolioType,
            assessment.ipfsHash,
            assessment.verified
        );
    }
    
    /**
     * @dev Update the management fee rate (only owner)
     * @param _newFeeRate New fee rate in basis points (100 = 1%)
     */
    function updateManagementFee(uint16 _newFeeRate) external onlyOwner {
        require(_newFeeRate <= 3000, "Fee cannot exceed 30%");
        managementFeeRate = _newFeeRate;
        emit ManagementFeeUpdated(_newFeeRate);
    }
    
    /**
     * @dev Update the treasury address (only owner)
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        treasury = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }
    
    /**
     * @dev Update the risk oracle address (only owner)
     * @param _newOracle New risk oracle address
     */
    function updateRiskOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        riskOracle = _newOracle;
        emit RiskOracleUpdated(_newOracle);
    }
    
    /**
     * @dev Withdraw excess FLR tokens (only owner)
     * @param _amount Amount to withdraw
     */
    function withdrawExcessFunds(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount > 0, "Amount must be greater than zero");
        require(flareToken.balanceOf(address(this)) >= _amount, "Insufficient balance");
        
        bool transferSuccess = flareToken.transfer(owner(), _amount);
        require(transferSuccess, "FLR transfer failed");
    }
}