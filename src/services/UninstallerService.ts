import type { ILogService } from "../types/index";
import { spawn } from "child_process";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export default class UninstallerService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  async listInstalledPrograms(): Promise<string[]> {
    this.logService.log("Listing installed programs from registry.");
    const programs: string[] = [];

    try {
      const psScript = `
                # Get installed programs from registry
                $uninstallKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
                )

                foreach ($keyPath in $uninstallKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $subKeys = Get-ChildItem -Path $keyPath -ErrorAction SilentlyContinue
                            foreach ($subKey in $subKeys) {
                                try {
                                    $displayName = $subKey.GetValue("DisplayName")
                                    if ($displayName) {
                                        $displayVersion = $subKey.GetValue("DisplayVersion")
                                        $publisher = $subKey.GetValue("Publisher")
                                        $uninstallString = $subKey.GetValue("UninstallString")

                                        $programInfo = $displayName
                                        if ($displayVersion) {
                                            $programInfo += " (v$displayVersion)"
                                        }
                                        if ($publisher) {
                                            $programInfo += " - $publisher"
                                        }
                                        if ($uninstallString) {
                                            $programInfo += " [Uninstallable]"
                                        }

                                        # Add registry source indicator
                                        if ($keyPath -like "*HKCU*") {
                                            $programInfo = "[User] $programInfo"
                                        } else {
                                            $programInfo = "[System] $programInfo"
                                        }

                                        Write-Output $programInfo
                                    }
                                } catch {
                                    # Skip problematic entries
                                }
                            }
                        }
                    } catch {
                        # Skip inaccessible keys
                    }
                }
            `;

      const result = await this.runProcess("powershell", [
        "-Command",
        psScript,
      ]);

      if (result.code === 0) {
        const lines = result.stdout.split("\n").filter(line => line.trim());
        programs.push(...lines);
      }

      this.logService.log(`Found ${programs.length} installed programs.`);
    } catch (error: unknown) {
      this.logService.log(
        `Exception listing installed programs: ${error instanceof Error ? error.message : String(error)}`,
      );
      programs.push(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return programs;
  }

  async uninstallProgram(programName: string): Promise<boolean> {
    this.logService.log(`Attempting to uninstall program: ${programName}`);

    try {
      // Find uninstall string for program
      const findScript = `
                $programName = "${programName}"
                $uninstallKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
                )

                $uninstallString = $null
                foreach ($keyPath in $uninstallKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $subKeys = Get-ChildItem -Path $keyPath -ErrorAction SilentlyContinue
                            foreach ($subKey in $subKeys) {
                                try {
                                    $displayName = $subKey.GetValue("DisplayName")
                                    if ($displayName -and $displayName -like "*$programName*") {
                                        $uninstallString = $subKey.GetValue("UninstallString")
                                        if ($uninstallString) {
                                            Write-Output $uninstallString
                                            break
                                        }
                                    }
                                } catch {
                                    # Continue searching
                                }
                            }
                        if ($uninstallString) { break }
                    } catch {
                        # Continue to next key
                    }
                }
            `;

      const findResult = await this.runProcess("powershell", [
        "-Command",
        findScript,
      ]);

      if (findResult.code !== 0 || !findResult.stdout.trim()) {
        this.logService.log(
          `Could not find uninstall string for: ${programName}`,
        );
        return false;
      }

      const uninstallString = findResult.stdout.trim();

      // Execute uninstall string
      this.logService.log(`Executing uninstall command: ${uninstallString}`);

      // For MSI uninstallers, use msiexec
      let process: ProcessResult;
      if (uninstallString.toLowerCase().includes("msiexec")) {
        process = await this.runProcess("cmd", ["/c", uninstallString]);
      } else {
        // For other uninstallers, try to execute directly
        process = await this.runProcess("cmd", ["/c", `"${uninstallString}"`]);
      }

      if (process.code === 0) {
        this.logService.log(
          `Successfully initiated uninstall for: ${programName}`,
        );
        return true;
      } else {
        this.logService.log(
          `Uninstall process exited with code ${process.code} for: ${programName}`,
        );
        return false;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Exception uninstalling program ${programName}: ${error instanceof Error ? error.message : String(error)}`,
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
