import urllib.request, json, urllib.error

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {
    'apikey': anon_key,
    'Authorization': 'Bearer ' + anon_key,
    'Content-Type': 'application/json'
}
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

results = []

for t in tables:
    # Check SELECT
    can_sel = False
    first_row = None
    try:
        req = urllib.request.Request(f"{base_url}{t}?limit=1", headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            can_sel = True
            if data and len(data) > 0:
                first_row = data[0]
    except urllib.error.HTTPError as e:
        can_sel = False

    # Check UPDATE
    upd_status = 'BLOCKED'
    if first_row:
        # Determine primary key / filter
        pk_col = 'id' if 'id' in first_row else ('player_id' if 'player_id' in first_row else list(first_row.keys())[0])
        pk_val = first_row[pk_col]
        
        # Try to send an update that doesn't change value (same value)
        test_col = list(first_row.keys())[-1]
        test_val = first_row[test_col]
        payload = json.dumps({test_col: test_val}).encode('utf-8')
        try:
            req = urllib.request.Request(f"{base_url}{t}?{pk_col}=eq.{pk_val}", data=payload, headers=headers, method='PATCH')
            with urllib.request.urlopen(req) as resp:
                upd_status = 'ALLOWED'
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            if 'permission denied' in err or e.code in (401, 403) or 'row-level security' in err:
                upd_status = 'BLOCKED (RLS/Perm)'
            else:
                upd_status = f'ERR ({e.code})'
    else:
        # Empty table, test on dummy id
        try:
            req = urllib.request.Request(f"{base_url}{t}?id=eq.-999999", data=b'{}', headers=headers, method='PATCH')
            with urllib.request.urlopen(req) as resp:
                upd_status = 'BLOCKED (Empty)'
        except urllib.error.HTTPError as e:
            upd_status = 'BLOCKED (RLS/Perm)'

    # Check INSERT
    ins_status = 'BLOCKED'
    try:
        # Send empty object
        req = urllib.request.Request(f"{base_url}{t}", data=b'{}', headers=headers, method='POST')
        with urllib.request.urlopen(req) as resp:
            ins_status = 'ALLOWED'
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        if 'permission denied' in err or e.code in (401, 403) or 'row-level security' in err:
            ins_status = 'BLOCKED (RLS/Perm)'
        elif 'null value' in err or 'violates' in err or '23502' in err:
            # Reached table constraint!
            ins_status = 'ALLOWED (Table Policy)'
        else:
            ins_status = f'ERR ({e.code})'

    # Check DELETE
    del_status = 'BLOCKED'
    try:
        req = urllib.request.Request(f"{base_url}{t}?id=eq.-999999", headers=headers, method='DELETE')
        with urllib.request.urlopen(req) as resp:
            # If 204 or 200, check if delete is actually granted
            del_status = 'ALLOWED (Check)'
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='ignore')
        if 'permission denied' in err or e.code in (401, 403) or 'row-level security' in err:
            del_status = 'BLOCKED (RLS/Perm)'
        else:
            del_status = f'ERR ({e.code})'

    results.append({
        'table': t,
        'select': 'READABLE' if can_sel else 'HIDDEN (401)',
        'insert': ins_status,
        'update': upd_status,
        'delete': del_status
    })

print(f"{'TABLE':<28} | {'SELECT':<12} | {'INSERT':<22} | {'UPDATE':<20} | {'DELETE':<15}")
print('='*105)
for r in results:
    print(f"{r['table']:<28} | {r['select']:<12} | {r['insert']:<22} | {r['update']:<20} | {r['delete']:<15}")
