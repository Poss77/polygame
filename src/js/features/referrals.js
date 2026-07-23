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
      if (appState.state.walletConnected && appState.state.walletAddress && supabase) {
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


