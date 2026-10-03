// ============================================================
// POLYGAME: ON-CHAIN PGT TOKEN WITHDRAWAL ENGINE
// Dedicated module for managing PGT withdrawals to Web3 wallets
// ============================================================

import { appState } from '../core/state.js';
import { triggerToast, closeModal } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { TOKEN_CONTRACT_ADDRESS, SUPABASE_URL, realSigner, supabase, TURNSTILE_SITE_KEY } from '../core/config.js';
import { sendAdminAlert } from '../utils/discord.js';

// Synchronize Withdraw Modal UI with dynamic limits and weekly 5-tx quota
export async function syncWithdrawModalUI() {
  const minLimit = appState.state.minWithdrawPgt || 10;
  const instantLimit = appState.state.maxWithdrawPgt || 3000;
  const balance = appState.state.balancePgt || 0;

  const availLabel = document.getElementById('withdraw-available-label');
  if (availLabel) availLabel.innerText = `${balance.toFixed(2)} PGT`;

  const limitsLabel = document.getElementById('withdraw-limits-label');
  if (limitsLabel) limitsLabel.innerText = `Min: ${minLimit} • Up to ${instantLimit.toLocaleString()} PGT`;

  const thresholdEl = document.getElementById('withdraw-instant-threshold');
  if (thresholdEl) thresholdEl.innerText = instantLimit.toLocaleString();

  const excessLabel = document.getElementById('withdraw-excess-label');
  if (excessLabel) excessLabel.innerText = 'No Max (Approved by Admin)';

  const input = document.getElementById('withdraw-input-amount');
  if (input) {
    input.min = minLimit;
    input.max = Math.floor(balance);
    input.value = Math.min(100, Math.floor(balance));
    updateSplitNotice();
    if (!input._hasSplitListener) {
      input.addEventListener('input', updateSplitNotice);
      input._hasSplitListener = true;
    }
  }

  const quotaLabel = document.getElementById('withdraw-weekly-quota-label');
  const btn = document.getElementById('btn-execute-withdraw');
  const quarantineDays = (appState.state.accountQuarantineDays !== undefined) ? appState.state.accountQuarantineDays : 7;

  // Check Dynamic Account Age Quarantine
  if (quarantineDays > 0) {
    if (!appState.state.createdAt) {
      if (quotaLabel) {
        quotaLabel.innerText = `⏳ Quarantined (${quarantineDays}d)`;
        quotaLabel.style.color = 'var(--color-warning)';
      }
      if (btn) {
        btn.disabled = true;
        btn.innerText = `Available in ${quarantineDays} Day(s) (Security Lock)`;
        btn.style.opacity = '0.5';
      }
      return;
    }
    const createdMs = new Date(appState.state.createdAt).getTime();
    const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
    if (ageDays < quarantineDays) {
      const daysLeft = Math.ceil(quarantineDays - ageDays);
      if (quotaLabel) {
        quotaLabel.innerText = `⏳ Quarantined (${daysLeft}d left)`;
        quotaLabel.style.color = 'var(--color-warning)';
      }
      if (btn) {
        btn.disabled = true;
        btn.innerText = `Available in ${daysLeft} Day(s) (${quarantineDays}-Day Security Lock)`;
        btn.style.opacity = '0.5';
      }
      return;
    }
  }

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

      // Self-Healing: Check for unconfirmed withdrawals from the last 24h that were never claimed on-chain
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentWithdrawals } = await supabase
        .from('withdrawals_history')
        .select('id, nonce, amount, created_at')
        .or(`player_id.ilike.${pid},wallet_address.ilike.${targetWallet}`)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentWithdrawals && recentWithdrawals.length > 0 && realSigner?.provider) {
        const lastWithdrawal = recentWithdrawals[0];
        try {
          const checkContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
            "function usedNonces(uint256) view returns (bool)"
          ], realSigner);
          const isUsed = await checkContract.usedNonces(lastWithdrawal.nonce);
          if (!isUsed) {
            console.log(`[Withdraw] Found unconsumed withdrawal for nonce ${lastWithdrawal.nonce} (${lastWithdrawal.amount} PGT). Auto-refunding...`);
            const { data: refData } = await supabase.rpc('refund_failed_withdrawal', {
              p_player_id: pid,
              p_nonce: lastWithdrawal.nonce
            });
            if (refData?.success) {
              if (typeof refData.new_balance === 'number') {
                appState.update({ balancePgt: refData.new_balance });
              } else {
                appState.update({ balancePgt: (appState.state.balancePgt || 0) + Number(lastWithdrawal.amount) });
              }
              appState.syncUI();
              triggerToast(`🔄 Unclaimed withdrawal of ${lastWithdrawal.amount} PGT restored back to your account!`, "info");
              // Refresh quota and labels after restore
              if (availLabel) availLabel.innerText = `${(appState.state.balancePgt || 0).toFixed(2)} PGT`;
            }
          }
        } catch (cErr) {
          console.warn("Could not check unconsumed withdrawal on-chain:", cErr);
        }
      }
    }
  } catch (err) {
    console.warn("Could not query weekly withdrawal quota:", err);
  }

  // Render or reset Cloudflare Turnstile human verification widget
  renderWithdrawTurnstile();
}

