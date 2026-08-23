import os
import re

src_dir = r'src/js'

import_regex = re.compile(r'import\s+.*?\s+from\s+[\'\"]([^\'\"]+)[\'\"]')
import_side_effect_regex = re.compile(r'import\s+[\'\"]([^\'\"]+)[\'\"]')

errors = []
total_imports = 0

for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as jsfile:
                content = jsfile.read()
                
            imports = import_regex.findall(content) + import_side_effect_regex.findall(content)
            for imp in imports:
                total_imports += 1
                if imp.startswith('.'):
                    # Clean query strings if any (e.g. ?v=1.2.3)
                    clean_imp = imp.split('?')[0]
                    target_path = os.path.normpath(os.path.join(os.path.dirname(filepath), clean_imp))
                    if not os.path.exists(target_path):
                        errors.append(f'File {filepath} imports {imp} which resolves to {target_path} BUT DOES NOT EXIST!')

if errors:
    print(f"FAILED: Found {len(errors)} broken import(s):")
    for e in errors:
        print(f"  - {e}")
    exit(1)
else:
    print(f"SUCCESS: All {total_imports} module imports point to valid existing files.")
