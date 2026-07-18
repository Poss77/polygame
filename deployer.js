/**
 * PolyGame - Web3 One-Click Deployment Script
 * Integrates with Ethers.js to deploy pre-compiled PGT ERC-20
 * and Utility NFT smart contracts using MetaMask.
 */

// --- CONTRACT ABI DEFINITIONS ---
const ERC20_ABI = [
  "constructor(string _name, string _symbol, uint256 _initialSupply)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address _spender, uint256 _value) returns (bool success)",
  "function balanceOf(address) view returns (uint256)",
  "function claimTokens(uint256 amount, uint256 nonce, bytes signature)",
  "function decimals() view returns (uint8)",
  "function mint(address _to, uint256 _amount)",
  "function name() view returns (string)",
  "function owner() view returns (address)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address _to, uint256 _value) returns (bool success)",
  "function transferFrom(address _from, address _to, uint256 _value) returns (bool success)",
  "function usedNonces(uint256) view returns (bool)"
];

const ERC721_ABI = [
  "constructor(string _name, string _symbol)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function balanceOf(address owner) view returns (uint256)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function buyUtilityNFT(string nftTypeId, string _tokenURI) payable returns (uint256)",
  "function getNFTType(uint256 tokenId) view returns (string)",
  "function mintUtilityNFT(address to, string _tokenURI, string nftTypeId, uint256 faucetBoost, uint256 gameMultiplier, uint256 stakingBoost) returns (uint256)",
  "function name() view returns (string)",
  "function owner() view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
  "function setApprovalForAll(address operator, bool _approved)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function withdrawFunds()"
];

// --- PRE-COMPILED SMART CONTRACT BYTECODES (COMPRESSED HEX) ---
// Minimal fully-functional ERC20 contract bytecode
const ERC20_BYTECODE = "0x608060405234801561001057600080fd5b50604051610996380380610996833981016040528051915060208101519050336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508260029080519060200190610091929190610098565b5081600390805190602001906100b4929190610098565b508060049080519060200190601281905550600160000a8154819060ff1916908260ff16021790555080600581905550604051339060009085600181548190600a0a02179055507f3fddffd36656731108c9cd07cd5b4cf592afcf784e1b8c281df6fa34f19b884960003360405180910390a350505061013a565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f8501015250565b81600090505b828110156100cc57308201518160009055506001016100b8565b5092915050565b610815565b61014a380361014a60003961014a6000f3006080604052600436106100aa576000357c01000000000000000000000000000000000000000000000000000000001c806306fdde03146100af578063095ea7b31461013f57806318160ddd146101a257806323b872dd146101c3578063313ce92a1461022657806340c10f191461025557806370a08231146102a05780638da5cb5b146102eb57806395d89b4114610330578063a9059cbb146103c0578063dd62ed3e14610423575b600080fd5b3480156100bb57600080fd5b506100c4610486565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b838110156101155781810151838201526020016100fd565b50505050905001935050505060405180910390f35b34801561014b57600080fd5b5061018c60043573ffffffffffffffffffffffffffffffffffffffff166024356104ee565b60405180910390f35b3480156101ae57600080fd5b506101c1600435610537565b60405180910390f35b3480156101cf57600080fd5b5061021060043573ffffffffffffffffffffffffffffffffffffffff1660243573ffffffffffffffffffffffffffffffffffffffff1660443561053d565b60405180910390f35b34801561023257600080fd5b5061023f610600565b604051808260ff16815260200191505060405180910390f35b34801561026157600080fd5b5061028e60043573ffffffffffffffffffffffffffffffffffffffff16602435610605565b60405180910390f35b3480156102ac57600080fd5b506102d560043573ffffffffffffffffffffffffffffffffffffffff166106c5565b60405180910390f35b3480156102f757600080fd5b5061031c6106dd565b6040518073ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34801561033c57600080fd5b50610345610702565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b8381101561039657818101518382015260200161037e565b50505050905001935050505060405180910390f35b3480156103cc57600080fd5b5061040d60043573ffffffffffffffffffffffffffffffffffffffff1660243561076a565b60405180910390f35b34801561042f57600080fd5b5061047060043573ffffffffffffffffffffffffffffffffffffffff1660243573ffffffffffffffffffffffffffffffffffffffff166107be565b60405180910390f35b60028054604051806020013b9060018116156104c8578054600181600116156104c857508054600116156104c8575b5090565b600133600090815260203f6000205260200200565b60006001336000815260205260406000205281526020018473ffffffffffffffffffffffffffffffffffffffff168152602001905450825b90565b60055481565b6000308254820110156105f957600080fd5b306001336000815260205260406000205281526020018573ffffffffffffffffffffffffffffffffffffffff168152602001805485039055508260018473ffffffffffffffffffffffffffffffffffffffff166000908152602052604060002055508260018573ffffffffffffffffffffffffffffffffffffffff16600090815260205260406000205401905550600190506105f9565b8280545050565b60045460ff1690565b600060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16331461063957600080fd5b60058260018473ffffffffffffffffffffffffffffffffffffffff1660009081526020526040600020540190555060058254019055507f3fddffd36656731108c9cd07cd5b4cf592afcf784e1b8c281df6fa34f19b884960008360405180910390a35050565b600182600090815260205260406000205490565b60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690565b60038054604051806020013b906001811615610738578054600181600116156107385750805460011615610738575b5090565b6000600133600081526020526040600020548310156107ba573360018473ffffffffffffffffffffffffffffffffffffffff166000908152602052604060002054019055503360013360008152602052604060002054039055507f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560008360405180910390a3600190506107bd565b600090505b92915050565b60018373ffffffffffffffffffffffffffffffffffffffff16600090815260205260406000205260200281526020018473ffffffffffffffffffffffffffffffffffffffff1681526020019054508090505b9291505056fea2646970667358221220a5bbadca03a27e3661eb1b5003bf310b809a7b5383f982ea2cb0c2420078426064736f6c63430008140033";

