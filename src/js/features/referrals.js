import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';

// --- REFERRAL BOOST GROUP ---

  {
    id: 'nft_referral_beacon',
    name: 'Referral Beacon',
    rarity: 'common',
    group: 'referral',
    price: 10.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.1,
    description: 'Starter relay core boosting downline commissions by +10%.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="18" fill="none" stroke="#00ff66" stroke-width="3" stroke-dasharray="2,2"/><circle cx="50" cy="50" r="8" fill="#00ff66"/><line x1="50" y1="15" x2="50" y2="30" stroke="#00ff66" stroke-width="2"/><line x1="50" y1="70" x2="50" y2="85" stroke="#00ff66" stroke-width="2"/><line x1="15" y1="50" x2="30" y2="50" stroke="#00ff66" stroke-width="2"/><line x1="70" y1="50" x2="85" y2="50" stroke="#00ff66" stroke-width="2"/></svg>`
  },
  {
    id: 'nft_affiliate_guild',
    name: 'Affiliate Guild',
    rarity: 'rare',
    group: 'referral',
    price: 100.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 1.5,
    description: 'A network relay core boosting all downline commissions by +50%.',
    svg: `<svg viewBox="0 0 100 100"><circle cx="25" cy="50" r="10" fill="#00ff66"/><circle cx="75" cy="30" r="10" fill="#00ff66"/><circle cx="75" cy="70" r="10" fill="#00ff66"/><line x1="25" y1="50" x2="75" y2="30" stroke="#00ff66" stroke-width="3"/><line x1="25" y1="50" x2="75" y2="70" stroke="#00ff66" stroke-width="3"/></svg>`
  },
  {
    id: 'nft_legendary_king',
    name: 'Omni Lord',
    rarity: 'legendary',
    group: 'referral',
    price: 300.0,
    faucetBoost: 0,
    gameMultiplier: 0,
    stakingBoost: 0,
    referralMultiplier: 2.0,
    description: 'Ultimate referral beacon. Multiplies all network commission earnings by +100%.',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,10 90,40 75,85 25,85 10,40" fill="none" stroke="#ffb700" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="none" stroke="#ffb700" stroke-width="2" stroke-dasharray="4,4"/><polygon points="50,30 62,55 38,55" fill="#ffb700"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>`
  }
];

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

