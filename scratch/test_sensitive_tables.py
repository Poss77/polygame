import urllib.request, json, urllib.error

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {
    'apikey': anon_key,
    'Authorization': 'Bearer ' + anon_key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}
base_url = 'https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/'

tables = ['pol_payout_requests', 'processed_deposits', 'nft_sales', 'weekly_leaderboard_history', 'bet_wins']

for t in tables:
    req = urllib.request.Request(f"{base_url}{t}?limit=1", headers=headers)
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read().decode('utf-8'))
    if rows:
        r = rows[0]
        pk = 'id' if 'id' in r else list(r.keys())[0]
        val = r[pk]
        try:
            p_req = urllib.request.Request(f"{base_url}{t}?{pk}=eq.{val}", data=b'{"status": "fake"}', headers=headers, method='PATCH')
            with urllib.request.urlopen(p_req) as p_resp:
                out = json.loads(p_resp.read().decode('utf-8'))
                print(f"{t}: Returned status {p_resp.status} - data: {out}")
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')
            print(f"{t}: 🛡️ BLOCKED with HTTP {e.code}: {err[:80]}")
    else:
        print(f"{t}: (empty table)")
