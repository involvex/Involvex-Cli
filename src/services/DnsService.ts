import type { ILogService } from "../types/index";
import { spawn } from "child_process";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export default class DnsService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  async setDns(primaryDns: string, secondaryDns = ""): Promise<boolean> {
    try {
      this.logService.log(
        `Setting DNS to ${primaryDns}${secondaryDns ? ` and ${secondaryDns}` : ""}`,
      );

      // Set primary DNS
      const primaryResult = await this.runNetshCommand(
        `interface ip set dns name="Ethernet" static ${primaryDns} primary`,
      );

      if (primaryResult.code !== 0) {
        this.logService.log("Failed to set primary DNS");
        return false;
      }

      // Set secondary DNS if provided
      if (secondaryDns) {
        const secondaryResult = await this.runNetshCommand(
          `interface ip add dns name="Ethernet" ${secondaryDns} index=2`,
        );

        if (secondaryResult.code !== 0) {
          this.logService.log("Failed to set secondary DNS");
          return false;
        }
      }

      this.logService.log("DNS settings updated successfully");
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error setting DNS: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async resetDns(): Promise<boolean> {
    try {
      this.logService.log("Resetting DNS to DHCP");

      const result = await this.runNetshCommand(
        'interface ip set dns name="Ethernet" dhcp',
      );

      if (result.code === 0) {
        this.logService.log("DNS settings reset successfully");
        return true;
      } else {
        this.logService.log("Failed to reset DNS settings");
        return false;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error resetting DNS: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async runNetshCommand(args: string): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const process = spawn("netsh", args.split(" "), {
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
        this.logService.log(`[netsh STDOUT]: ${stdout}`);
        this.logService.log(`[netsh STDERR]: ${stderr}`);

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
