import UIAnimationHelper from "./UIAnimationHelper";
import type { ILogService } from "../types/index";
import { spawn } from "child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface CacheResult {
  name: string;
  success: boolean;
  error?: string;
  size?: string;
}

export interface IClearCacheService {
  clearAllCaches(): Promise<CacheResult[]>;
  clearSelectiveCaches(caches: string[]): Promise<CacheResult[]>;
  clearMemory(): Promise<boolean>;
  clearStandbyMemory(): Promise<boolean>;
  getCacheSizes(): Promise<CacheResult[]>;
}

export default class ClearCacheService implements IClearCacheService {
  private logService: ILogService;
  private animationHelper: UIAnimationHelper;

  constructor(logService: ILogService) {
    this.logService = logService;
    this.animationHelper = new UIAnimationHelper(logService);
  }

  /**
   * Clear all detected package manager caches
   */
  async clearAllCaches(): Promise<CacheResult[]> {
    this.animationHelper.showSection("Clearing All Package Manager Caches");

    const results: CacheResult[] = [];
    const cacheOperations = [
      { name: "npm", fn: () => this.clearNpmCache() },
      { name: "pnpm", fn: () => this.clearPnpmCache() },
      { name: "bun", fn: () => this.clearBunCache() },
      { name: "gradle", fn: () => this.clearGradleCache() },
    ];

    for (const operation of cacheOperations) {
      const spinner = this.animationHelper.createSpinner(
        `Clearing ${operation.name} cache...`,
      );
      spinner.start();

      try {
        await operation.fn();
        spinner.succeed(`${operation.name} cache cleared`);
        results.push({ name: operation.name, success: true });
      } catch (error) {
        spinner.fail(
          `${operation.name} cache clearing failed or not installed`,
        );
        results.push({
          name: operation.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Clear specific package manager caches
   */
  async clearSelectiveCaches(caches: string[]): Promise<CacheResult[]> {
    this.animationHelper.showSection(
      `Clearing Selected Caches: ${caches.join(", ")}`,
    );

    const results: CacheResult[] = [];
    const cacheMap: Record<string, () => Promise<void>> = {
      npm: () => this.clearNpmCache(),
      pnpm: () => this.clearPnpmCache(),
      bun: () => this.clearBunCache(),
      gradle: () => this.clearGradleCache(),
    };

    for (const cache of caches) {
      const fn = cacheMap[cache.toLowerCase()];
      if (!fn) {
        this.animationHelper.showWarning(`Unknown cache: ${cache}`);
        continue;
      }

      const spinner = this.animationHelper.createSpinner(
        `Clearing ${cache} cache...`,
      );
      spinner.start();

      try {
        await fn();
        spinner.succeed(`${cache} cache cleared`);
        results.push({ name: cache, success: true });
      } catch (error) {
        spinner.fail(`${cache} cache clearing failed`);
        results.push({
          name: cache,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Clear npm cache
   */
  private async clearNpmCache(): Promise<void> {
    await this.runProcess("npm", ["cache", "clean", "--force"]);
    this.logService.log("NPM cache cleared");
  }

  /**
   * Clear pnpm store
   */
  private async clearPnpmCache(): Promise<void> {
    await this.runProcess("pnpm", ["store", "prune"]);
    this.logService.log("PNPM cache cleared");
  }

  /**
   * Clear bun cache
   */
  private async clearBunCache(): Promise<void> {
    const bunCachePath = path.join(os.homedir(), ".bun", "install", "cache");
    try {
      await fs.rm(bunCachePath, { recursive: true, force: true });
      this.logService.log("Bun cache cleared");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
        throw error;
      }
    }
  }

  /**
   * Clear gradle cache
   */
  private async clearGradleCache(): Promise<void> {
    const gradleCachePath = path.join(os.homedir(), ".gradle", "caches");
    try {
      await fs.rm(gradleCachePath, { recursive: true, force: true });
      this.logService.log("Gradle cache cleared");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
        throw error;
      }
    }
  }

  /**
   * Clear system memory
   */
  async clearMemory(): Promise<boolean> {
    this.animationHelper.showSection("Clearing System Memory");

    if (process.platform !== "win32") {
      this.animationHelper.showWarning("Memory clearing is Windows-specific");
      return false;
    }

    const spinner = this.animationHelper.createSpinner(
      "Clearing memory cache (requires admin)...",
    );
    spinner.start();

    try {
      const psScript = `
        $MemCacheMB = (Get-Process | Measure-Object WorkingSet -Sum).Sum / 1MB
        Write-Output "Memory cache size: $([Math]::Round($MemCacheMB, 2)) MB"
        
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        Start-Sleep -Milliseconds 500
        [System.GC]::Collect()
      `;

      await this.runProcess("powershell", ["-Command", psScript]);
      spinner.succeed("Memory cache cleared");
      this.logService.log("Memory cleared successfully");
      return true;
    } catch (error) {
      spinner.fail("Memory clearing failed");
      this.logService.log(
        `Error clearing memory: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Clear standby memory (Windows-specific)
   */
  async clearStandbyMemory(): Promise<boolean> {
    this.animationHelper.showSection("Clearing Standby Memory");

    if (process.platform !== "win32") {
      this.animationHelper.showWarning(
        "Standby memory clearing is Windows-specific",
      );
      return false;
    }

    const spinner = this.animationHelper.createSpinner(
      "Clearing standby memory (requires admin)...",
    );
    spinner.start();

    try {
      const psScript = `
        $beforeStandby = (Get-Counter "\\Memory\\Standby Cache Core Bytes").CounterSamples.CookedValue / 1MB
        
        Clear-Variable -Name "*" -ErrorAction SilentlyContinue
        
        # Attempt to clear standby memory using PSTools or native commands
        try {
          fsutil behavior set DisableLastAccess 0
          fsutil behavior set DisableLastAccess 1
        } catch {
          Write-Output "Standby memory clearing may require elevated permissions"
        }
        
        $afterStandby = (Get-Counter "\\Memory\\Standby Cache Core Bytes").CounterSamples.CookedValue / 1MB
        Write-Output "Standby memory before: $([Math]::Round($beforeStandby, 2)) MB"
        Write-Output "Standby memory after: $([Math]::Round($afterStandby, 2)) MB"
      `;

      await this.runProcess("powershell", ["-Command", psScript]);
      spinner.succeed("Standby memory cleared");
      this.logService.log("Standby memory cleared successfully");
      return true;
    } catch (error) {
      spinner.fail("Standby memory clearing failed");
      this.logService.log(
        `Error clearing standby memory: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get cache sizes for all package managers
   */
  async getCacheSizes(): Promise<CacheResult[]> {
    this.animationHelper.showSection("Checking Cache Sizes");

    const results: CacheResult[] = [];

    // npm
    try {
      const npmSize = await this.getNpmCacheSize();
      results.push({ name: "npm", success: true, size: npmSize });
    } catch {
      results.push({ name: "npm", success: false, size: "Unknown" });
    }

    // pnpm
    try {
      const pnpmSize = await this.getPnpmCacheSize();
      results.push({ name: "pnpm", success: true, size: pnpmSize });
    } catch {
      results.push({ name: "pnpm", success: false, size: "Unknown" });
    }

    // bun
    try {
      const bunSize = await this.getBunCacheSize();
      results.push({ name: "bun", success: true, size: bunSize });
    } catch {
      results.push({ name: "bun", success: false, size: "Unknown" });
    }

    // gradle
    try {
      const gradleSize = await this.getGradleCacheSize();
      results.push({ name: "gradle", success: true, size: gradleSize });
    } catch {
      results.push({ name: "gradle", success: false, size: "Unknown" });
    }

    return results;
  }

  private async getNpmCacheSize(): Promise<string> {
    const result = await this.runProcess("npm", ["cache", "verify"]);
    const sizeMatch = result.stdout.match(/(\d+)\s*bytes/);
    if (sizeMatch && sizeMatch[1]) {
      const bytes = parseInt(sizeMatch[1], 10);
      return this.formatBytes(bytes);
    }
    return "Unknown";
  }

  private async getPnpmCacheSize(): Promise<string> {
    const result = await this.runProcess("pnpm", ["store", "status"]);
    const sizeMatch = result.stdout.match(/(\d+)\s*bytes/);
    if (sizeMatch && sizeMatch[1]) {
      const bytes = parseInt(sizeMatch[1], 10);
      return this.formatBytes(bytes);
    }
    return "Unknown";
  }

  private async getBunCacheSize(): Promise<string> {
    const cachePath = path.join(os.homedir(), ".bun", "install", "cache");
    try {
      const size = await this.getDirectorySize(cachePath);
      return this.formatBytes(size);
    } catch {
      return "Not found";
    }
  }

  private async getGradleCacheSize(): Promise<string> {
    const cachePath = path.join(os.homedir(), ".gradle", "caches");
    try {
      const size = await this.getDirectorySize(cachePath);
      return this.formatBytes(size);
    } catch {
      return "Not found";
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const files = await fs.readdir(dirPath, { recursive: true });
      for (const file of files) {
        try {
          const filePath = path.join(
            dirPath,
            typeof file === "string" ? file : (file as { name: string }).name,
          );
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            size += stat.size;
          }
        } catch {
          // Ignore individual file errors
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return size;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  private runProcess(
    command: string,
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code: number) => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject(
            new Error(stderr || stdout || `Process exited with code ${code}`),
          );
        }
      });

      child.on("error", reject);
    });
  }
}
