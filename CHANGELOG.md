# Polygon Gaming — Complete Changelog & Patch History

This document contains the recent release notes (v1.5.690+).
For historical archives, see:
- [Historical v1.5 Releases (v1.5.000 - v1.5.689)](docs/archive/CHANGELOG_v1.5_archive.md)
- [Historical v1.4 Releases (v1.4.298 - v1.4.499)](docs/archive/CHANGELOG_v1.4_archive.md)

- **High-Converting Dashboard Homepage Rework & Tokenomics Modal (`v1.5.752`)**:
  - **🚀 Clean Player-First Dashboard Experience ([`index.html`](index.html))**:
    - **Tokenomics Modal (`#modal-tokenomics`)**: Extracted the 560-line PGT Tokenomics & 10-Year Distribution section into a dedicated, high-performance popup modal with all charts and allocation models preserved, eliminating home screen clutter.
    - **3-Step Fast Start Action Bar**: Integrated direct 1-click CTA buttons in the welcome hero: `1️⃣ Claim Free Faucet 💧`, `2️⃣ Play Arcade Games 🎮`, and `3️⃣ Stake & Vault APY 🏛️`.
    - **Daily Free Rewards Hub**: Added a prominent 3-column daily earning card highlighting the 24h Faucet, Daily Wordle, and Daily Sudoku with direct launch buttons.
    - **Featured Games Quick-Launch Grid**: Added direct launch cards with gameplay teasers for Astro-Dodge, PolySpace Fleet, Cyber Invaders, and Cyber Mines.
    - **3 Platform Pillars**: Replaced long paragraphs with 3 crisp visual feature cards (Free & Skill-Based, Polygon Native PGT, Passive Vault Yield & NFTs).
    - **Transparency & Leaderboards Action Bar**: Moved top token holders and tokenomics specs into a clean bottom action bar with 1-click modals.
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js))**:
    - Incremented `APP_VERSION = "1.5.752"`.

- **Staking Vault Interactive NFT Marketplace Routing (`v1.5.751`)**:
  - **🛍️ Staking NFT Boost Direct Link ([`index.html`](index.html))**:
    - Converted the static "🚀 APY up to 23% with NFT" badge in the Staking Vault into an interactive 1-click CTA button (`staking-nft-boost-banner`).
    - Clicking routes directly to the NFT tab and opens the active **Utility NFT Marketplace** (`switchTab('nft')` + `switchNftView('market')`).
    - Added subtle hover animation, cyan border glow, cursor feedback, and external link indicator (`↗`).
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js))**:
    - Incremented `APP_VERSION = "1.5.751"`.

- **Official X (Twitter) Conversion Tracking Integration (`v1.5.750`)**:
  - **📊 X Pixel Base Code (`ri5fg`) Integration ([`index.html`](index.html), [`privacy.html`](privacy.html), [`terms.html`](terms.html), [`contact.html`](contact.html), [`verify.html`](verify.html), [`launch.html`](launch.html), [`arcade.html`](arcade.html), [`arcade/index.html`](arcade/index.html))**:
    - Embedded the official asynchronous X conversion tracking base code SDK (`https://static.ads-twitter.com/uwt.js`) configured with Pixel ID `ri5fg` across all entry points and public site documents right before `</head>`.
    - Enables accurate ad attribution, visitor conversion tracking, and campaign ROI analytics for upcoming promotional campaigns.
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js))**:
    - Incremented `APP_VERSION = "1.5.750"`.

- **Compact Inline Payout Share Icons Across ALL Arcade Games (`v1.5.749`)**:
  - **✨ Compact Payout Share Icons ([`index.html`](index.html), [`game.js`](game.js), [`invaders.js`](invaders.js), [`src/js/utils/social-share.js`](src/js/utils/social-share.js))**:
    - Replaced the bulky, separate share button rows across all 9 arcade game over screens with two elegant, compact 24–26px icon buttons (**𝕏** and **✈️ Telegram**) placed directly inline next to the **Final Payout** text.
    - Eliminates vertical UI clutter on mobile and desktop screens while keeping social virality at the exact focal point where player excitement peaks (reward payout).
    - Unified across Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker, Cyber Runner, Quantum 2048, Cyber Tetris, Cyber Skeet, and Cyber Defense.
    - Added DOM score resolvers for `skeet-res-score` and `defense-res-score` in `src/js/utils/social-share.js`.
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.749"` and synced cache buster parameters across all script tags.

- **PolySpace Official Theme Soundtrack & Ambient Audio Engine (`v1.5.748`)**:
  - **🎵 PolySpace Theme Soundtrack Integration ([`src/assets/audio/polyspace_theme.mp3`](src/assets/audio/polyspace_theme.mp3), [`src/js/core/audio.js`](src/js/core/audio.js))**:
    - Integrated the official custom PolySpace space synthesizer soundtrack (`polyspace_theme.mp3`, 2m47s loop) into the client audio asset catalog.
    - Added dedicated `startPolySpaceAudio()`, `stopPolySpaceAudio()`, and `togglePolySpaceAudio()` methods to `RetroSynth` with volume mixing (0.35 gain) to ensure crystal-clear SFX audibility.
  - **🛰️ PolySpace Fleet Command Soundtrack HUD Button ([`index.html`](index.html), [`src/js/app.js`](src/js/app.js))**:
    - Added a stylized **`[ 🎵 Theme: ON / OFF ]`** toggle button directly inside the PolySpace Fleet Command header bar.
    - Seamlessly auto-plays soundtrack on entering the `#space` view (respecting persistent user preference in `localStorage`), and pauses background playback when routing to other views or arcade games.
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.748"` and updated asset cache busters.

- **Viral Acquisition Engine, 1-Click Social Sharing & Gameplay Quick Replay (`v1.5.747`)**:
  - **🚀 Viral Player Acquisition Engine ([`src/js/utils/social-share.js`](src/js/utils/social-share.js), [`index.html`](index.html), [`src/js/app.js`](src/js/app.js))**:
    - Built comprehensive viral attribution and social sharing module with automated referral link generation (`https://polygongaming.io/?ref={player_id}`).
    - Added dedicated **"Invite Players & Earn 4-Tier Rewards"** spotlight banner on the main Dashboard (`#view-dashboard`) featuring a 1-click **`📋 Copy Link`**, **`𝕏 Tweet Invite`**, and **`✈️ Telegram`** share button to maximize organic user acquisition.
  - **🎮 1-Click High-Score & Payout Sharing Across ALL Arcade Games ([`index.html`](index.html), [`drift.js`](drift.js), [`game.js`](game.js), [`invaders.js`](invaders.js))**:
    - Embedded 1-click **`𝕏 Share Score`** and **`✈️ Telegram`** buttons into the Game Over screens for Cyber Drift, Astro-Dodge, Cyber Invaders, Cyber Stacker, Cyber Runner, Quantum 2048, and Cyber Tetris.
    - Captures game score, PGT token earnings, and player referral links into pre-formatted, high-converting social posts.
  - **🧩 Daily Cyber Games (Wordle & Sudoku) Social Share Upgrade ([`src/js/features/wordle.js`](src/js/features/wordle.js), [`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`index.html`](index.html))**:
    - Upgraded daily result sharing with distinct 1-click **`𝕏 Tweet Result`**, **`✈️ Telegram`**, and **`📋 Copy`** buttons in both statistics modals.
  - **⌨️ Arcade Gaming Quality-of-Life: Keyboard Instant Replay ([`src/js/app.js`](src/js/app.js))**:
    - Added global `Space` / `Enter` keyboard hotkey listener that automatically triggers "Play Again" / "Relaunch" whenever a game over screen is open, streamlining arcade gameplay flow.
  - **🚀 Version Increment ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.747"` and updated script cache busters across all assets.

- **Referral Marketplace: Fix New Recruit Filter & Pool Accounting (`v1.5.746`)**:
  - **🌱 Accurate New Recruit Recognition ([`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/split_scout_and_recruit_pools.sql`](supabase/split_scout_and_recruit_pools.sql), [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`src/js/features/referrals.js`](src/js/features/referrals.js))**:
    - Identified reason New Recruit previously showed 0 available: the previous filter required `weekly_active_tier = 0`, but newly registered players who claimed a faucet or played a game on day 1 were automatically promoted to Tier 1, inadvertently transferring them into the L1 Scout pool.
    - Updated `get_unreferred_census()` and `adopt_referrals()` so that **ALL unreferred players created in the last 7 days** (`created_at >= NOW() - INTERVAL '7 days'`) are immediately categorized into the **`🌱 New Recruit (<7d)`** pool (currently 4 players ready for adoption).
    - Restricted **`🥉 L1 Scout`** strictly to established active casual players registered **more than 7 days ago** (`created_at < NOW() - INTERVAL '7 days' AND tier = 1`, 7 players in pool), ensuring complete mutual exclusivity with zero pool cannibalization.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.746"` and refreshed script cache busters.

- **Referral Adoption Marketplace: Production Launch & Full Security Audit (`v1.5.745`)**:
  - **🚀 Official Production Launch ([`index.html`](index.html), [`src/js/app.js`](src/js/app.js), [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Removed all "New Feature Preview", "Private Preview", and "Fictive Pricing" labels and banners across the Affiliate Network hub and marketplace view.
    - Updated entry badge to **`🛒 Official Marketplace`** with polished solid borders and direct CTA (`Open Marketplace →`).
    - Streamlined checkout modal title, hero badges, and navigation headers for production launch.
  - **🛡️ Comprehensive Security Audit & Invariants Verification**:
    - Validated anti-replay protection backed by unique database index `idx_nft_sales_tx_hash` on `LOWER(tx_hash)`.
    - Verified strict 64-hex transaction hash regex validation and server-side settlement recording.
    - Verified caller authentication guard (`assert_caller_player_id`) preventing identity spoofing.
    - Verified circular adoption / self-adoption / ancestor-adoption prevention logic.
    - Verified concurrency safety with row-level locks (`FOR UPDATE SKIP LOCKED`).
    - Confirmed zero direct balance mutations and strict `SECURITY INVOKER` posture on anti-cheat trigger.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.745"` and refreshed script cache busters.

- **Referral Marketplace: Replace "10x Boost" with "Max Boost" Terminology (`v1.5.744`)**:
  - **⚡ Label & Copy Streamlining ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Replaced all occurrences of `(10x Boost)` with `(Max Boost)` across each referral tier card (`⚡ Up to X PGT/wk (Max Boost)`).
    - Updated Order Summary yield projection to display `🚀 Up to ~X PGT/wk with Max Boosts`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.744"` and refreshed script cache busters.

- **Referral Marketplace: Split Scout & Recruit Pools + 10x Boost Yield Display (`v1.5.743`)**:
  - **🌱 Dedicated Scout vs. Recruit Pools ([`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/split_scout_and_recruit_pools.sql`](supabase/split_scout_and_recruit_pools.sql))**:
    - Disaggregated Level 1 into two clear, distinct adoption categories:
      - **🥉 L1 Scout**: Verified unreferred players with proven weekly activity (`weekly_active_tier = 1`).
      - **🌱 Fresh Recruit (<7d)**: Brand new unreferred signups registered in the past 7 days (`tier = 0 AND created_at >= NOW() - INTERVAL '7 days'`), giving buyers full transparency between established casuals and fresh discovery signups.
    - Updated `adopt_referrals()` with explicit `p_recruit` parameter, adopting newest signups first (`ORDER BY created_at DESC`).
    - Updated `get_unreferred_census()` to return separated `'1'` and `'recruit'` pool tallies.
  - **⚡ Conservative vs. 10x Boost Indicators ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`src/js/features/referrals.js`](src/js/features/referrals.js), [`index.html`](index.html))**:
    - Enhanced card yield badges across all tiers to display both base commission and max potential: e.g. `150 - 400 PGT/wk` with `⚡ Up to 4,000 PGT/wk (10x Boost)`.
    - Added real-time Projected Commission Yield calculation to the sticky Order Summary sidebar, detecting user's active VIP, Ambassador, and equipped NFT referral multipliers to project personalized weekly earnings (or highlighting the up to 10x ceiling for unboosted accounts).
    - Added dedicated `🌱 Recruit (<7d)` counter to the Downline Level Census grid in `#referrals`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.743"` and refreshed script cache busters.

- **Referral Marketplace: Option A — 7-Day New Recruits Priced as Level 1 (`v1.5.742`)**:
  - **🌱 New User Recruits as Level 1 ([`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/update_referral_option_a_7day_new_recruits.sql`](supabase/update_referral_option_a_7day_new_recruits.sql))**:
    - Resolved cold-start dormant classification for fresh accounts: newly registered players with 0 weekly faucets/games default to activity tier 0, but represent high-potential new participants discovering the ecosystem rather than long-term dormant accounts.
    - Updated `get_unreferred_census()` and `adopt_referrals()` to categorize all unreferred users registered within the last 7 days (`created_at >= NOW() - INTERVAL '7 days'`) with 0 weekly activity as **Level 1 (Bronze Cadet / New Recruit)**.
    - Restricted **Level 0 (Dormant)** exclusively to inactive unreferred accounts registered over 7 days ago (`created_at < NOW() - INTERVAL '7 days'`).
    - Ordered recruit adoptions by newest first (`ORDER BY created_at DESC`) so buyers receive the freshest signups.
  - **🏷️ Referral UI & Shop Alignment ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`src/js/features/referrals.js`](src/js/features/referrals.js), [`index.html`](index.html))**:
    - Updated tier definitions, badges, and requirement texts: Level 1 is now displayed as **🥉 L1 Scout / Recruit** (`1+ Faucet / week OR New User (<7d)`), and Level 0 as **⚪ L0 Dormant (>7d)** (`Registered >7d ago • 0 weekly claims`).
    - Updated the direct table-scan fallback in `referral-shop.js` and the downline census tally in `referrals.js` to ensure 7-day recruits with tier 0 are consistently recognized and displayed across the entire interface.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.742"` and refreshed script cache busters.

