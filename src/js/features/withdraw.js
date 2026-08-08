// ============================================================
// POLYGAME: ON-CHAIN PGT TOKEN WITHDRAWAL ENGINE
// Dedicated module for managing PGT withdrawals to Web3 wallets
// ============================================================

import { appState } from '../core/state.js';
import { triggerToast, closeModal } from '../core/ui.js';
import { sfx } from '../core/sound.js';
import { TOKEN_CONTRACT_ADDRESS, SUPABASE_URL, realSigner } from '../core/config.js';

// Quick set withdrawal amount input helper
export function setWithdrawAmount(type) {
  const input = document.getElementById('withdraw-input-amount');
  if (!input) return;

  const maxBal = appState.state.balancePgt;
  if (type === 'half') {
    input.value = Math.max(10, Math.floor(maxBal / 2));
  } else if (type === 'max') {
    input.value = Math.max(10, Math.floor(maxBal));
  }
}

export async function executeWithdrawPGT() {
  const amountInput = document.getElementById('withdraw-input-amount');
  if (!amountInput) return;

  const amount = Math.floor(parseFloat(amountInput.value)) || 0;
  const offChainBalance = appState.state.balancePgt;

  if (amount < 10) {
    triggerToast("Minimum withdrawal is 10 PGT!", "error");
    return;
  }
  if (amount > 20000) {
    triggerToast("Maximum single withdrawal limit is 20,000 PGT!", "error");
    return;
  }
  if (amount > offChainBalance) {
    triggerToast("Insufficient off-chain balance!", "error");
    return;
  }

  const targetWallet = appState.state.linkedWalletAddress || appState.state.walletAddress;
  if (!appState.state.walletConnected || !targetWallet || targetWallet.startsWith('0xg') || (typeof window.isValidEthereumAddress === 'function' && !window.isValidEthereumAddress(targetWallet))) {
    triggerToast("Please link a valid real Web3 wallet first to withdraw tokens!", "error");
    if (window.openModal) window.openModal('wallet');
    return;
  }

  if (!TOKEN_CONTRACT_ADDRESS || TOKEN_CONTRACT_ADDRESS.length !== 42) {
    triggerToast("Please enter your PGT contract address at the top of app.js", "error");
    return;
  }

  try {
    const isExternalMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.ethereum;
    if (isExternalMobile) {
      triggerToast("💡 On-chain Withdrawals require a Web3 Browser. Please use PC Chrome or MetaMask Mobile Browser!", "warning");
      if (typeof window.openModal === 'function') window.openModal('wallet');
      return;
    }

    if (!realSigner) {
      triggerToast("Web3 wallet not connected. Please use Desktop PC (Chrome) or MetaMask Mobile Browser!", "error");
      if (typeof window.openModal === 'function') window.openModal('wallet');
      return;
    }

    const recipient = targetWallet.toLowerCase();
    const nonceRequest = Math.floor(Math.random() * 100000000);
    const messageToSign = `Withdraw PGT: ${nonceRequest}`;

    triggerToast("Please sign the MetaMask message to verify identity...", "success");
    const playerSignature = await realSigner.signMessage(messageToSign);

    triggerToast("Generating authorization voucher securely...", "success");

    // Use the imported SUPABASE_URL to point to the edge function
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/withdraw-pgt`;

    const canonicalId = (appState.getPlayerId() || appState.state.playerId || recipient).toLowerCase();
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: canonicalId,
        walletAddress: recipient,
        linkedWalletAddress: recipient,
        amount: amount,
        signature: playerSignature,
        nonceRequest: nonceRequest
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      triggerToast(`Server rejected claim: ${result.error}`, "error");
      return;
    }

    const { signature, nonce, amountWei } = result;

    // Call claimTokens on deployed ERC-20 PGT Contract
    const tokenContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
      "function claimTokens(uint256 amount, uint256 nonce, bytes memory signature) payable",
      "function withdrawalFee() view returns (uint256)"
    ], realSigner);

    let feeWei = window.ethers.parseEther("0.5"); // Default fallback
    try {
      feeWei = await tokenContract.withdrawalFee();
    } catch (e) {
      console.warn("Could not query withdrawalFee from contract, using default 0.5 POL:", e);
    }

    triggerToast("Confirm transaction in MetaMask...", "success");

    const tx = await tokenContract.claimTokens(amountWei, nonce, signature, {
      value: feeWei
    });
    triggerToast("Withdrawal pending on-chain...", "success");

    await tx.wait();

    // Deduct off-chain balance locally (Edge function already updated DB)
    appState.update({
      balancePgt: offChainBalance - amount
    });

    sfx.playSuccess();
    triggerToast(`Withdrawal Success! Claimed ${amount} real PGT in your wallet!`, "success");
    appState.addActivity('You', `withdrew PGT on-chain`, `-${amount} PGT`);

    closeModal('withdraw');
    appState.syncUI();

  } catch (err) {
    console.error("Withdrawal claim failed:", err);
    triggerToast("Claim failed: " + (err.reason || err.message || err), "error");
  }
}

if (typeof window !== 'undefined') {
  window.setWithdrawAmount = setWithdrawAmount;
  window.executeWithdrawPGT = executeWithdrawPGT;
}
