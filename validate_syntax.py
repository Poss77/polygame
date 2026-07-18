import os
import esprima

src_dir = r'c:\Users\pasca\.gemini\antigravity\scratch\PolyGame\src\js'

errors = []

for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as jsfile:
                content = jsfile.read()
            
            try:
                esprima.parseModule(content)
            except Exception as e:
                errors.append(f"{filepath}: {e}")

if errors:
    for e in errors:
        print(e)
else:
    print('All files parsed successfully without SyntaxErrors.')
