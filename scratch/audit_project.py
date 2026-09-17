import os, glob, re, json

print("=== 1. VIEWS AUDIT IN index.html ===")
with open('index.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'id="view-' in line:
            print(f"L{i}: {line.strip()[:80]}")

print("\n=== 2. CONSOLE.LOG / CONSOLE.ERROR IN JS FILES ===")
js_files = glob.glob('src/js/**/*.js', recursive=True)
total_logs = 0
for jf in js_files:
    with open(jf, 'r', encoding='utf-8') as f:
        content = f.read()
        logs = len(re.findall(r'console\.(log|warn|error|info)', content))
        if logs > 10:
            print(f"{jf}: {logs} console calls")
        total_logs += logs
print(f"Total console statements in src/js: {total_logs}")

print("\n=== 3. ASSET REFERENCES AUDIT IN index.html ===")
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Check for missing local image/script/stylesheet files
img_srcs = re.findall(r'src="([^"]+\.(?:png|jpg|jpeg|svg|webp|gif|js))"', html)
missing_assets = []
for src in img_srcs:
    clean_src = src.split('?')[0]
    if not clean_src.startswith('http') and not os.path.exists(clean_src):
        missing_assets.append(src)
print(f"Total local src references: {len(img_srcs)}")
print(f"Missing local assets referenced in index.html: {missing_assets}")

print("\n=== 4. CSS FILES AND INLINE STYLES ===")
css_files = glob.glob('src/css/**/*.css', recursive=True)
for cf in css_files:
    print(f"{cf}: {os.path.getsize(cf)/1024:.1f} KB")

# Count inline styles in index.html
inline_styles = len(re.findall(r'style="[^"]+"', html))
print(f"Inline style tags in index.html: {inline_styles}")

print("\n=== 5. TODO / FIXME / HACK AUDIT ===")
todos = []
for root, _, files in os.walk('.'):
    if any(p in root for p in ['.git', 'backups', 'node_modules']): continue
    for file in files:
        if file.endswith(('.js', '.html', '.css', '.sql')):
            p = os.path.join(root, file)
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                for idx, l in enumerate(f, 1):
                    if any(w in l.upper() for w in ['TODO:', 'FIXME:', 'HACK:', 'XXX:']):
                        todos.append(f"{p}:{idx} -> {l.strip()[:80]}")
print(f"Total TODO/FIXME comments found: {len(todos)}")
for t in todos[:15]:
    print(f"  {t}")
