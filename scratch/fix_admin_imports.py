with open('tools/admin/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    "import('../core/db-sync.js')": "import('../../src/js/core/db-sync.js')",
    "import('./dex.js')": "import('../../src/js/features/dex.js')",
    "import('./relics.js')": "import('../../src/js/features/relics.js')",
    "import('../core/config.js')": "import('../../src/js/core/config.js')",
    "import('../core/ui.js')": "import('../../src/js/core/ui.js')",
    "import('./nft.js')": "import('../../src/js/features/nft.js')"
}

for old, new in replacements.items():
    count = content.count(old)
    content = content.replace(old, new)
    print(f"{old} -> replaced {count} occurrences")

with open('tools/admin/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated tools/admin/admin.js")
