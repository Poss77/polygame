#!/usr/bin/env python3
"""
==============================================================================
POLYGON GAMING: MASTER STORED PROCEDURES (RPCs) BUILDER
==============================================================================
Assembles the monolithic `supabase/master_rpcs.sql` file from domain-specific
modular SQL files in `supabase/rpcs/`.

Usage:
    python scripts/build_master_rpcs.py
    python scripts/build_master_rpcs.py --check   (verifies without writing)
==============================================================================
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RPCS_DIR = os.path.join(BASE_DIR, 'supabase', 'rpcs')
OUTPUT_FILE = os.path.join(BASE_DIR, 'supabase', 'master_rpcs.sql')

SECTIONS = [
    '00_schema_guarantees.sql',
    '01_utility_identity.sql',
    '02_arcade_sessions.sql',
    '03_quantum_relics.sql',
    '04_faucets_vip_yields.sql',
    '05_casino_minigames.sql',
    '06_polyspace_fleet.sql',
    '07_vault_staking.sql',
    '08_withdrawals_store.sql',
    '09_world_boss.sql',
    '10_quests_progression.sql',
    '11_admin_automation.sql',
    '12_anticheat_triggers.sql'
]

HEADER = """-- ==============================================================================
-- POLYGAME: MASTER CANONICAL STORED PROCEDURES (RPCs) (Authoritative)
-- ==============================================================================
-- NOTE: This file is auto-assembled from domain modules in `supabase/rpcs/`.
-- To modify procedures, edit the appropriate file in `supabase/rpcs/` and run:
--   python scripts/build_master_rpcs.py
-- ==============================================================================

"""

def assemble_master_rpcs():
    content = HEADER
    for sec in SECTIONS:
        sec_path = os.path.join(RPCS_DIR, sec)
        if not os.path.exists(sec_path):
            raise FileNotFoundError(f"Missing required RPC module: {sec_path}")
        with open(sec_path, 'r', encoding='utf-8') as f:
            content += f.read()
    return content

def main():
    check_mode = '--check' in sys.argv

    if not os.path.exists(RPCS_DIR):
        print(f"Error: RPCS directory not found: {RPCS_DIR}")
        sys.exit(1)

    assembled = assemble_master_rpcs()

    if check_mode:
        if not os.path.exists(OUTPUT_FILE):
            print(f"FAILED: Output file {OUTPUT_FILE} does not exist.")
            sys.exit(1)
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing = f.read()
        if existing == assembled:
            print(f"SUCCESS: {OUTPUT_FILE} is up to date with `supabase/rpcs/`.")
            sys.exit(0)
        else:
            print(f"OUT OF SYNC: {OUTPUT_FILE} differs from `supabase/rpcs/`.")
            sys.exit(1)
    else:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(assembled)
        print(f"SUCCESS: Built {OUTPUT_FILE} from {len(SECTIONS)} modular RPC files.")
        print(f"Total lines: {len(assembled.splitlines())}")

if __name__ == '__main__':
    main()
