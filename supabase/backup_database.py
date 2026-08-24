# ==============================================================================
# POLYGAME DATABASE BACKUP SCRIPT
# ==============================================================================
import urllib.request, json, os, datetime, sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndGZuc3VmZW12cWt5eXRzY2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcwODAsImV4cCI6MjA5OTk0MzA4MH0.njyzkMMjsco4ZGrhIqOtPUwqj1_rM-VcLACm5Hdw-gA'
BASE_URL = 'https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/'

TABLES = [
    'users',
    'global_settings',
    'user_stakes',
    'arcade_sessions',
    'weekly_leaderboard_history',
    'jackpot_winners',
    'global_jackpot',
    'nft_sales',
    'user_ips',
    'pgt_supply_history'
]

def fetch_table(table_name):
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        headers = {
            'apikey': ANON_KEY,
            'Authorization': 'Bearer ' + ANON_KEY,
            'Content-Type': 'application/json',
            'Range-Unit': 'items',
            'Range': f'{offset}-{offset + page_size - 1}'
        }
        url = f'{BASE_URL}{table_name}?select=*'
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if not data:
                    break
                all_rows.extend(data)
                if len(data) < page_size:
                    break
                offset += page_size
        except Exception as e:
            print(f'Error fetching [{table_name}] at offset {offset}: {e}')
            break
    return all_rows

def run_backup():
    now = datetime.datetime.now()
    timestamp_str = now.strftime('%Y_%m_%d_%H%M%S')
    backup_dir = os.path.join('supabase', 'backups', f'backup_{timestamp_str}')
    latest_dir = os.path.join('supabase', 'backups', 'latest')

    os.makedirs(backup_dir, exist_ok=True)
    os.makedirs(latest_dir, exist_ok=True)

    manifest = {
        'timestamp': now.isoformat(),
        'backup_dir': backup_dir,
        'tables': {}
    }

    print('==============================================================================')
    print('Starting PolyGame Database Full Backup...')
    print('==============================================================================')

    total_records = 0

    for table in TABLES:
        print(f'[*] Fetching table: {table} ...')
        records = fetch_table(table)
        count = len(records)
        total_records += count

        # Save to timestamped directory
        target_file = os.path.join(backup_dir, f'{table}.json')
        with open(target_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

        # Save to latest directory
        latest_file = os.path.join(latest_dir, f'{table}.json')
        with open(latest_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

        manifest['tables'][table] = {
            'records_count': count,
            'file_name': f'{table}.json'
        }
        print(f'    -> Saved {count} records.')

    manifest['total_records'] = total_records

    # Save manifest
    with open(os.path.join(backup_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    with open(os.path.join(latest_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print('==============================================================================')
    print(f'SUCCESS: Backup complete! Total records saved: {total_records}')
    print(f'Backup Path: {backup_dir}')
    print('==============================================================================')

if __name__ == '__main__':
    run_backup()
