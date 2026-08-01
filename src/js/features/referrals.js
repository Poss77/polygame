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

  if (typeof loadMyDownlineNetwork === 'function') {
    loadMyDownlineNetwork();
  }
}
window.updateReferralUiStats = updateReferralUiStats;

export async function loadMyDownlineNetwork() {
  if (!appState || !supabase) return;

  const primaryAddr = appState.state.walletAddress ? appState.state.walletAddress.toLowerCase() : '';
  const linkedAddr = appState.state.linkedWalletAddress ? appState.state.linkedWalletAddress.toLowerCase() : '';
  
  if (!primaryAddr && !linkedAddr) return;

  const container = document.getElementById('ref-downline-ledger');
  if (!container) return;

  try {
    let filters = [];
    if (primaryAddr) {
      filters.push(`referred_by_l1.ilike.${primaryAddr}`);
      filters.push(`referred_by_l2.ilike.${primaryAddr}`);
      filters.push(`referred_by_l3.ilike.${primaryAddr}`);
      filters.push(`referred_by_l4.ilike.${primaryAddr}`);
    }
    if (linkedAddr && linkedAddr !== primaryAddr) {
      filters.push(`referred_by_l1.ilike.${linkedAddr}`);
      filters.push(`referred_by_l2.ilike.${linkedAddr}`);
      filters.push(`referred_by_l3.ilike.${linkedAddr}`);
      filters.push(`referred_by_l4.ilike.${linkedAddr}`);
    }

    const { data: downlines, error } = await supabase
      .from('users')
      .select('wallet_address, linked_wallet_address, username, email, created_at, balance_pgt, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4')
      .or(filters.join(','))
      .order('created_at', { ascending: false });

    if (error) throw error;

    let countL1 = 0, countL2 = 0, countL3 = 0, countL4 = 0;
    const isMyAddr = (addr) => addr && (addr.toLowerCase() === primaryAddr || (linkedAddr && addr.toLowerCase() === linkedAddr));

    const list = downlines || [];
    list.forEach(u => {
      if (isMyAddr(u.referred_by_l1)) countL1++;
      else if (isMyAddr(u.referred_by_l2)) countL2++;
      else if (isMyAddr(u.referred_by_l3)) countL3++;
      else if (isMyAddr(u.referred_by_l4)) countL4++;
    });

    const totalCount = countL1 + countL2 + countL3 + countL4;

    // Live update appState & DOM counters
    appState.state.referralsL1 = countL1;
    appState.state.referralsL2 = countL2;
    appState.state.referralsL3 = countL3;
    appState.state.referralsL4 = countL4;
    appState.state.referralsCount = totalCount;

    const elCount = document.getElementById('ref-stat-count');
    const elL1 = document.getElementById('ref-level-1-count');
    const elL2 = document.getElementById('ref-level-2-count');
    const elL3 = document.getElementById('ref-level-3-count');
    const elL4 = document.getElementById('ref-level-4-count');

    if (elCount) elCount.innerText = totalCount;
    if (elL1) elL1.innerText = countL1;
    if (elL2) elL2.innerText = countL2;
    if (elL3) elL3.innerText = countL3;
    if (elL4) elL4.innerText = countL4;

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 1.5rem 0; color: var(--text-dim); font-size: 0.85rem;">No referred downlines recorded yet. Share your invite link above to build your network!</div>`;
      return;
    }

    let html = '';
    list.forEach(u => {
      let tier = 'L1 (10%)';
      let tierColor = 'var(--color-primary)';
      if (isMyAddr(u.referred_by_l2)) { tier = 'L2 (5%)'; tierColor = 'var(--color-accent)'; }
      else if (isMyAddr(u.referred_by_l3)) { tier = 'L3 (2%)'; tierColor = '#ff00ff'; }
      else if (isMyAddr(u.referred_by_l4)) { tier = 'L4 (1%)'; tierColor = 'var(--color-warning)'; }

      const isInternal = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
      const realW = (u.linked_wallet_address && !isInternal(u.linked_wallet_address)) ? u.linked_wallet_address : (!isInternal(u.wallet_address) ? u.wallet_address : '');
      let nameStr = u.username;
      if (!nameStr || nameStr.trim() === '') {
        nameStr = realW && realW.length >= 42 ? `Player_${realW.substring(0,6)}...${realW.substring(realW.length - 4)}` : (u.email ? u.email.split('@')[0] : 'Player_' + (u.wallet_address ? u.wallet_address.substring(u.wallet_address.length - 4) : 'User'));
      }

      const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent';

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:6px; margin-bottom:0.4rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:0.7rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px; background:rgba(255,255,255,0.06); color:${tierColor}; border:1px solid ${tierColor};">${tier}</span>
              <strong style="color:#fff; font-size:0.85rem;">${nameStr}</strong>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;">Joined: ${joinDate}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--color-primary);">${parseFloat(u.balance_pgt || 0).toFixed(2)} PGT</div>
            <div style="font-size:0.7rem; color:var(--text-dim);">Active Downline</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error("Failed to load downline network list:", err);
  }
}
window.loadMyDownlineNetwork = loadMyDownlineNetwork;

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
      const isInternal = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
      const w = u.wallet_address || '';
      const name = u.username || (!isInternal(w) && w.length >= 42 ? `${w.substring(0,6)}...${w.substring(w.length - 4)}` : `Player_${w.length >= 4 ? w.substring(w.length - 4) : rank}`);
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
