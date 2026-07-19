// --- Web3 Configurations (Real Polygon Deployments) ---

// REPLACE this placeholder with your deployed PGT ERC-20 contract address:
export const TOKEN_CONTRACT_ADDRESS = "0x701100D19b1a93672cfe7291EA455b4220631209"; // Placeholder token address
export const NFT_CONTRACT_ADDRESS = "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";   // Deployed on Polygon
export const TOKEN_1FLR_CONTRACT_ADDRESS = "0x5f0197Ba06860DaC7e31258BdF749F92b6a636d4";
// REPLACE this with your own secure admin/treasury wallet address to receive staking deposits:
export const VAULT_RECEIVER_ADDRESS = "0x14791697260E4c9A71f18484C9f997B308e59325"; // Defaults to authority signer address
export const ADMIN_WALLET_ADDRESS = "0x10B9993990c9EF8a212c9557cB02aD94da9a654d";

export let web3Provider = null;
export let realSigner = null;

export function setWeb3Provider(provider) {
  web3Provider = provider;
}

export function setRealSigner(signer) {
  realSigner = signer;
}
// --- Supabase DB Configuration ---

// Connected to user's Supabase project
export const SUPABASE_URL = "https://jgtfnsufemvqkyytscgl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA";
export let supabase = null;
if (typeof window.supabase !== 'undefined') {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

