// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EarthquakeAlertSubscription
 * @dev Contract for managing earthquake alert subscriptions on the Flare Network
 * @author QuakeSiren Team
 */
contract EarthquakeAlertSubscription {
    // Constants
    uint256 public constant SCALE_FACTOR = 1000000; // For storing decimal values as integers
    uint256 public constant SUBSCRIPTION_PRICE_PER_MONTH = 0.1 ether; // 0.1 FLR per month
    uint256 public constant SECONDS_PER_MONTH = 30 days; // Approximate seconds in a month
    uint256 public constant MAX_SUBSCRIPTION_MONTHS = 12; // Maximum subscription duration

    // Structures
    struct Subscription {
        uint256 id;                 // Unique identifier
        address subscriber;         // Address of the subscriber
        uint256 minMagnitude;       // Minimum magnitude to trigger alerts * SCALE_FACTOR
        int256 minLatitude;         // Minimum latitude * SCALE_FACTOR
        int256 maxLatitude;         // Maximum latitude * SCALE_FACTOR
        int256 minLongitude;        // Minimum longitude * SCALE_FACTOR
        int256 maxLongitude;        // Maximum longitude * SCALE_FACTOR
        uint256 startTime;          // Start timestamp
        uint256 endTime;            // End timestamp
        bool active;                // Whether the subscription is active
        string email;               // Email for alerts (encrypted off-chain)
        string organizationName;    // Name of the subscribing organization
    }

    // State variables
    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256[]) public subscriberToSubscriptionIds;
    uint256 private nextSubscriptionId;
    address public owner;
    address public dataContract;
    uint256 public totalRevenue;
    uint256 public totalActiveSubscriptions;

    // Events
    event SubscriptionCreated(uint256 indexed id, address indexed subscriber, uint256 endTime);
    event SubscriptionRenewed(uint256 indexed id, uint256 newEndTime);
    event SubscriptionCancelled(uint256 indexed id);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event DataContractChanged(address indexed newDataContract);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "EarthquakeAlertSubscription: caller is not the owner");
        _;
    }

    modifier validSubscription(uint256 _id) {
        require(subscriptions[_id].subscriber != address(0), "EarthquakeAlertSubscription: subscription does not exist");
        _;
    }

    modifier onlySubscriber(uint256 _id) {
        require(
            subscriptions[_id].subscriber == msg.sender,
            "EarthquakeAlertSubscription: caller is not the subscriber"
        );
        _;
    }

    /**
     * @dev Constructor to set the owner
     */
    constructor() {
        owner = msg.sender;
        nextSubscriptionId = 1;
    }

    /**
     * @dev Creates a new subscription for earthquake alerts
     * @param _minMagnitude Minimum magnitude threshold (multiplied by SCALE_FACTOR)
     * @param _minLatitude Minimum latitude for the region (multiplied by SCALE_FACTOR)
     * @param _maxLatitude Maximum latitude for the region (multiplied by SCALE_FACTOR)
     * @param _minLongitude Minimum longitude for the region (multiplied by SCALE_FACTOR)
     * @param _maxLongitude Maximum longitude for the region (multiplied by SCALE_FACTOR)
     * @param _months Number of months for the subscription
     * @param _email Email address for alerts
     * @param _organizationName Name of the subscribing organization
     * @return Subscription ID
     */
    function createSubscription(
        uint256 _minMagnitude,
        int256 _minLatitude,
        int256 _maxLatitude,
        int256 _minLongitude,
        int256 _maxLongitude,
        uint256 _months,
        string memory _email,
        string memory _organizationName
    ) external payable returns (uint256) {
        require(_months > 0 && _months <= MAX_SUBSCRIPTION_MONTHS, "EarthquakeAlertSubscription: invalid subscription duration");
        require(msg.value >= _months * SUBSCRIPTION_PRICE_PER_MONTH, "EarthquakeAlertSubscription: insufficient payment");
        require(_minLatitude <= _maxLatitude, "EarthquakeAlertSubscription: invalid latitude range");
        require(_minLongitude <= _maxLongitude, "EarthquakeAlertSubscription: invalid longitude range");
        
        uint256 subscriptionDuration = _months * SECONDS_PER_MONTH;
        uint256 endTime = block.timestamp + subscriptionDuration;
        
        uint256 id = nextSubscriptionId++;
        subscriptions[id] = Subscription({
            id: id,
            subscriber: msg.sender,
            minMagnitude: _minMagnitude,
            minLatitude: _minLatitude,
            maxLatitude: _maxLatitude,
            minLongitude: _minLongitude,
            maxLongitude: _maxLongitude,
            startTime: block.timestamp,
            endTime: endTime,
            active: true,
            email: _email,
            organizationName: _organizationName
        });
        
        subscriberToSubscriptionIds[msg.sender].push(id);
        totalRevenue += msg.value;
        totalActiveSubscriptions++;
        
        emit SubscriptionCreated(id, msg.sender, endTime);
        
        return id;
    }

    /**
     * @dev Renews an existing subscription
     * @param _id Subscription ID
     * @param _months Number of months to add
     */
    function renewSubscription(uint256 _id, uint256 _months) external payable validSubscription(_id) onlySubscriber(_id) {
        require(_months > 0 && _months <= MAX_SUBSCRIPTION_MONTHS, "EarthquakeAlertSubscription: invalid renewal duration");
        require(msg.value >= _months * SUBSCRIPTION_PRICE_PER_MONTH, "EarthquakeAlertSubscription: insufficient payment");
        
        Subscription storage subscription = subscriptions[_id];
        uint256 additionalDuration = _months * SECONDS_PER_MONTH;
        
        // If subscription has expired, renew from current time
        if (subscription.endTime < block.timestamp) {
            subscription.endTime = block.timestamp + additionalDuration;
            subscription.active = true;
        } else {
            // Otherwise extend the current end time
            subscription.endTime += additionalDuration;
        }
        
        totalRevenue += msg.value;
        
        // If it was inactive but now being renewed, increment active count
        if (!subscription.active) {
            subscription.active = true;
            totalActiveSubscriptions++;
        }
        
        emit SubscriptionRenewed(_id, subscription.endTime);
    }

    /**
     * @dev Cancels an existing subscription
     * @param _id Subscription ID
     */
    function cancelSubscription(uint256 _id) external validSubscription(_id) onlySubscriber(_id) {
        Subscription storage subscription = subscriptions[_id];
        require(subscription.active, "EarthquakeAlertSubscription: subscription already cancelled");
        
        subscription.active = false;
        totalActiveSubscriptions--;
        
        emit SubscriptionCancelled(_id);
    }

    /**
     * @dev Updates the parameters for an existing subscription
     * @param _id Subscription ID
     * @param _minMagnitude New minimum magnitude (multiplied by SCALE_FACTOR)
     * @param _minLatitude New minimum latitude (multiplied by SCALE_FACTOR)
     * @param _maxLatitude New maximum latitude (multiplied by SCALE_FACTOR)
     * @param _minLongitude New minimum longitude (multiplied by SCALE_FACTOR)
     * @param _maxLongitude New maximum longitude (multiplied by SCALE_FACTOR)
     * @param _email New email address
     */
    function updateSubscription(
        uint256 _id,
        uint256 _minMagnitude,
        int256 _minLatitude,
        int256 _maxLatitude,
        int256 _minLongitude,
        int256 _maxLongitude,
        string memory _email
    ) external validSubscription(_id) onlySubscriber(_id) {
        require(_minLatitude <= _maxLatitude, "EarthquakeAlertSubscription: invalid latitude range");
        require(_minLongitude <= _maxLongitude, "EarthquakeAlertSubscription: invalid longitude range");
        
        Subscription storage subscription = subscriptions[_id];
        
        subscription.minMagnitude = _minMagnitude;
        subscription.minLatitude = _minLatitude;
        subscription.maxLatitude = _maxLatitude;
        subscription.minLongitude = _minLongitude;
        subscription.maxLongitude = _maxLongitude;
        subscription.email = _email;
    }

    /**
     * @dev Gets all subscription IDs for a subscriber
     * @param _subscriber Address of the subscriber
     * @return Array of subscription IDs
     */
    function getSubscriptionsBySubscriber(address _subscriber) external view returns (uint256[] memory) {
        return subscriberToSubscriptionIds[_subscriber];
    }

    /**
     * @dev Gets details for a specific subscription
     * @param _id Subscription ID
     * @return Full subscription details
     */
    function getSubscriptionDetails(uint256 _id) external view validSubscription(_id) returns (
        uint256 id,
        address subscriber,
        uint256 minMagnitude,
        int256 minLatitude,
        int256 maxLatitude,
        int256 minLongitude,
        int256 maxLongitude,
        uint256 startTime,
        uint256 endTime,
        bool active,
        string memory email,
        string memory organizationName
    ) {
        Subscription storage subscription = subscriptions[_id];
        
        return (
            subscription.id,
            subscription.subscriber,
            subscription.minMagnitude,
            subscription.minLatitude,
            subscription.maxLatitude,
            subscription.minLongitude,
            subscription.maxLongitude,
            subscription.startTime,
            subscription.endTime,
            subscription.active,
            subscription.email,
            subscription.organizationName
        );
    }

    /**
     * @dev Checks if a subscription is currently active
     * @param _id Subscription ID
     * @return Whether the subscription is active
     */
    function isSubscriptionActive(uint256 _id) external view returns (bool) {
        Subscription storage subscription = subscriptions[_id];
        return subscription.active && subscription.endTime > block.timestamp;
    }

    /**
     * @dev Sets the earthquake data contract address
     * @param _dataContract Address of the data contract
     */
    function setDataContract(address _dataContract) external onlyOwner {
        require(_dataContract != address(0), "EarthquakeAlertSubscription: zero address");
        dataContract = _dataContract;
        emit DataContractChanged(_dataContract);
    }

    /**
     * @dev Withdraws funds from the contract
     * @param _to Address to send the funds to
     * @param _amount Amount to withdraw
     */
    function withdrawFunds(address payable _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "EarthquakeAlertSubscription: zero address");
        require(_amount <= address(this).balance, "EarthquakeAlertSubscription: insufficient funds");
        
        _to.transfer(_amount);
        emit FundsWithdrawn(_to, _amount);
    }

    /**
     * @dev Gets the current contract balance
     * @return Contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "EarthquakeAlertSubscription: zero address");
        owner = _newOwner;
    }
}