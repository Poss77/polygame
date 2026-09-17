import urllib.request, json, urllib.error

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {'apikey': anon_key, 'Authorization': 'Bearer ' + anon_key, 'Content-Type': 'application/json'}
base_url = 'https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/'

tables = [
    'account_merge_backups',
    'admin_security_config',
    'arcade_sessions',
    'bet_wins',
    'boss_reset_history',
    'bot_security_logs',
    'deposits_history',
    'game_metrics',
    'game_metrics_daily',
    'global_burn_metrics',
    'global_jackpot',
    'global_settings',
    'jackpot_winners',
    'mines_sessions',
    'nft_sales',
    'pol_payout_requests',
    'pol_referral_commissions',
    'processed_deposits',
    'processed_transactions',
    'user_ips',
    'user_stakes',
    'users',
    'weekly_leaderboard_history',
    'withdrawals_history'
]

print(f"{'TABLE':<28} | {'READ (SELECT)':<15} | {'INSERT':<15} | {'UPDATE':<15} | {'DELETE':<15}")
print('-' * 95)

for t in tables:
    # 1. SELECT test
    can_select = 'BLOCKED'
    try:
        req = urllib.request.Request(f"{base_url}{t}?limit=1", headers=headers)
        with urllib.request.urlopen(req) as resp:
            can_select = 'ALLOWED'
    except urllib.error.HTTPError as e:
        can_select = f'BLOCKED ({e.code})'

    # 2. INSERT test (send empty / invalid payload to detect if RLS blocks before validation)
    can_insert = 'UNKNOWN'
    try:
        req = urllib.request.Request(f"{base_url}{t}", data=b'{"__test_probe__": true}', headers=headers, method='POST')
        with urllib.request.urlopen(req) as resp:
            can_insert = 'ALLOWED'
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        if e.code in (401, 403) or 'policy' in err_body.lower() or 'row-level security' in err_body.lower():
            can_insert = 'RLS BLOCKED'
        elif 'column' in err_body.lower() or e.code == 400 or 'PGRST' in err_body:
            can_insert = 'ALLOWED (Check)'
        else:
            can_insert = f'BLOCKED ({e.code})'

    # 3. UPDATE test
    can_update = 'UNKNOWN'
    try:
        req = urllib.request.Request(f"{base_url}{t}?id=eq.-999999", data=b'{"__test_probe__": true}', headers=headers, method='PATCH')
        with urllib.request.urlopen(req) as resp:
            can_update = 'ALLOWED'
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        if e.code in (401, 403) or 'policy' in err_body.lower() or 'row-level security' in err_body.lower():
            can_update = 'RLS BLOCKED'
        elif 'column' in err_body.lower() or e.code == 400 or 'PGRST' in err_body:
            can_update = 'ALLOWED (Check)'
        else:
            can_update = f'BLOCKED ({e.code})'

    # 4. DELETE test
    can_delete = 'UNKNOWN'
    try:
        req = urllib.request.Request(f"{base_url}{t}?id=eq.-999999", headers=headers, method='DELETE')
        with urllib.request.urlopen(req) as resp:
            can_delete = 'ALLOWED'
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        if e.code in (401, 403) or 'policy' in err_body.lower() or 'row-level security' in err_body.lower():
            can_delete = 'RLS BLOCKED'
        else:
            can_delete = f'BLOCKED ({e.code})'

    print(f"{t:<28} | {can_select:<15} | {can_insert:<15} | {can_update:<15} | {can_delete:<15}")
