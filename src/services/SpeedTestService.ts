import type { ILogService } from "../types/index";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";

const execAsync = promisify(exec);

interface SpeedTestResult {
  ping: number;
  download: number;
  upload: number;
  timestamp: string;
  server?: string;
}

/**
 * SpeedTestService - Internet speed testing wrapper
 * Uses external speedtest CLI tool or HTTP-based testing
 */
export default class SpeedTestService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  /**
   * Run speed test using speedtest-cli
   */
  async runSpeedTest(verbose: boolean = false): Promise<SpeedTestResult> {
    try {
      this.logService.log("Starting speed test...");

      // Try using speedtest-cli (Python-based, most reliable)
      const result = await this.runSpeedtestCLI();

      if (verbose) {
        this.logService.log(`Speed test completed: ${JSON.stringify(result)}`);
      }

      return result;
    } catch (error) {
      this.logService.log(
        `Speed test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Run speedtest using speedtest-cli command
   */
  private async runSpeedtestCLI(): Promise<SpeedTestResult> {
    try {
      const { stdout } = await execAsync(
        "speedtest-cli --simple --secure 2>&1 || speedtest --simple 2>&1",
        { timeout: 300000 },
      );

      const lines = stdout.trim().split("\n");
      if (lines.length < 3) {
        throw new Error("Unexpected speedtest output format");
      }

      return {
        ping: Number.parseFloat(lines[0] ?? "0") || 0,
        download: Number.parseFloat(lines[1] ?? "0") || 0,
        upload: Number.parseFloat(lines[2] ?? "0") || 0,
        timestamp: new Date().toISOString(),
        server: "speedtest-cli",
      };
    } catch (error) {
      throw new Error(
        `Failed to run speedtest: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Format speed test result for display
   */
  formatResult(result: SpeedTestResult, bytes: boolean = false): string {
    const downloadSpeed = bytes
      ? (result.download / 8).toFixed(2)
      : result.download.toFixed(2);
    const uploadSpeed = bytes
      ? (result.upload / 8).toFixed(2)
      : result.upload.toFixed(2);
    const unit = bytes ? "MBps" : "Mbps";
    const serverStr = (result.server || "Unknown").padEnd(30);

    return `
${chalk.bold.cyan("╔════════════════════════════════════════════╗")}
${chalk.bold.cyan("║")}          Speed Test Results                ${chalk.bold.cyan("║")}
${chalk.bold.cyan("╠════════════════════════════════════════════╣")}
${chalk.bold.cyan("║")} ${chalk.yellow("Ping:")}       ${chalk.green(String(result.ping).padEnd(24))}${chalk.bold.cyan(" ms ║")}
${chalk.bold.cyan("║")} ${chalk.yellow("Download:")}   ${chalk.green(String(downloadSpeed).padEnd(21))}${chalk.bold.cyan(` ${unit} ║`)}
${chalk.bold.cyan("║")} ${chalk.yellow("Upload:")}     ${chalk.green(String(uploadSpeed).padEnd(21))}${chalk.bold.cyan(` ${unit} ║`)}
${chalk.bold.cyan("║                                            ║")}
${chalk.bold.cyan("║")} ${chalk.gray("Server: " + serverStr)}${chalk.bold.cyan("║")}
${chalk.bold.cyan("╚════════════════════════════════════════════╝")}
    `;
  }

  /**
   * Convert result to JSON
   */
  toJSON(result: SpeedTestResult): string {
    return JSON.stringify(result, null, 2);
  }
}
