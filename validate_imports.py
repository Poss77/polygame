import os
import re

src_dir = r'c:\Users\pasca\.gemini\antigravity\scratch\PolyGame\src\js'

import_regex = re.compile(r'import\s+.*?\s+from\s+[\'\"]([^\'\"]+)[\'\"]')
import_side_effect_regex = re.compile(r'import\s+[\'\"]([^\'\"]+)[\'\"]')

errors = []

for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as jsfile:
                content = jsfile.read()
                
            imports = import_regex.findall(content) + import_side_effect_regex.findall(content)
            for imp in imports:
                if imp.startswith('.'):
                    # Resolve relative path
                    target_path = os.path.normpath(os.path.join(os.path.dirname(filepath), imp))
                    if not os.path.exists(target_path):
                        errors.append(f'File {filepath} imports {imp} which resolves to {target_path} BUT DOES NOT EXIST!')

if errors:
    for e in errors:
        print(e)
else:
    print('All relative imports point to existing files.')
