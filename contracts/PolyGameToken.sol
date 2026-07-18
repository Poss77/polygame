// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PolyGameToken (PGT)
 * @dev Standard ERC-20 token for the PolyGame ecosystem.
 * Features a capped supply of 10,000,000 PGT, initial pre-mint, 
 * burning capabilities, and administrative mint overrides.
 */
contract PolyGameToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 Billion PGT Cap

    // Tracks claimed nonces to prevent replay attacks
    mapping(uint256 => bool) public usedNonces;

    // Events
    event TokensClaimed(address indexed recipient, uint256 amount, uint256 nonce);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        uint256 initialSupplyWithDecimals = initialSupply * 10**decimals();
        require(initialSupplyWithDecimals <= MAX_SUPPLY, "Initial supply exceeds max supply cap");
        _mint(msg.sender, initialSupplyWithDecimals);
    }

    /**
     * @dev Allows the contract owner to mint additional tokens up to the MAX_SUPPLY cap.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Minting exceeds max supply cap");
        _mint(to, amount);
    }

    /**
     * @dev Allows users to withdraw off-chain PGT tokens on-chain by verifying
     * a signed voucher from the game authority (contract owner).
     */
    function claimTokens(
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(!usedNonces[nonce], "Voucher already claimed");

        // Recreate the message hash that was signed off-chain
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        // Recover signer and verify it is the contract owner/authority
        address signer = recoverSigner(ethSignedMessageHash, signature);
        require(signer == owner(), "Invalid authority signature");

        usedNonces[nonce] = true;
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply cap");
        
        _mint(msg.sender, amount);

        emit TokensClaimed(msg.sender, amount, nonce);
    }

    // Recover signer address using ecrecover
    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory sig
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(sig);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    // Split signature utility helper
    function splitSignature(
        bytes memory sig
    ) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
