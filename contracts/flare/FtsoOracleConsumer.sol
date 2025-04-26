// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";

/**
 * @title FtsoOracleConsumer
 * @dev Contract to consume Flare Time Series Oracle (FTSO) data for crypto prices
 * For QuakeSiren dApp, this provides BTC/USD price data and other relevant feeds
 */
contract FtsoOracleConsumer {
    // FTSO interface
    FtsoV2Interface private ftsoV2;

    // Feed IDs for cryptos we want to track - CHANGED from bytes32[] to bytes21[]
    bytes21[] public feedIds;

    // Store feed symbols for easy lookup - CHANGED from bytes32 to bytes21
    mapping(bytes21 => string) public feedSymbols;

    // Store the latest prices - CHANGED from bytes32 to bytes21
    mapping(bytes21 => uint256) public latestPrices;

    // Store the latest timestamp
    uint64 public lastUpdateTimestamp;

    // Define events - CHANGED from bytes32[] to bytes21[]
    event PricesUpdated(bytes21[] feedIds, uint256[] prices, uint64 timestamp);
    event FeedAdded(bytes21 feedId, string symbol);

    /**
     * @dev Constructor initializes the contract with BTC/USD feed
     */
    constructor() {
        // Initialize BTC/USD feed ID - CHANGED from bytes32 to bytes21
        bytes21 btcUsdFeedId = bytes21(bytes("BTC/USD"));
        feedIds.push(btcUsdFeedId);
        feedSymbols[btcUsdFeedId] = "BTC/USD";

        // Add any other feeds we want to track - CHANGED from bytes32 to bytes21
        bytes21 ethUsdFeedId = bytes21(bytes("ETH/USD"));
        feedIds.push(ethUsdFeedId);
        feedSymbols[ethUsdFeedId] = "ETH/USD";

        // Initialize FTSO interface via contract registry
        ftsoV2 = FtsoV2Interface(ContractRegistry.getFtsoV2());
    }

    /**
     * @dev Get the current FTSO feed values for all tracked feeds
     * @return _feedValues Array of feed values
     * @return _decimals Array of decimals for each feed value
     * @return _timestamp Timestamp of when the values were last updated
     */
    function getFtsoCurrentFeedValues() 
        public
        returns (
            uint256[] memory _feedValues,
            int8[] memory _decimals,
            uint64 _timestamp
        )
    {
        // Fetch latest data from Flare
        (_feedValues, _decimals, _timestamp) = ftsoV2.getFeedsById(feedIds);

        // Update our stored values
        for (uint i = 0; i < feedIds.length; i++) {
            latestPrices[feedIds[i]] = _feedValues[i];
        }

        lastUpdateTimestamp = _timestamp;

        // Emit event
        emit PricesUpdated(feedIds, _feedValues, _timestamp);

        return (_feedValues, _decimals, _timestamp);
    }

    /**
     * @dev Get the current BTC/USD price
     * @return price The current BTC/USD price
     * @return decimals The number of decimals
     * @return timestamp The timestamp of when the price was last updated
     */
    function getBtcUsdPrice() 
        public
        returns (uint256 price, int8 decimals, uint64 timestamp) 
    {
        // CHANGED from bytes32 to bytes21
        bytes21 btcUsdFeedId = bytes21(bytes("BTC/USD"));
        price = latestPrices[btcUsdFeedId];

        // Get the decimals for this feed
        // CHANGED: Create a bytes21[] array with one element
        bytes21[] memory feedIdArray = new bytes21[](1);
        feedIdArray[0] = btcUsdFeedId;

        (, int8[] memory _decimals,) = ftsoV2.getFeedsById(feedIdArray);
        decimals = _decimals[0];

        timestamp = lastUpdateTimestamp;
        return (price, decimals, timestamp);
    }

    /**
     * @dev Add a new feed to track
     * @param feedId The ID of the feed to add
     * @param symbol The symbol for the feed
     */
    function addFeed(bytes21 feedId, string calldata symbol) external { // CHANGED parameter type
        // Add the feed
        feedIds.push(feedId);
        feedSymbols[feedId] = symbol;

        // Emit event
        emit FeedAdded(feedId, symbol);
    }

    /**
     * @dev Get all tracked feeds
     * @return IDs array of feed IDs
     * @return symbols array of feed symbols
     */
    function getAllFeeds() external view returns (bytes21[] memory, string[] memory) { // CHANGED return type
        string[] memory symbols = new string[](feedIds.length);

        for (uint i = 0; i < feedIds.length; i++) {
            symbols[i] = feedSymbols[feedIds[i]];
        }

        return (feedIds, symbols);
    }
}