import type { ILogService } from "../types/index";
import { spawn } from "child_process";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export default class DriverService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  async detectDrivers(): Promise<string[]> {
    try {
      this.logService.log("Detecting outdated drivers");

      // Use PowerShell to check for driver updates
      const psScript = `
                # Check for driver updates using Windows Update
                try {
                    $updateSession = New-Object -ComObject Microsoft.Update.Session
                    $updateSearcher = $updateSession.CreateUpdateSearcher()
                    $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Driver'")

                    $drivers = @()
                    foreach ($update in $searchResult.Updates) {
                        $drivers += "$($update.Title) - $($update.Description)"
                    }

                    if ($drivers.Count -eq 0) {
                        Write-Output "No driver updates available"
                    } else {
                        $drivers | ForEach-Object { Write-Output $_ }
                    }
                } catch {
                    Write-Output "Could not check for driver updates. Error: $($_.Exception.Message)"
                }
            `;

      const result = await this.runProcess("powershell", [
        "-Command",
        psScript,
      ]);

      if (result.code === 0) {
        const lines = result.stdout.split("\n").filter(line => line.trim());
        return lines.length > 0 ? lines : ["No driver updates found"];
      } else {
        return ["Error checking for driver updates"];
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error detecting drivers: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  }

  async updateDriver(driverName: string): Promise<boolean> {
    try {
      this.logService.log(`Attempting to update driver: ${driverName}`);

      // Use pnputil to update drivers (simplified)
      const result = await this.runProcess("pnputil", ["/scan-devices"]);

      if (result.code === 0) {
        this.logService.log(`Driver scan initiated for: ${driverName}`);
        return true;
      } else {
        this.logService.log(`Failed to update driver: ${driverName}`);
        return false;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error updating driver ${driverName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
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
