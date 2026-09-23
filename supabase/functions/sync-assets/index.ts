import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { ethers } from "https://esm.sh/ethers@6.11.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NFT_CONTRACT_ADDRESS = (Deno.env.get('NFT_CONTRACT_ADDRESS') ?? "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8").toLowerCase();
const RELICS_CONTRACT_ADDRESS = (Deno.env.get('RELICS_CONTRACT_ADDRESS') ?? "0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e").toLowerCase();

const POLYGON_RPCS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://polygon.gateway.tenderly.co"
];

function getPolygonProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(POLYGON_RPCS[0]);
}

const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

const RELICS_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenRelicTypes(uint256 tokenId) view returns (string)"
];

// Helper to map token URI or token ID to standard NFT type ID
function resolveNftTypeId(uri: string | null, tokenId: number): string {
  const s = (uri || '').toLowerCase();
  if (s.includes('gold_turbine') || s.includes('gold') || tokenId === 3) return 'nft_gold_turbine';
  if (s.includes('silver_charger') || s.includes('silver') || tokenId === 2) return 'nft_silver_charger';
  if (s.includes('common_boost') || s.includes('common') || tokenId === 1) return 'nft_common_boost';
  if (s.includes('rare_shield') || s.includes('shield') || tokenId === 4) return 'nft_rare_shield';
  if (s.includes('pulse_blaster') || s.includes('blaster') || tokenId === 5) return 'nft_pulse_blaster';
  if (s.includes('epic_yield') || s.includes('epic') || tokenId === 6) return 'nft_epic_yield';
  if (s.includes('referral_beacon') || s.includes('beacon') || tokenId === 7) return 'nft_referral_beacon';
  if (s.includes('affiliate_guild') || s.includes('guild') || tokenId === 8) return 'nft_affiliate_guild';
  if (s.includes('legendary_king') || s.includes('king') || tokenId === 9) return 'nft_legendary_king';
  if (s.includes('yield_vault_epic') || tokenId === 12) return 'nft_yield_vault_epic';
  if (s.includes('yield_vault_rare') || tokenId === 11) return 'nft_yield_vault_rare';
  if (s.includes('yield_vault') || tokenId === 10) return 'nft_yield_vault';
  return 'nft_common_boost';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { playerId, walletAddress } = await req.json();

    if (!playerId || !walletAddress) {
      throw new Error("Missing required parameters: playerId and walletAddress");
    }

    const cleanWallet = walletAddress.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(cleanWallet)) {
      throw new Error("Invalid EVM wallet address format");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration error: Missing service credentials");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const provider = getPolygonProvider();
    const verifiedNfts: string[] = [];
    const verifiedRelics: Record<string, { onchain: number; token_ids: number[] }> = {};

    // 1. Scan On-Chain Utility NFTs
    try {
      const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
      const balance = await nftContract.balanceOf(cleanWallet);
      const numNfts = Number(balance);

      const maxCheck = Math.min(numNfts, 50); // Bound gas/multicall lookups
      for (let i = 0; i < maxCheck; i++) {
        try {
          const tid = await nftContract.tokenOfOwnerByIndex(cleanWallet, i);
          const tokenIdNum = Number(tid);
          let uri = "";
          try {
            uri = await nftContract.tokenURI(tid);
          } catch (_) {}
          const resolvedType = resolveNftTypeId(uri, tokenIdNum);
          if (resolvedType && !verifiedNfts.includes(resolvedType)) {
            verifiedNfts.push(resolvedType);
          }
        } catch (eToken) {
          console.warn(`Error querying NFT token index ${i}:`, eToken);
        }
      }
    } catch (nftErr) {
      console.warn("Could not query NFT contract on Polygon:", nftErr);
    }

    // 2. Scan On-Chain Quantum Relics
    try {
      const relicsContract = new ethers.Contract(RELICS_CONTRACT_ADDRESS, RELICS_ABI, provider);
      const relicBal = await relicsContract.balanceOf(cleanWallet);
      const numRelics = Number(relicBal);

      const maxRelicsCheck = Math.min(numRelics, 100);
      for (let i = 0; i < maxRelicsCheck; i++) {
        try {
          const tid = await relicsContract.tokenOfOwnerByIndex(cleanWallet, i);
          const tokenIdNum = Number(tid);
          const relicTypeStr = await relicsContract.tokenRelicTypes(tid);
          if (relicTypeStr && relicTypeStr.trim() !== '') {
            const cleanRelicId = relicTypeStr.trim();
            if (!verifiedRelics[cleanRelicId]) {
              verifiedRelics[cleanRelicId] = { onchain: 0, token_ids: [] };
            }
            verifiedRelics[cleanRelicId].onchain += 1;
            verifiedRelics[cleanRelicId].token_ids.push(tokenIdNum);
          }
        } catch (eRelic) {
          console.warn(`Error querying Relic token index ${i}:`, eRelic);
        }
      }
    } catch (relicErr) {
      console.warn("Could not query Relics contract on Polygon:", relicErr);
    }

    // 3. Atomically Persist Verified Assets to Supabase using service_role
    const { data: nftData, error: nftError } = await supabase.rpc('sync_onchain_nfts', {
      p_player_id: playerId,
      p_chain_nfts: verifiedNfts
    });

    if (nftError) {
      console.warn("sync_onchain_nfts RPC notice:", nftError);
    }

    const { data: relicData, error: relicError } = await supabase.rpc('sync_onchain_relics', {
      p_player_id: playerId,
      p_chain_relics: verifiedRelics
    });

    if (relicError) {
      console.warn("sync_onchain_relics RPC notice:", relicError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        player_id: playerId,
        wallet: cleanWallet,
        verified_nfts: verifiedNfts,
        verified_relics: relicData || verifiedRelics
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
