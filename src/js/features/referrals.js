import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';


// Secure hash utility to prevent manual local storage editing (Anti-cheat)
export function cyb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334903);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
export const CHECKSUM_SALT = "polygame_secret_salt_1982";



import { supabase } from '../core/config.js';

// Copy ref link
document.getElementById('btn-copy-ref-link').addEventListener('click', () => {
  const link = document.getElementById('ref-invite-link');
  link.select();
  link.setSelectionRange(0, 99999); // mobile compatibility
  navigator.clipboard.writeText(link.value).then(() => {
    sfx.playCoin();
    triggerToast("Referral link copied to clipboard!", 'success');
  });
});

// Harvest Referral Rewards
const btnHarvestRef = document.getElementById('btn-harvest-ref-rewards');
if (btnHarvestRef) {
  btnHarvestRef.addEventListener('click', async () => {
    const currentUnclaimed = appState.state.unclaimedReferralPgt || 0;
    if (currentUnclaimed <= 0) {
      triggerToast("No unclaimed referral rewards available yet!", "info");
      return;
    }

    btnHarvestRef.disabled = true;
    btnHarvestRef.innerText = "Harvesting...";

    try {
      if (appState.isPlayerConnected() && supabase) {
        const { data: harvestedAmt, error } = await supabase.rpc('harvest_referral_rewards', {
          user_wallet: appState.state.walletAddress.toLowerCase()
        });

        if (!error && (harvestedAmt || harvestedAmt === 0)) {
          const claimed = parseFloat(harvestedAmt) || currentUnclaimed;
          appState.update({
            balancePgt: appState.state.balancePgt + claimed,
            unclaimedReferralPgt: 0
          });
          if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
          triggerToast(`🌾 Harvested ${claimed.toFixed(2)} PGT referral rewards!`, "success");
        } else {
          // Fallback if DB RPC isn't deployed yet
          appState.update({
            balancePgt: appState.state.balancePgt + currentUnclaimed,
            unclaimedReferralPgt: 0
          });
          if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
          triggerToast(`🌾 Harvested ${currentUnclaimed.toFixed(2)} PGT referral rewards!`, "success");
        }
      } else {
        // Guest mode offline harvest
        appState.update({
          balancePgt: appState.state.balancePgt + currentUnclaimed,
          unclaimedReferralPgt: 0
        });
        if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
        triggerToast(`🌾 Harvested ${currentUnclaimed.toFixed(2)} PGT referral rewards!`, "success");
      }
    } catch (err) {
      console.error("Harvest referral rewards error:", err);
      triggerToast("Failed to harvest referral rewards: " + (err.message || err), "error");
    } finally {
      btnHarvestRef.disabled = false;
      btnHarvestRef.innerText = "Harvest Referral Rewards";
    }
  });
}

// Capture referral code from URL immediately and on DOMContentLoaded
export function captureReferralCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || params.get('referrer');
    if (refCode) {
      localStorage.setItem('polygame_pending_referral', refCode.trim());
      console.log("Captured pending referral code:", refCode.trim());
    }
  } catch (e) {
    console.warn("Failed to parse referral URL:", e);
  }
}

captureReferralCode();
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', captureReferralCode);
}




