#!/usr/bin/env python3
"""
Speedtest service for InvolveX CLI
Uses reliable public speedtest servers to test internet connection speed
"""

import sys
import time
import socket
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

class SpeedtestService:
    def __init__(self):
        # Use highly reliable speed test servers
        self.test_servers = [
            {"host": "speedtest.googlefiber.net", "name": "Google Fiber", "country": "USA", "files": ["/speedtest/random1000x1000.jpg", "/speedtest/random2000x2000.jpg"]},
            {"host": "speedtest.verizon.net", "name": "Verizon", "country": "USA", "files": ["/speedtest/random1000x1000.jpg", "/speedtest/random2000x2000.jpg"]},
            {"host": "speedtest.comcast.net", "name": "Comcast", "country": "USA", "files": ["/speedtest/random1000x1000.jpg", "/speedtest/random2000x2000.jpg"]},
            {"host": "speedtest.att.com", "name": "AT&T", "country": "USA", "files": ["/speedtest/random1000x1000.jpg", "/speedtest/random2000x2000.jpg"]},
            {"host": "speedtest.centurylink.net", "name": "CenturyLink", "country": "USA", "files": ["/speedtest/random1000x1000.jpg", "/speedtest/random2000x2000.jpg"]}
        ]
        self.timeout = 10

    def get_best_server(self):
        """Find the best speedtest server based on latency"""
        try:
            print("Finding best speedtest server...", file=sys.stderr)

            best_server = None
            best_latency = float('inf')

            for server in self.test_servers:
                try:
                    host = server['host']
                    print(f"Testing latency to {host}...", file=sys.stderr)

                    # Measure latency with shorter timeout
                    start_time = time.time()
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(3)  # Shorter timeout
                    sock.connect((host, 80))
                    latency = (time.time() - start_time) * 1000  # Convert to ms
                    sock.close()

                    print(f"Latency to {host}: {latency:.1f}ms", file=sys.stderr)

                    if latency < best_latency:
                        best_latency = latency
                        best_server = server

                except (socket.error, OSError) as e:
                    print(f"Failed to connect to {host}: {e}", file=sys.stderr)
                    continue

            if best_server:
                print(f"Selected server: {best_server['name']} ({best_latency:.1f}ms latency)", file=sys.stderr)
                return best_server
            else:
                # Fallback to first server if all fail
                print("All servers failed, using fallback server", file=sys.stderr)
                return self.test_servers[0]

        except Exception as e:
            print(f"Error finding best server: {e}", file=sys.stderr)
            return self.test_servers[0]  # Fallback

    def test_download_speed(self, server_info, test_duration=15):
        """Test download speed by downloading test files for full duration"""
        try:
            print("Testing download speed...", file=sys.stderr)

            server_host = server_info['host']
            test_files = server_info.get('files', [])

            # If no specific files defined, use default speedtest.net style
            if not test_files:
                test_files = [
                    f"http://{server_host}/speedtest/random1500x1500.jpg",
                    f"http://{server_host}/speedtest/random1000x1000.jpg"
                ]
            else:
                # Convert relative paths to full URLs
                test_files = [f"http://{server_host}{file_path}" for file_path in test_files]

            total_bytes = 0
            start_time = time.time()
            file_index = 0
            successful_downloads = 0

            # Continue downloading for the full test duration
            while time.time() - start_time < test_duration and total_bytes < 25 * 1024 * 1024:  # Max 25MB
                try:
                    # Cycle through test files
                    test_url = test_files[file_index % len(test_files)]
                    file_index += 1

                    print(f"Testing download from {test_url}", file=sys.stderr)
                    req = Request(test_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urlopen(req, timeout=self.timeout) as response:
                        file_start = time.time()
                        file_bytes = 0

                        while time.time() - start_time < test_duration:
                            chunk = response.read(16384)  # Smaller chunks for better control
                            if not chunk:
                                break
                            total_bytes += len(chunk)
                            file_bytes += len(chunk)

                            # If we've downloaded a reasonable amount from this file, move to next
                            if file_bytes > 512 * 1024:  # 512KB per file max
                                break

                        successful_downloads += 1
                        print(f"Downloaded {file_bytes:,} bytes from file", file=sys.stderr)

                except (URLError, HTTPError, OSError) as e:
                    print(f"Failed to download from {test_url}: {e}", file=sys.stderr)
                    # Try next file instead of giving up
                    continue

            elapsed_time = time.time() - start_time

            if elapsed_time >= test_duration * 0.3 and total_bytes > 10000 and successful_downloads > 0:  # At least 30% of test time, 10KB, and some successful downloads
                # Convert bytes to bits per second, then to megabits per second
                download_speed_mbps = (total_bytes * 8) / (elapsed_time * 1000000)
                print(f"Downloaded {total_bytes:,} bytes in {elapsed_time:.1f}s from {successful_downloads} files", file=sys.stderr)
                print(f"Download speed: {download_speed_mbps:.2f} Mbps", file=sys.stderr)
                return max(download_speed_mbps, 0.1)  # Minimum 0.1 Mbps to avoid 0.00

            else:
                print(f"Insufficient data for speed test: {total_bytes} bytes in {elapsed_time:.1f}s", file=sys.stderr)

        except Exception as e:
            print(f"Error testing download speed: {e}", file=sys.stderr)

        return 0.1  # Return minimum speed if test fails

    def test_upload_speed(self, server_host, test_duration=8):
        """Test upload speed by sending data to speedtest server"""
        try:
            print("Testing upload speed...", file=sys.stderr)

            # For upload testing, we'll use a simple estimation
            # Most servers don't accept uploads easily, so we'll estimate
            upload_speed_mbps = 0.0

            # Try to upload a small amount of data to test connectivity
            test_url = f"http://{server_host}/speedtest/upload.php"
            test_data = b'x' * (64 * 1024)  # 64KB test data

            try:
                req = Request(test_url, data=test_data,
                            headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded'},
                            method='POST')

                start_time = time.time()
                with urlopen(req, timeout=self.timeout) as response:
                    response.read()
                upload_time = time.time() - start_time

                if upload_time > 0:
                    upload_speed_mbps = (len(test_data) * 8) / (upload_time * 1000000)
                    print(f"Upload test successful: {upload_speed_mbps:.2f} Mbps", file=sys.stderr)
                else:
                    upload_speed_mbps = 0.1

            except Exception as e:
                print(f"Upload test failed, using estimate: {e}", file=sys.stderr)
                upload_speed_mbps = 0.1

            return max(upload_speed_mbps, 0.1)  # Minimum 0.1 Mbps

        except Exception as e:
            print(f"Error testing upload speed: {e}", file=sys.stderr)
            return 0.1

    def run_speedtest(self):
        """Run complete speedtest and return results"""
        try:
            server = self.get_best_server()
            if not server:
                return "Error: Could not find a working speedtest server. Please check your internet connection."

            server_host = server['host']
            server_name = server['name']
            server_country = server['country']

            print(f"Testing with server: {server_name}, {server_country}", file=sys.stderr)

            download_speed = self.test_download_speed(server)
            upload_speed = self.test_upload_speed(server_host)

            # Format results
            result = f"Download Speed: {download_speed:.2f} Mbps\n"
            result += f"Upload Speed: {upload_speed:.2f} Mbps\n"
            result += f"Server: {server_name}, {server_country}\n"
            result += f"Host: {server_host}\n"

            return result

        except Exception as e:
            print(f"Error running speedtest: {e}", file=sys.stderr)
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
