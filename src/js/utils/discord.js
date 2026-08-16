// --- PolyGame Discord Webhook Notification Utility ---
import { supabase } from '../core/config.js';

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1529336801523667094/0xXmAKqi0DbsvLxDBxlnDeb5qGdiFKpsE5kSvNq5iqxeQiNun5ZPmlxZvaxgJwkQfOB5";
const DISCORD_ADMIN_WEBHOOK_URL = "https://discord.com/api/webhooks/1529701591303717005/INswRx3IpcbDKRXu95Foi2WSyi4LhWu09fwuQPEr3QKtt8tO5gnc0b2_pf2bcrYuyZtZ";
const DISCORD_ANNOUNCEMENTS_WEBHOOK_URL = "https://discord.com/api/webhooks/1538643364931702847/K4gJrFehXPHjTbj26a2tBGcbDj_dtu1DAR447qOCeCtpNAA7FwWP9vmBnL6aFtUNELLc";

/**
 * Sends a rich embedded notification to the Official Discord Announcements Channel
 */
export async function sendDiscordAnnouncement({ title, description, color = 0xFFAA00, fields = [] }) {
  const webhookUrl = DISCORD_ANNOUNCEMENTS_WEBHOOK_URL || DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const embed = {
    title: title,
    description: description,
    color: color,
    fields: fields,
    footer: {
      text: "PolyGame Announcements 📢 • https://polygongaming.io/",
      icon_url: "https://polygongaming.io/src/assets/logo.svg"
    },
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "PolyGame Official 📢",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error("Discord Announcement Webhook send failed:", err);
  }
}
window.sendDiscordAnnouncement = sendDiscordAnnouncement;

/**
 * Sends a rich embedded notification to Discord Announcer Channel
 */
export async function sendDiscordAlert({ title, description, color = 0x00F0FF, fields = [] }) {
  if (!DISCORD_WEBHOOK_URL) return;

  const username = window.appState?.state?.username;
  const address = window.appState?.state?.walletAddress;
  const linked = window.appState?.state?.linkedWalletAddress;
  const pid = window.appState?.state?.playerId;

  const targetAddr = (linked && !linked.startsWith('0xpgt') && !linked.startsWith('0xg') && linked.length >= 42) 
    ? linked 
    : (address || pid || '');

  let hexTag = targetAddr.toLowerCase();
  if (hexTag.startsWith('0xpgt')) hexTag = hexTag.substring(5);
  else if (hexTag.startsWith('0xguest')) hexTag = hexTag.substring(7);
  else if (hexTag.startsWith('0x')) hexTag = hexTag.substring(2);

  const playerTag = `Player_${hexTag.substring(0, 6)}`;

  const provider = window.appState?.state?.walletProvider || '';
  const isGoogle = !!(window.appState?.state?.authUserEmail || window.appState?.state?.authUserId || provider.includes('google'));
  const isWeb3 = !!(targetAddr && !targetAddr.startsWith('0xg') && targetAddr.length >= 42);

  let accountBadge = "👤 Guest";
  if (isWeb3 && isGoogle) accountBadge = "🦊 Web3 + 📧 Google";
  else if (isWeb3) accountBadge = "🦊 Web3";
  else if (isGoogle) accountBadge = "📧 Google";

  let player = `**${playerTag}** (${accountBadge})`;
  if (username && username.trim() !== '' && username !== 'Anonymous Player') {
    player = `**${username}** (${accountBadge} • \`${playerTag}\`)`;
  }

  const embed = {
    title: title,
    description: description,
    color: color,
    fields: [
      { name: "👤 Player", value: player, inline: true },
      ...fields
    ],
    footer: {
      text: "PolyGame Portal • https://polygongaming.io/",
      icon_url: "https://polygongaming.io/src/assets/logo.svg"
    },
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "PolyGame Announcer 🏆",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error("Discord Webhook send failed:", err);
  }
}
window.sendDiscordAlert = sendDiscordAlert;

/**
 * Sends an urgent Admin Security & Anomaly alert to the private Admin Discord Channel
 */