// Request POL Referral Payout
export async function requestPolReferralPayout() {
  if (!appState.isPlayerConnected()) {
    triggerToast("Please connect your Web3 wallet to request POL referral payouts!", "error");
    return;
  }

  const unclaimed = appState.state.unclaimedReferralPol || 0;
  if (unclaimed <= 0) {
    triggerToast("No unclaimed POL referral rewards available!", "info");
    return;
  }

  const wallet = appState.state.walletAddress.toLowerCase();
  const btn = document.getElementById('btn-request-pol-payout');
  if (btn) { btn.disabled = true; btn.innerText = "Submitting Request..."; }

  try {
    const { data: res, error } = await supabase.rpc('request_pol_referral_payout', {
      p_user_wallet: wallet,
      p_amount: unclaimed
    });

    if (error) throw error;

    if (res && res.success) {
      appState.update({ unclaimedReferralPol: 0 });
      if (sfx && sfx.playSuccess) sfx.playSuccess();
      triggerToast(`🎉 POL Payout request of ${unclaimed.toFixed(4)} POL submitted! Master Admin will review and send your payment on-chain.`, "success");
      updateReferralUiStats();
    } else {
      triggerToast("Payout request failed: " + (res?.reason || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("POL Payout Request Exception:", err);
    triggerToast("Failed to submit payout request: " + (err.message || err), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = "💸 Request POL Payout"; }
  }
}
window.requestPolReferralPayout = requestPolReferralPayout;

export function updateReferralUiStats() {
  const pgtUnclaimedEl = document.getElementById('ref-stat-unclaimed');
  const polUnclaimedEl = document.getElementById('ref-stat-unclaimed-pol');
  const polTotalEl = document.getElementById('ref-stat-total-pol');

  if (pgtUnclaimedEl) pgtUnclaimedEl.innerText = `${(appState.state.unclaimedReferralPgt || 0).toFixed(2)} PGT`;
  if (polUnclaimedEl) polUnclaimedEl.innerText = `${(appState.state.unclaimedReferralPol || 0).toFixed(4)} POL`;
  if (polTotalEl) polTotalEl.innerText = `${(appState.state.totalReferralPol || 0).toFixed(4)} POL`;

  const nftMultEl = document.getElementById('referral-nft-multiplier-val');
  if (nftMultEl && window.appState) {
    const multis = window.appState.getMultipliers();
    const multVal = multis.rawNftReferralMultiplier || multis.nftReferralMultiplier || 1.0;
    const bonusPct = Math.round((multVal - 1.0) * 100);
    nftMultEl.innerText = `${multVal.toFixed(2)}x (+${bonusPct}%)`;
  }

  const vipBadge = document.getElementById('referral-vip-badge');
  if (vipBadge && window.appState && window.appState.isVipActive) {
    vipBadge.style.display = window.appState.isVipActive() ? 'block' : 'none';
  }

  const ambBadge = document.getElementById('referral-ambassador-badge');
  if (ambBadge && window.appState) {
    ambBadge.style.display = !!window.appState.state.isAmbassador ? 'block' : 'none';
  }
}
window.updateReferralUiStats = updateReferralUiStats;

export let activeReferralLeaderboardMode = 'pgt'; // 'pgt' or 'pol'

export async function loadTopReferrersLeaderboard(mode = activeReferralLeaderboardMode) {
  activeReferralLeaderboardMode = mode;
  const container = document.getElementById('leaderboard-ref-container');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Loading top referrers...</div>';

  try {
    const sortCol = mode === 'pol' ? 'total_referral_pol' : 'total_referral_commission';
    const { data: users, error } = await supabase
      .from('users')
      .select('wallet_address, username, total_referral_commission, total_referral_pol, referrals_count')
      .gt(sortCol, 0)
      .order(sortCol, { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!users || users.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">No ${mode.toUpperCase()} referral earners recorded yet. Be the first!</div>`;
      return;
    }

    let html = '';
    users.forEach((u, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const name = u.username || (u.wallet_address ? `${u.wallet_address.substring(0,6)}...${u.wallet_address.substring(38)}` : `Player ${rank}`);
      const val = mode === 'pol' 
        ? `${parseFloat(u.total_referral_pol || 0).toFixed(4)} POL`
        : `${parseFloat(u.total_referral_commission || 0).toFixed(2)} PGT`;

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.2); border:1px solid var(--border-glass); border-radius:6px; margin-bottom:0.4rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-weight:800; font-size:0.9rem; min-width:24px;">${medal}</span>
            <span style="font-size:0.85rem; font-weight:700; color:#fff; cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" onclick="openPublicProfile('${u.wallet_address}')" title="Click to view public profile">${name}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.85rem; font-weight:800; color:${mode==='pol'?'var(--color-primary)':'var(--color-accent)'};">${val}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${u.referrals_count || 0} Downlines</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error("Failed to load top referrers leaderboard:", err);
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--color-danger);">Failed to load leaderboard.</div>';
  }
}
window.loadTopReferrersLeaderboard = loadTopReferrersLeaderboard;


export function switchReferralLeaderboardTab(mode) {
  const pgtBtn = document.getElementById('btn-ref-tab-pgt');
  const polBtn = document.getElementById('btn-ref-tab-pol');
  if (mode === 'pol') {
    if (pgtBtn) pgtBtn.classList.remove('active');
    if (polBtn) polBtn.classList.add('active');
  } else {
    if (pgtBtn) pgtBtn.classList.add('active');
    if (polBtn) polBtn.classList.remove('active');
  }
  loadTopReferrersLeaderboard(mode);
}
window.switchReferralLeaderboardTab = switchReferralLeaderboardTab;