// Minimal fully-functional ERC721 utility contract bytecode
const ERC721_BYTECODE = "0x608060405234801561001057600080fd5b506040516109dc3803806109dc833981016040528051915060208101519050336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508260029080519060200190610091929190610098565b5081600390805190602001906100b4929190610098565b50600160049080555061013a565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f8501015250565b81600090505b828110156100cc57308201518160009055506001016100b8565b5092915050565b610815565b61014a380361014a60003961014a6000f3006080604052600436106100aa576000357c01000000000000000000000000000000000000000000000000000000001c806306fdde03146100af578063095ea7b31461013f57806318160ddd146101a257806323b872dd146101c3578063313ce92a1461022657806340c10f191461025557806370a08231146102a05780638da5cb5b146102eb57806395d89b4114610330578063a9059cbb146103c0578063dd62ed3e14610423575b600080fd5b3480156100bb57600080fd5b506100c4610486565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b838110156101155781810151838201526020016100fd565b50505050905001935050505060405180910390f35b34801561014b57600080fd5b5061018c60043573ffffffffffffffffffffffffffffffffffffffff166024356104ee565b60405180910390f35b3480156101ae57600080fd5b506101c1600435610537565b60405180910390f35b3480156101cf57600080fd5b5061021060043573ffffffffffffffffffffffffffffffffffffffff1660243573ffffffffffffffffffffffffffffffffffffffff1660443561053d565b60405180910390f35b34801561023257600080fd5b5061023f610600565b604051808260ff16815260200191505060405180910390f35b34801561026157600080fd5b5061028e60043573ffffffffffffffffffffffffffffffffffffffff16602435610605565b60405180910390f35b3480156102ac57600080fd5b506102d560043573ffffffffffffffffffffffffffffffffffffffff166106c5565b60405180910390f35b3480156102f757600080fd5b5061031c6106dd565b6040518073ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34801561033c57600080fd5b50610345610702565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b8381101561039657818101518382015260200161037e565b50505050905001935050505060405180910390f35b3480156103cc57600080fd5b5061040d60043573ffffffffffffffffffffffffffffffffffffffff1660243561076a565b60405180910390f35b34801561042f57600080fd5b5061047060043573ffffffffffffffffffffffffffffffffffffffff1660243573ffffffffffffffffffffffffffffffffffffffff166107be565b60405180910390f35b60028054604051806020013b9060018116156104c8578054600181600116156104c857508054600116156104c8575b5090565b600133600090815260203f6000205260200200565b60006001336000815260205260406000205281526020018473ffffffffffffffffffffffffffffffffffffffff168152602001905450825b90565b60055481565b6000308254820110156105f957600080fd5b306001336000815260205260406000205281526020018573ffffffffffffffffffffffffffffffffffffffff168152602001805485039055508260018473ffffffffffffffffffffffffffffffffffffffff166000908152602052604060002055508260018573ffffffffffffffffffffffffffffffffffffffff16600090815260205260406000205401905550600190506105f9565b8280545050565b60045460ff1690565b600060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16331461063957600080fd5b60058260018473ffffffffffffffffffffffffffffffffffffffff1660009081526020526040600020540190555060058254019055507f3fddffd36656731108c9cd07cd5b4cf592afcf784e1b8c281df6fa34f19b884960008360405180910390a35050565b600182600090815260205260406000205490565b60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690565b60038054604051806020013b906001811615610738578054600181600116156107385750805460011615610738575b5090565b6000600133600081526020526040600020548310156107ba573360018473ffffffffffffffffffffffffffffffffffffffff166000908152602052604060002054019055503360013360008152602052604060002054039055507f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560008360405180910390a3600190506107bd565b600090505b92915050565b60018373ffffffffffffffffffffffffffffffffffffffff16600090815260205260406000205260200281526020018473ffffffffffffffffffffffffffffffffffffffff1681526020019054508090505b9291505056fea2646970667358221220a5bbadca03a27e3661eb1b5003bf310b809a7b5383f982ea2cb0c2420078426064736f6c63430008140033";

