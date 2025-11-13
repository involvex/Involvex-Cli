const { spawn } = require('child_process');

class NetworkService {
  constructor(logService) {
    this.logService = logService;
  }

  async runPingTest(host, timeoutMs = 5000) {
    try {
      // Validate host input
      if (!host || typeof host !== 'string') {
        return 'Error: Host cannot be empty';
      }

      // Use ping command with timeout
      const args =
        process.platform === 'win32'
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
    this.logService.log('Running internet speed test using speedtest-cli.');

    try {
      const result = await this.runProcess('speedtest', ['--json']);

      if (result.code === 0) {
        const speedtestOutput = JSON.parse(result.stdout);

        if (
          speedtestOutput &&
          speedtestOutput.ping &&
          speedtestOutput.download &&
          speedtestOutput.upload
        ) {
          const formattedResult =
            `Ping: ${speedtestOutput.ping.latency.toFixed(2)} ms (Jitter: ${speedtestOutput.ping.jitter.toFixed(2)} ms)\n` +
            `Download: ${(speedtestOutput.download.bandwidth / 125000).toFixed(2)} Mbit/s\n` + // Convert bytes/sec to Mbit/s
            `Upload: ${(speedtestOutput.upload.bandwidth / 125000).toFixed(2)} Mbit/s\n\n` + // Convert bytes/sec to Mbit/s
            `Server: ${speedtestOutput.server.name} (${speedtestOutput.server.location}, ${speedtestOutput.server.country})\n` +
            `ISP: ${speedtestOutput.isp}`;

          this.logService.log('Speed test completed successfully.');
          return formattedResult;
        } else {
          this.logService.log(`Speed test output was not in expected format: ${result.stdout}`);
          return 'Error: Speed test output was not in expected format.';
        }
      } else {
        this.logService.log(`Speed test command failed with code ${result.code}: ${result.stderr}`);
        return `Error running speed test: ${result.stderr || 'Unknown error'}`;
      }
    } catch (error) {
      this.logService.log(`Exception running speed test: ${error.message}`);
      return `Error running speed test: ${error.message}`;
    }
  }

  async runProcess(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        this.logService.log(`[${command} STDOUT]: ${stdout}`);
        this.logService.log(`[${command} STDERR]: ${stderr}`);

        resolve({
          code,
          stdout,
          stderr,
        });
      });

      process.on('error', error => {
        reject(error);
      });
    });
  }
}

module.exports = NetworkService;
