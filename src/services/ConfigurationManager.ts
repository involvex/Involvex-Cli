import type { ILogService } from "../types/index";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface AppConfiguration {
  autoUpdate: boolean;
  theme: "dark" | "light";
  logLevel: "debug" | "info" | "warn" | "error";
  configPath?: string;
}

const DEFAULT_CONFIG: AppConfiguration = {
  autoUpdate: true,
  theme: "dark",
  logLevel: "info",
};

export default class ConfigurationManager {
  private logService: ILogService;
  private configDir: string;
  private configFile: string;
  private config: AppConfiguration;

  constructor(logService: ILogService) {
    this.logService = logService;
    this.configDir = path.join(os.homedir(), ".involvex-cli");
    this.configFile = path.join(this.configDir, "config.json");
    this.config = { ...DEFAULT_CONFIG };
  }

  async initializeAsync(): Promise<void> {
    try {
      // Create config directory if it doesn't exist
      await fs.mkdir(this.configDir, { recursive: true });

      // Load or create config file
      try {
        const configData = await fs.readFile(this.configFile, "utf-8");
        const parsed = JSON.parse(configData);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
        this.logService.log("Configuration loaded");
      } catch {
        // Config file doesn't exist, create with defaults
        await this.saveConfigAsync();
        this.logService.log("Configuration file created with defaults");
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error initializing configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async saveConfigAsync(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.writeFile(
        this.configFile,
        JSON.stringify(this.config, null, 2),
        "utf-8",
      );
      this.logService.log("Configuration saved");
    } catch (error: unknown) {
      this.logService.log(
        `Error saving configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  getConfig(): AppConfiguration {
    return { ...this.config };
  }

  async setAutoUpdate(enabled: boolean): Promise<void> {
    this.config.autoUpdate = enabled;
    await this.saveConfigAsync();
    this.logService.log(`Auto-update set to ${enabled}`);
  }

  async setTheme(theme: "dark" | "light"): Promise<void> {
    this.config.theme = theme;
    await this.saveConfigAsync();
    this.logService.log(`Theme set to ${theme}`);
  }

  async setLogLevel(level: "debug" | "info" | "warn" | "error"): Promise<void> {
    this.config.logLevel = level;
    await this.saveConfigAsync();
    this.logService.log(`Log level set to ${level}`);
  }

  async setConfigPath(configPath: string): Promise<void> {
    this.config.configPath = configPath;
    await this.saveConfigAsync();
    this.logService.log(`Config path set to ${configPath}`);
  }

  getConfigDirectory(): string {
    return this.configDir;
  }

  getConfigFile(): string {
    return this.configFile;
  }
}
