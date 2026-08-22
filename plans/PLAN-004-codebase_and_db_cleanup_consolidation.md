# PLAN-004: Codebase & Supabase DB Scripts Cleanup & Consolidation

**Plan ID**: `PLAN-004`  
**Status**: Saved for Future Execution  
**Created**: 2026-08-22  
**Target Version**: Post-v1.5.128

---

## 🎯 Executive Summary

Over successive updates, the PolyGame repository has accumulated **74+ standalone SQL files** in `supabase/` and several legacy/scratch files in the root folder. 

This specification establishes a clean, zero-risk consolidation architecture to:
1. Archive historical one-off patch scripts into `supabase/archive/` while retaining 100% audit history.
2. Build canonical **`master_schema.sql`** and **`master_rpcs.sql`** reflecting the exact production state of Supabase at `v1.5.128+`.
3. Safely purge unreferenced scratch files from the repository root.
4. Clean up legacy query-string imports in frontend modules and enhance automated validation tools.

---

## 🛡️ Risk Assessment & Zero-Breaking Safeguards

### Risk Level: **Zero to Extremely Low**

| Area | Potential Risk | Why There Is No Live Risk | Mitigation / Safeguard Strategy |
| :--- | :--- | :--- | :--- |
| **Supabase Database & SQL Scripts** | Accidental data loss, schema corruption, or broken RPCs | Files in the local `supabase/` folder are **source code / reference files**. Modifying or organizing files in git **does NOT execute against Supabase** or alter the live production database in any way. | 1. **100% History Preservation**: Historical incremental scripts are not destroyed—they are organized cleanly into `supabase/archive/`.<br>2. **Canonical Master Files**: We assemble a unified `master_schema.sql` and `master_rpcs.sql` reflecting the active production state.<br>3. **Zero DB Mutation**: No SQL is run in Supabase during repo cleanup. |
| **Root Scratch & Backup Files** | Breaking runtime scripts or missing HTML dependencies | Unreferenced scratch files (`original_roshambo.js`, `good_roshambo.js`, `wc.js`, `test_rpc.html`, `test_wc.html`, etc.) are not loaded by `index.html`, `manifest.json`, or any JS module. | 1. Verified via codebase-wide grep that no active modules or HTML tags import these files.<br>2. Keep all essential operational files (`deployer.html`, `deployer.js`, `launch.html`, `generate_metadata.py`, `validate_syntax.py`, `validate_imports.py`). |
| **Frontend JavaScript Modules (`src/js/` & Arcade Scripts)** | Breaking global event handlers (`onclick="..."`) or cross-module state | In vanilla JS / ES modules, HTML inline handlers (e.g. `switchTab()`, `executeWithdrawPGT()`, `launchPolySpace()`) rely on specific `window.*` bindings and state mappings. | 1. **Preserve Global Contracts**: Maintain all `window.*` globals, state getters/setters, and RPC argument payloads.<br>2. **Preserve Backwards Compatibility**: Retain dual-column DB mappings (e.g. `catcher_highscore` / `stacker_highscore`) so historical leaderboards and player rows continue working seamlessly.<br>3. **Automated Validation**: Run automated syntax and import dependency checks before and after changes. |

---

## 📋 Detailed Action Plan

### Phase 1: Database Script Consolidation & Archive Organization

#### 1. Master Canonical Schema & RPCs
- **`supabase/master_schema.sql`**: Complete, clean schema definition containing all active production tables (`users`, `arcade_sessions`, `user_stakes`, `withdrawals_history`, `relics`, `global_settings`, `daily_quests`, `jackpot_state`, `bet_wins`, `user_ips`, etc.), column constraints, default values, indexes, and Row Level Security (RLS) policies.
- **`supabase/master_rpcs.sql`**: Consolidated, production-grade definitions of all active `SECURITY DEFINER` stored procedures (`end_arcade_session`, `credit_arcade_payout`, `claim_faucet`, `deposit_stake`, `unstake_position`, `process_referral_commissions`, `prune_old_arcade_sessions`, `execute_weekly_payout_and_reset`, etc.).

#### 2. Archive Historical & Superseded Scripts
- Create `supabase/archive/` and move historical one-off patch scripts, debug queries, and older RPC versions into it (e.g. `investigate_ginza_pgt.sql`, `investigate_gincha_pgt.sql`, `list_empty_inactive_accounts.sql`, `fix_column_users_id_error.sql`, `add_test_crate_nft.sql`, older security shield iterations).
- Keep only pending user-executable scripts in `supabase/` root:
  - `supabase/integrate_arcade_and_polyspace_referral_commissions.sql` (active user task).
  - `supabase/master_schema.sql` (reference canonical schema).
  - `supabase/master_rpcs.sql` (reference canonical RPCs).

---

### Phase 2: Root Directory & Scratch Files Purge

Remove unneeded temporary scratch files and unreferenced backups from the root directory:

#### Files to Delete
- `original_roshambo.js` (legacy backup)
- `original_roshambo_backup.js` (legacy backup)
- `good_roshambo.js` (legacy backup)
- `wc.js` (unreferenced bundle)
- `test_rpc.html` (scratch test)
- `test_wc.html` (scratch test)
- `fix_syntax.py` (one-off scratch script)
- `inject_logger.py` (one-off scratch script)
- `log_server.py` (one-off scratch script)
- `browser_logs.txt` (scratch log)

#### Files to Preserve
- `index.html` (Main Application)
- `launch.html` (Official Launch Portal & SEO article)
- `deployer.html` & `deployer.js` (Token/Contract deployment interface)
- `game.js`, `invaders.js`, `drift.js`, `stacker.js`, `space.js` (Arcade & Space engines loaded in `index.html`)
- `generate_metadata.py` & `generate_metadata.js` (Metadata generators)
- `validate_syntax.py` & `validate_imports.py` (Automated code validation tools)

---

### Phase 3: Frontend Codebase Refinement

1. **`src/js/app.js`**:
   - Clean up outdated query string parameters on local ES module imports (`import './features/spinner.js?v=1.5.027'` $\rightarrow$ `import './features/spinner.js'`). Versioning is centrally controlled at the root `index.html` script tag.

2. **`validate_syntax.py` & `validate_imports.py`**:
   - Upgrade `validate_syntax.py` to robustly validate modern JavaScript (ES2022+ syntax, optional chaining `?.`, nullish coalescing `??`, and Unicode/emojis).
   - Upgrade `validate_imports.py` to sanitize query parameters when validating file resolution.

3. **`src/js/core/` & `src/js/features/`**:
   - Remove redundant debugging logs, duplicate variable declarations, and dead comment blocks while preserving all functional logic, comments, and window bindings.

---

## 🧪 Verification Plan

### Automated Checks
1. **Python Validation Suite**:
   ```bash
   python validate_syntax.py
   python validate_imports.py
   ```
2. **Git Status & File Integrity**:
   Verify that all required files exist, no active references are broken, and the working tree is clean.

### Manual Verification
- Test main application in browser (navigation across views: Arcade, PolySpace, Faucet, Staking, Vault, Profile, Admin Panel).
- Verify that high score submission, Faucet claiming, and withdrawal modal function without console errors.
