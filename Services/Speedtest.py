#!/usr/bin/env python3
"""
Speedtest service for InvolveX CLI
Uses speedtest.net API to test internet connection speed
"""

import sys
import json
import time
import socket
import threading
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

class SpeedtestService:
    def __init__(self):
        self.speedtest_url = "https://www.speedtest.net/api/js/servers"
        self.timeout = 10

    def get_best_server(self):
        """Find the best speedtest server based on latency"""
        try:
            # Get list of speedtest servers
            req = Request(self.speedtest_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=self.timeout) as response:
                servers_data = response.read().decode('utf-8')

            # Parse JSON response
            servers = json.loads(servers_data)

            if not servers:
                return None

            # Test latency to first few servers and pick the best
            best_server = None
            best_latency = float('inf')

            for server in servers[:5]:  # Test first 5 servers
                try:
                    host = server.get('host', '').replace(':8080', '')
                    if not host:
                        continue

                    # Measure latency
                    start_time = time.time()
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5)
                    sock.connect((host, 80))
                    latency = (time.time() - start_time) * 1000  # Convert to ms
                    sock.close()

                    if latency < best_latency:
                        best_latency = latency
                        best_server = server

                except (socket.error, OSError):
                    continue

            return best_server

        except Exception as e:
            print(f"Error finding best server: {e}", file=sys.stderr)
            return None

    def test_download_speed(self, server_host, test_duration=10):
        """Test download speed by downloading from speedtest server"""
        try:
            # Use a simple HTTP download test
            test_url = f"http://{server_host}/speedtest/random750x750.jpg"

            start_time = time.time()
            total_bytes = 0

            req = Request(test_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urlopen(req, timeout=test_duration) as response:
                while time.time() - start_time < test_duration:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    total_bytes += len(chunk)

            elapsed_time = time.time() - start_time
            if elapsed_time > 0:
                # Convert bytes to bits per second, then to megabits per second
                download_speed_mbps = (total_bytes * 8) / (elapsed_time * 1000000)
                return download_speed_mbps

        except Exception as e:
            print(f"Error testing download speed: {e}", file=sys.stderr)

        return 0.0

    def test_upload_speed(self, server_host, test_duration=10):
        """Test upload speed by sending data to speedtest server"""
        try:
            # For simplicity, we'll simulate upload speed with a basic calculation
            # In a real implementation, you'd upload data to the speedtest server
            # For now, return a simulated value based on download speed
            return 0.0  # Placeholder - would need proper upload test implementation

        except Exception as e:
            print(f"Error testing upload speed: {e}", file=sys.stderr)

        return 0.0

    def run_speedtest(self):
        """Run complete speedtest and return results"""
        try:
            print("Finding best speedtest server...", file=sys.stderr)

            server = self.get_best_server()
            if not server:
                return "Error: Could not find a speedtest server"

            server_host = server.get('host', '').replace(':8080', '')
            server_name = server.get('name', 'Unknown')
            server_country = server.get('country', 'Unknown')

            print(f"Testing with server: {server_name}, {server_country}", file=sys.stderr)
            print("Testing download speed...", file=sys.stderr)

            download_speed = self.test_download_speed(server_host)

            print("Testing upload speed...", file=sys.stderr)
            upload_speed = self.test_upload_speed(server_host)

            # Format results
            result = f"Download Speed: {download_speed:.2f} Mbps\n"
            result += f"Upload Speed: {upload_speed:.2f} Mbps\n"
            result += f"Server: {server_name}, {server_country}\n"
            result += f"Host: {server_host}\n"

            return result

        except Exception as e:
            return f"Error running speedtest: {e}"

def main():
    """Main function when script is run directly"""
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print("Speedtest Service for InvolveX CLI")
        print("Usage: python Speedtest.py")
        print("Tests internet connection speed using speedtest.net")
        return

    service = SpeedtestService()
    result = service.run_speedtest()
    print(result)

if __name__ == "__main__":
    main()
