import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { ethers } from "https://esm.sh/ethers@6.11.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NFT_CONTRACT_ADDRESS = (Deno.env.get('NFT_CONTRACT_ADDRESS') ?? "0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8").toLowerCase();

const POLYGON_RPCS = [
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
  "https://1rpc.io/matic",
  "https://polygon.drpc.org"
];

async function getReceiptFromPolygon(txHash: string): Promise<any> {
  let lastErr = null;
  for (const rpcUrl of POLYGON_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { buyerWallet, nftId, txHash } = await req.json();

    if (!buyerWallet || !nftId || !txHash) {
      throw new Error("Missing required parameters: buyerWallet, nftId, or txHash");
    }

    const cleanTxHash = txHash.trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(cleanTxHash)) {
      throw new Error("Invalid transaction hash format");
    }

    // 1. Verify transaction receipt on Polygon Mainnet
    const receipt = await getReceiptFromPolygon(cleanTxHash);
    if (!receipt) {
      throw new Error("Transaction receipt not found on Polygon mainnet.");
    }

    if (receipt.status !== 1) {
      throw new Error("Transaction failed on-chain.");
    }

    // 2. Verify target contract is the official NFT contract
    const txTo = (receipt.to || '').toLowerCase();
    if (txTo !== NFT_CONTRACT_ADDRESS) {
      throw new Error("Transaction was not addressed to the PolyGame NFT contract.");
    }

    // 3. Connect to Supabase using Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration error: Missing Supabase Service Credentials");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Execute service_role procedure to credit commission
    const { data: dbResult, error: dbError } = await supabase.rpc('credit_nft_referral_commission', {
      buyer_wallet: buyerWallet,
      item_name: nftId,
      pol_price: 0,
      p_tx_hash: cleanTxHash,
      p_item_id: nftId
    });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify(dbResult),
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
