import http.server
import socketserver
import json

class LogHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/log':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            print(f"[{data['type'].upper()}] {data['msg']}")
            with open('browser_logs.txt', 'a', encoding='utf-8') as f:
                f.write(f"[{data['type'].upper()}] {data['msg']}\n")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

PORT = 8080

with socketserver.TCPServer(("", PORT), LogHandler) as httpd:
    print(f"Serving at port {PORT}")
    open('browser_logs.txt', 'w').close() # Clear logs
    httpd.serve_forever()
