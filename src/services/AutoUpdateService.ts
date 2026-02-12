import type {
  ILogService,
  ISettingsService,
  IPackageManagerService,
  PackageUpdate,
} from "../types/index.js";
import type { IncomingMessage } from "node:http";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import https from "node:https";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  description: string;
}

interface AutoUpdateParams {
  logService: ILogService;
  settingsService: ISettingsService;
  packageManagerService: IPackageManagerService;
}

export default class AutoUpdateService extends EventEmitter {
  private logService: ILogService;
  private settingsService: ISettingsService;
  private packageManagerService: IPackageManagerService;
  private packageName: string;
  private lastCheckTime: number | null;

  constructor({
    logService,
    settingsService,
    packageManagerService,
  }: AutoUpdateParams) {
    super();
    this.logService = logService;
    this.settingsService = settingsService;
    this.packageManagerService = packageManagerService;
    this.packageName = "@involvex/involvex-cli";
    this.lastCheckTime = null;
  }

  async isInstalledGlobally(): Promise<boolean> {
    try {
      // Check if package is installed globally by checking npm list
      const result = await this.runProcess("npm", [
        "list",
        "-g",
        "--depth=0",
        this.packageName,
      ]);
      return result.code === 0 && result.stdout.includes(this.packageName);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logService.log(
        `Error checking global installation: ${errorMessage}`,
      );
      return false;
    }
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      return new Promise((resolve, reject) => {
        const url = `https://registry.npmjs.org/${this.packageName}/latest`;
        https
          .get(url, (res: IncomingMessage) => {
            let data = "";

            res.on("data", (chunk: Buffer) => {
              data += chunk.toString();
            });

            res.on("end", () => {
              try {
                const latestInfo = JSON.parse(data) as {
                  version: string;
                  description: string;
                };
                resolve({
                  hasUpdate: true,
                  latestVersion: latestInfo.version,
                  description:
                    latestInfo.description || "New version available",
                });
              } catch (error: unknown) {
                reject(
                  error instanceof Error ? error : new Error(String(error)),
                );
              }
            });
          })
          .on("error", reject);
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logService.log(`Failed to check for updates: ${errorMessage}`);
      return {
        hasUpdate: false,
        latestVersion: "",
        description: "No update available",
      };
    }
  }

  async installUpdate(): Promise<boolean> {
    try {
      this.logService.log("Installing CLI update...");
      const result = await this.runProcess("npm", [
        "install",
        "-g",
        `${this.packageName}@latest`,
      ]);
      if (result.code === 0) {
        this.logService.log("CLI updated successfully!");
        return true;
      } else {
        this.logService.log(`Update failed with exit code: ${result.code}`);
        return false;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logService.log(`Error installing update: ${errorMessage}`);
      return false;
    }
  }

  private async runProcess(
    command: string,
    args: string[],
    timeoutMs = 60000,
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          try {
            process.kill();
          } catch {
            // Ignore kill errors
          }
          reject(new Error(`Process timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      process.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      process.on("close", (code: number | null) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({
          code: code ?? 0,
          stdout,
          stderr,
        });
      });

      process.on("error", (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });
    });
  }

  async shouldCheckForUpdate(): Promise<boolean> {
    const settings = this.settingsService.getSettings() as unknown as Record<
      string,
      Record<string, boolean | number>
    >;
    if (!settings?.autoUpdate?.enabled) {
      return false;
    }

    const checkIntervalHours =
      (settings.autoUpdate?.checkIntervalHours as number) || 24;
    const intervalMs = checkIntervalHours * 60 * 60 * 1000;

    if (!this.lastCheckTime) {
      return true;
    }

    return Date.now() - this.lastCheckTime >= intervalMs;
  }

  async performAutoUpdate(): Promise<boolean> {
    if (!(await this.shouldCheckForUpdate())) {
      return false;
    }

    const isGlobal = await this.isInstalledGlobally();
    if (!isGlobal) {
      this.logService.log(
        "CLI is not installed globally. Skipping auto-update.",
      );
      return false;
    }

    try {
      const updateInfo = await this.checkForUpdates();
      this.lastCheckTime = Date.now();

      if (updateInfo.hasUpdate) {
        const settings =
          this.settingsService.getSettings() as unknown as Record<
            string,
            Record<string, unknown>
          >;
        if ((settings?.autoUpdate as Record<string, boolean>)?.autoInstall) {
          this.logService.log(
            `Auto-updating CLI to version ${updateInfo.latestVersion}...`,
          );
          return await this.installUpdate();
        } else {
          this.logService.log(
            `Update available: ${updateInfo.latestVersion}. Auto-install is disabled.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logService.log(`Auto-update check failed: ${errorMessage}`);
    }

    return false;
  }

  async getAllAvailableUpdates(): Promise<PackageUpdate[]> {
    this.logService.log("Checking for all available updates...");
    try {
      const updates = await (
        this
          .packageManagerService as unknown as typeof this.packageManagerService & {
          getAvailableUpdatesAsync: () => Promise<PackageUpdate[]>;
        }
      ).getAvailableUpdatesAsync();
      this.logService.log(`Found ${updates.length} available updates.`);
      return updates;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logService.log(
        `Error getting all available updates: ${errorMessage}`,
      );
      return [];
    }
  }

  async installSelectedUpdates(
    selectedUpdates: PackageUpdate[],
  ): Promise<void> {
    const totalUpdates = selectedUpdates.length;
    let completedUpdates = 0;

    for (const update of selectedUpdates) {
      completedUpdates++;
      const progress = Math.floor((completedUpdates / totalUpdates) * 100);
      this.emit(
        "progress",
        `Updating ${update.packageManager} (${update.packageName})...`,
        progress,
      );

      try {
        switch (update.packageManager) {
          case "winget":
            await (
              this
                .packageManagerService as unknown as typeof this.packageManagerService & {
                updateSpecificProgramWithWinget: (
                  name: string,
                ) => Promise<void>;
              }
            ).updateSpecificProgramWithWinget(
              update.packageId || update.packageName,
            );
            break;
          case "npm":
            await (
              this
                .packageManagerService as unknown as typeof this.packageManagerService & {
                updateSpecificProgramWithNpm: (name: string) => Promise<void>;
              }
            ).updateSpecificProgramWithNpm(update.packageName);
            break;
          case "scoop":
            await (
              this
                .packageManagerService as unknown as typeof this.packageManagerService & {
                updateSpecificProgramWithScoop: (name: string) => Promise<void>;
              }
            ).updateSpecificProgramWithScoop(update.packageName);
            break;
          case "choco":
            await (
              this
                .packageManagerService as unknown as typeof this.packageManagerService & {
                updateSpecificProgramWithChoco: (name: string) => Promise<void>;
              }
            ).updateSpecificProgramWithChoco(update.packageName);
            break;
          case "pip":
            // Pip update is handled by updatePip() which updates all outdated packages
            // For specific package update, it's more complex, so we'll just log for now
            this.logService.log(
              `Pip specific package update not directly supported via 'updateSpecificProgramWithPip'. Updating all pip packages instead.`,
            );
            await this.packageManagerService.updatePip();
            break;
          case "powershell":
            // PowerShell module update is handled by updatePowerShellModules() which updates all outdated modules
            // For specific module update, it's more complex, so we'll just log for now
            this.logService.log(
              `PowerShell specific module update not directly supported via 'updateSpecificProgramWithPowerShell'. Updating all PowerShell modules instead.`,
            );
            await (
              this
                .packageManagerService as unknown as typeof this.packageManagerService & {
                updatePowerShellModules: () => Promise<void>;
              }
            ).updatePowerShellModules();
            break;
          default:
            this.logService.log(
              `Unknown package manager: ${update.packageManager}`,
            );
            break;
        }
        this.logService.log(
          `Successfully updated ${update.packageName} (${update.packageManager})`,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logService.log(
          `Failed to update ${update.packageName} (${update.packageManager}): ${errorMessage}`,
        );
        // Continue with other updates even if one fails
      }
    }
    this.emit("progress", "All selected updates completed!", 100);
  }
}