let turnstileWidgetId = null;
let currentTurnstileToken = null;

export function renderWithdrawTurnstile() {
  const container = document.getElementById('turnstile-withdraw-widget');
  if (!container) return;

  const statusEl = document.getElementById('turnstile-withdraw-status');

  if (typeof window.turnstile !== 'undefined') {
    // If widget was already rendered in this session, reset it cleanly
    if (turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
        currentTurnstileToken = null;
        if (statusEl) {
          statusEl.innerText = "Please complete the security check";
          statusEl.style.color = "var(--text-muted)";
          statusEl.style.display = "block";
        }
        return;
      } catch (e) {
        console.warn("Turnstile reset failed, will recreate:", e);
        turnstileWidgetId = null;
      }
    }

    container.innerHTML = '';
    try {
      turnstileWidgetId = window.turnstile.render('#turnstile-withdraw-widget', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: function (token) {
          currentTurnstileToken = token;
          if (statusEl) {
            statusEl.innerText = "✓ Human Verification Confirmed";
            statusEl.style.color = "var(--color-success)";
            statusEl.style.display = "block";
          }
        },
        'expired-callback': function () {
          currentTurnstileToken = null;
          if (statusEl) {
            statusEl.innerText = "Verification expired. Please re-verify.";
            statusEl.style.color = "var(--color-warning)";
            statusEl.style.display = "block";
          }
        },
        'error-callback': function () {
          currentTurnstileToken = null;
          if (statusEl) {
            statusEl.innerText = "Verification failed. Please retry.";
            statusEl.style.color = "var(--color-danger)";
            statusEl.style.display = "block";
          }
        }
      });
    } catch (err) {
      console.warn("Error rendering Turnstile widget:", err);
    }
  } else {
    // If Turnstile script tag is still loading in background, retry in 300ms
    setTimeout(renderWithdrawTurnstile, 300);
  }
}

export function resetWithdrawTurnstile() {
  currentTurnstileToken = null;
  if (turnstileWidgetId !== null && typeof window.turnstile !== 'undefined') {
    try {
      window.turnstile.reset(turnstileWidgetId);
    } catch (e) {}
  }
  const statusEl = document.getElementById('turnstile-withdraw-status');
  if (statusEl) {
    statusEl.innerText = "Verification required before withdrawal";
    statusEl.style.color = "var(--text-muted)";
    statusEl.style.display = "none";
  }
}

// Dynamically display split withdrawal notice for high-value requests
export function updateSplitNotice() {
  const input = document.getElementById('withdraw-input-amount');
  const notice = document.getElementById('withdraw-split-notice');
  if (!input || !notice) return;

  const amount = Math.floor(parseFloat(input.value)) || 0;
  const instantLimit = appState.state.maxWithdrawPgt || 3000;

  if (amount > instantLimit) {
    const manualAmount = amount - instantLimit;
    notice.style.display = 'block';
    notice.innerHTML = `<strong>⚡ Split Withdrawal (No Max Limit):</strong><br>• <strong>${instantLimit.toLocaleString()} PGT</strong> will be claimed instantly to your wallet (0.5 POL fee applies).<br>• <strong>${manualAmount.toLocaleString()} PGT</strong> will be approved by Admin & sent directly to your wallet.`;
  } else {
    notice.style.display = 'none';
  }
}

