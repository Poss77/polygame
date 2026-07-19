import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in .env file!");
  console.error("Please copy .env.example to .env and fill in SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// The 50,000 PGT Prize Pool Distribution Math
function calculatePrize(rank) {
  if (rank === 1) return 10000;
  if (rank === 2) return 5000;
  if (rank === 3) return 2500;
  if (rank >= 4 && rank <= 10) return 1000;
  if (rank >= 11 && rank <= 50) return 400;
  if (rank >= 51 && rank <= 100) return 190;
  return 0; // Rank > 100 gets nothing
}

async function processLeaderboard(gameName, scoreColumn) {
  console.log(`\n🏆 Processing [${gameName}] Leaderboard...`);
  
  // Fetch top 100 players with a score > 0
  const { data: topPlayers, error } = await supabase
    .from('users')
    .select(`wallet_address, ${scoreColumn}, balance_pgt`)
    .gt(scoreColumn, 0)
    .order(scoreColumn, { ascending: false })
    .limit(100);

  if (error) {
    console.error(`❌ Error fetching ${gameName} leaderboard:`, error.message);
    return;
  }

  if (!topPlayers || topPlayers.length === 0) {
    console.log(`ℹ️ No active players found for ${gameName} this week.`);
    return;
  }

  console.log(`Found ${topPlayers.length} eligible players. Distributing prizes...`);

  let totalPayout = 0;
  let rank = 1;

  for (const player of topPlayers) {
    const prize = calculatePrize(rank);
    if (prize > 0) {
      const newBalance = (player.balance_pgt || 0) + prize;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance_pgt: newBalance })
        .eq('wallet_address', player.wallet_address);

      if (updateError) {
        console.error(`❌ Failed to pay Rank ${rank} (${player.wallet_address}):`, updateError.message);
      } else {
        console.log(`✅ Paid Rank ${rank} | Score: ${player[scoreColumn]} | Prize: +${prize} PGT | Wallet: ${player.wallet_address}`);
        totalPayout += prize;
      }
    }
    rank++;
  }

  console.log(`🎉 Finished ${gameName}. Total Payout: ${totalPayout} PGT`);
}

async function runWeeklyPayouts() {
  console.log("=========================================");
  console.log("🌟 POLYGAME WEEKLY LEADERBOARD PAYOUT 🌟");
  console.log("=========================================");

  // Process Arcade Game
  await processLeaderboard('Arcade High Scores', 'game_highscore');
  
  // Process Cyber Invaders
  await processLeaderboard('Cyber Invaders', 'invaders_highscore');

  console.log("\n🧹 Resetting all leaderboards to 0 for the new week...");
  
  // Reset all high scores
  const { error: resetError } = await supabase
    .from('users')
    .update({ 
      game_highscore: 0, 
      invaders_highscore: 0 
    })
    // We update everyone where either score is > 0
    .or('game_highscore.gt.0,invaders_highscore.gt.0');

  if (resetError) {
    console.error("❌ Failed to reset leaderboards:", resetError.message);
  } else {
    console.log("✅ Leaderboards successfully wiped clean!");
  }

  console.log("\n✅ All weekly operations complete. You can close this script.");
  process.exit(0);
}

runWeeklyPayouts();