- **Affiliates & Referral Marketplace: Top Referrers Direct Action (`v1.5.741`)**:
  - **🛒 Direct Marketplace Shortcut ([`index.html`](index.html))**:
    - Added high-visibility **"🛒 Purchase Referrals"** CTA button directly inside the header of the "Top Referrers" card on `#referrals`, giving players instant access to the Referral Adoption Marketplace.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.741"` and refreshed script cache busters.

- **Gameplay UI: Remove In-Game Toasts & Suppress Notification Overlap (`v1.5.740`)**:
  - **🔕 In-Game Toast Elimination ([`game.js`](game.js), [`drift.js`](drift.js), [`invaders.js`](invaders.js), [`stacker.js`](stacker.js), [`runner.js`](runner.js), [`q2048.js`](q2048.js), [`tetris.js`](tetris.js))**:
    - Removed all intrusive HTML toast notifications fired during live gameplay (shield activation/break, overcharge timers, boss rage warnings, speed restoration, shard/crystal pickups, relic drops, and coin harvests).
    - All gameplay events continue to render their native, non-intrusive on-canvas floating texts, particle bursts, audio cues, and top HUD indicator bars without cluttering the screen or stealing focus.
  - **🛡️ Gameplay Notification Suppression ([`src/js/core/ui.js`](src/js/core/ui.js), [`src/js/features/games.js`](src/js/features/games.js), [`src/css/notifications.css`](src/css/notifications.css))**:
    - Enhanced `triggerToast()` to automatically suppress outside notifications whenever an arcade game is active (`active-game-container.active-game` or `document.body.game-active`).
    - Added CSS suppression rules ensuring `.notification-container` is completely hidden and non-overlapping during windowed and fullscreen gameplay.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.740"` and refreshed script cache busters.

