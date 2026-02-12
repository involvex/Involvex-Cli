import type { ILogService } from "../types/index";
import { spawn } from "child_process";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export default class NetworkService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  async runPingTest(host: string, timeoutMs = 5000): Promise<string> {
    try {
      // Validate host input
      if (!host || typeof host !== "string") {
        return "Error: Host cannot be empty";
      }

      // Use ping command with timeout
      const args =
        process.platform === "win32"
          ? ["-n", "4", "-w", Math.floor(timeoutMs / 1000).toString(), host]
          : ["-c", "4", "-W", Math.floor(timeoutMs / 1000).toString(), host];

      const result = await this.runProcess("ping", args);

      if (result.code === 0) {
        return result.stdout;
      } else {
        return `Ping test completed with warnings:\n${result.stdout}\n\nErrors:\n${result.stderr}`;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error running ping test: ${error instanceof Error ? error.message : String(error)}`,
      );
      return `Error running ping test: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async runSpeedTest(): Promise<string> {
    this.logService.log("Running internet speed test using speedtest-cli.");

    try {
      const result = await this.runProcess("speedtest", ["--json"]);

      if (result.code === 0) {
        interface SpeedtestOutput {
          ping?: {
            latency: number;
            jitter: number;
          };
          download?: {
            bandwidth: number;
          };
          upload?: {
            bandwidth: number;
          };
          server?: {
            name: string;
            location: string;
            country: string;
          };
          isp?: string;
        }

        const speedtestOutput = JSON.parse(result.stdout) as SpeedtestOutput;

        if (
          speedtestOutput.ping &&
          speedtestOutput.download &&
          speedtestOutput.upload
        ) {
          let formattedResult =
            `Ping: ${speedtestOutput.ping.latency.toFixed(2)} ms (Jitter: ${speedtestOutput.ping.jitter.toFixed(2)} ms)\n` +
            `Download: ${(speedtestOutput.download.bandwidth / 125000).toFixed(2)} Mbit/s\n` + // Convert bytes/sec to Mbit/s
            `Upload: ${(speedtestOutput.upload.bandwidth / 125000).toFixed(2)} Mbit/s\n\n`; // Convert bytes/sec to Mbit/s

          if (speedtestOutput.server) {
            formattedResult += `Server: ${speedtestOutput.server.name} (${speedtestOutput.server.location}, ${speedtestOutput.server.country})\n`;
          }

          formattedResult += `ISP: ${speedtestOutput.isp}`;

          this.logService.log("Speed test completed successfully.");
          return formattedResult;
        } else {
          this.logService.log(
            `Speed test output was not in expected format: ${result.stdout}`,
          );
          return "Error: Speed test output was not in expected format.";
        }
      } else {
        this.logService.log(
          `Speed test command failed with code ${result.code}: ${result.stderr}`,
        );
        return `Error running speed test: ${result.stderr || "Unknown error"}`;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Exception running speed test: ${error instanceof Error ? error.message : String(error)}`,
      );
      return `Error running speed test: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async runProcess(
    command: string,
    args: string[],
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", data => {
        stdout += data.toString();
      });

      process.stderr?.on("data", data => {
        stderr += data.toString();
      });

      process.on("close", code => {
        this.logService.log(`[${command} STDOUT]: ${stdout}`);
        this.logService.log(`[${command} STDERR]: ${stderr}`);

        resolve({
          code: code ?? 0,
          stdout,
          stderr,
        });
      });

      process.on("error", error => {
        reject(error);
      });
    });
  }
}
