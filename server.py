#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run_server():
    os.chdir(DIRECTORY)
    handler = MyHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"Server running at http://localhost:{PORT}")
            print(f"Serving files from: {DIRECTORY}")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
        sys.exit(0)
    except OSError as e:
        print(f"Error: {e}")
        print(f"Port {PORT} might be in use. Try changing the PORT variable in server.py")
        sys.exit(1)

if __name__ == "__main__":
    run_server()
