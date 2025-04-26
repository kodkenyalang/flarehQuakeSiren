// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EarthquakeData
 * @dev Contract for storing and managing earthquake data on the Flare Network
 * @author QuakeSiren Team
 */
contract EarthquakeData {
    // Constants
    uint256 public constant SCALE_FACTOR = 1000000; // For storing decimal values as integers
    uint256 public constant MIN_VERIFICATION_THRESHOLD = 3; // Minimum verifications needed

    // Structures
    struct Earthquake {
        string id;              // Unique identifier (e.g., USGS ID)
        int256 latitude;        // Latitude * SCALE_FACTOR
        int256 longitude;       // Longitude * SCALE_FACTOR
        uint256 magnitude;      // Magnitude * SCALE_FACTOR
        uint256 depth;          // Depth in km * SCALE_FACTOR
        uint256 time;           // Unix timestamp
        string place;           // Description of location
        bool verified;          // Verification status
        uint256 verifications;  // Number of verifications
        uint256 dataTimestamp;  // When data was recorded on-chain
    }

    // State variables
    mapping(string => Earthquake) public earthquakes;
    mapping(string => mapping(address => bool)) public hasVerified;
    string[] public earthquakeIds;
    address public owner;
    address public governanceContract;
    uint256 public verificationThreshold;
    uint256 public earthquakeCount;
    
    // Events
    event EarthquakeRecorded(string id, uint256 magnitude, uint256 time, string place);
    event EarthquakeVerified(string id, address verifier, uint256 verifications);
    event VerificationThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event GovernanceContractChanged(address oldContract, address newContract);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "EarthquakeData: caller is not the owner");
        _;
    }

    modifier onlyGovernance() {
        require(
            msg.sender == governanceContract || msg.sender == owner,
            "EarthquakeData: caller is not governance or owner"
        );
        _;
    }

    /**
     * @dev Constructor to set the owner and initial verification threshold
     */
    constructor() {
        owner = msg.sender;
        verificationThreshold = 5; // Default threshold, can be changed later
    }

    /**
     * @dev Records a new earthquake in the contract storage
     * @param _id Unique identifier for the earthquake
     * @param _latitude Latitude coordinate (multiplied by SCALE_FACTOR)
     * @param _longitude Longitude coordinate (multiplied by SCALE_FACTOR)
     * @param _magnitude Earthquake magnitude (multiplied by SCALE_FACTOR)
     * @param _depth Depth in kilometers (multiplied by SCALE_FACTOR)
     * @param _time Unix timestamp when the earthquake occurred
     * @param _place Description of the earthquake location
     */
    function recordEarthquake(
        string memory _id,
        int256 _latitude,
        int256 _longitude,
        uint256 _magnitude,
        uint256 _depth,
        uint256 _time,
        string memory _place
    ) external {
        require(bytes(earthquakes[_id].id).length == 0, "EarthquakeData: earthquake already exists");
        
        earthquakes[_id] = Earthquake({
            id: _id,
            latitude: _latitude,
            longitude: _longitude,
            magnitude: _magnitude,
            depth: _depth,
            time: _time,
            place: _place,
            verified: false,
            verifications: 0,
            dataTimestamp: block.timestamp
        });
        
        earthquakeIds.push(_id);
        earthquakeCount++;
        
        emit EarthquakeRecorded(_id, _magnitude, _time, _place);
    }

    /**
     * @dev Verifies an earthquake's data
     * @param _id The ID of the earthquake to verify
     */
    function verifyEarthquake(string memory _id) external {
        require(bytes(earthquakes[_id].id).length > 0, "EarthquakeData: earthquake does not exist");
        require(!hasVerified[_id][msg.sender], "EarthquakeData: caller has already verified this earthquake");
        
        Earthquake storage earthquake = earthquakes[_id];
        hasVerified[_id][msg.sender] = true;
        earthquake.verifications++;
        
        if (earthquake.verifications >= verificationThreshold && !earthquake.verified) {
            earthquake.verified = true;
        }
        
        emit EarthquakeVerified(_id, msg.sender, earthquake.verifications);
    }

    /**
     * @dev Updates the verification threshold
     * @param _newThreshold New threshold value
     */
    function setVerificationThreshold(uint256 _newThreshold) external onlyGovernance {
        require(_newThreshold >= MIN_VERIFICATION_THRESHOLD, "EarthquakeData: threshold too low");
        
        uint256 oldThreshold = verificationThreshold;
        verificationThreshold = _newThreshold;
        
        emit VerificationThresholdChanged(oldThreshold, _newThreshold);
    }

    /**
     * @dev Sets the governance contract address
     * @param _governanceContract Address of the governance contract
     */
    function setGovernanceContract(address _governanceContract) external onlyOwner {
        require(_governanceContract != address(0), "EarthquakeData: zero address");
        
        address oldContract = governanceContract;
        governanceContract = _governanceContract;
        
        emit GovernanceContractChanged(oldContract, _governanceContract);
    }

    /**
     * @dev Gets an earthquake by its ID
     * @param _id Earthquake ID
     * @return id, latitude, longitude, magnitude, depth, time, place, verified, verifications
     */
    function getEarthquake(string memory _id) external view returns (
        string memory id,
        int256 latitude,
        int256 longitude,
        uint256 magnitude,
        uint256 depth,
        uint256 time,
        string memory place,
        bool verified,
        uint256 verifications
    ) {
        Earthquake storage earthquake = earthquakes[_id];
        require(bytes(earthquake.id).length > 0, "EarthquakeData: earthquake does not exist");
        
        return (
            earthquake.id,
            earthquake.latitude,
            earthquake.longitude,
            earthquake.magnitude,
            earthquake.depth,
            earthquake.time,
            earthquake.place,
            earthquake.verified,
            earthquake.verifications
        );
    }

    /**
     * @dev Gets the IDs of the most recent earthquakes
     * @param _limit Maximum number of IDs to return
     * @return Array of earthquake IDs
     */
    function getRecentEarthquakeIds(uint256 _limit) external view returns (string[] memory) {
        uint256 length = earthquakeIds.length;
        uint256 resultSize = _limit < length ? _limit : length;
        
        string[] memory result = new string[](resultSize);
        
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = earthquakeIds[length - 1 - i];
        }
        
        return result;
    }

    /**
     * @dev Gets the verification status of an earthquake
     * @param _id Earthquake ID
     * @return Whether the earthquake is verified
     */
    function isEarthquakeVerified(string memory _id) external view returns (bool) {
        return earthquakes[_id].verified;
    }

    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "EarthquakeData: zero address");
        owner = _newOwner;
    }
}