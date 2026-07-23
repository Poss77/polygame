// --- PolyGame Discord Webhook Notification Utility ---
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1529336801523667094/0xXmAKqi0DbsvLxDBxlnDeb5qGdiFKpsE5kSvNq5iqxeQiNun5ZPmlxZvaxgJwkQfOB5";
const DISCORD_ADMIN_WEBHOOK_URL = "https://discord.com/api/webhooks/1529701591303717005/INswRx3IpcbDKRXu95Foi2WSyi4LhWu09fwuQPEr3QKtt8tO5gnc0b2_pf2bcrYuyZtZ";

/**
 * Sends a rich embedded notification to Discord Announcer Channel
 */
export async function sendDiscordAlert({ title, description, color = 0x00F0FF, fields = [] }) {
  if (!DISCORD_WEBHOOK_URL) return;

  const player = window.appState?.state?.username || 
                 (window.appState?.state?.walletAddress ? 
                  `${window.appState.state.walletAddress.substring(0, 6)}...${window.appState.state.walletAddress.substring(38)}` : 
                  "Guest Player");

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

  const player = window.appState?.state?.username || 
                 (window.appState?.state?.walletAddress ? 
                  `${window.appState.state.walletAddress.substring(0, 6)}...${window.appState.state.walletAddress.substring(38)}` : 
                  "Guest / Unknown");

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

/**
 * Helper to trigger High Score Discord Notifications
 */
export function sendDiscordHighScore(gameName, score, rewardPgt) {
  sendDiscordAlert({
    title: `🏆 NEW HIGH SCORE IN ${gameName.toUpperCase()}!`,
    description: `A player set a new personal record on **PolyGame Arcade**!`,
    color: 0xFFAA00, // Gold
    fields: [
      { name: "🎮 Game", value: gameName, inline: true },
      { name: "⭐ Score", value: `${Math.floor(score)} pts`, inline: true },
      { name: "💰 Payout", value: `+${parseFloat(rewardPgt).toFixed(2)} PGT`, inline: true }
    ]
  });
}
window.sendDiscordHighScore = sendDiscordHighScore;

/**
 * Helper to trigger Big Win Discord Notifications (winnings >= 25 PGT or multiplier >= 5x)
 */
export function sendDiscordBigWin(gameName, betAmount, winAmount, multiplier = 1) {
  if (winAmount < 25 && multiplier < 5) return; // Only notify on notable wins!

  sendDiscordAlert({
    title: `🔥 BIG WIN ON ${gameName.toUpperCase()}!`,
    description: `A lucky player just hit a HUGE payout!`,
    color: multiplier >= 10 ? 0xFF007A : 0x00F0FF, // Pink or Cyan
    fields: [
      { name: "🎯 Game", value: gameName, inline: true },
      { name: "⚡ Multiplier", value: `${parseFloat(multiplier).toFixed(2)}x`, inline: true },
      { name: "💎 Win Payout", value: `+${parseFloat(winAmount).toFixed(2)} PGT`, inline: true },
      { name: "🎲 Wager", value: betAmount > 0 ? `${parseFloat(betAmount).toFixed(2)} PGT` : "Free Play", inline: true }
    ]
  });
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