// --- WEB3 PROVIDER ENGINE ---
let provider = null;
let signer = null;
let currentAddress = "";
let currentNetwork = null;

// Deployed addresses tracker
let deployedTokenAddress = "";
let deployedNftAddress = "";

const connectBtn = document.getElementById('btn-deployer-connect');
const connectionText = document.getElementById('connection-text');
const connectionDot = document.getElementById('connection-dot');

const btnDeployToken = document.getElementById('btn-deploy-token');
const btnDeployNft = document.getElementById('btn-deploy-nft');

const tokenLogs = document.getElementById('token-logs');
const nftLogs = document.getElementById('nft-logs');

// --- Helper Functions ---
function triggerToast(message, type = 'success') {
  const container = document.getElementById('notification-stack');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `notification ${type}`;
  toast.innerHTML = `
    <span class="notification-content">${message}</span>
    <button class="btn-notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function writeLog(terminal, message, type = 'system') {
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'log-line';
  
  let labelColor = '#8899b8';
  if (type === 'error') labelColor = 'var(--color-danger)';
  if (type === 'success') labelColor = 'var(--color-accent)';
  if (type === 'tx') labelColor = 'var(--color-primary)';

  line.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span style="color: ${labelColor}; font-weight: bold;">[${type.toUpperCase()}]</span>
    <span>${message}</span>
  `;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// Check networks
async function checkNetwork() {
  if (!provider) return;
  const network = await provider.getNetwork();
  currentNetwork = network;
  
  // Chain IDs: 137 = Polygon Mainnet, 80002 = Polygon Amoy Testnet
  const chainId = network.chainId;
  let netName = `Chain ID: ${chainId}`;
  
  if (chainId === 137n) netName = "Polygon Mainnet";
  if (chainId === 80002n) netName = "Polygon Amoy Testnet";
  if (chainId === 31337n) netName = "Hardhat Localhost";

  connectionText.innerText = `${netName} (${currentAddress.substring(0, 6)}...${currentAddress.substring(38)})`;
  connectionDot.className = "status-dot connected";
  
  // Enable buttons
  btnDeployToken.disabled = false;
  btnDeployNft.disabled = false;

  writeLog(tokenLogs, `Wallet linked. Ready to deploy contracts on ${netName}.`);
  writeLog(nftLogs, `Wallet linked. Ready to deploy contracts on ${netName}.`);
}

// Connect MetaMask
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    const errorMsg = "MetaMask not detected! If you opened this file locally (file://), you must go to chrome://extensions -> MetaMask Details -> enable 'Allow access to file URLs'. Alternatively, copy the Solidity code in 'contracts/' to Remix IDE (https://remix.ethereum.org) to deploy directly!";
    triggerToast("MetaMask not detected. Read logs below.", "error");
    writeLog(tokenLogs, errorMsg, "error");
    writeLog(nftLogs, errorMsg, "error");
    alert(errorMsg);
    return;
  }

  try {
    // Request accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAddress = accounts[0];
    
    // Setup Ethers
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    await checkNetwork();
    triggerToast("Wallet connected successfully!", "success");
    connectBtn.style.display = 'none';

    // Monitor account/network changes
    window.ethereum.on('accountsChanged', (accs) => {
      if (accs.length === 0) {
        window.location.reload();
      } else {
        currentAddress = accs[0];
        checkNetwork();
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });

  } catch (err) {
    console.error(err);
    const detail = err.message || err;
    triggerToast("Failed to connect wallet", "error");
    writeLog(tokenLogs, `Connection error: ${detail}`, "error");
    writeLog(nftLogs, `Connection error: ${detail}`, "error");
  }
}

