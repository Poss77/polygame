// --- Web3 Configurations (Real Polygon Deployments) ---

// Deployed PGT ERC-20 contract address on Polygon:
export const TOKEN_CONTRACT_ADDRESS = "0x701100D19b1a93672cfe7291EA455b4220631209"; // Deployed on Polygon
export const NFT_CONTRACT_ADDRESS = "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8";   // Deployed on Polygon
export const RELICS_CONTRACT_ADDRESS = "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e"; // Deployed PolyGameRelicsNFT on Polygon
export const TOKEN_1FLR_CONTRACT_ADDRESS = "0x5f0197Ba06860DaC7e31258BdF749F92b6a636d4";
export const WALLETCONNECT_PROJECT_ID = "00950c9a536e980dd84dbc015411baa7";
export const ADMIN_WALLET_ADDRESS = "0x10B9993990c9EF8a212c9557cB02aD94da9a654d"; // Master Admin Wallet
export const VAULT_RECEIVER_ADDRESS = "0x10B9993990c9EF8a212c9557cB02aD94da9a654d"; // 50% Treasury Pool (Master Admin)
export const BURN_RECEIVER_ADDRESS = "0x000000000000000000000000000000000000dEaD"; // 50% Deflationary Burn
export const APP_VERSION = "1.5.421"; // Context Token Optimization: Modularized RPCs, archived changelog/migrations, search ignore filters & clean repository hierarchy

// Development / Debug Flag
export const POLY_DEBUG = (typeof window !== 'undefined' && (Boolean(window.POLY_DEBUG) || window.location?.search?.includes('debug=true')));
if (typeof window !== 'undefined') {
  window.POLY_DEBUG = POLY_DEBUG;
}

export function polyLog(...args) {
  if (typeof window !== 'undefined' && window.POLY_DEBUG) {
    console.log(...args);
  }
}
if (typeof window !== 'undefined') {
  window.polyLog = polyLog;
}

// Cloudflare Turnstile Anti-Bot Security Key
export const TURNSTILE_SITE_KEY = "0x4AAAAAAEtOatvXxoQxHwhg";

export let web3Provider = null;
export let realSigner = null;

export function setWeb3Provider(provider) {
  web3Provider = provider;
  if (typeof window !== 'undefined') window.web3Provider = provider;
}

export function setRealSigner(signer) {
  realSigner = signer;
  if (typeof window !== 'undefined') window.realSigner = signer;
}
// --- Supabase DB Configuration ---

// Connected to user's Supabase project
export const SUPABASE_URL = "https://jgtfnsufemvqkyytscgl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA";
export let supabase = null;

if (typeof window !== 'undefined') {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    supabase = window.supabaseClient;
  } else if (window.supabase && typeof window.supabase.from === 'function') {
    supabase = window.supabase;
    window.supabaseClient = supabase;
  } else if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabase;
    window.supabase = supabase; // Expose active client instance directly on window.supabase for universal access
  }
}
