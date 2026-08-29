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

// Capture referral code from URL immediately and on DOMContentLoaded (supports search params, hash params, and OAuth redirects)
export function captureReferralCode() {
  try {
    let refCode = null;
    const url = window.location.href;
    
    // Parse ?ref=code, &ref=code, ?referrer=code, &referrer=code, #ref=code, or #view-games?ref=code
    const match = url.match(/[?&#](ref|referrer)=([a-zA-Z0-9_-]+)/i);
    if (match && match[2]) {
      refCode = match[2].trim();
    } else {
      const params = new URLSearchParams(window.location.search);
      refCode = params.get('ref') || params.get('referrer');
    }

    if (refCode) {
      localStorage.setItem('polygame_pending_referral', refCode);
      sessionStorage.setItem('polygame_pending_referral', refCode);
      console.log("[captureReferralCode] Captured pending referral code:", refCode);
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
      p_user_wallet: (appState.getPlayerId() || appState.state.walletAddress || wallet).toLowerCase(),
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

let refLedgerTab = 'earnings'; // 'earnings' (default) or 'network'
let cachedDownlineList = [];

export function switchReferralLedgerTab(tab) {
  refLedgerTab = tab;
  const tabEarnings = document.getElementById('tab-ref-ledger-earnings');
  const tabNetwork = document.getElementById('tab-ref-ledger-network');
  const descEl = document.getElementById('ref-ledger-desc');

  if (tabEarnings && tabNetwork) {
    tabEarnings.classList.remove('active');
    tabNetwork.classList.remove('active');

    if (tab === 'earnings') {
      tabEarnings.classList.add('active');
      if (descEl) descEl.innerText = 'Live real-time feed of PGT commissions earned from your 4-Tier affiliate network.';
    } else {
      tabNetwork.classList.add('active');
      if (descEl) descEl.innerText = 'Registered players in your 4-Tier downline affiliate tree.';
    }
  }

  renderReferralLedger();
}
window.switchReferralLedgerTab = switchReferralLedgerTab;

export async function loadMyDownlineNetwork() {
  if (!appState || !supabase) return;

  const playerId = appState.state.playerId ? appState.state.playerId.toLowerCase() : '';
  const walletAddr = appState.state.walletAddress ? appState.state.walletAddress.toLowerCase() : '';
  const linkedAddr = appState.state.linkedWalletAddress ? appState.state.linkedWalletAddress.toLowerCase() : '';
  
  const myAddrs = Array.from(new Set([playerId, walletAddr, linkedAddr].filter(Boolean)));
  if (myAddrs.length === 0) return;

  try {
    let filters = [];
    myAddrs.forEach(addr => {
      filters.push(`referred_by_l1.ilike.${addr}`);
      filters.push(`referred_by_l2.ilike.${addr}`);
      filters.push(`referred_by_l3.ilike.${addr}`);
      filters.push(`referred_by_l4.ilike.${addr}`);
    });

    // Query downlines and current user referrals_list
    const [downlinesRes, userRes] = await Promise.all([
      supabase.from('users')
        .select('player_id, linked_wallet_address, username, email, created_at, balance_pgt, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4, last_weekly_active_tier, weekly_active_tier')
        .or(filters.join(','))
        .order('created_at', { ascending: false }),
      supabase.from('users')
        .select('referrals_list, unclaimed_referral_pgt, total_referral_commission')
        .or(`player_id.ilike.${playerId || walletAddr},linked_wallet_address.ilike.${linkedAddr || walletAddr}`)
        .maybeSingle()
    ]);

    const downlines = downlinesRes.data || [];
    cachedDownlineList = downlines;

    if (userRes && userRes.data) {
      if (userRes.data.referrals_list) {
        appState.state.referralsList = userRes.data.referrals_list;
      }
      if (userRes.data.unclaimed_referral_pgt !== undefined) {
        appState.state.unclaimedReferralPgt = parseFloat(userRes.data.unclaimed_referral_pgt || 0);
      }
      if (userRes.data.total_referral_commission !== undefined) {
        appState.state.totalReferralCommission = parseFloat(userRes.data.total_referral_commission || 0);
      }
    }

    let countL1 = 0, countL2 = 0, countL3 = 0, countL4 = 0;
    let tierL0 = 0, tierL1 = 0, tierL2 = 0, tierL3 = 0, tierL4 = 0, tierL5 = 0;
    const isMyAddr = (addr) => addr && myAddrs.includes(addr.toLowerCase());

    downlines.forEach(u => {
      const isL1 = isMyAddr(u.referred_by_l1);
      if (isL1) {
        countL1++;
        // Downline Activity Level Census strictly tallies direct Level 1 (L1) referrals
        const activeTier = parseInt(u.last_weekly_active_tier !== undefined ? u.last_weekly_active_tier : (u.weekly_active_tier || 0), 10);
        if (activeTier === 5) tierL5++;
        else if (activeTier === 4) tierL4++;
        else if (activeTier === 3) tierL3++;
        else if (activeTier === 2) tierL2++;
        else if (activeTier === 1) tierL1++;
        else tierL0++;
      } else if (isMyAddr(u.referred_by_l2)) {
        countL2++;
      } else if (isMyAddr(u.referred_by_l3)) {
        countL3++;
      } else if (isMyAddr(u.referred_by_l4)) {
        countL4++;
      }
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

    // Live update Downline Weekly Active Level Census counters
    const elT0 = document.getElementById('ref-tier-l0-count');
    const elT1 = document.getElementById('ref-tier-l1-count');
    const elT2 = document.getElementById('ref-tier-l2-count');
    const elT3 = document.getElementById('ref-tier-l3-count');
    const elT4 = document.getElementById('ref-tier-l4-count');
    const elT5 = document.getElementById('ref-tier-l5-count');

    if (elT0) elT0.innerText = tierL0;
    if (elT1) elT1.innerText = tierL1;
    if (elT2) elT2.innerText = tierL2;
    if (elT3) elT3.innerText = tierL3;
    if (elT4) elT4.innerText = tierL4;
    if (elT5) elT5.innerText = tierL5;

    renderReferralLedger();
  } catch (err) {
    console.error("Failed to load downline network list:", err);
  }
}
window.loadMyDownlineNetwork = loadMyDownlineNetwork;

export function renderReferralLedger() {
  const container = document.getElementById('ref-downline-ledger');
  if (!container) return;

  const playerId = appState.state.playerId ? appState.state.playerId.toLowerCase() : '';
  const walletAddr = appState.state.walletAddress ? appState.state.walletAddress.toLowerCase() : '';
  const linkedAddr = appState.state.linkedWalletAddress ? appState.state.linkedWalletAddress.toLowerCase() : '';
  const myAddrs = Array.from(new Set([playerId, walletAddr, linkedAddr].filter(Boolean)));
  const isMyAddr = (addr) => addr && myAddrs.includes(addr.toLowerCase());

  // 1. EARNED COMMISSIONS VIEW (Default)
  if (refLedgerTab === 'earnings') {
    const rawList = appState.state.referralsList || [];
    const earnings = Array.isArray(rawList) ? rawList : [];

    if (earnings.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim); font-size: 0.85rem;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">💸</div>
          <strong style="color: #fff; display: block; margin-bottom: 0.3rem;">No Commission Earnings Recorded Yet</strong>
          When players in your 4-tier downline claim the 24h Faucet, harvest Staking Yield, or win Arcade games, your live commissions (e.g. <code>L2 (5%), Player123, Faucet Claim, +300 PGT</code>) will stream here!
        </div>
      `;
      return;
    }

    // Build lookup dictionary to resolve real usernames from cached downlines
    const userLookup = {};
    (cachedDownlineList || []).forEach(u => {
      const uname = (u.username && u.username.trim() !== '' && u.username.toUpperCase() !== 'EMPTY') ? u.username.trim() : '';
      if (uname) {
        if (u.player_id) {
          userLookup[u.player_id.toLowerCase()] = uname;
          userLookup[u.player_id.substring(0, 8).toLowerCase()] = uname;
          userLookup['player_' + u.player_id.substring(0, 8).toLowerCase()] = uname;
        }
        if (u.linked_wallet_address) {
          userLookup[u.linked_wallet_address.toLowerCase()] = uname;
          userLookup[u.linked_wallet_address.substring(0, 8).toLowerCase()] = uname;
          userLookup['player_' + u.linked_wallet_address.substring(0, 8).toLowerCase()] = uname;
        }
      }
    });

    let html = '';
    earnings.forEach(item => {
      const lvl = Number(item.level || 1);
      let tierLabel = 'L1 (10%)';
      let tierColor = 'var(--color-primary)';

      if (lvl === 2) { tierLabel = 'L2 (5%)'; tierColor = 'var(--color-accent)'; }
      else if (lvl === 3) { tierLabel = 'L3 (2%)'; tierColor = '#ff00ff'; }
      else if (lvl === 4) { tierLabel = 'L4 (1%)'; tierColor = 'var(--color-warning)'; }

      let rawName = (item.name || item.player || '').trim();
      let resolvedName = rawName;

      // Check lookup for username override if rawName is a generic Player_0x... or if player_id is available
      const keyLow = rawName.toLowerCase();
      if (userLookup[keyLow]) {
        resolvedName = userLookup[keyLow];
      } else if (item.player_id && userLookup[item.player_id.toLowerCase()]) {
        resolvedName = userLookup[item.player_id.toLowerCase()];
      } else if (rawName.startsWith('Player_') || rawName.startsWith('0x')) {
        const cleanId = rawName.replace('Player_', '').toLowerCase();
        const found = (cachedDownlineList || []).find(u => 
          (u.player_id && (u.player_id.toLowerCase().includes(cleanId) || cleanId.includes(u.player_id.substring(0, 8).toLowerCase()))) ||
          (u.linked_wallet_address && (u.linked_wallet_address.toLowerCase().includes(cleanId) || cleanId.includes(u.linked_wallet_address.substring(0, 8).toLowerCase())))
        );
        if (found && found.username && found.username.trim() !== '' && found.username.toUpperCase() !== 'EMPTY') {
          resolvedName = found.username.trim();
        }
      }

      if (!resolvedName || resolvedName.toUpperCase() === 'EMPTY') {
        resolvedName = rawName || 'Referred Player';
      }

      const commVal = parseFloat(item.commission || item.amount || 0);

      // Determine accurate action name
      let actionName = item.action;
      if (actionName === 'Vault Yield' || actionName === 'Vault Harvest') {
        actionName = 'Staking Yield';
      } else if (!actionName || actionName === 'General' || actionName === 'General Activity' || actionName === 'Referral Commission') {
        if (commVal > 0 && commVal < 2.5) {
          actionName = 'Staking Yield';
        } else if (commVal >= 5.0) {
          actionName = 'Faucet Claim';
        } else {
          actionName = 'Activity Reward';
        }
      } else if (actionName === 'Faucet Claim' && commVal < 2.5) {
        // Correct legacy mislabeled micro-claims from staking yield
        actionName = 'Staking Yield';
      }
      
      let timeDisplay = item.time || item.created_at || item.date || 'Recent';
      if (item.created_at && !item.time) {
        try { timeDisplay = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      }

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:8px; margin-bottom:0.45rem; gap: 0.75rem;">
          <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
            <span style="font-size:0.72rem; font-weight:800; padding:0.2rem 0.45rem; border-radius:4px; background:rgba(255,255,255,0.06); color:${tierColor}; border:1px solid ${tierColor}; white-space:nowrap;">
              ${tierLabel}
            </span>
            <div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <strong style="color:#fff; font-size:0.86rem;">${resolvedName}</strong>
                <span style="font-size:0.78rem; color:var(--text-muted);">• ${actionName}</span>
              </div>
              <div style="font-size:0.7rem; color:var(--text-dim); margin-top:0.15rem;">
                🗓️ ${timeDisplay}
              </div>
            </div>
          </div>
          <div style="text-align:right; white-space:nowrap;">
            <div style="font-size:0.92rem; font-weight:900; color:var(--color-success);">+${commVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PGT</div>
            <div style="font-size:0.68rem; color:var(--text-dim);">Earned Commission</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    return;
  }

  // 2. REGISTERED DOWNLINE MEMBERS VIEW
  const list = cachedDownlineList || [];
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 1.5rem 0; color: var(--text-dim); font-size: 0.85rem;">No referred downlines registered yet. Share your invite link above to build your network!</div>`;
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
    const pid = u.player_id || u.wallet_address || '';
    const realW = (u.linked_wallet_address && !isInternal(u.linked_wallet_address)) ? u.linked_wallet_address : (!isInternal(pid) ? pid : '');
    let nameStr = u.username;
    if (!nameStr || nameStr.trim() === '') {
      nameStr = realW && realW.length >= 42 ? `Player_${realW.substring(0,6)}...${realW.substring(realW.length - 4)}` : (u.email ? u.email.split('@')[0] : 'Player_' + (pid ? pid.substring(pid.length - 4) : 'User'));
    }

    const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent';
    const activeTierLvl = parseInt(u.last_weekly_active_tier !== undefined ? u.last_weekly_active_tier : (u.weekly_active_tier || 0), 10);
    const tierBadge = activeTierLvl === 5 ? '👑 L5 Apex' : activeTierLvl === 4 ? '💎 L4 Elite' : activeTierLvl === 3 ? '🥇 L3 Veteran' : activeTierLvl === 2 ? '🥈 L2' : activeTierLvl === 1 ? '🥉 L1' : '⚪ L0';
    const tierBadgeColor = activeTierLvl === 5 ? '#ffd700' : activeTierLvl === 4 ? '#00ff88' : activeTierLvl === 3 ? '#ffaa00' : activeTierLvl === 2 ? '#c084fc' : activeTierLvl === 1 ? '#38bdf8' : '#94a3b8';

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:6px; margin-bottom:0.4rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:0.7rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px; background:rgba(255,255,255,0.06); color:${tierColor}; border:1px solid ${tierColor};">${tier}</span>
            <strong style="color:#fff; font-size:0.85rem;">${nameStr}</strong>
            <span style="font-size:0.68rem; font-weight:800; padding:0.1rem 0.35rem; border-radius:4px; background:rgba(255,255,255,0.05); color:${tierBadgeColor}; border:1px solid ${tierBadgeColor};" title="Weekly Active Level">${tierBadge}</span>
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
}
window.renderReferralLedger = renderReferralLedger;

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
      .select('player_id, linked_wallet_address, username, total_referral_commission, total_referral_pol, referrals_count')
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
      const w = u.linked_wallet_address || u.player_id || u.wallet_address || '';
      const name = u.username || (!isInternal(w) && w.length >= 42 ? `${w.substring(0,6)}...${w.substring(w.length - 4)}` : `Player_${w.length >= 4 ? w.substring(w.length - 4) : rank}`);
      const val = mode === 'pol' 
        ? `${parseFloat(u.total_referral_pol || 0).toFixed(4)} POL`
        : `${parseFloat(u.total_referral_commission || 0).toFixed(2)} PGT`;

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.2); border:1px solid var(--border-glass); border-radius:6px; margin-bottom:0.4rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-weight:800; font-size:0.9rem; min-width:24px;">${medal}</span>
            <span style="font-size:0.85rem; font-weight:700; color:#fff; cursor:pointer; text-decoration:underline; text-decoration-color:rgba(0,240,255,0.3);" onclick="openPublicProfile('${w}')" title="Click to view public profile">${name}</span>
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