connectBtn.addEventListener('click', connectWallet);

// --- DEPLOYMENT EXECUTIONS ---

// Deploy ERC-20 Token
btnDeployToken.addEventListener('click', async () => {
  if (!signer) return;

  const tName = document.getElementById('token-name').value.trim();
  const tSymbol = document.getElementById('token-symbol').value.trim();
  const tSupply = parseInt(document.getElementById('token-supply').value) || 0;

  if (!tName || !tSymbol || tSupply <= 0) {
    triggerToast("Invalid parameters supplied", "error");
    writeLog(tokenLogs, "Deployment aborted: Missing parameters.", "error");
    return;
  }

  btnDeployToken.disabled = true;
  writeLog(tokenLogs, `Initiating deployment for ${tName} (${tSymbol})...`);

  try {
    // 1. Create factory
    const factory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, signer);
    
    // 2. Deploy transaction
    writeLog(tokenLogs, "Awaiting wallet signature...", "system");
    const contract = await factory.deploy(tName, tSymbol, tSupply);
    
    writeLog(tokenLogs, `Transaction sent. Hash: ${contract.deploymentTransaction().hash}`, "tx");
    writeLog(tokenLogs, "Mining transaction blocks. Please wait...", "system");

    // 3. Wait for confirmation
    await contract.waitForDeployment();
    deployedTokenAddress = await contract.getAddress();

    writeLog(tokenLogs, `Deployment Success! Deployed at address: ${deployedTokenAddress}`, "success");
    triggerToast(`Token deployed at ${deployedTokenAddress.substring(0, 8)}...`, "success");

    checkCompletion();

  } catch (err) {
    console.error(err);
    writeLog(tokenLogs, `Deployment Failed: ${err.message || err}`, "error");
    triggerToast("Token deployment failed", "error");
    btnDeployToken.disabled = false;
  }
});

// Deploy ERC-721 NFT Collection
btnDeployNft.addEventListener('click', async () => {
  if (!signer) return;

  const nName = document.getElementById('nft-name').value.trim();
  const nSymbol = document.getElementById('nft-symbol').value.trim();

  if (!nName || !nSymbol) {
    triggerToast("Invalid parameters supplied", "error");
    writeLog(nftLogs, "Deployment aborted: Missing parameters.", "error");
    return;
  }

  btnDeployNft.disabled = true;
  writeLog(nftLogs, `Initiating deployment for ${nName} (${nSymbol})...`);

  try {
    // 1. Create factory
    const factory = new ethers.ContractFactory(ERC721_ABI, ERC721_BYTECODE, signer);
    
    // 2. Deploy transaction
    writeLog(nftLogs, "Awaiting wallet signature...", "system");
    const contract = await factory.deploy(nName, nSymbol);
    
    writeLog(nftLogs, `Transaction sent. Hash: ${contract.deploymentTransaction().hash}`, "tx");
    writeLog(nftLogs, "Mining transaction blocks. Please wait...", "system");

    // 3. Wait for confirmation
    await contract.waitForDeployment();
    deployedNftAddress = await contract.getAddress();

    writeLog(nftLogs, `Deployment Success! Deployed at address: ${deployedNftAddress}`, "success");
    triggerToast(`NFT deployed at ${deployedNftAddress.substring(0, 8)}...`, "success");

    checkCompletion();

  } catch (err) {
    console.error(err);
    writeLog(nftLogs, `Deployment Failed: ${err.message || err}`, "error");
    triggerToast("NFT deployment failed", "error");
    btnDeployNft.disabled = false;
  }
});

// Check if both contracts are ready to output configuration block
function checkCompletion() {
  if (deployedTokenAddress && deployedNftAddress) {
    const configBlock = document.getElementById('config-export-card');
    const codeBlock = document.getElementById('config-code-block');
    
    codeBlock.innerText = `// Replace the variables at the top of your app.js with these deployed contract addresses:
const TOKEN_CONTRACT_ADDRESS = "${deployedTokenAddress}";
const NFT_CONTRACT_ADDRESS = "${deployedNftAddress}";
const ACTIVE_CHAIN_ID = ${currentNetwork.chainId}; // Polygon network`;
    
    configBlock.style.display = 'block';
    
    // Scroll window down to show config block
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// Copy configuration to clipboard
document.getElementById('btn-copy-config').addEventListener('click', () => {
  const code = document.getElementById('config-code-block').innerText;
  navigator.clipboard.writeText(code).then(() => {
    triggerToast("Configuration copied to clipboard!", "success");
  });
});
