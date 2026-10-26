# Polygon Gaming — Complete Changelog & Patch History

This document contains the recent release notes (v1.5.690+).
For historical archives, see:
- [Historical v1.5 Releases (v1.5.000 - v1.5.689)](docs/archive/CHANGELOG_v1.5_archive.md)
- [Historical v1.4 Releases (v1.4.298 - v1.4.499)](docs/archive/CHANGELOG_v1.4_archive.md)

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

