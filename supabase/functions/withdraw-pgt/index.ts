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
    const { walletAddress, amount, signature, nonceRequest } = await req.json();

    if (!walletAddress || !amount || !signature || !nonceRequest) {
      throw new Error("Missing required parameters");
    }

    if (amount > 100000) {
      throw new Error("Security Alert: Withdrawal amount exceeds single transaction cap of 100,000 PGT.");
    }

    // 1. Verify the signature actually came from the wallet owner
    // The player must sign the message: "Withdraw PGT: <nonceRequest>"
    const message = `Withdraw PGT: ${nonceRequest}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error("Signature verification failed! You do not own this wallet.");
    }

    // 2. Connect to Supabase using the Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Check the user's balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance_pgt')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (userError || !user) {
      throw new Error("User profile not found in database.");
    }

    if (user.balance_pgt < amount) {
      throw new Error("Insufficient off-chain PGT balance.");
    }

    // 4. Deduct the balance securely
    const newBalance = user.balance_pgt - amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance_pgt: newBalance })
      .eq('wallet_address', walletAddress.toLowerCase());

    if (updateError) {
      throw new Error("Failed to deduct balance from database.");
    }

    // 5. Generate the Smart Contract Voucher
    const ADMIN_PRIVATE_KEY = Deno.env.get('ADMIN_PRIVATE_KEY');
    if (!ADMIN_PRIVATE_KEY) {
      throw new Error("Server configuration error: Missing Admin Key");
    }

    const authorityWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);
    const TOKEN_CONTRACT_ADDRESS = Deno.env.get('TOKEN_CONTRACT_ADDRESS') ?? "0xYourContractAddressHere";
    const chainId = 137; // Polygon Mainnet
    
    // The smart contract expects: keccak256(abi.encodePacked(address(this), block.chainid, msg.sender, amount, nonce))
    // We generate a random nonce for the smart contract (different from the signature nonceRequest)
    const contractNonce = Math.floor(Math.random() * 100000000);
    const amountWei = ethers.parseEther(amount.toString());

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "address", "uint256", "uint256"],
      [TOKEN_CONTRACT_ADDRESS, chainId, walletAddress, amountWei, contractNonce]
    );

    const messageHashBytes = ethers.getBytes(messageHash);
    const claimSignature = await authorityWallet.signMessage(messageHashBytes);

    // 6. Return the voucher to the frontend
    return new Response(
      JSON.stringify({
        success: true,
        signature: claimSignature,
        nonce: contractNonce,
        amountWei: amountWei.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
