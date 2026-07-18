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

// --- Affiliate Referral Simulations (Multi-Level 4-Tiers) ---

document.getElementById('btn-simulate-referral-claim').addEventListener('click', () => {
  const names = ['CryptoKnight', 'ZecHunter', 'ChainSlinger', 'BitGlider', 'TokenWrangler', 'HashRider', 'PolMaster'];
  const user = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 999);
  
  // Roll a level 1 to 4
  const level = Math.floor(1 + Math.random() * 4); // 1, 2, 3, or 4
  
  let pct = 10;
  let commission = 5.0; // 10% of 50
  if (level === 2) { pct = 5; commission = 2.5; } // 5% of 50
  else if (level === 3) { pct = 2; commission = 1.0; } // 2% of 50
  else if (level === 4) { pct = 1; commission = 0.5; } // 1% of 50

  const refList = [...(appState.state.referralsList || [])];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const multis = appState.getMultipliers();
  const finalCommission = commission * multis.nftReferralMultiplier;
  
  refList.unshift({ name: user, level: level, commission: finalCommission, time: time });
  if (refList.length > 10) refList.pop();

  const updates = {
    referralsCount: appState.state.referralsCount + 1,
    totalReferralCommission: appState.state.totalReferralCommission + finalCommission,
    pendingPayoutPgt: appState.state.pendingPayoutPgt + finalCommission,
    referralsList: refList
  };

  if (level === 1) updates.referralsL1 = (appState.state.referralsL1 || 0) + 1;
  else if (level === 2) updates.referralsL2 = (appState.state.referralsL2 || 0) + 1;
  else if (level === 3) updates.referralsL3 = (appState.state.referralsL3 || 0) + 1;
  else if (level === 4) updates.referralsL4 = (appState.state.referralsL4 || 0) + 1;

  appState.update(updates);

  // Log activity with downline tier details
  appState.addActivity(user, `claimed faucet (Tier L${level} downline)`, `+${finalCommission.toFixed(2)} PGT (Pending)`);
  
  setTimeout(() => {
    appState.addActivity('System', `credited ${pct}% L${level} affiliate bonus from ${user}`, `+${finalCommission.toFixed(2)} PGT (Pending)`);
    triggerToast(`Downline L${level} referral ${user} claimed! Commission: +${finalCommission.toFixed(2)} PGT (Pending)`, 'success');
  }, 350);
});

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

