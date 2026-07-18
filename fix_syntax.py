import os
import re

db_sync_path = r'c:\Users\pasca\.gemini\antigravity\scratch\PolyGame\src\js\core\db-sync.js'
ui_path = r'c:\Users\pasca\.gemini\antigravity\scratch\PolyGame\src\js\core\ui.js'

with open(db_sync_path, 'r', encoding='utf-8') as f:
    db_lines = f.readlines()

with open(ui_path, 'r', encoding='utf-8') as f:
    ui_lines = f.readlines()

# Extract the body that belongs inside connectWeb3's try block from db-sync.js
# It starts at line 8: "    if (supabase) {" and goes up to line 88: "    window.ethereum.on('chainChanged', () => window.location.reload());\n"
body_for_sync = db_lines[7:88]

# Extract the catch block from db-sync.js lines 89 to 101
catch_block = db_lines[88:101]

# Rebuild ui.js
# We insert the body_for_sync and catch_block at the end of ui.js
# Also add the import for db-sync.js if needed (not needed if we just dump it all in ui.js!)
# Wait, why not just move the whole mockWalletSelection and swap code into ui.js and delete db-sync.js?
# The user explicitly created db-sync.js to extract DB syncing. 
# But let's just make db-sync.js export syncProfileWithDb.

new_db_sync_lines = db_lines[:7] + [
    "export async function syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, ownedNfts) {\n"
] + body_for_sync + ["}\n"] + db_lines[101:]

with open(db_sync_path, 'w', encoding='utf-8') as f:
    f.writelines(new_db_sync_lines)

# Rebuild ui.js
new_ui_lines = [
    "import { syncProfileWithDb } from './db-sync.js';\n"
] + ui_lines + [
    "    await syncProfileWithDb(address, pgtBalance, flrBalance, maticBalance, ownedNfts);\n"
] + catch_block

with open(ui_path, 'w', encoding='utf-8') as f:
    f.writelines(new_ui_lines)

print("Refactor complete.")
