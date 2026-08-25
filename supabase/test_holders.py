import urllib.request, json

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {'apikey': anon_key, 'Authorization': 'Bearer ' + anon_key, 'Content-Type': 'application/json'}

print("=== Testing Query 1: users ===")
try:
    req1 = urllib.request.Request('https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/users?select=player_id,linked_wallet_address,balance_pgt,username,email,user_id,auth_provider,total_claims,relics,space_state', headers=headers)
    with urllib.request.urlopen(req1) as resp:
        u_data = json.loads(resp.read().decode('utf-8'))
        print('Query 1 (users) SUCCESS:', len(u_data), 'rows')
except Exception as e:
    print('Query 1 (users) ERROR:', e)

print("=== Testing Query 2: user_stakes ===")
try:
    req2 = urllib.request.Request('https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/user_stakes?select=wallet_address,amount,pool&active=eq.true', headers=headers)
    with urllib.request.urlopen(req2) as resp:
        s_data = json.loads(resp.read().decode('utf-8'))
        print('Query 2 (user_stakes) SUCCESS:', len(s_data), 'rows')
except Exception as e:
    print('Query 2 (user_stakes) ERROR:', e)

print("=== Testing Query 3: arcade_sessions count ===")
try:
    h = dict(headers)
    h['Range-Unit'] = 'items'
    h['Range'] = '0-0'
    h['Prefer'] = 'count=exact'
    req3 = urllib.request.Request('https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/arcade_sessions?select=id', headers=h)
    with urllib.request.urlopen(req3) as resp:
        print('Query 3 (arcade_sessions) SUCCESS. Content-Range:', resp.headers.get('Content-Range'))
except Exception as e:
    print('Query 3 (arcade_sessions) ERROR:', e)

print("=== Testing pgt_supply_history ===")
try:
    req4 = urllib.request.Request('https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/pgt_supply_history?select=*&order=created_at.desc&limit=10', headers=headers)
    with urllib.request.urlopen(req4) as resp:
        h_data = json.loads(resp.read().decode('utf-8'))
        print('pgt_supply_history SUCCESS:', len(h_data), 'rows')
except Exception as e:
    print('pgt_supply_history ERROR:', e)