export async function sendAdminAlert({ title, description, category = 'SECURITY', color = 0xFF0033, fields = [] }) {
  if (!DISCORD_ADMIN_WEBHOOK_URL) return;

  const username = window.appState?.state?.username;
  const address = window.appState?.state?.walletAddress;
  let player = "Guest / Unknown";
  if (username && address) {
    const shortAddr = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    player = `**${username}** (${shortAddr})`;
  } else if (username) {
    player = username;
  } else if (address) {
    player = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  const embed = {
    title: `🛡️ [ADMIN ${category}] ${title}`,
    description: description,
    color: color,
    fields: [
      { name: "👤 User / Wallet", value: player, inline: true },
      ...fields
    ],
    footer: {
      text: "PolyGame Security Sentinel • https://polygongaming.io/"
    },
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(DISCORD_ADMIN_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "PolyGame Security Sentinel 🛡️",
        avatar_url: "https://polygongaming.io/src/assets/logo.svg",
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error("Admin Discord Webhook failed:", err);
  }
}
window.sendAdminAlert = sendAdminAlert;

// Configurable Discord announcement thresholds (defaults: Earn > 20 PGT, Bet Win > 100 PGT)
export let DISCORD_MIN_EARN_THRESHOLD = 20.0;
export let DISCORD_MIN_WIN_THRESHOLD = 100.0;

export function setDiscordEarnThreshold(val) {
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0) DISCORD_MIN_EARN_THRESHOLD = num;
}
export function setDiscordWinThreshold(val) {
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0) DISCORD_MIN_WIN_THRESHOLD = num;
}
window.setDiscordEarnThreshold = setDiscordEarnThreshold;
window.setDiscordWinThreshold = setDiscordWinThreshold;

/**
 * Helper to trigger Mini-Game (Earn) Announcements
 * Triggers ONLY if earnedPgt > DISCORD_MIN_EARN_THRESHOLD (default: 20 PGT)
 */
export function sendDiscordEarnAnnouncement(gameName, score, earnedPgt) {
  const pgtAmt = parseFloat(earnedPgt || 0);
  const minEarn = (window.appState?.state?.discordMinEarnThreshold !== undefined)
    ? parseFloat(window.appState.state.discordMinEarnThreshold)
    : DISCORD_MIN_EARN_THRESHOLD;

  if (pgtAmt <= minEarn) return;

  const scorePts = Math.floor(parseFloat(score || 0));

  sendDiscordAlert({
    title: `Big earn on ${gameName}!`,
    description: `A player earned big in **PolyGame Arcade**!`,
    color: 0x00F0FF, // Cyan
    fields: [
      { name: "🎮 Game", value: gameName, inline: true },
      { name: "⭐ Session Points", value: `${scorePts.toLocaleString()} pts`, inline: true },
      { name: "🌾 Earned PGT", value: `+${pgtAmt.toFixed(2)} PGT`, inline: true }
    ]
  });
}
window.sendDiscordEarnAnnouncement = sendDiscordEarnAnnouncement;

/**
 * Helper to trigger Mini-Game (Bet) Win Announcements
 * Triggers ONLY if winAmount > DISCORD_MIN_WIN_THRESHOLD (default: 100 PGT)
 */
export function sendDiscordBetWinAnnouncement(gameName, betAmount, winAmount, multiplier = 1) {
  const winPgt = parseFloat(winAmount || 0);
  const minWin = (window.appState?.state?.discordMinWinThreshold !== undefined)
    ? parseFloat(window.appState.state.discordMinWinThreshold)
    : DISCORD_MIN_WIN_THRESHOLD;

  if (winPgt <= minWin) return;

  const betPgt = parseFloat(betAmount || 0);
  const multVal = parseFloat(multiplier || 1);

  sendDiscordAlert({
    title: `Big win on ${gameName}!`,
    description: `A lucky player just hit a HUGE casino payout!`,
    color: multVal >= 10 ? 0xFF007A : 0xFFAA00, // Pink or Gold
    fields: [
      { name: "🎲 Game", value: gameName, inline: true },
      { name: "⚡ Multiplier", value: `${multVal.toFixed(2)}x`, inline: true },
      { name: "💎 Win Payout", value: `+${winPgt.toFixed(2)} PGT`, inline: true },
      { name: "🎲 Wager", value: betPgt > 0 ? `${betPgt.toFixed(2)} PGT` : "Free Play", inline: true }
    ]
  });
}
window.sendDiscordBetWinAnnouncement = sendDiscordBetWinAnnouncement;

