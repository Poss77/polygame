// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PolyGameStarshipNFT
 * @dev 100% On-Chain Generative Starship Fleet NFT for Polygon Gaming (Astro-Dodge).
 * Features:
 *  - 6-Layer Procedural DNA Generation (36,000+ Combinations) matching HTML5 vector engine.
 *  - On-Chain Combat Skills (Rapid Fire, Plasma Damage, Overdrive Matrix, Micro-Missiles).
 *  - Deflationary Skill Upgrades: Burns real on-chain PGT (10% burn / 90% treasury).
 *  - ERC-4906 Metadata Update Standard for seamless OpenSea & marketplace trait refreshes.
 *  - ERC-721Enumerable and batch view helpers for instant 1-call frontend querying.
 */
contract PolyGameStarshipNFT is ERC721, ERC721Enumerable, ERC721Burnable, ERC2981, Ownable {
    using Strings for uint256;

    // --- State Variables ---
    uint256 private _nextTokenId;
    string public baseTokenURI = "https://polygongaming.io/metadata/ships/";

    // Mint Fee in POL (MATIC) - Anti-Spam Public Mint Fee
    uint256 public mintFee = 2.0 ether;

    // Treasury Address & Burn Address
    address payable public treasury = payable(0x10B9993990c9EF8a212c9557cB02aD94da9a654d);
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // PGT Token on Polygon (0x701100D19b1a93672cfe7291EA455b4220631209)
    address public pgtTokenAddress = 0x701100D19b1a93672cfe7291EA455b4220631209;

    // Starship Data Structure
    struct StarshipStats {
        uint256 dna;             // 6-digit procedural trait seed (100000..999999)
        uint8 rapidFireLevel;    // Level 1..5
        uint8 plasmaDamageLevel; // Level 1..5
        uint8 overdriveLevel;    // Level 1..5
        uint8 missilePodLevel;   // Level 1..5
        uint8 shipTier;          // Composite Tier 1..5
        uint256 mintedAt;        // Block timestamp
        string name;             // Ship designation
    }

    // Token ID => Starship Stats
    mapping(uint256 => StarshipStats) public starshipStats;

    // Authorized Operators (Relayers / Admin)
    mapping(address => bool) public authorizedOperators;

    // --- Events ---
    event StarshipMinted(address indexed owner, uint256 indexed tokenId, uint256 dna, uint256 tier, string name);
    event StarshipUpgraded(uint256 indexed tokenId, uint8 indexed skillType, uint8 newLevel, uint8 newTier);
    event MintFeeUpdated(uint256 newFee);
    event TreasuryUpdated(address newTreasury);
    event PgtTokenUpdated(address newPgtToken);
    event BaseURIUpdated(string newBaseURI);

    // ERC-4906: Metadata Update Standard
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || authorizedOperators[msg.sender], "Not authorized operator");
        _;
    }

    constructor() ERC721("PolyGame Starship Fleet", "PGSHIP") Ownable(msg.sender) {
        _nextTokenId = 1;

        // Default 5% Royalty (500 basis points) to Treasury
        _setDefaultRoyalty(treasury, 500);
        authorizedOperators[msg.sender] = true;
    }

    // --- MINTING ENGINE ---

    /**
     * @dev Generates pseudo-random 6-digit DNA integer (100000 to 999999)
     * Maps to 6 trait layers: chassis, wings, palette, canopy, thruster, decal.
     */
    function _generateRandomDNA(uint256 tokenId, address minter) internal view returns (uint256) {
        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                minter,
                tokenId,
                address(this)
            )
        );
        return 100000 + (uint256(seed) % 900000);
    }

    /**
     * @dev Public minting of a Generative Starship.
     * Costs POL mintFee, forwarded to Treasury.
     */
    function mintStarship(string memory customName) external payable returns (uint256) {
        require(msg.value >= mintFee, "Insufficient POL fee sent");

        uint256 tokenId = _nextTokenId++;
        uint256 dna = _generateRandomDNA(tokenId, msg.sender);

        _safeMint(msg.sender, tokenId);

        starshipStats[tokenId] = StarshipStats({
            dna: dna,
            rapidFireLevel: 1,
            plasmaDamageLevel: 1,
            overdriveLevel: 1,
            missilePodLevel: 1,
            shipTier: 1,
            mintedAt: block.timestamp,
            name: bytes(customName).length > 0 ? customName : "PolySpace Flagship"
        });

        // Forward POL fee to treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Failed to send mint fee to treasury");

        emit StarshipMinted(msg.sender, tokenId, dna, 1, starshipStats[tokenId].name);
        return tokenId;
    }

    /**
     * @dev Owner / Admin free test mint (Zero POL cost for Poss / Admin testing).
     */
    function ownerMint(address recipient, string memory customName) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Cannot mint to zero address");

        uint256 tokenId = _nextTokenId++;
        uint256 dna = _generateRandomDNA(tokenId, recipient);

        _safeMint(recipient, tokenId);

        starshipStats[tokenId] = StarshipStats({
            dna: dna,
            rapidFireLevel: 1,
            plasmaDamageLevel: 1,
            overdriveLevel: 1,
            missilePodLevel: 1,
            shipTier: 1,
            mintedAt: block.timestamp,
            name: bytes(customName).length > 0 ? customName : "PolySpace Alpha Flagship"
        });

        emit StarshipMinted(recipient, tokenId, dna, 1, starshipStats[tokenId].name);
        return tokenId;
    }

    /**
     * @dev Owner mint with specific predetermined DNA (for reproducible visual QA testing).
     */
    function ownerMintWithDNA(
        address recipient,
        uint256 customDna,
        string memory customName
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Cannot mint to zero address");
        require(customDna >= 100000 && customDna <= 999999, "DNA must be 6-digit");

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);

        starshipStats[tokenId] = StarshipStats({
            dna: customDna,
            rapidFireLevel: 1,
            plasmaDamageLevel: 1,
            overdriveLevel: 1,
            missilePodLevel: 1,
            shipTier: 1,
            mintedAt: block.timestamp,
            name: bytes(customName).length > 0 ? customName : "PolySpace Custom Flagship"
        });

        emit StarshipMinted(recipient, tokenId, customDna, 1, starshipStats[tokenId].name);
        return tokenId;
    }

    // --- ON-CHAIN SKILL PROGRESSION & DEFLATIONARY PGT BURNING ---

    /**
     * @dev Cost in PGT (18 decimals) to upgrade a skill from currentLevel to nextLevel:
     * Level 1 -> 2: 35,000 PGT
     * Level 2 -> 3: 85,000 PGT
     * Level 3 -> 4: 170,000 PGT
     * Level 4 -> 5: 300,000 PGT
     */
    function getUpgradeCost(uint8 currentLevel) public pure returns (uint256) {
        if (currentLevel == 1) return 35_000 ether;
        if (currentLevel == 2) return 85_000 ether;
        if (currentLevel == 3) return 170_000 ether;
        if (currentLevel == 4) return 300_000 ether;
        revert("Max skill level reached");
    }

    /**
     * @dev Upgrades a specific combat skill on-chain by burning real PGT tokens.
     * @param tokenId The Starship token ID
     * @param skillType 0: Rapid Fire, 1: Plasma Damage, 2: Overdrive Matrix, 3: Micro-Missiles
     */
    function upgradeSkillWithPGT(uint256 tokenId, uint8 skillType) external {
        require(ownerOf(tokenId) == msg.sender, "Caller does not own starship");
        require(skillType <= 3, "Invalid skill type: 0..3");

        StarshipStats storage stats = starshipStats[tokenId];
        uint8 currentLevel;

        if (skillType == 0) {
            currentLevel = stats.rapidFireLevel;
        } else if (skillType == 1) {
            currentLevel = stats.plasmaDamageLevel;
        } else if (skillType == 2) {
            currentLevel = stats.overdriveLevel;
        } else {
            currentLevel = stats.missilePodLevel;
        }

        require(currentLevel < 5, "Skill already at max level 5");

        uint256 cost = getUpgradeCost(currentLevel);
        uint256 burnAmount = (cost * 10) / 100; // 10% Burn
        uint256 treasuryAmount = cost - burnAmount; // 90% Treasury

        // Single atomic token pull from player, 10% burned and 90% routed to treasury
        IERC20 pgt = IERC20(pgtTokenAddress);
        require(pgt.transferFrom(msg.sender, address(this), cost), "PGT transfer failed");
        if (burnAmount > 0) {
            require(pgt.transfer(DEAD_ADDRESS, burnAmount), "PGT burn failed");
        }
        require(pgt.transfer(treasury, treasuryAmount), "PGT treasury transfer failed");

        // Increment skill level
        uint8 newLevel = currentLevel + 1;
        if (skillType == 0) {
            stats.rapidFireLevel = newLevel;
        } else if (skillType == 1) {
            stats.plasmaDamageLevel = newLevel;
        } else if (skillType == 2) {
            stats.overdriveLevel = newLevel;
        } else {
            stats.missilePodLevel = newLevel;
        }

        // Recalculate composite tier (average rounded down)
        uint8 newTier = uint8((uint256(stats.rapidFireLevel) + stats.plasmaDamageLevel + stats.overdriveLevel + stats.missilePodLevel) / 4);
        if (newTier < 1) newTier = 1;
        stats.shipTier = newTier;

        emit StarshipUpgraded(tokenId, skillType, newLevel, newTier);
        emit MetadataUpdate(tokenId);
    }

    // --- FAST QUERY VIEW HELPERS ---

    /**
     * @dev 1-Call view returning all token IDs owned by a wallet.
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
     * @dev Returns full stats for a specific starship.
     */
    function getStarshipStats(uint256 tokenId) external view returns (StarshipStats memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return starshipStats[tokenId];
    }

    /**
     * @dev 1-Call view returning stats for an array of tokens.
     */
    function getBatchStarshipStats(uint256[] calldata tokenIds) external view returns (StarshipStats[] memory) {
        StarshipStats[] memory result = new StarshipStats[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            result[i] = starshipStats[tokenIds[i]];
        }
        return result;
    }

    // --- METADATA & CONFIGURATION ---

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return string(abi.encodePacked(baseTokenURI, tokenId.toString(), ".json"));
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function setMintFee(uint256 newFee) external onlyOwner {
        mintFee = newFee;
        emit MintFeeUpdated(newFee);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury cannot be zero address");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setPgtTokenAddress(address newPgtToken) external onlyOwner {
        require(newPgtToken != address(0), "PGT cannot be zero address");
        pgtTokenAddress = newPgtToken;
        emit PgtTokenUpdated(newPgtToken);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
    }

    function withdrawTreasury() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance to withdraw");
        (bool success, ) = treasury.call{value: bal}("");
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
        // Includes ERC-4906 interface ID 0x49064906
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }
}
