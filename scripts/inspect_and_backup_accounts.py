import urllib.request
import json
import os

url = "https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/users?select=*"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA"

req = urllib.request.Request(url, headers={
    "apikey": key,
    "Authorization": f"Bearer {key}"
})

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

print(f"Total users fetched: {len(data)}")

targets = ["6671633e", "1340d9e6"]
matched = []

for u in data:
    pid = str(u.get("player_id", "")).lower()
    wal = str(u.get("wallet_address", "")).lower()
    link = str(u.get("linked_wallet_address", "")).lower()
    uid = str(u.get("user_id", "")).lower()
    
    for t in targets:
        if t in pid or t in wal or t in link or t in uid:
            matched.append(u)
            break

print(f"Matched accounts count: {len(matched)}")

os.makedirs("backups", exist_ok=True)
with open("backups/account_merge_backup_2026_09_02.json", "w", encoding="utf-8") as f:
    json.dump(matched, f, indent=2)

print("Saved backup to backups/account_merge_backup_2026_09_02.json")

for idx, m in enumerate(matched):
    print("=" * 60)
    print(f"ACCOUNT {idx+1}")
    print(f"player_id: {m.get('player_id')}")
    print(f"user_id: {m.get('user_id')}")
    print(f"wallet_address: {m.get('wallet_address')}")
    print(f"linked_wallet_address: {m.get('linked_wallet_address')}")
    print(f"balance_pgt: {m.get('balance_pgt')}")
    print(f"balance_1flr: {m.get('balance_1flr')}")
    print(f"unclaimed_referral_pgt: {m.get('unclaimed_referral_pgt')}")
    print(f"unclaimed_referral_pol: {m.get('unclaimed_referral_pol')}")
    print(f"total_claims: {m.get('total_claims')}")
    print(f"weekly_active_tier: {m.get('weekly_active_tier')}")
    print(f"highscores: dodge={m.get('game_highscore')}, invaders={m.get('invaders_highscore')}, drift={m.get('drift_highscore')}, stacker={m.get('stacker_highscore')}, skeet={m.get('skeet_highscore')}")
    print(f"alltime: dodge={m.get('alltime_game_highscore')}, invaders={m.get('alltime_invaders_highscore')}, drift={m.get('alltime_drift_highscore')}, stacker={m.get('alltime_stacker_highscore')}, skeet={m.get('alltime_skeet_highscore')}")
    print(f"relics: {json.dumps(m.get('relics'))}")
    print(f"owned_nfts: {json.dumps(m.get('owned_nfts'))}")
    print(f"equipped_nft: {m.get('equipped_nft')}")
    print(f"stakes: {json.dumps(m.get('stakes'))}")
    print(f"space_state: {json.dumps(m.get('space_state'))}")
    print(f"vip_until: {m.get('vip_until')}")
    print(f"is_ambassador: {m.get('is_ambassador')}")
    print(f"created_at: {m.get('created_at')}")