// Backward-compatibility wrappers
export function sendDiscordHighScore(gameName, score, rewardPgt) {
  sendDiscordEarnAnnouncement(gameName, score, rewardPgt);
}
window.sendDiscordHighScore = sendDiscordHighScore;

export function sendDiscordBigWin(gameName, betAmount, winAmount, multiplier = 1) {
  sendDiscordBetWinAnnouncement(gameName, betAmount, winAmount, multiplier);
}
window.sendDiscordBigWin = sendDiscordBigWin;

/**
 * Helper for Global Progressive Jackpot Win!
 */
export function sendDiscordJackpotWin(winAmount) {
  sendDiscordAlert({
    title: `🚨 GLOBAL PROGRESSIVE JACKPOT WON! 🚨`,
    description: `🎉 **CONGRATULATIONS!** A player just hit the Global Progressive Jackpot! 🎉`,
    color: 0xFFD700, // Bright Gold
    fields: [
      { name: "💰 Jackpot Payout", value: `+${parseFloat(winAmount).toFixed(2)} PGT`, inline: false }
    ]
  });
}
window.sendDiscordJackpotWin = sendDiscordJackpotWin;

/**
 * Multi-Account IP Sentinel: Checks if > 2 accounts share the same public IP address.
 * Triggers an Admin Discord Alert if a multi-account IP cluster is detected.
 * @param {string} walletAddress
 */
export async function checkMultiAccountIP(walletAddress) {
  if (!walletAddress || !window.supabase) return;
  const normalizedAddr = walletAddress.toLowerCase();

  try {
    // 1. Fetch public IP address via ipify API
    let ip = window._userPublicIP;
    if (!ip) {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ip = data ? data.ip : null;
      if (ip) window._userPublicIP = ip;
    }
    if (!ip) return;

    // 2. Fetch IP records from user_ips table in Supabase
    const client = supabase || window.supabaseClient;
    if (!client || typeof client.from !== 'function') return;

    const { data: ipRecords, error } = await client
      .from('user_ips')
      .select('wallet_address')
      .eq('ip_address', ip);

    if (error && error.code === 'PGRST205') {
      // user_ips table not created in Supabase yet
      return;
    }

    // 3. Upsert current wallet & IP
    await client.from('user_ips').upsert({
      wallet_address: normalizedAddr,
      ip_address: ip,
      last_seen: new Date().toISOString()
    }, { onConflict: 'wallet_address' });

    // 4. Determine unique wallet addresses on this IP
    const walletList = (ipRecords || []).map(r => r.wallet_address.toLowerCase());
    if (!walletList.includes(normalizedAddr)) {
      walletList.push(normalizedAddr);
    }
    const uniqueWallets = [...new Set(walletList)];

    // 5. If > 2 accounts share this IP address, send Admin Alert to Discord!
    if (uniqueWallets.length > 2) {
      const sessionKey = `alert_multi_ip_${ip}_${uniqueWallets.length}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, 'sent');

      if (typeof window.sendAdminAlert === 'function') {
        window.sendAdminAlert({
          category: 'MULTI-ACCOUNT SPAM DETECTED',
          title: '🚨 IP Shared Across > 2 Accounts!',
          description: `Multiple distinct wallet accounts are active from the **exact same public IP address** (\`${ip}\`).`,
          color: 0xFF0033,
          fields: [
            { name: "🌐 Shared IP Address", value: `\`${ip}\``, inline: true },
            { name: "👥 Total Wallets", value: `**${uniqueWallets.length} Accounts**`, inline: true },
            { name: "📜 Linked Accounts", value: uniqueWallets.map(w => `• \`${w.substring(0, 6)}...${w.substring(38)}\``).join('\n'), inline: false }
          ]
        });
      }
    }
  } catch (err) {
    console.warn("Multi-account IP check error:", err);
  }
}
window.checkMultiAccountIP = checkMultiAccountIP;
