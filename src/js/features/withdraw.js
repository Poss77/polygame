// ============================================================
// POLYGAME: ON-CHAIN PGT TOKEN WITHDRAWAL ENGINE
// Dedicated module for managing PGT withdrawals to Web3 wallets
// ============================================================

import { appState } from '../core/state.js';
import { triggerToast, closeModal } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { TOKEN_CONTRACT_ADDRESS, SUPABASE_URL, realSigner, supabase } from '../core/config.js';

// Synchronize Withdraw Modal UI with dynamic limits and weekly 5-tx quota
export async function syncWithdrawModalUI() {
  const minLimit = appState.state.minWithdrawPgt || 10;
  const maxLimit = appState.state.maxWithdrawPgt || 100000;
  const balance = appState.state.balancePgt || 0;

  const availLabel = document.getElementById('withdraw-available-label');
  if (availLabel) availLabel.innerText = `${balance.toFixed(2)} PGT`;

  const limitsLabel = document.getElementById('withdraw-limits-label');
  if (limitsLabel) limitsLabel.innerText = `Min: ${minLimit} • Max: ${maxLimit.toLocaleString()} PGT`;

  const input = document.getElementById('withdraw-input-amount');
  if (input) {
    input.min = minLimit;
    input.max = Math.min(balance, maxLimit);
    input.value = Math.min(100, Math.floor(balance));
  }

  const quotaLabel = document.getElementById('withdraw-weekly-quota-label');
  const btn = document.getElementById('btn-execute-withdraw');

  // Query 7-day rolling withdrawal history
  try {
    const targetWallet = (appState.state.linkedWalletAddress || appState.state.walletAddress || '').toLowerCase();
    const pid = (appState.getPlayerId() || appState.state.playerId || '').toLowerCase();

    if (supabase && (targetWallet || pid)) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('withdrawals_history')
        .select('id', { count: 'exact', head: true })
        .or(`player_id.ilike.${pid},wallet_address.ilike.${targetWallet}`)
        .gte('created_at', sevenDaysAgo);

      if (!error && count !== null) {
        const maxWeekly = appState.state.maxWeeklyWithdrawals || 5;
        const used = count || 0;
        const remaining = Math.max(0, maxWeekly - used);
        if (quotaLabel) {
          quotaLabel.innerText = `${remaining} / ${maxWeekly} Remaining`;
          quotaLabel.style.color = remaining > 0 ? 'var(--color-success)' : 'var(--color-danger)';
        }
        if (btn) {
          if (remaining <= 0) {
            btn.disabled = true;
            btn.innerText = `Weekly Limit Reached (${maxWeekly}/${maxWeekly} Used)`;
            btn.style.opacity = '0.5';
          } else {
            btn.disabled = false;
            btn.innerText = 'Confirm & Withdraw';
            btn.style.opacity = '1';
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not query weekly withdrawal quota:", err);
  }
}

// Quick set withdrawal amount input helper
export function setWithdrawAmount(type) {
  const input = document.getElementById('withdraw-input-amount');
  if (!input) return;

  const minLimit = appState.state.minWithdrawPgt || 10;
  const maxLimit = appState.state.maxWithdrawPgt || 100000;
  const maxBal = appState.state.balancePgt || 0;

  if (type === 'half') {
    input.value = Math.max(minLimit, Math.floor(maxBal / 2));
  } else if (type === 'max') {
    input.value = Math.max(minLimit, Math.floor(Math.min(maxBal, maxLimit)));
  }
}

export async function executeWithdrawPGT() {
  const amountInput = document.getElementById('withdraw-input-amount');
  if (!amountInput) return;

  const amount = Math.floor(parseFloat(amountInput.value)) || 0;
  const offChainBalance = appState.state.balancePgt || 0;
  const minLimit = appState.state.minWithdrawPgt || 10;
  const maxLimit = appState.state.maxWithdrawPgt || 100000;

  if (amount < minLimit) {
    triggerToast(`Minimum withdrawal is ${minLimit} PGT!`, "error");
    return;
  }
  if (amount > maxLimit) {
    triggerToast(`Maximum single withdrawal limit is ${maxLimit.toLocaleString()} PGT!`, "error");
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
    triggerToast("Please configure valid PGT contract address", "error");
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

// Attach event listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnWithdraw = document.getElementById('btn-execute-withdraw');
  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', executeWithdrawPGT);
  }
});

if (typeof window !== 'undefined') {
  window.setWithdrawAmount = setWithdrawAmount;
  window.executeWithdrawPGT = executeWithdrawPGT;
  window.syncWithdrawModalUI = syncWithdrawModalUI;
}
