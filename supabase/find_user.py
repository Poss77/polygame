import urllib.request, json, os, glob

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {'apikey': anon_key, 'Authorization': 'Bearer ' + anon_key, 'Content-Type': 'application/json'}

req = urllib.request.Request('https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/users?select=*', headers=headers)
with urllib.request.urlopen(req) as resp:
    users = json.loads(resp.read().decode('utf-8'))

print(f"Total Users in DB: {len(users)}")
for u in users:
    uname = (u.get('username') or '').lower()
    email = (u.get('email') or '').lower()
    pid = (u.get('player_id') or '').lower()
    r_obj = u.get('relics') or {}
    has_mythic = ('relic_apex_genesis' in r_obj) or ('relic_apex_singularity' in r_obj)
    
    if any(k in uname or k in email or k in pid for k in ['fill', 'phil', 'fly']) or has_mythic:
        print('=== MATCHED USER ===')
        print(f"User: {u.get('username')} | PID: {u.get('player_id')} | Email: {u.get('email')} | Linked: {u.get('linked_wallet_address')}")
        print(f"Relics: {json.dumps(u.get('relics'), indent=2)}")
        print(f"Updated At: {u.get('updated_at')}")

# Also search backups
backup_dirs = glob.glob('supabase/backups/*')
for bdir in sorted(backup_dirs):
    users_file = os.path.join(bdir, 'users.json')
    if os.path.exists(users_file):
        with open(users_file, 'r', encoding='utf-8') as f:
            b_users = json.load(f)
            for bu in b_users:
                uname = (bu.get('username') or '').lower()
                email = (bu.get('email') or '').lower()
                pid = (bu.get('player_id') or '').lower()
                r_obj = bu.get('relics') or {}
                has_mythic = ('relic_apex_genesis' in r_obj) or ('relic_apex_singularity' in r_obj)
                if any(k in uname or k in email or k in pid for k in ['fill', 'phil', 'fly']) or has_mythic:
                    print(f"=== BACKUP MATCH ({bdir}) ===")
                    print(f"User: {bu.get('username')} | PID: {bu.get('player_id')} | Email: {bu.get('email')}")
                    print(f"Relics: {json.dumps(bu.get('relics'), indent=2)}")
