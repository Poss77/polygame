// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PolyGameStarshipNFT
 * @dev Dynamic, Upgradeable ERC-721 Starship Fleet Flagship on Polygon.
 * Supports ERC721Enumerable, ERC-2981 Royalties, and on-chain dynamic module stats.
 */
contract PolyGameStarshipNFT is ERC721, ERC721Enumerable, ERC721Burnable, ERC2981, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    string public baseTokenURI = "https://polygongaming.io/metadata/ships/";
    uint256 public mintFee = 5 ether; // 5.0 POL Public Mint Fee

    struct StarshipStats {
        uint256 warpLevel;
        uint256 laserLevel;
        uint256 cargoLevel;
        uint256 shipTier;
        uint256 mintedAt;
        string name;
    }

    // Mapping from tokenId => Starship Stats
    mapping(uint256 => StarshipStats) public starshipStats;

    // Authorized sync operators (Backend relayer / Admin)
    mapping(address => bool) public authorizedOperators;

    // Events
    event StarshipMinted(address indexed owner, uint256 indexed tokenId, uint256 tier, string name);
    event StarshipUpgraded(uint256 indexed tokenId, uint256 warpLvl, uint256 laserLvl, uint256 cargoLvl, uint256 tier);
    event MintFeeUpdated(uint256 newFee);
    event BaseURIUpdated(string newBaseURI);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedOperators[msg.sender], "Not authorized operator");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address royaltyReceiver
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _nextTokenId = 1;

        // Default 5% Royalty (500 basis points)
        _setDefaultRoyalty(royaltyReceiver, 500);
        authorizedOperators[msg.sender] = true;
    }

    // --- PUBLIC MINTING ---

    /**
     * @dev Public mint a fresh Tier 1 Starter Starship (Level 1/1/1).
     */
    function mintStarship(string memory customName) external payable returns (uint256) {
        require(msg.value >= mintFee, "Insufficient POL fee sent");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        starshipStats[tokenId] = StarshipStats({
            warpLevel: 1,
            laserLevel: 1,
            cargoLevel: 1,
            shipTier: 1,
            mintedAt: block.timestamp,
            name: bytes(customName).length > 0 ? customName : "PolySpace Flagship"
        });

        emit StarshipMinted(msg.sender, tokenId, 1, starshipStats[tokenId].name);
        return tokenId;
    }

    /**
     * @dev Bridge an existing in-game leveled-up ship to Polygon on-chain.
     */
    function bridgeInGameStarship(
        address recipient,
        uint256 warpLvl,
        uint256 laserLvl,
        uint256 cargoLvl,
        string memory shipName
    ) external payable onlyAuthorized returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);

        uint256 avgLvl = (warpLvl + laserLvl + cargoLvl) / 3;
        uint256 derivedTier = calculateTier(avgLvl);

        starshipStats[tokenId] = StarshipStats({
            warpLevel: warpLvl,
            laserLevel: laserLvl,
            cargoLevel: cargoLvl,
            shipTier: derivedTier,
            mintedAt: block.timestamp,
            name: bytes(shipName).length > 0 ? shipName : "PolySpace Flagship"
        });

        emit StarshipMinted(recipient, tokenId, derivedTier, starshipStats[tokenId].name);
        return tokenId;
    }

    // --- STATS UPGRADE & PROGRESSION SYNC ---

    /**
     * @dev Synchronizes upgraded module levels to the on-chain NFT.
     */
    function updateStarshipStats(
        uint256 tokenId,
        uint256 warpLvl,
        uint256 laserLvl,
        uint256 cargoLvl
    ) external onlyAuthorized {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        uint256 avgLvl = (warpLvl + laserLvl + cargoLvl) / 3;
        uint256 derivedTier = calculateTier(avgLvl);

        StarshipStats storage stats = starshipStats[tokenId];
        stats.warpLevel = warpLvl;
        stats.laserLevel = laserLvl;
        stats.cargoLevel = cargoLvl;
        stats.shipTier = derivedTier;

        emit StarshipUpgraded(tokenId, warpLvl, laserLvl, cargoLvl, derivedTier);
    }

    function calculateTier(uint256 level) public pure returns (uint256) {
        if (level >= 30) return 7; // Genesis Mothership
        if (level >= 25) return 6; // Singularity Flagship
        if (level >= 20) return 5; // Apex Dreadnought
        if (level >= 15) return 4; // Titan Battlecruiser
        if (level >= 10) return 3; // Void Cruiser
        if (level >= 5)  return 2; // Plasma Frigate
        return 1;                  // Scout Corvette
    }

    // --- FAST ENUMERATION & VIEW HELPERS ---

    /**
     * @dev 1-Call helper for PolyGame frontend: returns all token IDs owned by address.
     */
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(owner, i);
        }
        return result;
    }

    /**
     * @dev Returns full stats for an array of tokens in a single call.
     */
    function getBatchStarshipStats(uint256[] calldata tokenIds) external view returns (StarshipStats[] memory) {
        StarshipStats[] memory result = new StarshipStats[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            result[i] = starshipStats[tokenIds[i]];
        }
        return result;
    }

    // --- METADATA & OPENSEA ---

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return string(abi.encodePacked(baseTokenURI, tokenId.toString(), ".json"));
    }

    // --- ADMIN CONFIGURATION ---

    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
    }

    function setMintFee(uint256 newFee) external onlyOwner {
        mintFee = newFee;
        emit MintFeeUpdated(newFee);
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function withdrawTreasury() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance to withdraw");
        (bool success, ) = payable(owner()).call{value: bal}("");
        require(success, "Withdrawal failed");
    }

    // --- REQUIRED OVERRIDES ---

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
