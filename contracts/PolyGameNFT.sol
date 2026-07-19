// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PolyGameNFT
 * @dev ERC-721 Utility NFT contract for PolyGame boosts.
 * Includes ERC-2981 Royalties, Soulbound restriction capabilities, and ERC721Burnable.
 */
contract PolyGameNFT is ERC721, ERC721Burnable, ERC2981, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    string public baseTokenURI = "https://poss77.github.io/polygame/metadata/";

    struct NFTUtility {
        string nftTypeId;       
        uint256 faucetBoost;     
        uint256 gameMultiplier;  
        uint256 stakingBoost;    
        uint256 referralMultiplier; 
    }

    struct NFTTypeData {
        uint256 price;
        uint256 faucetBoost;
        uint256 gameMultiplier;
        uint256 stakingBoost;
        uint256 referralMultiplier;
        bool isSoulbound;
        bool exists;
    }

    mapping(string => NFTTypeData) public nftTypes;
    mapping(uint256 => NFTUtility) public tokenUtilities;

    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string nftTypeId);
    event UtilityUpdated(uint256 indexed tokenId, string nftTypeId, uint256 faucetBoost, uint256 gameMultiplier, uint256 stakingBoost, uint256 referralMultiplier);
    event NFTTypeRegistered(string typeId, uint256 price, uint256 faucetBoost, uint256 gameMultiplier, uint256 stakingBoost, uint256 referralMultiplier, bool isSoulbound);

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _nextTokenId = 1;

        // Set Default 5% Royalty to the contract owner
        _setDefaultRoyalty(msg.sender, 500);

        // Initialize NFT Type Data (Price, Faucet, Game, Staking, Referral, isSoulbound)
        _registerType("nft_common_boost", 5 ether, 10, 0, 0, 100, false);
        _registerType("nft_silver_charger", 15 ether, 25, 0, 0, 100, false);
        _registerType("nft_gold_turbine", 40 ether, 50, 0, 0, 100, false);
        _registerType("nft_rare_shield", 15 ether, 0, 15, 0, 100, false);
        _registerType("nft_pulse_blaster", 40 ether, 0, 30, 0, 100, false);
        _registerType("nft_epic_yield", 60 ether, 0, 50, 5, 100, false);
        _registerType("nft_referral_beacon", 10 ether, 0, 0, 0, 110, false);
        _registerType("nft_affiliate_guild", 100 ether, 0, 0, 0, 150, false);
        _registerType("nft_legendary_king", 300 ether, 0, 0, 0, 200, false);
        
        // NEW: Yield Vault and VIP Pass
        _registerType("nft_yield_vault", 50 ether, 0, 0, 15, 100, false);
        _registerType("nft_vip_pass", 100 ether, 0, 0, 0, 100, true);
    }

    function _registerType(
        string memory typeId, uint256 price, uint256 fb, uint256 gm, uint256 sb, uint256 rm, bool soulbound
    ) internal {
        nftTypes[typeId] = NFTTypeData(price, fb, gm, sb, rm, soulbound, true);
        emit NFTTypeRegistered(typeId, price, fb, gm, sb, rm, soulbound);
    }

    // --- ADMIN CONTROLS ---

    /**
     * @dev Dynamically registers a new NFT type to the marketplace.
     */
    function addUtilityNFTType(
        string memory typeId, uint256 price, uint256 fb, uint256 gm, uint256 sb, uint256 rm, bool soulbound
    ) external onlyOwner {
        require(!nftTypes[typeId].exists, "NFT Type already exists. Use updateUtilityNFTType.");
        _registerType(typeId, price, fb, gm, sb, rm, soulbound);
    }

    /**
     * @dev Updates parameters of an existing NFT type.
     */
    function updateUtilityNFTType(
        string memory typeId, uint256 price, uint256 fb, uint256 gm, uint256 sb, uint256 rm, bool soulbound
    ) external onlyOwner {
        require(nftTypes[typeId].exists, "NFT Type does not exist.");
        nftTypes[typeId] = NFTTypeData(price, fb, gm, sb, rm, soulbound, true);
        emit NFTTypeRegistered(typeId, price, fb, gm, sb, rm, soulbound);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    // --- OVERRIDES ---

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        string memory typeId = tokenUtilities[tokenId].nftTypeId;
        return string(abi.encodePacked(baseTokenURI, typeId, ".json"));
    }

    /**
     * @dev Override _update to enforce soulbound restriction.
     * In OpenZeppelin v5, _update handles minting, burning, and transferring.
     * We only block standard transfers (from != 0 && to != 0).
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // If it is a transfer (not mint and not burn)
        if (from != address(0) && to != address(0)) {
            string memory typeId = tokenUtilities[tokenId].nftTypeId;
            require(!nftTypes[typeId].isSoulbound, "PolyGameNFT: This NFT is soulbound and cannot be transferred.");
        }
        
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // --- MINTING ---

    function buyUtilityNFT(
        string memory nftTypeId
    ) external payable returns (uint256) {
        NFTTypeData memory tData = nftTypes[nftTypeId];
        require(tData.exists, "Invalid NFT type ID");
        require(msg.value >= tData.price, "Insufficient MATIC/POL sent");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);

        tokenUtilities[tokenId] = NFTUtility({
            nftTypeId: nftTypeId,
            faucetBoost: tData.faucetBoost,
            gameMultiplier: tData.gameMultiplier,
            stakingBoost: tData.stakingBoost,
            referralMultiplier: tData.referralMultiplier
        });

        emit NFTMinted(msg.sender, tokenId, nftTypeId);
        emit UtilityUpdated(tokenId, nftTypeId, tData.faucetBoost, tData.gameMultiplier, tData.stakingBoost, tData.referralMultiplier);

        return tokenId;
    }

    function mintUtilityNFT(
        address to,
        string memory nftTypeId
    ) external onlyOwner returns (uint256) {
        NFTTypeData memory tData = nftTypes[nftTypeId];
        require(tData.exists, "Invalid NFT type ID");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);

        tokenUtilities[tokenId] = NFTUtility({
            nftTypeId: nftTypeId,
            faucetBoost: tData.faucetBoost,
            gameMultiplier: tData.gameMultiplier,
            stakingBoost: tData.stakingBoost,
            referralMultiplier: tData.referralMultiplier
        });

        emit NFTMinted(to, tokenId, nftTypeId);
        emit UtilityUpdated(tokenId, nftTypeId, tData.faucetBoost, tData.gameMultiplier, tData.stakingBoost, tData.referralMultiplier);

        return tokenId;
    }

    // --- UTILS ---

    function getNFTPrice(string memory nftTypeId) public view returns (uint256) {
        require(nftTypes[nftTypeId].exists, "Invalid NFT type ID");
        return nftTypes[nftTypeId].price;
    }

    function getNFTStats(string memory nftTypeId) public view returns (uint256, uint256, uint256, uint256) {
        require(nftTypes[nftTypeId].exists, "Invalid NFT type ID");
        NFTTypeData memory tData = nftTypes[nftTypeId];
        return (tData.faucetBoost, tData.gameMultiplier, tData.stakingBoost, tData.referralMultiplier);
    }

    function getNFTType(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenUtilities[tokenId].nftTypeId;
    }

    function getNFTUtility(uint256 tokenId) external view returns (NFTUtility memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenUtilities[tokenId];
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Transfer failed");
    }
}
