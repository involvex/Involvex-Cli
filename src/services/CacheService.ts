import type { ILogService } from "../types/index";
import { spawn } from "child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export default class CacheService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  async clearSystemCache(): Promise<boolean> {
    try {
      this.logService.log("Starting system cache clearing operation.");

      // Clear user-specific temporary files
      const tempPath = os.tmpdir();
      await this.deleteDirectoryContents(tempPath);

      // Clear npm cache if npm is available
      try {
        await this.runProcess("npm", ["cache", "clean", "--force"]);
        this.logService.log("NPM cache cleared.");
      } catch {
        this.logService.log("NPM cache clearing failed or npm not available.");
      }

      // Clear Windows temp files using PowerShell
      if (process.platform === "win32") {
        try {
          const psScript = `
                        # Clear Windows temp files
                        $tempFolders = @(
                            $env:TEMP,
                            "$env:USERPROFILE\\AppData\\Local\\Temp",
                            "$env:windir\\Temp"
                        )

                        foreach ($folder in $tempFolders) {
                            if (Test-Path $folder) {
                                Get-ChildItem -Path $folder -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
                            }
                        }

                        # Clear Windows prefetch files
                        $prefetchPath = "$env:windir\\Prefetch"
                        if (Test-Path $prefetchPath) {
                            Get-ChildItem -Path $prefetchPath -Filter "*.pf" | Remove-Item -Force -ErrorAction SilentlyContinue
                        }

                        Write-Host "Windows temp files cleared"
                    `;

          await this.runProcess("powershell", ["-Command", psScript]);
          this.logService.log("Windows temp files cleared.");
        } catch {
          this.logService.log("Failed to clear Windows temp files");
        }
      }

      this.logService.log("System cache cleared successfully.");
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error clearing system cache: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async clearMemory(): Promise<boolean> {
    try {
      this.logService.log("Attempting to clear system memory/RAM.");

      // Force Node.js garbage collection
      if ((global as unknown as Record<string, unknown>).gc) {
        ((global as unknown as Record<string, unknown>).gc as () => void)();
        this.logService.log("Node.js garbage collection triggered.");
      }

      if (process.platform === "win32") {
        // Use PowerShell to clear system memory
        const psScript = `
                    # Force garbage collection in PowerShell
                    [System.GC]::Collect()
                    [System.GC]::WaitForPendingFinalizers()
                    [System.GC]::Collect()

                    # Clear Windows memory cache (requires admin privileges)
                    try {
                        # Use EmptyWorkingSet equivalent via PowerShell
                        $signature = @'
[DllImport("psapi.dll")]
public static extern int EmptyWorkingSet(IntPtr hProcess);
'@

                        $type = Add-Type -MemberDefinition $signature -Name "PSAPI" -Namespace "Win32" -PassThru
                        $currentProcess = Get-Process -Id $PID
                        $type::EmptyWorkingSet($currentProcess.Handle)

                        Write-Host "Memory cleared for current process"
                    } catch {
                        Write-Host "Memory clearing requires administrator privileges or failed"
                    }
                `;

        await this.runProcess("powershell", ["-Command", psScript]);
      }

      // Force Node.js garbage collection if available
      if ((global as unknown as Record<string, unknown>).gc) {
        ((global as unknown as Record<string, unknown>).gc as () => void)();
        this.logService.log("Node.js garbage collection performed.");
      }

      this.logService.log("Memory clearing operations completed.");
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error clearing memory: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async deleteDirectoryContents(directoryPath: string): Promise<void> {
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) return;

      const items = await fs.readdir(directoryPath);

      for (const item of items) {
        const itemPath = path.join(directoryPath, item);
        try {
          const itemStats = await fs.stat(itemPath);
          if (itemStats.isDirectory()) {
            await this.deleteDirectoryContents(itemPath);
            await fs.rmdir(itemPath);
          } else {
            await fs.unlink(itemPath);
          }
        } catch (error: unknown) {
          // Skip files/directories we can't delete
          this.logService.log(
            `Could not delete ${itemPath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error accessing directory ${directoryPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
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
