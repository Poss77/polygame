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

    // 3. Query Dynamic Limits from global_settings table
    const { data: gs } = await supabase
      .from('global_settings')
      .select('min_withdraw_pgt, max_withdraw_pgt, max_weekly_withdrawals')
      .eq('id', 1)
      .maybeSingle();

    const minLimit = Number(gs?.min_withdraw_pgt ?? 10);
    const maxLimit = Number(gs?.max_withdraw_pgt ?? 100000);
    const maxWeeklyWithdrawals = Number(gs?.max_weekly_withdrawals ?? 5);

    if (amount < minLimit) {
      throw new Error(`Minimum single withdrawal limit is ${minLimit} PGT per transaction.`);
    }

    if (amount > maxLimit) {
      throw new Error(`Security Limit: Maximum single withdrawal limit is ${maxLimit.toLocaleString()} PGT per transaction.`);
    }

    // 4. Check the user's balance using player_id or linked_wallet_address
    const normAddr = walletAddress.toLowerCase();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('player_id, balance_pgt, linked_wallet_address')
      .or(`player_id.ilike.${normAddr},linked_wallet_address.ilike.${normAddr}`)
      .maybeSingle();

    if (userError || !user) {
      throw new Error("User profile not found in database.");
    }

    if (user.balance_pgt < amount) {
      throw new Error("Insufficient off-chain PGT balance.");
    }

    // 5. Enforce configurable weekly withdrawal quota (rolling 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const pid = user.player_id.toLowerCase();
    const { count: recentCount, error: countError } = await supabase
      .from('withdrawals_history')
      .select('id', { count: 'exact', head: true })
      .or(`player_id.ilike.${pid},wallet_address.ilike.${normAddr}`)
      .gte('created_at', sevenDaysAgo);

    if (recentCount !== null && recentCount >= maxWeeklyWithdrawals) {
      throw new Error(`Weekly Limit Reached: Maximum ${maxWeeklyWithdrawals} withdrawals allowed per 7-day period (${recentCount}/${maxWeeklyWithdrawals} used). Please wait for previous withdrawals to mature out of the 7-day window.`);
    }

    // 6. Deduct the balance securely by target player_id
    const newBalance = user.balance_pgt - amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance_pgt: newBalance, updated_at: new Date().toISOString() })
      .eq('player_id', user.player_id);

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

    // 8. Record transaction into withdrawals_history
    await supabase.from('withdrawals_history').insert({
      player_id: user.player_id,
      wallet_address: normAddr,
      amount: amount,
      nonce: contractNonce,
      created_at: new Date().toISOString()
    });

    // 9. Return the voucher to the frontend
    return new Response(
      JSON.stringify({
        success: true,
        signature: claimSignature,
        nonce: contractNonce,
        amountWei: amountWei.toString(),
        weeklyUsed: (recentCount || 0) + 1,
        weeklyLimit: maxWeeklyWithdrawals
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
