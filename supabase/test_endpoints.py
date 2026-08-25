import urllib.request, json, time

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {'apikey': anon_key, 'Authorization': 'Bearer ' + anon_key, 'Content-Type': 'application/json'}

def test_url(name, url):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            dt = round(time.time() - t0, 2)
            print(f"[{name}] SUCCESS in {dt}s: {len(data) if isinstance(data, list) else data}")
    except urllib.error.HTTPError as e:
        dt = round(time.time() - t0, 2)
        print(f"[{name}] HTTP Error {e.code} in {dt}s: {e.read().decode('utf-8')[:200]}")
    except Exception as e:
        dt = round(time.time() - t0, 2)
        print(f"[{name}] Exception in {dt}s: {e}")

test_url("global_settings", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/global_settings?select=*")
test_url("users_limit_5", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/users?select=player_id,balance_pgt&limit=5")
test_url("users_all", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/users?select=player_id,linked_wallet_address,balance_pgt,username,email,user_id,auth_provider,total_claims,relics,space_state")
test_url("user_stakes", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/user_stakes?select=wallet_address,amount,pool&active=eq.true")
test_url("arcade_sessions_head", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/arcade_sessions?select=id&limit=1")
test_url("pgt_supply_history", "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/pgt_supply_history?select=*&order=created_at.desc&limit=5")
