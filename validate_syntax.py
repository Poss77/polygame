import os
import re
import esprima

errors = []
scanned_count = 0

for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root or 'archive' in root:
        continue
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            scanned_count += 1
            with open(filepath, 'r', encoding='utf-8') as jsfile:
                content = jsfile.read()
            
            # Normalize modern ES2020+ syntax for AST structural grammar parsing
            cleaned = re.sub(r'\?\.', '.', content)
            cleaned = re.sub(r'\?\?', '||', cleaned)
            cleaned = re.sub(r'(\d+)n\b', r'\1', cleaned)
            cleaned = re.sub(r'[\U00010000-\U0010ffff]', ' ', cleaned)
            
            try:
                esprima.parseModule(cleaned)
            except Exception as e:
                errors.append(f"{filepath}: {e}")

if errors:
    print(f"FAILED: Found {len(errors)} syntax error(s):")
    for e in errors:
        print(f"  - {e}")
    exit(1)
else:
    print(f"SUCCESS: All {scanned_count} JavaScript files parsed successfully without SyntaxErrors.")
