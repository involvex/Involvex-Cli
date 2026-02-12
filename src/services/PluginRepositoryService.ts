/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ILogService } from "../types/index";
import fs from "node:fs/promises";
import { request } from "https";
import path from "node:path";

export interface PluginInfo {
  name: string;
  description: string;
  version: string;
  author: string;
  downloadUrl?: string;
  homepage?: string;
  repository?: string;
}

export default class PluginRepositoryService {
  private logService: ILogService;
  private repositoryUrl: string;
  private localRepositoryPath: string;

  constructor(logService: ILogService) {
    this.logService = logService;
    this.repositoryUrl =
      "https://raw.githubusercontent.com/InvolveX/InvolveX-Cli/main/plugins-repository.json";
    this.localRepositoryPath = path.join(
      __dirname,
      "..",
      "plugins-repository.json",
    );
  }

  async getAvailablePluginsAsync(): Promise<PluginInfo[] | null> {
    try {
      // Try to load from local cache first
      let plugins = await this.loadLocalRepositoryAsync();

      // If local cache is empty or old, try to fetch from remote
      if (!plugins || plugins.length === 0) {
        plugins = await this.fetchRemoteRepositoryAsync();
        if (plugins) {
          await this.saveLocalRepositoryAsync(plugins);
        }
      }

      return plugins || [];
    } catch (error: any) {
      this.logService.log(`Error getting available plugins: ${error.message}`);
      return [];
    }
  }

  private async fetchRemoteRepositoryAsync(): Promise<PluginInfo[] | null> {
    try {
      return new Promise(resolve => {
        const req = request(this.repositoryUrl, res => {
          let data = "";

          res.on("data", chunk => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const trimmedData = data.trim();
              const plugins = JSON.parse(trimmedData) as PluginInfo[];
              resolve(plugins);
            } catch (parseError: any) {
              this.logService.log(
                `Error parsing remote repository: ${parseError.message}`,
              );
              resolve(null);
            }
          });
        });

        req.on("error", error => {
          this.logService.log(
            `Error fetching remote repository: ${error.message}`,
          );
          resolve(null);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          this.logService.log("Timeout fetching remote repository");
          resolve(null);
        });
      });
    } catch (error: any) {
      this.logService.log(
        `Error in fetchRemoteRepositoryAsync: ${error.message}`,
      );
      return null;
    }
  }

  private async loadLocalRepositoryAsync(): Promise<PluginInfo[] | null> {
    try {
      const data = await fs.readFile(this.localRepositoryPath, "utf8");

      const plugins = JSON.parse(data) as PluginInfo[];

      return plugins;
    } catch {
      // File doesn't exist or is invalid

      return null;
    }
  }

  private async saveLocalRepositoryAsync(plugins: PluginInfo[]): Promise<void> {
    try {
      const dir = path.dirname(this.localRepositoryPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.localRepositoryPath,
        JSON.stringify(plugins, null, 2),
        "utf8",
      );
    } catch (error: any) {
      this.logService.log(`Error saving local repository: ${error.message}`);
    }
  }

  async downloadAndInstallPluginAsync(
    pluginInfo: PluginInfo,
    pluginsDir: string,
  ): Promise<boolean> {
    try {
      const https = await import("https");
      const fs = await import("fs");

      if (!pluginInfo.downloadUrl) {
        this.logService.log("Plugin does not have a download URL");
        return false;
      }

      const fileName = `${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, "_")}_${pluginInfo.version}.js`;
      const filePath = path.join(pluginsDir, fileName);

      return new Promise(resolve => {
        const file = fs.createWriteStream(filePath);

        const req = https.get(pluginInfo.downloadUrl!, (res: any) => {
          if (res.statusCode !== 200) {
            file.close();
            fs.unlink(filePath, () => {});
            resolve(false);
            return;
          }

          res.pipe(file);

          file.on("finish", () => {
            file.close();
            this.logService.log(`Downloaded plugin to: ${filePath}`);
            resolve(true);
          });
        });

        req.on("error", (error: any) => {
          file.close();
          fs.unlink(filePath, () => {});
          this.logService.log(`Error downloading plugin: ${error.message}`);
          resolve(false);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          file.close();
          fs.unlink(filePath, () => {});
          this.logService.log("Timeout downloading plugin");
          resolve(false);
        });
      });
    } catch (error: any) {
      this.logService.log(
        `Error in downloadAndInstallPluginAsync: ${error.message}`,
      );
      return false;
    }
  }

  async validatePluginAsync(pluginPath: string): Promise<boolean> {
    try {
      // Basic validation - check if file exists and is readable
      await fs.access(pluginPath);

      // Try to load plugin module to validate it
      const pluginModule = await import(pluginPath);

      // Check if it has required exports
      const PluginClass = pluginModule.default || pluginModule;
      if (!PluginClass) {
        this.logService.log("Plugin validation failed: No default export");
        return false;
      }

      // Try to create an instance
      const plugin = new PluginClass();

      // Check for required properties
      if (!plugin.name) {
        this.logService.log("Plugin validation failed: Missing name property");
        return false;
      }

      this.logService.log(`Plugin validation successful for: ${plugin.name}`);
      return true;
    } catch (error: any) {
      this.logService.log(`Plugin validation failed: ${error.message}`);
      return false;
    }
  }
}
