import urllib.request
import json
from datetime import datetime, timezone

RPC = 'https://polygon-bor-rpc.publicnode.com'
HEADERS = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}

def rpc(method, params):
    req = urllib.request.Request(RPC, data=json.dumps({
        'jsonrpc': '2.0',
        'method': method,
        'params': params,
        'id': 1
    }).encode(), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())['result']

token = '0x701100D19b1a93672cfe7291EA455b4220631209'
wallet = '0x909e9a5c84bd638b5b4c292b7f7fde4ccbec2864'.lower()

latest = int(rpc('eth_blockNumber', []), 16)
logs = rpc('eth_getLogs', [{
    'address': token,
    'fromBlock': hex(latest - 6000),
    'toBlock': 'latest',
    'topics': [
        '0x9923b4306c6c030f2bdfbf156517d5983b87e15b96176da122cd4f2effa4ba7b',
        '0x000000000000000000000000' + wallet[2:]
    ]
}])

first_block = int(logs[0]['blockNumber'], 16)
last_block = int(logs[-1]['blockNumber'], 16)

b_first = rpc('eth_getBlockByNumber', [hex(first_block), False])
b_last = rpc('eth_getBlockByNumber', [hex(last_block), False])
t_first = int(b_first['timestamp'], 16)
t_last = int(b_last['timestamp'], 16)

lines = [
    '''-- ==============================================================================
-- POLYGON GAMING: BACKFILL NOWER ON-CHAIN WITHDRAWALS (195 RECORDS)
-- ==============================================================================
-- These records were successfully claimed on-chain on Polygon but failed to log
-- to withdrawals_history because the ip_address column was missing at the time.
-- ==============================================================================

BEGIN;

INSERT INTO public.withdrawals_history (player_id, wallet_address, amount, nonce, ip_address, created_at) VALUES'''
]

values = []
for l in logs:
    b_num = int(l['blockNumber'], 16)
    ratio = (b_num - first_block) / max(1, (last_block - first_block))
    ts = t_first + ratio * (t_last - t_first)
    dt_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S+00')
    
    data_hex = l['data'][2:]
    amt = round(int(data_hex[:64], 16) / 1e18, 2)
    nonce = int(data_hex[64:128], 16)
    values.append(f"  ('0xpgt31ab923c', '0x909e9a5c84bd638b5b4c292b7f7fde4ccbec2864', {amt}, {nonce}, '160.19.227.122', '{dt_str}')")

lines.append(',\n'.join(values) + ';')
lines.append('\nCOMMIT;\n')

with open('supabase/backfill_nower_withdrawals_history.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Successfully generated backfill script with {len(values)} records!')
