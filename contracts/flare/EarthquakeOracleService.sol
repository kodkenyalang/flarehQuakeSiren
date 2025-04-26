// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EarthquakeOracleService
 * @dev Contract for providing financial institutions with real-time earthquake data
 * @author QuakeSiren Team
 */
contract EarthquakeOracleService {
    // Constants
    uint256 public constant CONNECTION_FEE = 20 ether; // 20 FLR tokens
    uint256 public constant SCALE_FACTOR = 1000000; // For storing decimal values
    uint256 public constant SECONDS_PER_DAY = 86400; // Seconds in a day

    // Structures
    struct Subscription {
        uint256 id;                 // Subscription ID
        address subscriber;         // Address of the subscriber
        string apiKey;              // API key for accessing the oracle
        uint256 startTime;          // Start timestamp
        uint256 endTime;            // End timestamp
        bool active;                // Whether the subscription is active
        uint256 remainingRequests;  // Number of remaining API requests
        string organizationName;    // Organization name
        string contactEmail;        // Contact email
        uint256 lastRequestTime;    // Last API request timestamp
    }

    struct OracleRequest {
        uint256 id;                 // Request ID
        address requester;          // Address of the requester
        uint256 timestamp;          // Timestamp of the request
        string requestType;         // Type of data requested
        string parameters;          // Request parameters (JSON string)
        bool fulfilled;             // Whether the request has been fulfilled
        uint256 responseTimestamp;  // When the response was provided
    }

    struct FinancialImpactData {
        string earthquakeId;        // ID of the earthquake
        uint256 timestamp;          // Timestamp of the impact assessment
        int256 marketImpactScore;   // Market impact score (scaled)
        int256 volatilityIndex;     // Expected market volatility (scaled)
        string[] affectedMarkets;   // List of affected markets
        string[] affectedCurrencies;// List of affected currencies
        string riskLevel;           // Overall risk level (Low, Medium, High, Critical)
        mapping(string => int256) marketSpecificScores; // Specific market scores
    }

    // State variables
    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256[]) public subscriberToSubscriptionIds;
    mapping(string => address) private apiKeyToSubscriber;
    mapping(uint256 => OracleRequest) public oracleRequests;
    mapping(string => FinancialImpactData) private financialImpactData;
    
    uint256 private nextSubscriptionId;
    uint256 private nextRequestId;
    address public owner;
    address public dataContract;
    address public treasuryWallet;
    uint256 public totalRevenue;
    uint256 public totalActiveSubscriptions;
    uint256 public totalRequests;
    
    // Events
    event SubscriptionCreated(uint256 indexed id, address indexed subscriber, uint256 endTime);
    event SubscriptionRenewed(uint256 indexed id, uint256 newEndTime);
    event SubscriptionCancelled(uint256 indexed id);
    event OracleRequestCreated(uint256 indexed id, address indexed requester, string requestType);
    event OracleRequestFulfilled(uint256 indexed id, uint256 responseTimestamp);
    event FinancialImpactDataUpdated(string indexed earthquakeId, string riskLevel);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ApiKeyRevoked(string apiKey);
    event ApiKeyGenerated(address indexed subscriber, uint256 indexed subscriptionId);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "EarthquakeOracleService: caller is not the owner");
        _;
    }

    modifier validSubscription(uint256 _id) {
        require(subscriptions[_id].subscriber != address(0), "EarthquakeOracleService: subscription does not exist");
        _;
    }

    modifier onlySubscriber(uint256 _id) {
        require(
            subscriptions[_id].subscriber == msg.sender,
            "EarthquakeOracleService: caller is not the subscriber"
        );
        _;
    }

    modifier onlyActiveSubscriber() {
        bool hasActiveSubscription = false;
        uint256[] memory subs = subscriberToSubscriptionIds[msg.sender];
        
        for (uint256 i = 0; i < subs.length; i++) {
            if (subscriptions[subs[i]].active && subscriptions[subs[i]].endTime > block.timestamp) {
                if (subscriptions[subs[i]].remainingRequests > 0) {
                    hasActiveSubscription = true;
                    break;
                }
            }
        }
        
        require(hasActiveSubscription, "EarthquakeOracleService: no active subscription with remaining requests");
        _;
    }

    /**
     * @dev Constructor to set the owner and treasury wallet
     * @param _treasuryWallet Address where subscription fees will be sent
     */
    constructor(address _treasuryWallet) {
        owner = msg.sender;
        treasuryWallet = _treasuryWallet;
        nextSubscriptionId = 1;
        nextRequestId = 1;
    }

    /**
     * @dev Create a new subscription to the oracle service
     * @param _days Number of days for the subscription
     * @param _requestsPerDay Number of API requests allowed per day
     * @param _organizationName Name of the subscribing organization
     * @param _contactEmail Contact email for the organization
     * @return Subscription ID and API key
     */
    function createSubscription(
        uint256 _days,
        uint256 _requestsPerDay,
        string memory _organizationName,
        string memory _contactEmail
    ) external payable returns (uint256, string memory) {
        require(_days > 0, "EarthquakeOracleService: subscription days must be greater than 0");
        require(_requestsPerDay > 0, "EarthquakeOracleService: requests per day must be greater than 0");
        require(bytes(_organizationName).length > 0, "EarthquakeOracleService: organization name is required");
        require(bytes(_contactEmail).length > 0, "EarthquakeOracleService: contact email is required");

        // Calculate total price based on days and request volume
        uint256 totalPrice = CONNECTION_FEE;
        
        // Ensure the payment is sufficient
        require(msg.value >= totalPrice, "EarthquakeOracleService: insufficient payment");
        
        // Forward the payment to the treasury
        payable(treasuryWallet).transfer(msg.value);
        totalRevenue += msg.value;
        
        // Generate a unique API key
        string memory apiKey = generateApiKey(msg.sender, block.timestamp);
        
        // Calculate subscription duration and remaining requests
        uint256 subscriptionDuration = _days * SECONDS_PER_DAY;
        uint256 endTime = block.timestamp + subscriptionDuration;
        uint256 totalRequests = _days * _requestsPerDay;
        
        // Create subscription
        uint256 id = nextSubscriptionId++;
        subscriptions[id] = Subscription({
            id: id,
            subscriber: msg.sender,
            apiKey: apiKey,
            startTime: block.timestamp,
            endTime: endTime,
            active: true,
            remainingRequests: totalRequests,
            organizationName: _organizationName,
            contactEmail: _contactEmail,
            lastRequestTime: 0
        });
        
        // Update mappings
        subscriberToSubscriptionIds[msg.sender].push(id);
        apiKeyToSubscriber[apiKey] = msg.sender;
        totalActiveSubscriptions++;
        
        emit SubscriptionCreated(id, msg.sender, endTime);
        emit ApiKeyGenerated(msg.sender, id);
        
        return (id, apiKey);
    }

    /**
     * @dev Renew an existing subscription
     * @param _id Subscription ID
     * @param _days Additional days to add
     * @param _additionalRequests Additional API requests to add
     */
    function renewSubscription(
        uint256 _id,
        uint256 _days,
        uint256 _additionalRequests
    ) external payable validSubscription(_id) onlySubscriber(_id) {
        require(_days > 0 || _additionalRequests > 0, "EarthquakeOracleService: must add days or requests");
        
        Subscription storage subscription = subscriptions[_id];
        
        // Calculate price
        uint256 price = CONNECTION_FEE / 2; // Half price for renewals
        
        require(msg.value >= price, "EarthquakeOracleService: insufficient payment");
        
        // Forward the payment to the treasury
        payable(treasuryWallet).transfer(msg.value);
        totalRevenue += msg.value;
        
        // Update subscription
        if (_days > 0) {
            uint256 additionalDuration = _days * SECONDS_PER_DAY;
            
            // If subscription has expired, renew from current time
            if (subscription.endTime < block.timestamp) {
                subscription.endTime = block.timestamp + additionalDuration;
                subscription.active = true;
                totalActiveSubscriptions++;
            } else {
                // Otherwise extend the current end time
                subscription.endTime += additionalDuration;
            }
        }
        
        // Add requests
        if (_additionalRequests > 0) {
            subscription.remainingRequests += _additionalRequests;
        }
        
        emit SubscriptionRenewed(_id, subscription.endTime);
    }

    /**
     * @dev Cancel a subscription
     * @param _id Subscription ID
     */
    function cancelSubscription(uint256 _id) external validSubscription(_id) onlySubscriber(_id) {
        Subscription storage subscription = subscriptions[_id];
        require(subscription.active, "EarthquakeOracleService: subscription already cancelled");
        
        subscription.active = false;
        totalActiveSubscriptions--;
        
        // Revoke API key
        string memory apiKey = subscription.apiKey;
        delete apiKeyToSubscriber[apiKey];
        
        emit SubscriptionCancelled(_id);
        emit ApiKeyRevoked(apiKey);
    }

    /**
     * @dev Make an oracle request (retrieve financial impact data for an earthquake)
     * @param _requestType Type of request (e.g., "financial_impact", "market_analysis")
     * @param _parameters Request parameters as a JSON string
     * @return Request ID
     */
    function makeOracleRequest(
        string memory _requestType,
        string memory _parameters
    ) external onlyActiveSubscriber returns (uint256) {
        // Find the active subscription with remaining requests
        uint256 subscriptionId = 0;
        uint256[] memory subs = subscriberToSubscriptionIds[msg.sender];
        
        for (uint256 i = 0; i < subs.length; i++) {
            if (subscriptions[subs[i]].active && 
                subscriptions[subs[i]].endTime > block.timestamp &&
                subscriptions[subs[i]].remainingRequests > 0) {
                subscriptionId = subs[i];
                break;
            }
        }
        
        require(subscriptionId > 0, "EarthquakeOracleService: no valid subscription found");
        
        // Create request
        uint256 requestId = nextRequestId++;
        oracleRequests[requestId] = OracleRequest({
            id: requestId,
            requester: msg.sender,
            timestamp: block.timestamp,
            requestType: _requestType,
            parameters: _parameters,
            fulfilled: false,
            responseTimestamp: 0
        });
        
        // Decrement remaining requests
        subscriptions[subscriptionId].remainingRequests--;
        subscriptions[subscriptionId].lastRequestTime = block.timestamp;
        
        totalRequests++;
        
        emit OracleRequestCreated(requestId, msg.sender, _requestType);
        
        return requestId;
    }

    /**
     * @dev Validate an API key
     * @param _apiKey API key to validate
     * @return Whether the API key is valid
     */
    function validateApiKey(string memory _apiKey) external view returns (bool) {
        address subscriber = apiKeyToSubscriber[_apiKey];
        
        if (subscriber == address(0)) {
            return false;
        }
        
        uint256[] memory subs = subscriberToSubscriptionIds[subscriber];
        
        for (uint256 i = 0; i < subs.length; i++) {
            Subscription storage sub = subscriptions[subs[i]];
            if (sub.active && 
                sub.endTime > block.timestamp && 
                keccak256(bytes(sub.apiKey)) == keccak256(bytes(_apiKey))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * @dev Get the financial impact data for an earthquake
     * @param _earthquakeId ID of the earthquake
     * @param _apiKey API key for authentication
     * @return Overall risk level and JSON data
     */
    function getFinancialImpactData(
        string memory _earthquakeId,
        string memory _apiKey
    ) external view returns (string memory, string memory) {
        // Validate API key
        address subscriber = apiKeyToSubscriber[_apiKey];
        require(subscriber != address(0), "EarthquakeOracleService: invalid API key");
        
        // Ensure subscriber has an active subscription
        bool hasValidSubscription = false;
        uint256[] memory subs = subscriberToSubscriptionIds[subscriber];
        
        for (uint256 i = 0; i < subs.length; i++) {
            if (subscriptions[subs[i]].active && subscriptions[subs[i]].endTime > block.timestamp) {
                hasValidSubscription = true;
                break;
            }
        }
        
        require(hasValidSubscription, "EarthquakeOracleService: no active subscription");
        
        // This would return actual data, but for now return placeholder
        return ("MEDIUM", '{"marketImpact": 65, "volatilityIndex": 42, "affectedMarkets": ["NIKKEI", "ASX200"], "details": "Moderate financial impact expected"}');
    }

    /**
     * @dev Update financial impact data for an earthquake (owner only)
     * @param _earthquakeId ID of the earthquake
     * @param _riskLevel Risk level (LOW, MEDIUM, HIGH, CRITICAL)
     */
    function updateFinancialImpactData(
        string memory _earthquakeId,
        string memory _riskLevel
    ) external onlyOwner {
        // In a real implementation, this would update the stored data
        
        emit FinancialImpactDataUpdated(_earthquakeId, _riskLevel);
    }

    /**
     * @dev Fulfill an oracle request (owner only)
     * @param _requestId ID of the request to fulfill
     */
    function fulfillOracleRequest(uint256 _requestId) external onlyOwner {
        require(_requestId < nextRequestId, "EarthquakeOracleService: request does not exist");
        
        OracleRequest storage request = oracleRequests[_requestId];
        require(!request.fulfilled, "EarthquakeOracleService: request already fulfilled");
        
        request.fulfilled = true;
        request.responseTimestamp = block.timestamp;
        
        emit OracleRequestFulfilled(_requestId, block.timestamp);
    }

    /**
     * @dev Sets the data contract address
     * @param _dataContract Address of the earthquake data contract
     */
    function setDataContract(address _dataContract) external onlyOwner {
        require(_dataContract != address(0), "EarthquakeOracleService: zero address");
        dataContract = _dataContract;
    }

    /**
     * @dev Sets the treasury wallet address
     * @param _treasuryWallet Address where fees will be sent
     */
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        require(_treasuryWallet != address(0), "EarthquakeOracleService: zero address");
        treasuryWallet = _treasuryWallet;
    }
    
    /**
     * @dev Generate a unique API key
     * @param _subscriber Address of the subscriber
     * @param _timestamp Current timestamp
     * @return Generated API key
     */
    function generateApiKey(address _subscriber, uint256 _timestamp) private pure returns (string memory) {
        // In a production environment, this would be more secure
        // This is a simplified implementation for demonstration
        bytes32 hash = keccak256(abi.encodePacked(_subscriber, _timestamp));
        
        bytes memory result = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            result[i] = hash[i];
        }
        
        return bytes32ToString(hash);
    }
    
    /**
     * @dev Convert bytes32 to string
     * @param _bytes32 Bytes to convert
     * @return String representation
     */
    function bytes32ToString(bytes32 _bytes32) private pure returns (string memory) {
        bytes memory bytesArray = new bytes(64);
        
        for (uint256 i = 0; i < 32; i++) {
            uint8 value = uint8(_bytes32[i]);
            bytesArray[i*2] = toHexChar(value / 16);
            bytesArray[i*2+1] = toHexChar(value % 16);
        }
        
        return string(bytesArray);
    }
    
    /**
     * @dev Convert value to hex character
     * @param _value Value to convert
     * @return Hex character
     */
    function toHexChar(uint8 _value) private pure returns (bytes1) {
        if (_value < 10) {
            return bytes1(uint8(_value) + 48); // 0-9
        } else {
            return bytes1(uint8(_value) + 87); // a-f
        }
    }
    
    /**
     * @dev Get all subscription IDs for a subscriber
     * @param _subscriber Address of the subscriber
     * @return Array of subscription IDs
     */
    function getSubscriptionsBySubscriber(address _subscriber) external view returns (uint256[] memory) {
        return subscriberToSubscriptionIds[_subscriber];
    }
    
    /**
     * @dev Get subscription details
     * @param _id Subscription ID
     * @return Full subscription details except the API key
     */
    function getSubscriptionDetails(uint256 _id) external view validSubscription(_id) returns (
        uint256 id,
        address subscriber,
        uint256 startTime,
        uint256 endTime,
        bool active,
        uint256 remainingRequests,
        string memory organizationName,
        string memory contactEmail,
        uint256 lastRequestTime
    ) {
        Subscription storage subscription = subscriptions[_id];
        
        // Don't return the API key for security reasons
        return (
            subscription.id,
            subscription.subscriber,
            subscription.startTime,
            subscription.endTime,
            subscription.active,
            subscription.remainingRequests,
            subscription.organizationName,
            subscription.contactEmail,
            subscription.lastRequestTime
        );
    }
    
    /**
     * @dev Check if a subscription is active
     * @param _id Subscription ID
     * @return Whether the subscription is active
     */
    function isSubscriptionActive(uint256 _id) external view returns (bool) {
        Subscription storage subscription = subscriptions[_id];
        return subscription.active && subscription.endTime > block.timestamp;
    }
    
    /**
     * @dev Get contract statistics
     * @return Total revenue, active subscriptions, total requests
     */
    function getContractStats() external view returns (uint256, uint256, uint256) {
        return (totalRevenue, totalActiveSubscriptions, totalRequests);
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "EarthquakeOracleService: zero address");
        owner = _newOwner;
    }
}