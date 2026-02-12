import type { ILogService } from "../types/index";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface AutoUpdateSettings {
  enabled: boolean;
  checkIntervalHours: number;
  autoInstall: boolean;
}

interface PackageAutoUpdateSettings {
  enabled: boolean;
  managers: {
    winget?: boolean;
    npm?: boolean;
    scoop?: boolean;
    choco?: boolean;
    pip?: boolean;
  };
  checkIntervalHours: number;
}

interface AutoCacheClearingSettings {
  enabled: boolean;
  intervalHours: number;
  lastCleared: number | null;
}

interface AutoMemoryClearingSettings {
  enabled: boolean;
  thresholdMB: number;
  intervalMinutes: number;
  lastCleared: number | null;
}

interface NotificationsSettings {
  showUpdateNotifications: boolean;
  showCacheClearingNotifications: boolean;
  showMemoryClearingNotifications: boolean;
}

interface DiscordRPCSettings {
  enabled: boolean;
  clientId: string;
  updateIntervalSeconds: number;
}

export interface AppSettings {
  autoUpdate: AutoUpdateSettings;
  packageAutoUpdate: PackageAutoUpdateSettings;
  autoCacheClearing: AutoCacheClearingSettings;
  autoMemoryClearing: AutoMemoryClearingSettings;
  notifications: NotificationsSettings;
  discordRPC: DiscordRPCSettings;
}

export default class SettingsService {
  private logService: ILogService;
  private settingsPath: string;
  private settings: AppSettings;

  constructor(logService: ILogService) {
    this.logService = logService;
    this.settingsPath = path.join(
      os.homedir(),
      "involvex-cli",
      "settings.json",
    );
    this.settings = this.getDefaultSettings();
  }

  getDefaultSettings(): AppSettings {
    return {
      autoUpdate: {
        enabled: false,
        checkIntervalHours: 24,
        autoInstall: false,
      },
      packageAutoUpdate: {
        enabled: false,
        managers: {
          winget: false,
          npm: false,
          scoop: false,
          choco: false,
          pip: false,
        },
        checkIntervalHours: 24,
      },
      autoCacheClearing: {
        enabled: false,
        intervalHours: 168, // 1 week
        lastCleared: null,
      },
      autoMemoryClearing: {
        enabled: false,
        thresholdMB: 4096, // Clear if RAM usage > 4GB
        intervalMinutes: 60,
        lastCleared: null,
      },
      notifications: {
        showUpdateNotifications: true,
        showCacheClearingNotifications: true,
        showMemoryClearingNotifications: true,
      },
      discordRPC: {
        enabled: false,
        clientId: "1438575785228242994",
        updateIntervalSeconds: 15,
      },
    };
  }

  async loadSettingsAsync(): Promise<void> {
    try {
      const settingsDir = path.dirname(this.settingsPath);
      await fs.mkdir(settingsDir, { recursive: true });

      try {
        const data = await fs.readFile(this.settingsPath, "utf8");
        const loaded = JSON.parse(data) as Partial<AppSettings>;
        this.settings = { ...this.getDefaultSettings(), ...loaded };
        this.logService.log("Settings loaded successfully");
      } catch (error: unknown) {
        if ((error as unknown as Record<string, string>).code === "ENOENT") {
          // File doesn't exist, use defaults
          await this.saveSettingsAsync();
          this.logService.log("Created default settings file");
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      this.logService.log(
        `Failed to load settings: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.settings = this.getDefaultSettings();
    }
  }

  async saveSettingsAsync(): Promise<boolean> {
    try {
      const settingsDir = path.dirname(this.settingsPath);
      await fs.mkdir(settingsDir, { recursive: true });
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        "utf8",
      );
      this.logService.log("Settings saved successfully");
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  updateSettings(updates: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...updates };
  }

  getAutoUpdateEnabled(): boolean {
    return this.settings.autoUpdate?.enabled || false;
  }

  getAutoUpdateAutoInstall(): boolean {
    return this.settings.autoUpdate?.autoInstall || false;
  }

  getPackageAutoUpdateEnabled(): boolean {
    return this.settings.packageAutoUpdate?.enabled || false;
  }

  getPackageAutoUpdateManagers(): PackageAutoUpdateSettings["managers"] {
    return this.settings.packageAutoUpdate?.managers || {};
  }

  getAutoCacheClearingEnabled(): boolean {
    return this.settings.autoCacheClearing?.enabled || false;
  }

  getAutoCacheClearingInterval(): number {
    return this.settings.autoCacheClearing?.intervalHours || 168;
  }

  getAutoMemoryClearingEnabled(): boolean {
    return this.settings.autoMemoryClearing?.enabled || false;
  }

  getAutoMemoryClearingThreshold(): number {
    return this.settings.autoMemoryClearing?.thresholdMB || 4096;
  }

  getAutoMemoryClearingInterval(): number {
    return this.settings.autoMemoryClearing?.intervalMinutes || 60;
  }

  setLastCacheCleared(timestamp: number): void {
    if (!this.settings.autoCacheClearing) {
      this.settings.autoCacheClearing = {} as AutoCacheClearingSettings;
    }
    this.settings.autoCacheClearing.lastCleared = timestamp;
  }

  setLastMemoryCleared(timestamp: number): void {
    if (!this.settings.autoMemoryClearing) {
      this.settings.autoMemoryClearing = {} as AutoMemoryClearingSettings;
    }
    this.settings.autoMemoryClearing.lastCleared = timestamp;
  }

  shouldRunAutoCacheClearing(): boolean {
    if (!this.getAutoCacheClearingEnabled()) {
      return false;
    }

    const lastCleared = this.settings.autoCacheClearing?.lastCleared;
    if (!lastCleared) {
      return true;
    }

    const intervalMs = this.getAutoCacheClearingInterval() * 60 * 60 * 1000;
    const now = Date.now();
    return now - lastCleared >= intervalMs;
  }

  shouldRunAutoMemoryClearing(): boolean {
    if (!this.getAutoMemoryClearingEnabled()) {
      return false;
    }

    const lastCleared = this.settings.autoMemoryClearing?.lastCleared;
    if (!lastCleared) {
      return true;
    }

    const intervalMs = this.getAutoMemoryClearingInterval() * 60 * 1000;
    const now = Date.now();
    return now - lastCleared >= intervalMs;
  }

  getDiscordRPCEnabled(): boolean {
    return this.settings.discordRPC?.enabled || false;
  }

  getDiscordRPCClientId(): string {
    return this.settings.discordRPC?.clientId || "";
  }

  getDiscordRPCUpdateInterval(): number {
    return this.settings.discordRPC?.updateIntervalSeconds || 15;
  }
}
