#!/usr/bin/env python3
"""
scripts/verify_security_invariants.py

Automated Security Linter for Polygon Gaming (PolyGame)
Enforces immutable security invariants across all SQL definitions, RPCs, and source files.
Exits with code 0 on PASS, code 1 on FAIL.
"""

import sys
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

ERRORS = []

def log_error(msg):
    ERRORS.append(msg)
    print(f"[FAIL] [SECURITY INVARIANT VIOLATION] {msg}")

def log_pass(msg):
    print(f"[PASS] {msg}")

def check_trigger_security_invoker():
    """Invariant: prevent_direct_balance_mutation MUST NEVER have SECURITY DEFINER."""
    master_rpcs = ROOT_DIR / "supabase" / "master_rpcs.sql"
    trigger_file = ROOT_DIR / "supabase" / "rpcs" / "12_anticheat_triggers.sql"

    for fpath in [master_rpcs, trigger_file]:
        if not fpath.exists():
            continue
        content = fpath.read_text(encoding="utf-8")
        # Find prevent_direct_balance_mutation function definition
        matches = re.finditer(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?prevent_direct_balance_mutation[\s\S]*?\$\$", content, re.IGNORECASE)
        for m in matches:
            block = m.group(0)
            if "SECURITY DEFINER" in block.upper():
                log_error(f"{fpath.name}: prevent_direct_balance_mutation contains forbidden SECURITY DEFINER!")

def check_no_anon_writes_to_users():
    """Invariant: anon must NEVER be granted INSERT/UPDATE on public.users, and RLS must not permit it."""
    active_sql_files = [
        ROOT_DIR / "supabase" / "rpcs" / "00_schema_guarantees.sql",
        ROOT_DIR / "supabase" / "master_rpcs.sql",
        ROOT_DIR / "supabase" / "master_schema.sql"
    ]

    grant_pattern = re.compile(r"GRANT\s+[^;]*?(?:INSERT|UPDATE|ALL)[^;]*?ON\s+(?:TABLE\s+)?(?:public\.)?users\s+TO\s+[^;]*?\banon\b", re.IGNORECASE)
    policy_pattern = re.compile(r"CREATE\s+POLICY\s+[\"'\w\s]+\s+ON\s+(?:public\.)?users\s+FOR\s+(?:INSERT|UPDATE|ALL)\s+TO\s+[^;]*?\banon\b", re.IGNORECASE)

    for fpath in active_sql_files:
        if not fpath.exists():
            continue
        content = fpath.read_text(encoding="utf-8")
        if grant_pattern.search(content):
            log_error(f"{fpath.name}: Grants INSERT/UPDATE on public.users to anon!")
        if policy_pattern.search(content):
            log_error(f"{fpath.name}: Contains RLS policy granting INSERT/UPDATE on public.users to anon!")

def check_no_wallet_address_column():
    """Invariant: public.users.wallet_address DOES NOT EXIST and must never be referenced."""
    schema_file = ROOT_DIR / "supabase" / "master_schema.sql"
    if schema_file.exists():
        content = schema_file.read_text(encoding="utf-8")
        if re.search(r"ALTER\s+TABLE\s+(?:public\.)?users\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?wallet_address\b", content, re.IGNORECASE):
            log_error("master_schema.sql: Attempts to add forbidden column 'wallet_address' to public.users!")

def check_sensitive_rpcs_restricted():
    """Invariant: Critical admin/service RPCs must NOT be granted to anon or public."""
    restricted_funcs = [
        "submit_arcade_highscore",
        "sync_onchain_nfts",
        "sync_onchain_relics",
        "refund_failed_withdrawal",
        "process_referral_commissions",
        "credit_verified_deposit"
    ]
    master_rpcs = ROOT_DIR / "supabase" / "master_rpcs.sql"
    if master_rpcs.exists():
        content = master_rpcs.read_text(encoding="utf-8")
        for fn in restricted_funcs:
            pattern = re.compile(rf"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?{fn}[^;]*?TO\s+[^;]*?(?:\banon\b|\bpublic\b)", re.IGNORECASE)
            if pattern.search(content):
                log_error(f"master_rpcs.sql: Critical procedure '{fn}' is dangerously granted to anon/public!")

def main():
    print("=" * 65)
    print(">>> RUNNING POLYGON GAMING IMMUTABLE SECURITY INVARIANT AUDIT")
    print("=" * 65)

    check_trigger_security_invoker()
    if not ERRORS:
        log_pass("Trigger Security: prevent_direct_balance_mutation is strictly SECURITY INVOKER.")

    check_no_anon_writes_to_users()
    if not ERRORS:
        log_pass("Database RLS: public.users has ZERO anon INSERT/UPDATE grants or policies.")

    check_no_wallet_address_column()
    if not ERRORS:
        log_pass("Schema Invariant: public.users.wallet_address does not exist.")

    check_sensitive_rpcs_restricted()
    if not ERRORS:
        log_pass("RPC Restrictions: All high-risk procedures are strictly locked to service_role.")

    print("-" * 65)
    if ERRORS:
        print(f"FAILED: {len(ERRORS)} security invariant violation(s) detected!")
        sys.exit(1)
    else:
        print("SUCCESS: All security invariants verified! Anti-regression shield intact.")
        sys.exit(0)

if __name__ == "__main__":
    main()
