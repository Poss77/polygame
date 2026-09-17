import urllib.request, json, urllib.error

anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
headers = {
    'apikey': anon_key,
    'Authorization': 'Bearer ' + anon_key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}
base_url = 'https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/'

# Attempt to update global_settings id=1
payload = json.dumps({'earn_multiplier': 999.0}).encode('utf-8')
try:
    req = urllib.request.Request(f"{base_url}global_settings?id=eq.1", data=payload, headers=headers, method='PATCH')
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Update returned:", data)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8', errors='ignore'))

# Check real value of earn_multiplier
req_get = urllib.request.Request(f"{base_url}global_settings?id=eq.1&select=earn_multiplier", headers=headers)
with urllib.request.urlopen(req_get) as resp_get:
    actual = json.loads(resp_get.read().decode('utf-8'))
    print("Actual earn_multiplier in DB:", actual)