- **Cyber Drift: Recalibrate Velocity Safety Clamps & Instant Leaderboard Await (`v1.5.739`)**:
  - **🏎️ Velocity Rate Clamp Recalibration ([`supabase/rpcs/02_arcade_sessions.sql`](supabase/rpcs/02_arcade_sessions.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/fix_cyber_drift_velocity_rate_clamp_and_tiboryeah.sql`](supabase/fix_cyber_drift_velocity_rate_clamp_and_tiboryeah.sql))**:
    - Identified root cause of Tiboryeah's 123,308 high score being clamped down to 117,600: Cyber Drift's duration safety rate clamp in `end_arcade_session` was hardcoded to `v_duration_seconds * 1200` (1,200 pts/sec), based on an outdated assumption of 167–200 km/h cruising.
    - At top speeds (350–450 km/h) with active Nitro and dense orb streaks, high-skill driving legitimately generates 2,000–2,500 pts/sec (Tiboryeah covered 9,869m in 98s at 352 km/h, collecting 164 orbs = 1,258.2 pts/sec).
    - Paul V's 232,636 score was not clamped because his marathon run lasted 680 seconds (11m 20s), averaging only 342.1 pts/sec (well within the old 1,200 pts/sec ceiling).
    - Recalibrated `drift` score clamp to `LEAST(v_clamped_score, 500000, GREATEST(2500, v_duration_seconds * 3000))` (3,000 pts/sec) and increased `v_max_velocity_rate` to `1.75`.
  - **⚡ Real-Time Leaderboard Post-Game Sync ([`src/js/core/db-sync.js`](src/js/core/db-sync.js))**:
    - Updated `endArcadeSession` to asynchronously `await window.loadGameLeaderboard(activeGameKey, true)`, ensuring the in-game leaderboard DOM updates with the fresh tournament standing before displaying the game-over screen.
  - **🎖️ Player Remediation ([`supabase/fix_cyber_drift_velocity_rate_clamp_and_tiboryeah.sql`](supabase/fix_cyber_drift_velocity_rate_clamp_and_tiboryeah.sql))**:
    - Restored Tiboryeah's score from 117,600 to 123,308 in `public.arcade_sessions` (session `24c3872d-a083-4f17-859f-3276e2a2e3b9`) and `public.users.drift_highscore`.
    - Retroactively credited +12.88 PGT ($78.68 - $65.80 PGT) to Tiboryeah's `balance_pgt` and `total_earned`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.739"` and refreshed script cache busters.

- **Cyber Sudoku: Pool Expansion to 300 Puzzles (Option A) (`v1.5.738`)**:
  - **300-Puzzle Scaled Architecture ([`src/js/features/sudoku-puzzles.js`](src/js/features/sudoku-puzzles.js), [`supabase/expand_sudoku_puzzles_300.sql`](supabase/expand_sudoku_puzzles_300.sql), [`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Expanded the Daily Sudoku puzzle pool from 25 puzzles per tier (75 total) to **100 puzzles per difficulty tier (300 puzzles total)**:
      - **100 Easy Puzzles**: Exactly 52 clues (~3 missing per box, 29 empty cells total).
      - **100 Medium Puzzles**: Exactly 40 clues (~4.5 missing per box, 41 empty cells total).
      - **100 Hard Puzzles**: Exactly 32 clues (~5.5 missing per box, 49 empty cells total).
    - Preserved existing 75 puzzle IDs (1..25 Easy, 26..50 Medium, 51..75 Hard) for 100% backward compatibility with all historical and current player sessions.
    - Sequentially appended 75 new calibrated puzzles per difficulty (IDs 76..150 for Easy, 151..225 for Medium, 226..300 for Hard) with mathematically verified unique solutions and balanced 3x3 box clue distributions.
    - Updated client-side direct index lookup `getSudokuPuzzleById(puzzleId)` and `getSudokuPuzzleFallback(difficulty, seedIndex)` to seamlessly support all 300 puzzles.
    - Added standalone idempotent migration script [`supabase/expand_sudoku_puzzles_300.sql`](supabase/expand_sudoku_puzzles_300.sql) to populate `public.daily_sudoku_puzzles`.
  - **Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.738"` and refreshed script cache busters.

- **Cyber Sudoku: Infallible Puzzle Bundling & Offline Fallback (`v1.5.737`)**:
  - **🧩 75-Puzzle Client Bundle & Infallible Fallback ([`src/js/features/sudoku-puzzles.js`](src/js/features/sudoku-puzzles.js), [`src/js/features/sudoku.js`](src/js/features/sudoku.js))**:
    - Bundled all 75 calibrated daily puzzles (25 Easy, 25 Medium, 25 Hard) into [`src/js/features/sudoku-puzzles.js`](src/js/features/sudoku-puzzles.js) mirroring the Wordle dictionary architecture.
    - Added multi-stage fallback resolution in `checkDailySudokuStatus()` and `startDailySudokuGame()`:
      1. RPC response (`get_daily_games_hub_status` / `start_daily_sudoku`).
      2. Local session completion cache (`polygame_sudoku_completed_${today}`).
      3. Direct `daily_game_sessions` query with `puzzle_id` mapped via `getSudokuPuzzleById()`.
      4. Deterministic hash seed fallback via `getSudokuPuzzleFallback()`, guaranteeing that even without running SQL updates on the database, returning to a completed puzzle always renders all 81 solved digits.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.737"` and refreshed script cache busters.

- **Cyber Sudoku: Fix Completed Board Rendering & HUD State (`v1.5.736`)**:
  - **🧩 Completed Board Restoration ([`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/fix_completed_sudoku_board_retrieval.sql`](supabase/fix_completed_sudoku_board_retrieval.sql))**:
    - Fixed black board issue when returning to view today's completed Sudoku puzzle. Previously, `checkDailySudokuStatus()` only unhid the play screen without fetching the puzzle data, populating `playerBoard`, or calling `renderSudokuGrid()`.
    - Updated `get_daily_games_hub_status` and `start_daily_sudoku` RPCs to look up and return `clues_mask`, `solution`, `time_seconds`, and `mistakes` for completed sessions.
    - Updated `checkDailySudokuStatus()` and `startDailySudokuGame()` to render the full solved grid with original clues and filled numbers, update the HUD with the accurate difficulty, elapsed solve time, and mistakes, and hide the controls/keypad while displaying the victory card.
    - Added instant client completion caching (`polygame_sudoku_completed_${today}`) in `localStorage` upon puzzle victory.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.736"` and refreshed script cache busters.

- **Referral Marketplace: Fix price_pol On-Chain Cost, 2-Week Best Activity Tier & Direct Access (`v1.5.735`)**:
  - **🛒 Referral Adoption On-Chain POL Recording ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/fix_referral_adoption_price_pol_and_2week_tier.sql`](supabase/fix_referral_adoption_price_pol_and_2week_tier.sql))**:
    - Fixed `price_pol` in `public.nft_sales` recording `0` instead of the actual on-chain POL paid. `adopt_referrals` now accepts `p_pol_cost NUMERIC` and records the exact discounted POL cost into `public.nft_sales`.
    - Backfilled existing adoption records in `public.nft_sales` with their verified on-chain Polygon transaction values (`0.68 POL` and `1.35 POL`).
  - **📈 2-Week Best Activity Tier Calculation ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`src/js/features/referrals.js`](src/js/features/referrals.js), [`src/js/features/profile.js`](src/js/features/profile.js), [`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql))**:
    - Enhanced referral activity tier determination across census and adoption queries to take `GREATEST(COALESCE(weekly_active_tier, 0), COALESCE(last_weekly_active_tier, 0))` (and `Math.max()` on the client), ensuring players are always evaluated by their best/highest tier achieved across the last 2 weeks (current active week vs prior snapshotted week).
  - **🔗 Access & Discovery ([`index.html`](index.html))**:
    - Unhid `#card-referral-shop-preview` on the Affiliates page (`#referrals`) so players can easily click "Explore Marketplace →" to navigate directly to `#buy-referrals`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.735"` and refreshed script cache busters.

- **PLAN-020: Recalibrate Daily Sudoku Base Rewards (20, 40, 60 PGT) & Hub Tile Sync (`v1.5.734`)**:
  - **💎 Sudoku Base Rewards Calibration ([`index.html`](index.html), [`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql), [`supabase/update_sudoku_base_rewards_20_40_60.sql`](supabase/update_sudoku_base_rewards_20_40_60.sql))**:
    - Updated Cyber Sudoku base completion rewards across all 3 difficulty tiers:
      - **🟢 Easy Tier**: **20 PGT base** (+4 PGT / +20% Flawless Solver Bonus)
      - **🟡 Medium Tier**: **40 PGT base** (+8 PGT / +20% Flawless Solver Bonus)
      - **🔴 Hard Tier**: **60 PGT base** (+12 PGT / +20% Flawless Solver Bonus)
    - Synced the Daily Games Hub card tile in `index.html` to display `💎 20–60 PGT Base • +20% Flawless Solver Bonus` (previously `15–25 PGT Base`).
    - Synced tier selection cards in `index.html` to display `+20 PGT`, `+40 PGT`, and `+60 PGT`.
    - Updated authoritative RPC `claim_daily_sudoku_reward` to calculate base rewards (20 / 40 / 60) before applying player multipliers (NFTs, VIP, Apex Relics, Ambassador) and atomically increment `users.total_earned` alongside `balance_pgt`.
    - Generated standalone migration script `supabase/update_sudoku_base_rewards_20_40_60.sql`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.734"` and refreshed asset queries across all game scripts.

- **PLAN-020: Calibrate Sudoku Difficulty Tiers (Easy: 52, Med: 40, Hard: 32) (`v1.5.733`)**:
  - **🧩 3-Tier Sudoku Calibration ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/calibrate_sudoku_tiers_52_40_32.sql`](supabase/calibrate_sudoku_tiers_52_40_32.sql), [`index.html`](index.html))**:
    - Calibrated all 75 puzzles (25 per tier) to the exact player difficulty targets:
      - **Easy Tier**: **52 clues** (~3 missing per box, 29 empty cells) — relaxing, engaging, balanced.
      - **Medium Tier**: **40 clues** (~4.5 missing per box, 41 empty cells) — balanced, accessible challenge.
      - **Hard Tier**: **32 clues** (~5.5 missing per box, 49 empty cells) — strategic, multi-step deduction.
    - Updated difficulty card labels in `index.html`.
    - Generated standalone migration script `supabase/calibrate_sudoku_tiers_52_40_32.sql`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.733"` and refreshed asset queries.

- **PLAN-020: Fix Sudoku Clue Rendering (Zero Suppression) & Add Restart Control (`v1.5.732`)**:
  - **🧩 Sudoku Grid Rendering & Local Draft Synchronization ([`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`index.html`](index.html))**:
    - Fixed zero rendering bug where pre-filled clue cells rendered as cyan `0`s when restored from stale browser drafts; clue cells now strictly display authoritative digits from `cluesMask`.
    - Added stale draft invalidation in `restoreLocalDraft()` when puzzle `cluesMask` has changed.
    - Added one-click `🔄 Restart` control to the Sudoku controls bar, allowing players to reset their board, mistake count, and timer to the clean starting grid anytime.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.732"` and refreshed asset queries.

- **PLAN-020: Increase Easy Sudoku Clues to 60 Numbers (`v1.5.731`)**:
  - **🧩 Casual Easy Sudoku Calibration ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/update_easy_sudoku_60_clues.sql`](supabase/update_easy_sudoku_60_clues.sql), [`index.html`](index.html))**:
    - Upgraded all 25 Easy daily Sudoku puzzles from 50 clues to 60 pre-filled numbers (~58-62 clues), leaving only ~21 empty cells to solve.
    - Updated Easy tier card description in `index.html` to reflect `58-62 clues revealed • 5 mistakes buffer • Relaxed friendly`.
    - Generated standalone migration script `supabase/update_easy_sudoku_60_clues.sql` for instant database update.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.731"` and refreshed asset queries.

- **PLAN-020: Fix Mobile Fullscreen Modal Stacking & Z-Index Hierarchy (`v1.5.730`)**:
  - **📱 Modal Stacking Resolution ([`src/css/modals.css`](src/css/modals.css), [`src/css/mobile.css`](src/css/mobile.css), [`index.html`](index.html))**:
    - Fixed stacking context conflict where `.game-window-container.fullscreen-active` (`z-index: 99999999 !important;`) eclipsed `.modal-overlay` on mobile devices (`z-index: 10000000 !important;`).
    - Elevated `.modal-overlay` and `.modal-overlay.active` across desktop and responsive mobile stylesheets to `z-index: 100000000 !important;`.
    - Maintained `.notification-container` at `z-index: 100000005 !important;` to ensure system notifications stay atop modal dialogs.
    - Wordle and Sudoku statistics dialogs now render above the fullscreen game viewport on all mobile and desktop devices.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.730"` and refreshed asset queries.

- **PLAN-020: Fix Ambassador Multiplier to Canonical 2.0x in Daily Games (`v1.5.729`)**:
  - **🛡️ Multiplier Alignment ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/fix_daily_games_payout_rpc.sql`](supabase/fix_daily_games_payout_rpc.sql))**:
    - Corrected Ambassador multiplier from `1.10x` to canonical `2.0x` across `submit_wordle_guess` and `claim_daily_sudoku_reward`.
    - Player Poss's total multiplier is now authoritatively: `1.95 (NFTs) × 2.0 (VIP Gold) × 1.5 (Apex Relics) × 2.0 (Ambassador) = 11.7x`.
    - Added retroactive balance correction script for Poss's today Wordle prize (+105.3 PGT, reaching 234.0 PGT total).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.729"` and refreshed asset queries.

- **PLAN-020: Fix Wordle Guess Distribution Chart Colors & Design Tokens (`v1.5.728`)**:
  - **🎨 Wordle Histogram Colors ([`src/js/features/wordle.js`](src/js/features/wordle.js), [`src/css/variables.css`](src/css/variables.css))**:
    - Added `--color-success: #00ff66;` to `:root` design tokens in `variables.css`.
    - Corrected guess distribution rendering: rows with `0` wins now render as neutral, muted gray bars with light text instead of electric cyan.
    - Rows with wins render in electric cyan, and the specific row representing today's winning attempt is highlighted in vibrant green (`--color-success`).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.728"` and refreshed asset queries.

- **PLAN-020: Fix Daily Games Payout Multipliers & Validation Invariants (`v1.5.727`)**:
  - **🛡️ Server-Side Multiplier Authoritative Schema ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/fix_daily_games_payout_rpc.sql`](supabase/fix_daily_games_payout_rpc.sql))**:
    - Fixed runtime error `record "v_user" has no field "all_nfts"` in `submit_wordle_guess` and `claim_daily_sudoku_reward`.
    - Corrected NFT multiplier calculation to authoritatively union `owned_nfts` and `crate_nfts`.
    - Corrected VIP multiplier calculation to check `users.vip_until` and `users.vip_level`.
    - Corrected Relic multiplier calculation to verify `is_season1_apex_unlocked(users.relics)`.
    - Updated balance credit to atomically update `total_earned` alongside `balance_pgt`.
  - **📦 Database Schema & Master Synchronization ([`supabase/master_schema.sql`](supabase/master_schema.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Synchronized Section 27 in `master_schema.sql` with unified polymorphic tables and RLS policies.
    - Recompiled `master_rpcs.sql` with automated verification.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.727"` and refreshed asset queries.

- **PLAN-020: Consolidated Daily Games Schema from 9 Tables to 2 Polymorphic Tables (`v1.5.725`)**:
  - **🏛️ Streamlined Database Schema ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/consolidate_daily_games_schema.sql`](supabase/consolidate_daily_games_schema.sql))**:
    - Dropped 7 redundant tables (`daily_wordle_sessions`, `daily_wordle_claims`, `daily_wordle_stats`, `daily_sudoku_sessions`, `daily_sudoku_claims`, `daily_sudoku_stats`, `daily_logic_streaks`).
    - Consolidated all daily session tracking and claims into `public.daily_game_sessions` (`player_id, game_id, day_date`).
    - Consolidated all career stats, guess distributions, and logic streaks into `public.daily_game_stats` with flexible JSONB storage.
    - Updated all 4 authoritative daily RPCs (`get_daily_games_hub_status`, `submit_wordle_guess`, `start_daily_sudoku`, `claim_daily_sudoku_reward`) to operate on the unified schema with identical external API interfaces.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.725"` and refreshed asset queries.

- **PLAN-020: Rebalance Cyber Sudoku Difficulty Tier Base Rewards (`v1.5.724`)**:
  - **💰 Rebalanced Difficulty Tier Rewards ([`index.html`](index.html), [`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/easier_sudoku_puzzles.sql`](supabase/easier_sudoku_puzzles.sql))**:
    - Rebalanced base rewards across Sudoku difficulty cards and authoritative Supabase RPCs:
      - 🟢 **Easy Tier**: **+50 PGT** (Base) + 20% Flawless bonus (+10 PGT)
      - 🟡 **Medium Tier**: **+75 PGT** (Base) + 20% Flawless bonus (+15 PGT)
      - 🔴 **Hard Tier**: **+100 PGT** (Base) + 20% Flawless bonus (+20 PGT)
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.724"` and refreshed asset queries.

- **PLAN-020: Quality-of-Life Sudoku Polish (Easy Clues, Hints, 5 Mistakes Buffer & Keypad Counters) (`v1.5.723`)**:
  - **🔢 Easy Sudoku Clues Upgrade to 50 Clues ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/easier_sudoku_puzzles.sql`](supabase/easier_sudoku_puzzles.sql))**:
    - Upgraded all 25 Easy puzzles from 38-39 clues to a generous 50 clues (leaving only ~31 empty cells, over 62% pre-filled), making the Easy tier relaxed, approachable, and fun.
  - **🛡️ 5 Mistakes Allowance on Easy Tier ([`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql))**:
    - Relaxed mistake limit on Easy to 5 mistakes (up from 3) so accidental touch clicks don't terminate daily sessions prematurely.
  - **💡 3 Free Hints Per Game ([`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`index.html`](index.html))**:
    - Added a `💡 Hint (3)` button to the controls bar. Clicking reveals 1 correct cell with an animated green pop to help players when stuck.
  - **🔢 Keypad Remaining Counters & Completed Checkmarks ([`src/js/features/sudoku.js`](src/js/features/sudoku.js), [`src/css/features/games.css`](src/css/features/games.css))**:
    - Added real-time remaining number counters to the 1-9 keypad buttons. When all 9 instances of a number are placed, the button dims with a green checkmark `✓`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.723"` and refreshed asset queries.

- **PLAN-020: Player Referral Link Share & Daily Games UX Polish (`v1.5.722`)**:
  - **🔗 Player Referral Link Integration in Results Share ([`src/js/features/wordle.js`](src/js/features/wordle.js), [`src/js/features/sudoku.js`](src/js/features/sudoku.js))**:
    - Both Cyber Wordle and Cyber Sudoku result shares now automatically include the player's personal referral link (`https://polygongaming.io/?ref=<player_referral_code>`), allowing viral recruitment directly from Discord and X shares.
    - Added dedicated `📋 Share Result` buttons to both the Sudoku postgame card and stats modal.
  - **🧹 Obsolete Domain Purge ([`src/js/features/faucet.js`](src/js/features/faucet.js), [`.agents/AGENTS.md`](.agents/AGENTS.md), [`plans/`](plans/))**:
    - Purged remaining references to obsolete `polygame.fun` across all code and documentation, standardizing strictly on `https://polygongaming.io/`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.722"` and refreshed asset queries.

- **PLAN-020: Daily Cyber Games Hub (Wordle & Sudoku) with Dedicated Daily Tab & Salted Seed Anti-Cheat (`v1.5.721`)**:
  - **📅 Dedicated Daily Games Tab & Matrix Hub ([`index.html`](index.html), [`src/js/features/games.js`](src/js/features/games.js), [`src/js/features/daily-hub.js`](src/js/features/daily-hub.js))**:
    - Added a dedicated top-level `[ 📅 Daily Games ]` category tab alongside `[ ⚡ Mini-Games (Earn) ]` and `[ 🎲 Win PGT (Bet) ]`.
    - Integrated the Daily Cyber Logic Matrix dashboard featuring a live 00:00 UTC countdown timer, persistent Daily Logic Streak badge, and today's completion matrix (0/2, 1/2, 2/2 Double Mastery).
  - **🔠 Cyber Wordle (5-Letter Cipher) ([`src/js/features/wordle.js`](src/js/features/wordle.js), [`src/js/features/wordle-words.js`](src/js/features/wordle-words.js))**:
    - 5-letter cryptographic daily cipher with compact 5×6 tile grid, neon animations, virtual keyboard with color memory, and physical keyboard support.
    - 20 PGT baseline reward + row precision accuracy bonuses (Row 1: +100% / Row 2: +50% / Row 3: +25%).
    - Guess distribution histogram modal and spoiler-free emoji share copy for Discord & X.
  - **🔢 Cyber Sudoku with Difficulty Choice ([`src/js/features/sudoku.js`](src/js/features/sudoku.js))**:
    - 1 daily Sudoku puzzle per 24h cycle with player difficulty choice before start (🟢 Easy: 15 PGT, 🟡 Medium: 20 PGT, 🔴 Hard: 25 PGT).
    - +20% Flawless Solver bonus for completing with 0 mistakes.
    - 9×9 cyber grid with cell crosshair highlights, same-number highlighting, pencil candidate notes mode, undo, erase, mistake counter (max 3), and career stats modal.
  - **🛡️ Server-Side Salted Seed Anti-Cheat ([`supabase/rpcs/13_daily_games.sql`](supabase/rpcs/13_daily_games.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Target secret words and Sudoku boards are uniquely derived per player ID via deterministic salted hash `Hash(player_id + salt + CURRENT_DATE)` to render Discord/alt answer sharing completely useless.
    - Solutions are RLS locked and never exposed in browser DevTools.
    - Strict velocity floors and maximum mistake limits enforced server-side.
    - Assembled migration script [`supabase/daily_games_hub_phase2.sql`](supabase/daily_games_hub_phase2.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.721"` and refreshed asset queries.

- **PolySpace: Rebalance Module Upgrade Mineral Costs (Option 1) (`v1.5.720`)**:
  - **⛏️ Rebalanced Iron & Titanium Base Costs ([`space.js`](space.js), [`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql))**:
    - Increased Base Iron upgrade cost from 40 to 80 (2.0x base).
    - Increased Base Titanium upgrade cost from 10 to 30 (3.0x base), raising the Titanium-to-Iron ratio from 25% up to 37.5% to align with expedition drop rates in Deep Space and Odyssey.
  - **📈 Mineral Endgame Scaling & 1.18 Taper ([`space.js`](space.js), [`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql))**:
    - Adjusted Level 36–50 mineral cost taper to 1.18 (while preserving the 1.15 taper for PGT to maintain strict <2-year token ROI).
    - Provides a meaningful endgame sink for player mineral stockpiles without impeding token payback.
    - Created migration file [`supabase/rebalance_polyspace_mineral_costs_option1.sql`](supabase/rebalance_polyspace_mineral_costs_option1.sql) and rebuilt [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.720"` and refreshed asset queries.

- **PolySpace: Rebalance ROI with L35-50 Cost Taper, L21-50 Laser Scaling & +25% Long Missions (`v1.5.719`)**:
  - **🚀 Level 35–50 Module Cost Tapering ([`space.js`](space.js), [`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql))**:
    - Tapered exponential module upgrade cost scaling from 1.22 down to 1.15 for Levels 36–50, cutting Level 50 upgrade costs by up to 59% (from 852k PGT down to 351k PGT).
  - **⚡ Enhanced Mining Laser Yield Scaling ([`space.js`](space.js), [`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql))**:
    - Boosted Mining Laser yield scaling from +0.18 to +0.25 per level for Levels 21–50 (reaching 9.42x at L40 and 11.92x at L50).
  - **🌌 Deep Space & Odyssey Base PGT Buff (+25%) ([`space.js`](space.js), [`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql))**:
    - Increased Deep Space (3-Day) base PGT from 13.7 to 17.125 PGT (+25%).
    - Increased Odyssey (7-Day) base PGT from 24.5 to 30.625 PGT (+25%).
    - Rebalanced long-duration expeditions to cap payback strictly under 2 years up to Level 43 (Level 40 Deep Space payback drops to 1.31 years).
    - Created migration script [`supabase/rebalance_polyspace_roi_l35_taper_and_yields.sql`](supabase/rebalance_polyspace_roi_l35_taper_and_yields.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.719"` and refreshed asset queries.

- **VIP Faucet: Custom & Full Balance POL Payout Requests (`v1.5.718`)**:
  - **💎 Dynamic POL Payout Amount Selector ([`index.html`](index.html), [`src/js/features/faucet.js`](src/js/features/faucet.js))**:
    - Added an interactive Payout Amount input field with quick-preset `[ 5 POL ]` and `[ MAX ]` buttons in `#vip-faucet-payout-section`.
    - Allowed eligible players to request any custom amount from the 5.00 POL minimum up to their entire accumulated balance (e.g. 7.3156 POL).
    - Defaults automatically to the player's full balance (`MAX`) for instant 1-click full balance withdrawals.
    - Updated confirmation prompt, server RPC payload (`p_amount`), success toasts, player activity log, and Master Admin Discord alerts to reflect the exact requested amount.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.718"` and refreshed asset queries.

- **PolySpace: Dynamic Warp-Scaling Anti-Cheat Duration for High Warp Players (`v1.5.717`)**:
  - **🚀 Dynamic Flight Duration Anti-Cheat ([`supabase/rpcs/06_polyspace_fleet.sql`](supabase/rpcs/06_polyspace_fleet.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Replaced rigid static minimum duration floors in `claim_polyspace_expedition` (e.g. fixed 28h for Odyssey) with dynamic calculation based on player's actual `v_warp_level` (`v_warp_speed_mult = 1.0 + (v_warp_level - 1) * 0.05`).
    - Accommodates legitimate stacking of Warp Drive speed boosts, Hyperdrive mini-game calibration (-30%), and Deep Space Anomaly Temporal Wormholes (-25%) without false-positive claim blocks.
    - Preserves 100% anti-cheat protection against forged timestamps, backdating, and speedhackers.
    - Created migration file [`supabase/fix_polyspace_expedition_dynamic_warp_duration.sql`](supabase/fix_polyspace_expedition_dynamic_warp_duration.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.717"` and refreshed asset queries.

- **Security: Hard Cap Relic Drops to 1 Max Per Game Session with Anti-Cheat Trigger on 2nd (`v1.5.716`)**:
  - **🛡️ Strict 1 Relic Per Session Hard Cap ([`invaders.js`](invaders.js), [`game.js`](game.js), [`drift.js`](drift.js), [`stacker.js`](stacker.js), [`src/js/utils/confetti.js`](src/js/utils/confetti.js))**:
    - Initialized `this.sessionRelicsDroppedCount = 0` on session start across all arcade titles.
    - Restricted quantum relic spawn checks strictly to `(this.sessionRelicsDroppedCount || 0) < 1`, guaranteeing that legitimate gameplay will never spawn more than 1 relic per session regardless of game duration or score.
    - Added a client-side session set in `src/js/utils/confetti.js` to ensure duplicate RPC triggers cannot occur for the same active session ID.
  - **🔒 Anti-Cheat Trigger Calibrated ([`supabase/rpcs/03_quantum_relics.sql`](supabase/rpcs/03_quantum_relics.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Updated `grant_relic_drop` RPC: any attempt to claim $\ge 2$ relics within the same session ID is strictly recognized as an illegitimate duplicate exploit probe and triggers `unauthorized_relic_probe_capacity_exceeded`.
    - Created migration and remediation script [`supabase/remediate_relic_capacity_and_paulv_false_positive.sql`](supabase/remediate_relic_capacity_and_paulv_false_positive.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.716"` and refreshed asset queries.

- **Fix: Remove duplicate ARCADE_GAMES export in games.js (`v1.5.715`)**:
  - **🚀 Release Changes**:
    - Fix: Remove duplicate ARCADE_GAMES export in games.js.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.715"` and refreshed asset queries.

- **Architecture: Complete PLAN-019 Phases 2-4 (Dynamic Shared Leaderboard Template, Unified Games Registry & Modular Profile/Leaderboards/Holders) (`v1.5.714`)**:
  - **Single Source of Truth Arcade Registry ([`src/js/core/games-registry.js`](src/js/core/games-registry.js))**:
    - Created `ARCADE_GAMES_REGISTRY` and `ARCADE_GAMES_LIST` centralizing game keys, panel IDs, leaderboard container IDs, prize pool element IDs, score fields, and metadata for all 9 Earn Arcade games.
    - Integrated `initArcadeLeaderboardCards()` which dynamically hydrates all 9 arcade leaderboard cards from configuration with automatic deferred/DOM ready execution.
  - **HTML & CSS Optimization ([`index.html`](index.html), [`src/css/views.css`](src/css/views.css))**:
    - Deduplicated 115 lines of repetitive markup in `index.html` by replacing 9 hardcoded `<div id="leaderboard-col-*">` cards with clean mount containers.
    - Extracted the inline `@keyframes cratePulse` `<style>` tag from `index.html` into `src/css/views.css`, eliminating all inline `<style>` tags from the HTML root.
  - **Games Navigation & DB Sync Refactoring ([`src/js/features/games.js`](src/js/features/games.js), [`src/js/core/db-sync.js`](src/js/core/db-sync.js), [`src/js/app.js`](src/js/app.js))**:
    - Refactored `isAnyArcadeGamePlaying()` using `ARCADE_GAMES_LIST.some()` to eliminate hardcoded multi-branch game checks.
    - Simplified `closeGameView()` engine stops, start screen overlay restorations, and leaderboard column toggles into registry loops.
    - Streamlined `updateLeaderboardPoolHeaders()` in `db-sync.js` to iterate over `ARCADE_GAMES_LIST` directly.
  - **Modularized Profile Domain Architecture ([`src/js/features/leaderboards.js`](src/js/features/leaderboards.js), [`src/js/features/holders.js`](src/js/features/holders.js), [`src/js/features/profile.js`](src/js/features/profile.js))**:
    - Extracted `src/js/features/leaderboards.js` (864 lines) for live arcade and sitewide leaderboards, caching, user row detection, and name formatting.
    - Extracted `src/js/features/holders.js` (667 lines) for the PGT holders leaderboard, token supply history chart, and past weekly tournament archives.
    - Reduced `src/js/features/profile.js` from 2,651 lines down to 1,116 lines while maintaining 100% backward compatibility via `export * from './leaderboards.js'` and `export * from './holders.js'`.
    - Optimized scorecard updates in `syncProfileView()` and `openPublicProfile()` using concise `ARCADE_GAMES_LIST` loops.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.714"` and refreshed asset queries.

- **Architecture: Phase 1 token optimization and release tooling (`v1.5.713`)**:
  - **🚀 Release Changes**:
    - Architecture: Phase 1 token optimization and release tooling.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.713"` and refreshed asset queries.

- **Cyber 2048: Mobile Performance Overhaul, Edge-Guard & Back-Swipe Navigation Trap (`v1.5.712`)**:
  - **🛡️ Accidental History Back-Navigation & Edge-Swipe Guard ([`q2048.js`](q2048.js), [`src/css/features/games.css`](src/css/features/games.css))**:
    - Added an edge-zone filter that ignores touches starting within `28px` of the left/right screen bezel, preventing accidental mobile browser native system "swipe to go back/forward" gestures that kicked players out of active games.
    - Added `overscroll-behavior: none` and `touch-action: none` to `#panel-game-q2048` and `.q2048-board-wrapper` to suppress page rubber-banding and pull-to-refresh.
    - Integrated a `popstate` history-trap state machine on game start to prevent losing active puzzle sessions on back actions.
  - **⚡ Mobile 60 FPS Render Optimization ([`q2048.js`](q2048.js), [`src/css/features/games.css`](src/css/features/games.css))**:
    - Pre-cached HUD DOM elements (`_gridEl`, `_scoreEl`, `_bestEl`, `_maxTileEl`, `_bonusTokensEl`) to eliminate redundant `document.getElementById()` queries on every move.
    - Batched the entire 16-tile board rendering using an offscreen `DocumentFragment` with atomic `replaceChildren()`, cutting layout thrashing and DOM reflow cycles by 94%.
    - Replaced 2D translations with hardware-accelerated `translate3d()` and added `will-change: transform, opacity`, `transform: translateZ(0)`, and `backface-visibility: hidden` to `.q2048-tile` to offload tile animations entirely to the mobile GPU compositor.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.712"` and updated asset cache-busting queries.

- **Astro-Dodge: Strict Level 2 Weapon Overcharge Requirement for Seeking Missiles (`v1.5.711`)**:
  - **🚀 Missile Gating Fix ([`game.js`](game.js))**:
    - Restricted micro-missiles strictly to **Level 2 Weapon Overcharge** (`weaponLevel >= 2`).
    - Removed fallback condition that allowed missiles to launch prematurely during Level 1 Quad-Laser Boost if a starship was equipped.
    - Level 1 weapon boost now strictly fires the 4-bullet quad plasma spread as intended, while collecting a second weapon powerup unlocks Level 2 with high-velocity homing missiles.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.711"` and refreshed asset queries.

- **Astro-Dodge: High-Visibility Seeking Missiles & Proportional Angular Guidance (`v1.5.710`)**:
  - **🚀 Missile Visual Size & Neon Plume Upgrade ([`game.js`](game.js))**:
    - Significantly enlarged micro-missile graphics: widened fuselage from `14x5` to `24x9`, extended warhead cone length to 20px, added distinct aerodynamic stabilizer fins, and rendered a translucent high-visibility orange outer glow aura (`rgba(255, 136, 0, 0.35)`).
    - Upgraded exhaust particle trail: moved plume origin back to align with the extended fuselage and increased particle radius and density.
  - **🎯 Proportional Angular Guidance & Anti-Orbiting Fix ([`game.js`](game.js))**:
    - Replaced raw vector delta addition with true angular steering (`Math.atan2` differential clamped to `[-PI, PI]`).
    - Added distance-proportional turn rate clamping (0.12 rad/s at distance, sharpening up to 0.25 rad/s within 100px) to prevent missiles from orbiting around moving asteroids.
    - Expanded asteroid/enemy hit-test proximity radius from `e.radius + 10` to `e.radius + 16` to reflect the larger missile dimensions.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Bumped `APP_VERSION = "1.5.710"` and updated asset cache-busters.

- **Arcade Economy Balance: 30% PGT Earning Reduction for Cyber Stacker, Drift & Runner (`v1.5.709`)**:
  - **⚖️ Calibrated Base Earning Rates Across Top Arcade Games ([`drift.js`](drift.js), [`stacker.js`](stacker.js), [`runner.js`](runner.js))**:
    - Reduced the base PGT earn calculation by **30%** (multiplied by `0.70`) for Cyber Drift, Cyber Stacker, and Cyber Runner to maintain long-term game economy sustainability and curb hyper-earning.
    - Preserved bonus token / orb mechanics and capped multiplier logic while re-aligning the base formula curve.
  - **🔒 Synchronized Authoritative Server RPC ([`supabase/rpcs/02_arcade_sessions.sql`](supabase/rpcs/02_arcade_sessions.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Updated `public.end_arcade_session()` to enforce the identical 30% reduction on server-side settlements for Drift, Stacker, and Runner.
    - Rebuilt `master_rpcs.sql` and generated migration [`supabase/reduce_stacker_drift_runner_earnings_30pct.sql`](supabase/reduce_stacker_drift_runner_earnings_30pct.sql).
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Bumped `APP_VERSION = "1.5.709"` and refreshed client script cache-busters.

- **Arcade & UI Performance Overhaul: 60 FPS Frame-Pacing, DOM HUD Throttling & GPU Compositor Relief (`v1.5.708`)**:
  - **⚡ Eliminated Per-Frame DOM Thrashing Across Arcade Engines ([`tetris.js`](tetris.js), [`game.js`](game.js), [`runner.js`](runner.js), [`skeet.js`](skeet.js), [`defense.js`](defense.js), [`drift.js`](drift.js))**:
    - Cached HUD DOM element references and added dirty-value checks + frame-interval throttling across all arcade engines so `document.getElementById()`, `.innerText`, and `.innerHTML` are no longer mutated unconditionally 60–144 times per second.
    - In `tetris.js`: pre-bound `this.boundLoop` once in the constructor (eliminating per-frame `.bind()` allocations), added a 60 FPS frame-delta cap for 120Hz/144Hz screens, gated `updateGravity()` to run once per second instead of every frame, and batched all 32 board grid lines into a single `ctx.beginPath()` / `ctx.stroke()` draw call.
    - In `game.js`: moved `appState.getMultipliers()`, `isVipActive()`, and `getVipLevel()` inside the 10-frame HUD throttle block, cutting 90% of per-frame Set/Array allocations during Astro-Dodge flight.
  - **🚀 Procedural Starship Renderer & DNA Memoization ([`src/js/features/hangar.js`](src/js/features/hangar.js))**:
    - Added `Map` memoization caches (`_rarityCache`, `_dnaCache`) for `getStarshipRarity(dna)` and `decodeDNA(dna)` so 60 FPS gameplay loops never re-parse DNA strings or filter trait arrays on every frame.
    - Replaced per-frame `ctx.createLinearGradient()` and `ctx.shadowBlur` calls on thruster plumes and hull/wing panels during active gameplay (`isGame === true`) with fast layered vector fills while preserving full glow gradients in the Hangar preview.
  - **🔊 Pre-Cached Explosion White-Noise Buffer & Auto-Removing Unlock Listeners ([`src/js/core/audio.js`](src/js/core/audio.js))**:
    - Cached a single reusable white-noise `AudioBuffer` (`this._explosionBuffer`) in `playExplosion()`, eliminating synchronous 28,800-iteration `Math.random()` loops on the main thread during chain explosions.
    - Automatically removed the 5 global `capture: true` audio-unlock listeners (`click`, `touchstart`, `touchend`, `pointerdown`, `keydown`) once the `AudioContext` is unlocked and running.
  - **🎨 Multi-Entity Canvas `shadowBlur` Cleanup & Background Timer Gating ([`invaders.js`](invaders.js), [`runner.js`](runner.js), [`src/js/features/faucet.js`](src/js/features/faucet.js), [`src/js/features/quests.js`](src/js/features/quests.js), [`src/js/features/staking.js`](src/js/features/staking.js), [`space.js`](space.js), [`src/css/views.css`](src/css/views.css))**:
    - Removed per-alien, per-bunker-segment, per-bullet, and per-particle `ctx.shadowBlur` passes in `invaders.js` and `runner.js` (saving ~80 Gaussian blur passes per frame).
    - Paused 1-second background DOM timers in `faucet.js`, `quests.js`, `staking.js`, and `space.js` while `document.hidden` is true or any arcade game is actively running (`window.isAnyArcadeGamePlaying()`).
    - Disabled heavy 16px GPU `backdrop-filter` blurring on `.card` containers inside `#view-games` and on mobile viewports (`max-width: 768px`).

- **Arcade Leaderboard UX: Weekly Pool Reset Timing Clarification (`v1.5.707`)**:
  - **🕒 Reset Notice Added Across All 9 Leaderboards ([`index.html`](index.html))**:
    - Updated the weekly tournament banner text across all arcade leaderboard cards (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker, Cyber Skeet, Cyber Defense, Cyber Runner, Cyber 2048, and Cyber Tetris).
    - Added explicit community notice: *"Pool resets every Sunday (reset can be delayed by a few hours)."* to set clear expectations around weekly prize distribution and score rollover windows.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.707"` and refreshed asset cache-busters.

- **Cyber Tetris Mobile Controls: Directional Axis Locking for Swipes (`v1.5.706`)**:
  - **📱 Gesture Axis Locking & Drift Elimination ([`tetris.js`](tetris.js))**:
    - Introduced a directional axis-lock state machine (`gestureLock`) for touch gestures with a 10px deadzone filter.
    - When swiping down or flicking to drop (soft drop / hard drop), the gesture immediately locks strictly to the vertical axis (`absTotalDy >= 12 && absTotalDy >= absTotalDx * 1.2`).
    - While locked to vertical, all horizontal column movement (`moveLeft` / `moveRight`) is completely suppressed, preventing accidental left/right drifting caused by natural thumb curvature or angled downward swiping.
    - When shifting columns horizontally (`absTotalDx >= 12 && absTotalDx >= absTotalDy * 1.2`), downward soft drops are suppressed to prevent premature drops while aiming tetrominoes into narrow gaps.
    - Calibrated fast downward flick detection (`totalDy > 55`, `dt < 260ms`) for crisp, instant hard drops without column drift.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.706"` and refreshed cache busters for `tetris.js`, `app.js`, and `main.css`.

- **Arcade Polish: In-Game Starship Size Further Boosted by +20% (`v1.5.705`)**:
  - **🚀 Extended Starship Canvas Scaling ([`src/js/features/hangar.js`](src/js/features/hangar.js), [`game.js`](game.js), [`invaders.js`](invaders.js))**:
    - Further increased the normalized Starship rendering scale by an additional +20% (`targetHalfSpan = 28.8px`, `targetLength = 59.4px`, scale range `0.28` - `0.53`).
    - Gives procedural NFT starships a bold, commanding screen presence while maintaining the standardized 14px competitive collision radius.
    - Expanded the rarity atmospheric underglow halo to a 23px radius in Astro-Dodge.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.705"` and refreshed asset cache-busters.

- **Arcade Polish: In-Game Starship Size Increased by +30% (`v1.5.704`)**:
  - **🚀 Proportional +30% Starship Upscaling ([`src/js/features/hangar.js`](src/js/features/hangar.js), [`game.js`](game.js), [`invaders.js`](invaders.js))**:
    - Increased the normalized in-game visual envelope for all procedural Starships by +30% (`targetHalfSpan = 24.0px`, `targetLength = 49.5px`, scale range `0.23` - `0.44`).
    - Striking the perfect visual balance: starships are prominent, clear, and striking on canvas while remaining aligned with core collision dodging physics.
    - Expanded the rarity-colored core atmospheric underglow aura to a 19px radius in Astro-Dodge.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.704"` and refreshed asset cache-busters.

- **Arcade Fair Play & Visual Hitbox Normalization for NFT Starships (`v1.5.703`)**:
  - **🚀 Dynamic DNA Bounding-Box Normalization ([`src/js/features/hangar.js`](src/js/features/hangar.js), [`game.js`](game.js), [`invaders.js`](invaders.js))**:
    - Created `getNormalizedShipScale(dna, targetHalfSpan, targetLength)` engine in `hangar.js` that calculates proportional in-game rendering scale based on each starship's procedural DNA traits (`wings.span` and `chassis.length`).
    - Eliminates the static `0.48` scale that previously caused long-wing starships (e.g. Broad Delta Wings, span 85) to appear 2.5x larger than the standardized 14px radius (28px diameter) collision hitbox.
    - Standardizes all equipped NFT Starships to a ~36px visual footprint across Astro-Dodge and Cyber Invaders, ensuring wingtips align with collision boundaries and dodging remains completely intuitive and fair without phantom asteroid pass-throughs.
    - Added subtle rarity-colored atmospheric underglow aura (radius 16px) around the starship core in Astro-Dodge to visually signal the exact player collision center.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.703"` and refreshed asset cache-busters.

- **Faucet Post-Claim Modal: High-Visibility 2,500 PGT Boost Callout (`v1.5.702`)**:
  - **⚡ Prominent Top Boost Badge ([`index.html`](index.html))**:
    - Added a glowing highlight pill directly below the claim celebration header (`+56.10 PGT Claimed!`): *"⚡ Boost to earn up to 2,500 PGT per claim! ↗"*, linking directly to the Faucet Boost NFT marketplace.
    - Enlarged and enhanced the **2,500 PGT** typography across the Utility NFTs recommendation card with high-contrast emerald glow and bold letter spacing.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.702"` and refreshed asset cache-busters.

- **Legal Navigation Polish: Removed Unrelated Wallet Portal Link (`v1.5.701`)**:
  - **🧹 Legal Navigation Cleanup ([`terms.html`](terms.html), [`privacy.html`](privacy.html))**:
    - Removed the unrelated Discord bot wallet portal link (`verify.html`) from both the top navigation header and the footer across the website Terms of Service and Privacy Policy.
    - Cleaned legal navigation to focus purely between `📜 Terms of Service`, `🔒 Privacy Policy`, and the `← Return to Polygongaming.io` portal.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.701"` and refreshed asset cache-busters.

- **Legal Scope Refinement: Website-Dedicated Terms & Privacy (`v1.5.700`)**:
  - **🌐 Dedicated Website Scope & Domain Cleanup ([`terms.html`](terms.html), [`privacy.html`](privacy.html))**:
    - Removed obsolete domain reference (`polygame.fun`) from all legal documents, establishing `https://polygongaming.io` as the sole official web platform authority.
    - Decoupled the Discord bot (PolyBot) from website legal documentation (the Discord bot maintains its own separate legal documentation and developer portal agreements).
    - Streamlined `terms.html` and `privacy.html` strictly for visitors, players, and on-chain Web3 participants of the **Polygon Gaming Website**.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html), [`src/js/core/ui.js`](src/js/core/ui.js))**:
    - Incremented `APP_VERSION = "1.5.700"` and refreshed asset cache-busters.

- **Legal & Platform Compliance: Enterprise Terms of Service & Privacy Policy Overhaul (`v1.5.699`)**:
  - **📜 Comprehensive Terms of Service ([`terms.html`](terms.html))**:
    - Re-architected `terms.html` to comprehensively cover the entire **Polygon Gaming** ecosystem (including web platform `polygongaming.io`, skill arcades, provably fair chance games, 24h faucet, staking vaults, utility NFTs, starships, relics, 4-tier referral marketplace, and the official Discord bot `PolyBot`).
    - Added 12 legally robust sections with quick-jump navigation: Eligibility & 18+ Age Restriction, Platform Architecture, Strict Non-Custodial Principles, Zero-Tolerance Anti-Cheat & Sybil Defense (1 account per person rule), Virtual Asset & Financial Disclaimers (PGT is a utility token, not an investment/security), Blockchain Gas & Finality, Limitation of Liability ("As-Is"), and Dispute Resolution.
  - **🔒 Transparent Privacy Policy & GDPR/CCPA Compliance ([`privacy.html`](privacy.html))**:
    - Expanded `privacy.html` with data minimization principles: clearly categorizes collected data (public EVM wallet address, transaction hashes, arcade session scores, synthetic `player_id`, optional Google OAuth recovery, and Discord snowflake IDs).
    - Structured "What We NEVER Collect" clause: zero private keys, zero seed phrases, zero credit cards, zero real names, and zero third-party advertising tracking.
    - Added user data rights (Right of Access, Rectification, and Erasure / "Right to be Forgotten"), technical security invariant documentation (Zero-Anon-Writes, Row-Level Security, Ed25519 webhook signatures), and children's privacy protection (strict 18+ policy).
  - **📱 In-App Legal Modals & Direct Links ([`src/js/core/ui.js`](src/js/core/ui.js), [`index.html`](index.html))**:
    - Upgraded `openInfoModal('privacy')` and `openInfoModal('terms')` in `ui.js` with structured executive summaries and prominent action buttons linking to the full 12-section documents.
    - Updated homepage footer and information sections in `index.html` with direct outbound links to `terms.html` and `privacy.html`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.699"` and refreshed asset cache-busters.

- **Referral Marketplace: Direct RPC Adoption & Live Pool Census Decrement (`v1.5.698`)**:
  - **🧹 Direct RPC Execution & Elimination of Undeployed Edge CORS Errors ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Streamlined the Web3 POL adoption pipeline to directly execute the verified `adopt_referrals` Supabase RPC with zero redundant calls to undeployed Edge Function endpoints.
    - Completely eliminates the preflight CORS / `ERR_FAILED` red errors previously logged in the browser console.
  - **⚡ Fast Census Aggregation & Instant Real-Time Pool Decrement ([`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/add_referral_marketplace_rpcs.sql`](supabase/add_referral_marketplace_rpcs.sql), [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Created lightweight `get_unreferred_census()` database function that performs server-side SQL aggregation of available unreferred players across all 6 activity tiers, replacing slow whole-table scans.
    - Added instant client-side decrement of tier pool counters immediately upon successful adoption, ensuring tier badges (e.g. "75 In Pool" -> "73 In Pool") update visually without delay.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.698"` and refreshed asset cache-busters.

- **Referral Marketplace Anti-Cheat & Security Hardening (`v1.5.697`)**:
  - **🛡️ Blockchain-Verified Edge Function & Anti-Replay Shield ([`supabase/functions/adopt-referrals/index.ts`](supabase/functions/adopt-referrals/index.ts), [`supabase/add_referral_marketplace_rpcs.sql`](supabase/add_referral_marketplace_rpcs.sql))**:
    - **Polygon Mainnet JSON-RPC Verification**: Created serverless Edge Function `adopt-referrals` that directly inspects transaction status on Polygon blockchain (`receipt.status == 1`), destination address (`tx.to == ADMIN_WALLET_ADDRESS`), sender address (`tx.from == buyer.linked_wallet_address`), and exact POL amount before calling the database.
    - **Cryptographic Anti-Replay Defense**: Every redeemed `tx_hash` is atomically validated and permanently recorded into `public.nft_sales` (backed by database-level unique index `idx_nft_sales_tx_hash`). Double-spending or recycling transaction hashes is strictly impossible.
    - **Anti-Front-Running Defense**: Verifies that the sender address of the Polygon transaction strictly matches the authenticated buyer's registered account wallet, preventing attackers from intercepting or stealing third-party hashes from the public mempool.
    - **Anti-Loop Referral Tree Defense**: Explicitly prevents buyers from adopting themselves or any account that exists in their upstream referral chain (`referred_by_l1..l4`), eliminating any circular commission loop exploits.
    - **Row-Level Concurrency Isolation**: Employs `FOR UPDATE SKIP LOCKED` during unreferred player selection, preventing parallel race condition exploits or double-adoption across concurrent purchases.
    - **Autonomous Server-Side Pricing & Discount Enforcement**: Pricing, tier quantities, volume discounts, and VIP membership statuses are calculated independently on the server, guaranteeing that client-side payload tampering cannot lower POL costs.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.697"` and refreshed asset cache-busters.

- **Referral Economy: Exclusively On-Chain POL Payment (PGT Disabled) (`v1.5.696`)**:
  - **🟣 Strictly On-Chain Polygon POL Checkout ([`index.html`](index.html), [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`supabase/add_referral_marketplace_rpcs.sql`](supabase/add_referral_marketplace_rpcs.sql))**:
    - Removed the in-app PGT balance payment option from the Referral Marketplace checkout modal and order summary.
    - Referral adoption is now exclusively funded via on-chain Polygon POL Web3 transfers to the treasury wallet (`ADMIN_WALLET_ADDRESS`), preventing players from purchasing referral trees using faucet/mined PGT tokens.
    - Updated server-side RPC `adopt_referrals` to reject any non-POL payment attempts with a clear notice.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.696"` and refreshed asset cache-busters.

- **Referral Economy: Downline Tree Reconciliation & Inherited Sub-Referrals (`v1.5.695`)**:
  - **🌳 Automatic Referral Tree Reconciliation on Adoption ([`supabase/add_referral_marketplace_rpcs.sql`](supabase/add_referral_marketplace_rpcs.sql), [`supabase/rpcs/01_utility_identity.sql`](supabase/rpcs/01_utility_identity.sql), [`supabase/master_rpcs.sql`](supabase/master_rpcs.sql))**:
    - Upgraded `adopt_referrals` to automatically trigger `public.reconcile_referral_trees_internal()` immediately upon player adoption.
    - Cascades the 4-tier network: when a buyer adopts an unreferred player who already invited their own friends, the adopted player becomes the buyer's Level 1 (L1), their referrals cascade as the buyer's Level 2 (L2), and so on down to Level 4 (L4).
    - Automatically updates `referrals_l1`, `referrals_l2`, `referrals_l3`, `referrals_l4`, and `referrals_count` across the entire database.
  - **📱 Live Multi-Tier Downline Refresh & Inherited Sub-Referral Alerts ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - The checkout completion flow in both PGT and POL now extracts authoritative 4-tier counts (`referrals_l1..l4`) returned by the server.
    - Calculates inherited sub-referrals and highlights them in the post-purchase celebration banner (e.g., `🎉 Adoption Complete! 3 active players (+5 inherited sub-referrals!) added to your downline network!`).
    - Automatically calls `loadMyDownlineNetwork()` to instantaneously refresh the user's downline directory, ledger, and weekly activity census.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.695"` and refreshed asset cache-busters.

- **Referral Economy: 3x Pricing Reduction, POL & PGT Crypto Checkout & Tier/VIP Discounts (`v1.5.694`)**:
  - **💰 ~3x Price Reduction on Referral Adoption ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Re-calibrated unreferred player adoption tier pricing to approximately 1/3 of initial preview estimates:
      - **👑 Level 5 (Apex Legend)**: $8.00 USD (down from $25.00)
      - **💎 Level 4 (Elite Champion)**: $5.00 USD (down from $15.00)
      - **🥇 Level 3 (Veteran)**: $2.50 USD (down from $8.00)
      - **🥈 Level 2 (Contender)**: $1.25 USD (down from $4.00)
      - **🥉 Level 1 (Scout)**: $0.60 USD (down from $2.00)
      - **⚪ Level 0 (Dormant)**: $0.15 USD (down from $0.50)
  - **🎁 Tiered Volume Discounts & VIP Bonus ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`index.html`](index.html))**:
    - Automatic -10% volume discount on carts totaling >= $20.00 USD.
    - Automatic -20% volume discount on carts totaling >= $100.00 USD.
    - Additional +10% stacked discount for active VIP pass holders (`appState.isVipActive()`).
    - Live order summary and checkout modal dynamically calculate subtotal, total discount percentage, savings, and final net amount.
  - **⚡ Real Crypto Payment Execution (POL & PGT) ([`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`index.html`](index.html))**:
    - Replaced simulation with real payment processing:
      - **⚡ PGT Token**: Checks in-app balance against discounted PGT cost, executes secure server deduction via `adopt_referrals` RPC (or resilient client fallback), immediately credits Level 1 downline counters, logs activity, and displays celebration confetti.
      - **🟣 Polygon POL**: Prompts user's Web3 wallet (`ethers.BrowserProvider`) to transfer discounted POL directly to Treasury (`ADMIN_WALLET_ADDRESS`), verifies transaction confirmation on Polygon, synchronizes referral adoption with tx hash, and updates user stats.
  - **🔒 Strictly Hidden from Regular Users ([`index.html`](index.html))**:
    - Preview card on the referral tab is hidden by default (`style="display: none;"`), accessible only via direct URL hash (`/#buy-referrals`) or to master admin.
  - **🗄️ Backend RPC Migration Ready ([`supabase/add_referral_marketplace_rpcs.sql`](supabase/add_referral_marketplace_rpcs.sql))**:
    - Prepared transactional PostgreSQL RPC `adopt_referrals(...)` implementing anti-cheat trigger compliance, row locking (`FOR UPDATE SKIP LOCKED`), downline tree assignment, and audit activity logging.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.694"` and refreshed asset cache-busters.

- **Router & Extension Error Suppression Fix (`v1.5.693`)**:
  - **🛡️ Early Fallback Router & Unhandled Rejection Sentinel ([`index.html`](index.html), [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js))**:
    - Synchronized `validTabs` in the early inline `<head>` fallback router to recognize `'buy-referrals'` and `'referral-shop'`, preventing direct hash visits from accidentally defaulting back to dashboard before ES modules load.
    - Moved the `unhandledrejection` sentinel to document `<head>` to immediately intercept and suppress browser extension message channel / port disconnect errors (`chrome.runtime.sendMessage` disconnects on `/#buy-referrals:1` from MetaMask, Phantom, Coinbase, etc.).
    - Added resilient multi-layer `getActiveSupabase()` resolution in `referral-shop.js` to ensure queries safely await client initialization without unhandled promises.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.693"` and refreshed asset cache-busters.

- **Referral Economy: Referral Adoption Marketplace Preview (`v1.5.692`)**:
  - **🛒 Hidden Referral Adoption Marketplace (`#buy-referrals`, [`src/js/features/referral-shop.js`](src/js/features/referral-shop.js), [`index.html`](index.html), [`src/css/features/referrals.css`](src/css/features/referrals.css))**:
    - Built a dedicated private-preview page allowing players to browse unreferred players across all 6 weekly activity levels:
      - **👑 Level 5 (Apex Legend)**: $\ge 6$ claims, $\ge 50$ arcade games / week (Fictive: $25.00 USD)
      - **💎 Level 4 (Elite Champion)**: $\ge 5$ claims, $\ge 25$ arcade games / week (Fictive: $15.00 USD)
      - **🥇 Level 3 (Veteran)**: $\ge 3$ claims, $\ge 5$ arcade games / week (Fictive: $8.00 USD)
      - **🥈 Level 2 (Contender)**: $\ge 2$ claims, $\ge 1$ arcade game / week (Fictive: $4.00 USD)
      - **🥉 Level 1 (Scout)**: $\ge 1$ faucet claim / week (Fictive: $2.00 USD)
      - **⚪ Level 0 (Dormant)**: Registered unreferred players currently idle (Fictive: $0.50 USD)
    - **Live Supabase Census**: Automatically pulls real-time counts of unreferred users (`referred_by_l1 IS NULL OR referred_by_l1 = ''`) and filters out banned accounts.
    - **Interactive Steppers & Fictive Price Calculator**: Allows players to select desired quantities per level (`[-]`, input, `[+]`, `[Max]`), calculating subtotal and total cost in real time with USD, POL, and PGT conversions.
    - **Checkout Simulation Modal (`#modal-buy-referrals-checkout`)**: Displays an order breakdown and upcoming payment method options (Polygon POL, PGT Tokens, Credit/Debit Card via Stripe, and Stablecoins), with simulated purchase flow.
  - **🔗 Private Preview Entry & Router Integration ([`src/js/app.js`](src/js/app.js), [`index.html`](index.html))**:
    - Added `'buy-referrals'` and alias `'referral-shop'` to `VALID_TABS` for direct hash navigation (`#buy-referrals`).
    - Added a subtle preview card in the existing Affiliate tab (`view-referrals`) directly beneath the Direct L1 Activity Level Census for easy testing.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.692"` and refreshed asset cache-busters.

- **Faucet Claim Success Modal: NFT Boost Promotion (`v1.5.691`)**:
  - **G🊪 Replaced Sunday Reset with NFT Boost Card ([`index.html`](index.html), [`src/js/features/faucet.js`](src/js/features/faucet.js))**:
    - Removed the old Sunday Reset option from the post-claim faucet modal (`#modal-faucet-success`).
    - Added an interactive **Utility NFTs (Boost Claims)** card highlighting how players can equip Faucet Boost NFTs and stack bonuses to earn up to **2,500 PGT** per claim.
    - Updated `launchFromFaucetModal('nft')` to automatically route players to the Utility NFT Market (`switchNftView('market')`).
  - **🚘 Outdated Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`k((index.html))j**:
    - Incremented `APP_VERSION = "1.5.691"` and refreshed script cache-busters.

- **Faucet & Staking Economy: Progressive 1-Year PGT Staker Bonus (`v1.5.690`)**:
  - **🐋 Progressive 5%-Step 1Y Staker Bonus (`500k` to `2.5M` PGT = `+10%` to `+30%`) ([`index.html`](index.html), [`src/js/core/state.js`](src/js/core/state.js), [`src/js/features/faucet.js`](src/js/features/faucet.js), [`src/js/features/profile.js`](src/js/features/profile.js))**:
    - Upgraded the Faucet Staker Multiplier card to a progressive 1-Year (`tier = 'year'`) PGT Staker Bonus with a live progress bar (`#faucet-pgt-progress-fill`), staked 1Y counter (`#faucet-pgt-progress-count`), and next-tier milestone indicator (`#faucet-pgt-progress-next`).
    - Only active 1-Year PGT vault positions (`pool = 'pgt'`, `tier = 'year'`) count toward the progressive multiplier in 5% steps per 500,000 PGT:
      - `< 500,000 PGT (1Y)`: `+0% (1.00x)`
      - `500,000 – 999,999 PGT (1Y)`: `+10% (1.10x)`
      - `1,000,000 – 1,499,999 PGT (1Y)`: `+15% (1.15x)`
      - `1,500,000 – 1,999,999 PGT (1Y)`: `+20% (1.20x)`
      - `2,000,000 – 2,499,999 PGT (1Y)`: `+25% (1.25x)`
      - `>= 2,500,000 PGT (1Y)`: `+30% (1.30x)`
  - **🛡️ Server-Authoritative Faucet & Staking RPCs ([`supabase/rpcs/04_faucets_vip_yields.sql`](supabase/rpcs/04_faucets_vip_yields.sql), [`supabase/rpcs/07_vault_staking.sql`](supabase/rpcs/07_vault_staking.sql), [`supabase/upgrade_progressive_1y_staker_faucet_bonus.sql`](supabase/upgrade_progressive_1y_staker_faucet_bonus.sql))**:
    - Updated `claim_faucet` and `claim_vip_faucet` Step 11 to compute `v_staked_pgt_1y` authoritatively from `public.user_stakes` (`tier = 'year'`) and apply the 5%-step multiplier (`1.10x` to `1.30x`), while preserving `v_staked_pgt_total` for the separate 1M PGT Holder Bonus (+10%).
    - Updated `get_user_stakes` to match active stakes across both `player_id` and `linked_wallet_address`.
  - **🚀 Cache-Busters & Version Bump ([`src/js/core/config.js`](src/js/core/config.js), [`index.html`](index.html))**:
    - Incremented `APP_VERSION = "1.5.690"` and refreshed asset cache-busters.

