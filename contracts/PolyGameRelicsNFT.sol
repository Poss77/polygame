// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PolyGameRelicsNFT
 * @dev Quantum Relics ERC-721 NFT Contract on Polygon.
 * Supports self-minting of in-game unlocked relics for 5.0 POL.
 * 100% of minting fees are forwarded to the Treasury.
 * Fully compatible with ERC-165, ERC-721, and ERC-721 Enumerable standards.
 */

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

contract PolyGameRelicsNFT {
    string public name = "PolyGame Quantum Relics";
    string public symbol = "PGLIC";
    string public baseTokenURI = "https://polygame.bet/metadata/relics/";

    address public owner;
    address payable public treasury = payable(0x10B9993990c9EF8a212c9557cB02aD94da9a654d);
    uint256 public mintFee = 5.0 ether; // 5.0 POL (MATIC)

    uint256 public totalSupply = 0;

    // Token ID to Owner & Approvals
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Token ID to Relic String ID (e.g. "relic_astrododge_prism")
    mapping(uint256 => string) public tokenRelicTypes;

    // Enumerable tracking
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event RelicMinted(address indexed minter, uint256 indexed tokenId, string relicId);
    event MintFeeUpdated(uint256 newFee);
    event TreasuryUpdated(address newTreasury);
    event BaseURIUpdated(string newBaseURI);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can execute");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- ERC-165 Standard Interface Support ---

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f || // ERC721Metadata
            interfaceId == 0x780e9d63;   // ERC721Enumerable
    }

    // --- ERC-721 Core Functions ---

    function balanceOf(address account) public view returns (uint256) {
        require(account != address(0), "Zero address query");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token nonexistent");
        return tokenOwner;
    }

    function getRelicType(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token nonexistent");
        return tokenRelicTypes[tokenId];
    }

    function tokensOfOwner(address account) external view returns (uint256[] memory) {
        return _ownedTokens[account];
    }

    function tokenOfOwnerByIndex(address account, uint256 index) external view returns (uint256) {
        require(index < _balances[account], "Owner index out of bounds");
        return _ownedTokens[account][index];
    }

    // --- Minting Functions ---

    /**
     * @dev Mint an unlocked in-game relic to Polygon for 5.0 POL.
     * Enforces Checks-Effects-Interactions to eliminate re-entrancy risks.
     * @param relicId The registered relic ID string (e.g. "relic_astrododge_prism").
     */
    function mintRelic(string calldata relicId) external payable returns (uint256) {
        require(msg.value >= mintFee, "Insufficient POL: Mint fee is 5.0 POL");
        require(bytes(relicId).length > 0, "Empty relicId");

        // 1. Effects (State updates first)
        totalSupply++;
        uint256 newTokenId = totalSupply;

        _mint(msg.sender, newTokenId);
        tokenRelicTypes[newTokenId] = relicId;

        emit RelicMinted(msg.sender, newTokenId, relicId);

        // 2. Interactions (External call last)
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Treasury transfer failed");

        return newTokenId;
    }

    /**
     * @dev Admin/Promotion Minting without fee for tournament champions.
     */
    function adminMintRelic(address recipient, string calldata relicId) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Cannot mint to zero address");
        require(bytes(relicId).length > 0, "Empty relicId");

        totalSupply++;
        uint256 newTokenId = totalSupply;

        _mint(recipient, newTokenId);
        tokenRelicTypes[newTokenId] = relicId;

        emit RelicMinted(recipient, newTokenId, relicId);
        return newTokenId;
    }

    // --- Internal Mint / Transfer Implementation ---

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(_owners[tokenId] == address(0), "Token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        // Enumerable index update
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);

        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "Transfer from incorrect owner");
        require(to != address(0), "Transfer to zero address");

        // Clear approvals
        delete _tokenApprovals[tokenId];

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        // Remove from 'from' enumerable array
        uint256 lastTokenIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }
        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];

        // Add to 'to' enumerable array
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);

        emit Transfer(from, to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "Transfer to non-ERC721Receiver");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function approve(address to, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        require(to != tokenOwner, "Approval to current owner");
        require(msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender), "Not authorized to approve");

        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Token nonexistent");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "Approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address tokenOwner, address operator) public view returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return (spender == tokenOwner || isApprovedForAll(tokenOwner, spender) || _tokenApprovals[tokenId] == spender);
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private returns (bool) {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch {
                return false;
            }
        }
        return true;
    }

    // --- Admin & Emergency Recovery Setters ---

    function setMintFee(uint256 newFee) external onlyOwner {
        mintFee = newFee;
        emit MintFeeUpdated(newFee);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function withdrawBalance() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool sent, ) = treasury.call{value: bal}("");
            require(sent, "Withdrawal failed");
        }
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token nonexistent");
        return string(abi.encodePacked(baseTokenURI, tokenRelicTypes[tokenId], ".json"));
    }
}
