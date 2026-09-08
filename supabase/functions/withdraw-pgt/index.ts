import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { ethers } from "https://esm.sh/ethers@6.11.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { walletAddress, amount, signature, nonceRequest, playerId } = await req.json();

    if (!walletAddress || !amount || !signature || !nonceRequest) {
      throw new Error("Missing required parameters");
    }

    // Extract client real IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // 1. Verify the signature actually came from the wallet owner
    const message = `Withdraw PGT: ${nonceRequest}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error("Signature verification failed! You do not own this wallet.");
    }

    // 2. Connect to Supabase using the Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration error: Missing Supabase Service Credentials");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Generate random contract nonce
    const contractNonce = Math.floor(Math.random() * 100000000);

    // 4. Atomic Database Validation, Rate Limiting, & Balance Deduction
    const targetPlayerId = playerId || walletAddress;
    const { data: dbResult, error: dbError } = await supabase.rpc('request_withdrawal_voucher', {
      p_player_id: targetPlayerId,
      p_wallet_address: walletAddress,
      p_amount: Number(amount),
      p_ip_address: clientIp,
      p_nonce: contractNonce
    });

    if (dbError) {
      throw new Error(`Database transaction error: ${dbError.message}`);
    }

    if (!dbResult || !dbResult.success) {
      throw new Error(dbResult?.error || "Withdrawal request rejected by database.");
    }

    // 5. Generate the Smart Contract Voucher
    const ADMIN_PRIVATE_KEY = Deno.env.get('ADMIN_PRIVATE_KEY');
    if (!ADMIN_PRIVATE_KEY) {
      // Rollback database deduction if key is missing
      await supabase.rpc('cancel_withdrawal_voucher', { p_nonce: contractNonce });
      throw new Error("Server configuration error: Missing Admin Key");
    }

    const authorityWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);
    const TOKEN_CONTRACT_ADDRESS = Deno.env.get('TOKEN_CONTRACT_ADDRESS') ?? "0x701100D19b1a93672cfe7291EA455b4220631209";
    const chainId = 137; // Polygon Mainnet
    
    // The smart contract expects: keccak256(abi.encodePacked(address(this), block.chainid, msg.sender, amount, nonce))
    const amountWei = ethers.parseEther(amount.toString());

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "address", "uint256", "uint256"],
      [TOKEN_CONTRACT_ADDRESS, chainId, walletAddress, amountWei, contractNonce]
    );

    const messageHashBytes = ethers.getBytes(messageHash);
    const claimSignature = await authorityWallet.signMessage(messageHashBytes);

    // Return the voucher to the frontend
    return new Response(
      JSON.stringify({
        success: true,
        signature: claimSignature,
        nonce: contractNonce,
        amountWei: amountWei.toString(),
        newBalance: dbResult.new_balance,
        weeklyUsed: dbResult.weekly_used,
        weeklyLimit: dbResult.weekly_limit
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

