const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

class NetworkService {
    constructor(logService) {
        this.logService = logService;
    }

    async runPingTest(host, timeoutMs = 5000) {
        try {
            // Validate host input
            if (!host || typeof host !== 'string') {
                return "Error: Host cannot be empty";
            }

            // Use ping command with timeout
            const args = process.platform === 'win32'
                ? ['-n', '4', '-w', Math.floor(timeoutMs / 1000).toString(), host]
                : ['-c', '4', '-W', Math.floor(timeoutMs / 1000).toString(), host];

            const result = await this.runProcess('ping', args);

            if (result.code === 0) {
                return result.stdout;
            } else {
                return `Ping test completed with warnings:\n${result.stdout}\n\nErrors:\n${result.stderr}`;
            }
        } catch (error) {
            this.logService.log(`Error running ping test: ${error.message}`);
            return `Error running ping test: ${error.message}`;
        }
    }

    async runSpeedTest() {
        this.logService.log("Running internet speed test.");

        try {
            // Simple speed test using HTTP download
            const testUrls = [
                'https://speed.cloudflare.com/__down?bytes=10000000', // 10MB test
                'https://proof.ovh.net/files/10Mb.dat' // Alternative 10MB test
            ];

            let bestResult = null;
            let bestSpeed = 0;

            for (const url of testUrls) {
                try {
                    const result = await this.testDownloadSpeed(url);
                    if (result && result.speedMbps > bestSpeed) {
                        bestResult = result;
                        bestSpeed = result.speedMbps;
                    }
                } catch (error) {
                    this.logService.log(`Speed test failed for ${url}: ${error.message}`);
                    continue;
                }
            }

            if (!bestResult) {
                return "Speed test failed: Could not connect to any test servers.";
            }

            // Format result similar to speedtest-cli
            const result = `Ping: ${bestResult.ping} ms\n` +
                          `Download: ${bestResult.speedMbps.toFixed(2)} Mbit/s\n` +
                          `Upload: N/A (basic test)\n\n` +
                          `Test server: ${bestResult.server}\n` +
                          `Downloaded: ${(bestResult.bytes / 1024 / 1024).toFixed(2)} MB in ${bestResult.duration.toFixed(2)} seconds`;

            this.logService.log("Speed test completed successfully.");
            return result;

        } catch (error) {
            this.logService.log(`Exception running speed test: ${error.message}`);
            return `Error running speed test: ${error.message}`;
        }
    }

    async testDownloadSpeed(url) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let downloadedBytes = 0;
            let pingTime = 0;

            const protocol = url.startsWith('https:') ? https : http;

            // First, measure ping (simple HEAD request)
            const pingReq = protocol.request(url, { method: 'HEAD' }, (_res) => {
                pingTime = Date.now() - startTime;

                // Now do the actual download
                const downloadReq = protocol.get(url, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }

                    res.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                    });

                    res.on('end', () => {
                        const endTime = Date.now();
                        const duration = (endTime - startTime) / 1000; // seconds
                        const bits = downloadedBytes * 8;
                        const speedBps = bits / duration;
                        const speedMbps = speedBps / 1000000;

                        resolve({
                            speedMbps,
                            bytes: downloadedBytes,
                            duration,
                            ping: pingTime,
                            server: url
                        });
                    });
                });

                downloadReq.on('error', (error) => {
                    reject(error);
                });

                downloadReq.setTimeout(30000, () => {
                    downloadReq.destroy();
                    reject(new Error('Download timeout'));
                });
            });

            pingReq.on('error', (error) => {
                reject(error);
            });

            pingReq.setTimeout(10000, () => {
                pingReq.destroy();
                reject(new Error('Ping timeout'));
            });

            pingReq.end();
        });
    }

    async runProcess(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                this.logService.log(`[${command} STDOUT]: ${stdout}`);
                this.logService.log(`[${command} STDERR]: ${stderr}`);

                resolve({
                    code,
                    stdout,
                    stderr
                });
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = NetworkService;
