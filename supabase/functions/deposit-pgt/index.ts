import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { ethers } from "https://esm.sh/ethers@6.11.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official contract and treasury addresses on Polygon Mainnet
const PGT_CONTRACT_ADDRESS = (Deno.env.get('TOKEN_CONTRACT_ADDRESS') ?? "0x701100D19b1a93672cfe7291EA455b4220631209").toLowerCase();
const VAULT_RECEIVER_ADDRESS = (Deno.env.get('VAULT_RECEIVER_ADDRESS') ?? "0x10B9993990c9EF8a212c9557cB02aD94da9a654d").toLowerCase();

// ERC-20 Transfer event topic: keccak256("Transfer(address,address,uint256)")
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// High-reliability Polygon Mainnet RPC providers with fallback support
const POLYGON_RPCS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://polygon.gateway.tenderly.co"
];

async function getReceiptFromPolygon(txHash: string): Promise<any> {
  let lastErr = null;
  for (const rpcUrl of POLYGON_RPCS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.warn("Polygon RPC warning in getReceiptFromPolygon:", lastErr);
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { txHash, playerId, turnstileToken } = await req.json();

    if (!txHash || typeof txHash !== 'string') {
      throw new Error("Missing or invalid 'txHash' parameter.");
    }
    if (!playerId || typeof playerId !== 'string') {
      throw new Error("Missing or invalid 'playerId' parameter.");
    }

    const cleanTxHash = txHash.trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(cleanTxHash)) {
      throw new Error("Invalid transaction hash format. Expected 64-character hexadecimal.");
    }


    // 1. Query Polygon blockchain for verified transaction receipt
    const receipt = await getReceiptFromPolygon(cleanTxHash);
    if (!receipt) {
      throw new Error("Transaction receipt not found on Polygon mainnet. It may still be pending confirmation.");
    }

    if (receipt.status !== 1) {
      throw new Error("On-chain transaction failed on Polygon (status = 0). Tokens were not transferred.");
    }

    // 2. Parse ERC-20 Transfer logs to verify real PGT token movement to Vault
    let validTransferFound = false;
    let senderWallet = '';
    let creditedPgtAmount = 0;

    for (const log of (receipt.logs || [])) {
      const logAddress = (log.address || '').toLowerCase();
      // Ensure the log was emitted specifically by the official PGT token contract
      if (logAddress !== PGT_CONTRACT_ADDRESS) {
        continue;
      }

      // Check for Transfer(address indexed from, address indexed to, uint256 value)
      if (log.topics && log.topics[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC && log.topics.length >= 3) {
        // topics[1] = from address (padded to 32 bytes)
        const fromAddr = "0x" + log.topics[1].slice(26).toLowerCase();
        // topics[2] = to address (padded to 32 bytes)
        const toAddr = "0x" + log.topics[2].slice(26).toLowerCase();

        // Must be transferred to the PolyGame Treasury Vault
        if (toAddr === VAULT_RECEIVER_ADDRESS) {
          const rawAmount = ethers.toBigInt(log.data);
          const parsedAmount = Number(ethers.formatUnits(rawAmount, 18));

          if (parsedAmount > 0) {
            validTransferFound = true;
            senderWallet = fromAddr;
            creditedPgtAmount = parsedAmount;
            break;
          }
        }
      }
    }

    if (!validTransferFound || creditedPgtAmount <= 0) {
      throw new Error(
        "Cryptographic Verification Failed: Transaction does not contain a valid PGT transfer to the PolyGame Treasury Vault (" +
        VAULT_RECEIVER_ADDRESS + ")."
      );
    }

    // 3. Connect to Supabase using the Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration error: Missing Supabase Service Credentials");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Atomically credit the verified deposit via private service_role RPC
    const { data: dbResult, error: dbError } = await supabase.rpc('credit_verified_deposit', {
      p_player_id: playerId,
      p_tx_hash: cleanTxHash,
      p_from_wallet: senderWallet,
      p_amount: creditedPgtAmount
    });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!dbResult || !dbResult.success) {
      throw new Error(dbResult?.error || "Deposit credit was rejected by the database.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash: cleanTxHash,
        deposited: creditedPgtAmount,
        newBalance: dbResult.new_balance_pgt,
        message: `Successfully verified and credited +${creditedPgtAmount.toFixed(2)} PGT!`
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