// Quick set withdrawal amount input helper
export function setWithdrawAmount(type) {
  const input = document.getElementById('withdraw-input-amount');
  if (!input) return;

  const minLimit = appState.state.minWithdrawPgt || 10;
  const maxBal = appState.state.balancePgt || 0;

  if (type === 'half') {
    input.value = Math.max(minLimit, Math.floor(maxBal / 2));
  } else if (type === 'max') {
    input.value = Math.max(minLimit, Math.floor(maxBal));
  }
  updateSplitNotice();
}

export async function executeWithdrawPGT() {
  if (window._isWithdrawExecuting) {
    console.warn("Withdrawal already in progress.");
    return;
  }
  window._isWithdrawExecuting = true;

  try {
    const amountInput = document.getElementById('withdraw-input-amount');
    if (!amountInput) return;

    const amount = Math.floor(parseFloat(amountInput.value)) || 0;
    const offChainBalance = appState.state.balancePgt || 0;
    const minLimit = appState.state.minWithdrawPgt || 10;
    const quarantineDays = (appState.state.accountQuarantineDays !== undefined) ? appState.state.accountQuarantineDays : 7;

    // Strict Dynamic Account Age Quarantine Check
    if (quarantineDays > 0) {
      if (!appState.state.createdAt) {
        triggerToast(`Security Lock: Account verification pending (${quarantineDays}-day lock required)!`, "error");
        return;
      }
      const createdMs = new Date(appState.state.createdAt).getTime();
      const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
      if (ageDays < quarantineDays) {
        const daysLeft = Math.ceil(quarantineDays - ageDays);
        triggerToast(`Security Lock: New accounts must wait ${quarantineDays} days before withdrawing (${daysLeft} day(s) remaining)!`, "error");
        return;
      }
    }

    if (amount < minLimit) {
      triggerToast(`Minimum withdrawal is ${minLimit} PGT!`, "error");
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

    // Require Cloudflare Turnstile verification before proceeding
    if (!currentTurnstileToken) {
      triggerToast("Please complete the Cloudflare Turnstile human verification check!", "warning");
      return;
    }

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

    // 1. PRE-FLIGHT CHECK: Query on-chain withdrawal fee and verify player has sufficient POL
    let feeWei = window.ethers.parseEther("0.5"); // Default fallback
    try {
      const feeContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
        "function withdrawalFee() view returns (uint256)"
      ], realSigner);
      feeWei = await feeContract.withdrawalFee();
    } catch (e) {
      console.warn("Could not query withdrawalFee from contract, using default 0.5 POL:", e);
    }

    if (realSigner.provider) {
      try {
        const polBalance = await realSigner.provider.getBalance(recipient);
        if (polBalance < feeWei) {
          const userPol = (Number(polBalance) / 1e18).toFixed(4);
          const requiredPol = (Number(feeWei) / 1e18).toFixed(2);
          triggerToast(`⚠️ Insufficient POL: You have ${userPol} POL in your wallet, but ${requiredPol} POL is required for the network distribution fee. Please add POL!`, "error");
          return; // Aborts before ANY PGT is deducted!
        }
      } catch (balErr) {
        console.warn("Could not pre-check POL balance:", balErr);
      }
    }

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
        nonceRequest: nonceRequest,
        turnstileToken: currentTurnstileToken
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      triggerToast(`Server rejected claim: ${result.error}`, "error");
      return;
    }

    const { signature, nonce, amountWei } = result;
    let activeNonce = nonce;

    // Call claimTokens on deployed ERC-20 PGT Contract
    const tokenContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, [
      "function claimTokens(uint256 amount, uint256 nonce, bytes memory signature) payable",
      "function withdrawalFee() view returns (uint256)"
    ], realSigner);

    triggerToast("Confirm transaction in MetaMask...", "success");

    const tx = await tokenContract.claimTokens(amountWei, nonce, signature, {
      value: feeWei
    });
    triggerToast("Withdrawal pending on-chain...", "success");

    await tx.wait();

    // Deduct off-chain balance locally (Edge function already updated DB atomically)
    appState.update({
      balancePgt: typeof result.newBalance === 'number' ? result.newBalance : (offChainBalance - amount)
    });

    sfx.playSuccess();
    if (result.isSplit) {
      triggerToast(`✅ Claimed ${result.amount} PGT instantly! Remaining ${Number(result.manualAmount).toLocaleString()} PGT queued for Admin review & payout.`, "success");
      appState.addActivity('You', `requested split withdrawal`, `-${amount} PGT (${result.amount} instant + ${result.manualAmount} queued)`);

      // 📢 Dispatch Admin Discord Alert for Queued Manual Review
      try {
        const recipientWallet = result.wallet_address || appState?.state?.linkedWalletAddress || appState?.state?.walletAddress || 'unknown';
        sendAdminAlert({
          title: "High-Value Split Withdrawal Queued",
          description: `Player requested **${Number(amount).toLocaleString()} PGT**. ${Number(result.amount).toLocaleString()} PGT claimed on-chain (0.5 POL fee paid). **${Number(result.manualAmount).toLocaleString()} PGT** is queued in Admin Operations for review & minting.`,
          category: "WITHDRAWAL",
          color: 0xFFAA00,
          fields: [
            { name: "💰 Total Requested", value: `${Number(amount).toLocaleString()} PGT`, inline: true },
            { name: "⚡ Instant Claimed", value: `${Number(result.amount).toLocaleString()} PGT`, inline: true },
            { name: "👑 Pending Manual Mint", value: `**${Number(result.manualAmount).toLocaleString()} PGT**`, inline: true },
            { name: "🦊 Recipient Wallet", value: `\`${recipientWallet}\``, inline: false }
          ]
        }).catch(() => {});
      } catch (alertErr) {
        console.warn("[Withdraw] Notice sending admin alert:", alertErr);
      }
    } else {
      triggerToast(`Withdrawal Success! Claimed ${amount} real PGT in your wallet!`, "success");
      appState.addActivity('You', `withdrew PGT on-chain`, `-${amount} PGT`);
    }

    closeModal('withdraw');
    appState.syncUI();

  } catch (err) {
    console.error("Withdrawal claim failed:", err);

    // 🛡️ AUTOMATIC ROLLBACK: If voucher was deducted in DB but failed/reverted on-chain, refund immediately!
    const activeId = (appState.getPlayerId() || appState.state.playerId || '').toLowerCase();
    const activeNonceVal = typeof activeNonce !== 'undefined' ? activeNonce : null;
    const withdrawAmount = Math.floor(parseFloat(document.getElementById('withdraw-input-amount')?.value || 0)) || 0;

    if (activeNonceVal && supabase) {
      try {
        const { data: refundRes, error: refundErr } = await supabase.rpc('refund_failed_withdrawal', {
          p_player_id: activeId,
          p_nonce: activeNonceVal
        });
        if (!refundErr && refundRes?.success) {
          const refundedTotal = typeof refundRes.refunded_amount === 'number' ? refundRes.refunded_amount : withdrawAmount;
          if (typeof refundRes.new_balance === 'number') {
            appState.update({ balancePgt: refundRes.new_balance });
          } else {
            appState.update({ balancePgt: (appState.state.balancePgt || 0) + refundedTotal });
          }
          appState.syncUI();
          triggerToast(`✅ PGT Refunded! ${refundedTotal.toLocaleString()} PGT restored back to your account.`, "success");
        } else {
          console.warn("[Withdraw] Auto-refund notice:", refundErr || refundRes);
        }
      } catch (refundEx) {
        console.warn("[Withdraw] Auto-refund exception:", refundEx);
      }
    }

    // Friendly Human-Readable Error Translator
    const errMsg = (err.reason || err.message || String(err)).toLowerCase();
    if (errMsg.includes('user rejected') || errMsg.includes('action_rejected') || errMsg.includes('denied')) {
      triggerToast("Transaction cancelled in wallet. PGT remained in your account.", "info");
    } else if (errMsg.includes('missing revert data') || errMsg.includes('c2c2a26b') || errMsg.includes('insufficient funds')) {
      triggerToast("⚠️ Withdrawal failed: Insufficient POL in your wallet to cover the 0.5 POL network fee or gas. PGT refunded!", "error");
    } else {
      triggerToast("Claim failed: " + (err.reason || err.message || err), "error");
    }
  } finally {
    resetWithdrawTurnstile();
    window._isWithdrawExecuting = false;
  }
}

if (typeof window !== 'undefined') {
  window.setWithdrawAmount = setWithdrawAmount;
  window.executeWithdrawPGT = executeWithdrawPGT;
  window.syncWithdrawModalUI = syncWithdrawModalUI;
  window.renderWithdrawTurnstile = renderWithdrawTurnstile;
  window.resetWithdrawTurnstile = resetWithdrawTurnstile;
}
