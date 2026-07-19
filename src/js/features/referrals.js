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

// Capture referral code from URL
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const refCode = params.get('ref');
  if (refCode) {
    localStorage.setItem('polygame_pending_referral', refCode);
  }
});


