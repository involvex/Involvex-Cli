import type { ILogService } from "../types/index";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import os from "node:os";

interface PackageManagersConfig {
  enabledManagers: string[];
  settings: Record<string, PackageManagerSettings>;
}

interface PackageManagerSettings {
  autoUpdate?: boolean;
  excludedPackages?: string[];
  customSources?: Record<string, string>;
}

interface UpdatesConfig {
  autoCheck: boolean;
  checkIntervalHours: number;
  includePreReleases: boolean;
  excludedCategories: string[];
  categorySettings: Record<string, CategorySettings>;
}

interface CategorySettings {
  enabled: boolean;
  requireConfirmation: boolean;
  maxConcurrentUpdates: number;
}

interface SecurityConfig {
  verifyHashes: boolean;
  checkCertificates: boolean;
  trustedPublishers: string[];
  knownHashes: Record<string, string>;
  sandboxMode: boolean;
}

interface UIConfig {
  theme: string;
  showAnimations: boolean;
  animationSpeed: number;
  showProgressBars: boolean;
  autoCloseDialogs: boolean;
  dialogTimeoutSeconds: number;
}

interface LoggingConfig {
  level: string;
  logToFile: boolean;
  logToConsole: boolean;
  maxLogFiles: number;
  maxLogSizeBytes: number;
  excludedCategories: string[];
}

export interface AppConfig {
  packageManagers: PackageManagersConfig;
  updates: UpdatesConfig;
  security: SecurityConfig;
  ui: UIConfig;
  logging: LoggingConfig;
}

export default class ConfigService {
  private logService: ILogService;
  private configPath: string;
  private config: AppConfig;

  constructor(logService: ILogService) {
    this.logService = logService;
    this.configPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "InvolveX",
      "config.yaml",
    );
    this.config = this.getDefaultConfig();
  }

  getDefaultConfig(): AppConfig {
    return {
      packageManagers: {
        enabledManagers: ["winget", "npm", "scoop", "choco"],
        settings: {},
      },
      updates: {
        autoCheck: true,
        checkIntervalHours: 24,
        includePreReleases: false,
        excludedCategories: [],
        categorySettings: {},
      },
      security: {
        verifyHashes: true,
        checkCertificates: true,
        trustedPublishers: [],
        knownHashes: {},
        sandboxMode: false,
      },
      ui: {
        theme: "default",
        showAnimations: true,
        animationSpeed: 100,
        showProgressBars: true,
        autoCloseDialogs: false,
        dialogTimeoutSeconds: 30,
      },
      logging: {
        level: "info",
        logToFile: true,
        logToConsole: true,
        maxLogFiles: 10,
        maxLogSizeBytes: 10485760, // 10MB
        excludedCategories: [],
      },
    };
  }

  async loadConfigAsync(): Promise<void> {
    try {
      if (await this.fileExists(this.configPath)) {
        const yamlContent = await fs.readFile(this.configPath, "utf8");
        this.config =
          (yaml.load(yamlContent) as AppConfig) || this.getDefaultConfig();
        this.logService.log("Configuration loaded successfully.");
      } else {
        // Create default config
        this.config = this.getDefaultConfig();
        await this.saveConfigAsync();
        this.logService.log("Default configuration created.");
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error loading configuration: ${error instanceof Error ? error.message : String(error)}. Using defaults.`,
      );
      this.config = this.getDefaultConfig();
    }
  }

  async saveConfigAsync(): Promise<void> {
    try {
      const directory = path.dirname(this.configPath);
      await fs.mkdir(directory, { recursive: true });

      const yamlContent = yaml.dump(this.config);
      await fs.writeFile(this.configPath, yamlContent, "utf8");
      this.logService.log("Configuration saved successfully.");
    } catch (error: unknown) {
      this.logService.log(
        `Error saving configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  updateConfig(config: AppConfig): void {
    if (!config) {
      throw new Error("Config cannot be null or undefined");
    }
    this.config = config;
  }

  // Convenience methods for common config access
  isPackageManagerEnabled(manager: string): boolean {
    return this.config.packageManagers.enabledManagers.includes(manager);
  }

  shouldAutoUpdate(category: string): boolean {
    const settings = this.config.updates.categorySettings[category];
    return settings ? settings.enabled : true;
  }

  getExcludedPackages(manager: string): string[] {
    const settings = this.config.packageManagers.settings[manager];
    return settings ? settings.excludedPackages || [] : [];
  }

  shouldVerifyHashes(): boolean {
    return this.config.security.verifyHashes;
  }

  getLogLevel(): string {
    return this.config.logging.level;
  }

  shouldShowAnimations(): boolean {
    return this.config.ui.showAnimations;
  }

  // Configuration update methods
  setPackageManagerEnabled(manager: string, enabled: boolean): void {
    if (
      enabled &&
      !this.config.packageManagers.enabledManagers.includes(manager)
    ) {
      this.config.packageManagers.enabledManagers.push(manager);
    } else if (!enabled) {
      const index =
        this.config.packageManagers.enabledManagers.indexOf(manager);
      if (index > -1) {
        this.config.packageManagers.enabledManagers.splice(index, 1);
      }
    }
  }

  addExcludedPackage(manager: string, packageName: string): void {
    if (!this.config.packageManagers.settings[manager]) {
      this.config.packageManagers.settings[manager] = {
        autoUpdate: true,
        excludedPackages: [],
        customSources: {},
      };
    }

    if (
      !this.config.packageManagers.settings[manager].excludedPackages!.includes(
        packageName,
      )
    ) {
      this.config.packageManagers.settings[manager].excludedPackages!.push(
        packageName,
      );
    }
  }

  removeExcludedPackage(manager: string, packageName: string): void {
    const settings = this.config.packageManagers.settings[manager];
    if (settings && settings.excludedPackages) {
      const index = settings.excludedPackages.indexOf(packageName);
      if (index > -1) {
        settings.excludedPackages.splice(index, 1);
      }
    }
  }

  setUpdateCategoryEnabled(category: string, enabled: boolean): void {
    if (!this.config.updates.categorySettings[category]) {
      this.config.updates.categorySettings[category] = {
        enabled: true,
        requireConfirmation: true,
        maxConcurrentUpdates: 3,
      };
    }

    this.config.updates.categorySettings[category].enabled = enabled;
  }

  setSecurityVerification(
    verifyHashes: boolean,
    checkCertificates: boolean,
  ): void {
    this.config.security.verifyHashes = verifyHashes;
    this.config.security.checkCertificates = checkCertificates;
  }

  setUIAnimations(enabled: boolean, speed = 100): void {
    this.config.ui.showAnimations = enabled;
    this.config.ui.animationSpeed = speed;
  }

  setLoggingLevel(level: string): void {
    this.config.logging.level = level;
  }
}
