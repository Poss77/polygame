// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PolyGameNFT
 * @dev ERC-721 Utility NFT contract for PolyGame boosts.
 * Supports token metadata URIs and links token types to active gameplay rewards.
 */
contract PolyGameNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Mapping from tokenId to active Game/Faucet utility properties
    struct NFTUtility {
        string nftTypeId;       // e.g., "nft_epic_yield"
        uint256 faucetBoost;     // e.g., 30 for +30% faucet payouts
        uint256 gameMultiplier;  // e.g., 15 for +15% game score
        uint256 stakingBoost;    // e.g., 5 for +5% Staking APY
    }

    mapping(uint256 => NFTUtility) public tokenUtilities;

    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string nftTypeId);
    event UtilityUpdated(uint256 indexed tokenId, string nftTypeId, uint256 faucetBoost, uint256 gameMultiplier, uint256 stakingBoost);

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    /**
     * @dev Mints a new utility NFT to a target address.
     * @param to Recipient wallet.
     * @param tokenURI_ Metadata link detailing artwork & description.
     * @param nftTypeId Identifier code matching frontend registration (e.g. "nft_epic_yield").
     * @param faucetBoost Percentage multiplier boost for faucet claims.
     * @param gameMultiplier Percentage multiplier boost for arcade runs.
     * @param stakingBoost Additional APY percentage added to staking vault.
     */
    /**
     * @dev Allows users to purchase/mint a utility NFT directly using MATIC/POL.
     * @param nftTypeId Identifier code (e.g. "nft_rare_shield").
     * @param tokenURI_ Metadata link detailing artwork & description.
     */
    function buyUtilityNFT(
        string memory nftTypeId,
        string memory tokenURI_
    ) external payable returns (uint256) {
        uint256 price = getNFTPrice(nftTypeId);
        require(msg.value >= price, "Insufficient MATIC/POL sent");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        // Map utility stats based on type
        (uint256 faucetBoost, uint256 gameMultiplier, uint256 stakingBoost) = getNFTStats(nftTypeId);

        tokenUtilities[tokenId] = NFTUtility({
            nftTypeId: nftTypeId,
            faucetBoost: faucetBoost,
            gameMultiplier: gameMultiplier,
            stakingBoost: stakingBoost
        });

        emit NFTMinted(msg.sender, tokenId, nftTypeId);
        emit UtilityUpdated(tokenId, nftTypeId, faucetBoost, gameMultiplier, stakingBoost);

        return tokenId;
    }

    /**
     * @dev Returns the MATIC/POL price for a given NFT type.
     */
    function getNFTPrice(string memory nftTypeId) public pure returns (uint256) {
        bytes32 hashedType = keccak256(abi.encodePacked(nftTypeId));
        if (hashedType == keccak256(abi.encodePacked("nft_common_boost"))) {
            return 0.05 ether;
        } else if (hashedType == keccak256(abi.encodePacked("nft_rare_shield"))) {
            return 0.15 ether;
        } else if (hashedType == keccak256(abi.encodePacked("nft_epic_yield"))) {
            return 0.40 ether;
        } else if (hashedType == keccak256(abi.encodePacked("nft_legendary_king"))) {
            return 1.00 ether;
        }
        revert("Invalid NFT type ID");
    }

    /**
     * @dev Returns the boost values (faucet, game, staking) for an NFT type.
     */
    function getNFTStats(string memory nftTypeId) public pure returns (uint256, uint256, uint256) {
        bytes32 hashedType = keccak256(abi.encodePacked(nftTypeId));
        if (hashedType == keccak256(abi.encodePacked("nft_common_boost"))) {
            return (10, 0, 0);
        } else if (hashedType == keccak256(abi.encodePacked("nft_rare_shield"))) {
            return (20, 15, 0);
        } else if (hashedType == keccak256(abi.encodePacked("nft_epic_yield"))) {
            return (30, 0, 5);
        } else if (hashedType == keccak256(abi.encodePacked("nft_legendary_king"))) {
            return (50, 30, 10);
        }
        revert("Invalid NFT type ID");
    }

    /**
     * @dev Mints a new utility NFT to a target address. (Owner fallback)
     */
    function mintUtilityNFT(
        address to,
        string memory tokenURI_,
        string memory nftTypeId,
        uint256 faucetBoost,
        uint256 gameMultiplier,
        uint256 stakingBoost
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        tokenUtilities[tokenId] = NFTUtility({
            nftTypeId: nftTypeId,
            faucetBoost: faucetBoost,
            gameMultiplier: gameMultiplier,
            stakingBoost: stakingBoost
        });

        emit NFTMinted(to, tokenId, nftTypeId);
        emit UtilityUpdated(tokenId, nftTypeId, faucetBoost, gameMultiplier, stakingBoost);

        return tokenId;
    }

    /**
     * @dev Updates utility values for an existing NFT.
     */
    function updateUtility(
        uint256 tokenId,
        string memory nftTypeId,
        uint256 faucetBoost,
        uint256 gameMultiplier,
        uint256 stakingBoost
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        tokenUtilities[tokenId] = NFTUtility({
            nftTypeId: nftTypeId,
            faucetBoost: faucetBoost,
            gameMultiplier: gameMultiplier,
            stakingBoost: stakingBoost
        });

        emit UtilityUpdated(tokenId, nftTypeId, faucetBoost, gameMultiplier, stakingBoost);
    }

    /**
     * @dev Helper to retrieve the frontend NFT type ID for a token.
     */
    function getNFTType(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenUtilities[tokenId].nftTypeId;
    }

    /**
     * @dev Helper to retrieve the full utility struct.
     */
    function getNFTUtility(uint256 tokenId) external view returns (NFTUtility memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenUtilities[tokenId];
    }

    /**
     * @dev Allows withdrawal of contract funds by the owner.
     */
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
}
