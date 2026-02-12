import type { ILogService } from "../types/index";
import type { Plugin } from "../types/index.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface PluginMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  path: string;
  enabled: boolean;
}

interface LoadPluginResult {
  success: boolean;
  plugin: Plugin | null;
  metadata: PluginMetadata | null;
  errorMessage: string;
}

export default class PluginService {
  private logService: ILogService;
  private configService: unknown;
  private loadedPlugins: Map<string, Plugin>;
  private pluginMetadata: Map<string, PluginMetadata>;

  constructor(logService: ILogService, configService: unknown) {
    this.logService = logService;
    this.configService = configService;
    this.loadedPlugins = new Map();
    this.pluginMetadata = new Map();
  }

  async initializeAsync(): Promise<void> {
    this.logService.log("Initializing plugin service...");

    // Create plugins directory if it doesn't exist
    const pluginsDir = this.getPluginsDirectory();
    try {
      await fs.mkdir(pluginsDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Load enabled plugins
    await this.loadEnabledPluginsAsync();

    this.logService.log(
      `Plugin service initialized. Loaded ${this.loadedPlugins.size} plugins.`,
    );
  }

  async shutdownAsync(): Promise<void> {
    this.logService.log("Shutting down plugin service...");

    for (const [name, plugin] of this.loadedPlugins) {
      try {
        if (plugin.shutdownAsync) {
          await plugin.shutdownAsync();
        }
        this.logService.log(`Plugin '${name}' shut down successfully.`);
      } catch (error: unknown) {
        this.logService.log(
          `Error shutting down plugin '${name}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.loadedPlugins.clear();
    this.pluginMetadata.clear();
    this.logService.log("Plugin service shut down.");
  }

  async loadPluginAsync(pluginPath: string): Promise<LoadPluginResult> {
    const result: LoadPluginResult = {
      success: false,
      plugin: null,
      metadata: null,
      errorMessage: "",
    };

    try {
      // Check if file exists
      await fs.access(pluginPath);

      // For JavaScript/TypeScript plugins, we'll require them
      // Keep require() for dynamic plugin loading as noted in plan
      let pluginModule: unknown;
      try {
        // Clear require cache to allow reloading
        delete require.cache[require.resolve(pluginPath)];
        pluginModule = await import(pluginPath);
      } catch (error: unknown) {
        result.errorMessage = `Failed to load plugin module: ${error instanceof Error ? error.message : String(error)}`;
        return result;
      }

      // Get the plugin class/constructor
      const PluginClass = ((pluginModule as unknown as Record<string, unknown>)
        .default || pluginModule) as unknown as { new (): Plugin };
      if (!PluginClass) {
        result.errorMessage =
          "Plugin module does not export a default class or constructor";
        return result;
      }

      // Create plugin instance
      const plugin = new PluginClass() as Plugin;

      // Initialize plugin
      if (plugin.initializeAsync) {
        await plugin.initializeAsync();
      }

      // Create metadata
      const metadata: PluginMetadata = {
        name:
          plugin.name || path.basename(pluginPath, path.extname(pluginPath)),
        description: plugin.description || "No description available",
        version: plugin.version || "1.0.0",
        author: plugin.author || "Unknown",
        path: pluginPath,
        enabled: true,
      };

      // Store the plugin
      this.loadedPlugins.set(metadata.name, plugin);
      this.pluginMetadata.set(metadata.name, metadata);

      result.success = true;
      result.plugin = plugin;
      result.metadata = metadata;

      this.logService.log(
        `Plugin '${metadata.name}' loaded successfully from ${pluginPath}`,
      );
    } catch (error: unknown) {
      result.errorMessage = `Error loading plugin: ${error instanceof Error ? error.message : String(error)}`;
      this.logService.log(
        `Error loading plugin from ${pluginPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  async unloadPluginAsync(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      this.logService.log(`Plugin '${pluginName}' not found.`);
      return false;
    }

    try {
      if (plugin.shutdownAsync) {
        await plugin.shutdownAsync();
      }
      this.loadedPlugins.delete(pluginName);
      this.pluginMetadata.delete(pluginName);

      this.logService.log(`Plugin '${pluginName}' unloaded successfully.`);
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error unloading plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async executePluginMenuItemAsync(
    pluginName: string,
    menuItem: string,
  ): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      this.logService.log(`Plugin '${pluginName}' not found.`);
      return false;
    }

    try {
      if ((plugin as unknown as Record<string, unknown>).executeMenuItemAsync) {
        await (
          (plugin as unknown as Record<string, unknown>)
            .executeMenuItemAsync as (item: string) => Promise<void>
        )(menuItem);
      } else {
        this.logService.log(
          `Plugin '${pluginName}' does not support menu item execution.`,
        );
        return false;
      }
      this.logService.log(
        `Executed menu item '${menuItem}' for plugin '${pluginName}'`,
      );
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error executing menu item '${menuItem}' for plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async registerPluginAsync(plugin: Plugin): Promise<void> {
    if (!plugin) {
      throw new Error("Plugin cannot be null or undefined");
    }

    const pluginName = plugin.name || "Unknown Plugin";
    if (this.loadedPlugins.has(pluginName)) {
      this.logService.log(`Plugin '${pluginName}' is already registered.`);
      return;
    }

    try {
      // Initialize plugin
      if (plugin.initializeAsync) {
        await plugin.initializeAsync();
      }

      // Create metadata
      const metadata: PluginMetadata = {
        name: pluginName,
        description: plugin.description || "No description available",
        version: plugin.version || "1.0.0",
        author: plugin.author || "Unknown",
        path: "Built-in",
        enabled: true,
      };

      // Store the plugin
      this.loadedPlugins.set(metadata.name, plugin);
      this.pluginMetadata.set(metadata.name, metadata);

      this.logService.log(`Plugin '${metadata.name}' registered successfully.`);
    } catch (error: unknown) {
      this.logService.log(
        `Error registering plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  getLoadedPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  getPluginNames(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  getPlugin(name: string): Plugin | null {
    return this.loadedPlugins.get(name) || null;
  }

  async getAllPluginMenuItemsAsync(): Promise<string[]> {
    const allMenuItems: string[] = [];

    for (const [name, plugin] of this.loadedPlugins) {
      try {
        let menuItems: string[] = [];
        if (plugin.getMenuItemsAsync) {
          menuItems = await plugin.getMenuItemsAsync();
        } else if (plugin.menuItems) {
          menuItems = plugin.menuItems;
        }

        allMenuItems.push(...menuItems.map(item => `${name}: ${item}`));
      } catch (error: unknown) {
        this.logService.log(
          `Error getting menu items for plugin '${name}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return allMenuItems;
  }

  async installPluginAsync(pluginPath: string): Promise<boolean> {
    try {
      const fileName = path.basename(pluginPath);
      const destinationPath = path.join(this.getPluginsDirectory(), fileName);

      // Copy plugin file
      await fs.copyFile(pluginPath, destinationPath);

      // Try to load it
      const result = await this.loadPluginAsync(destinationPath);

      if (result.success && result.metadata) {
        this.logService.log(
          `Plugin '${result.metadata.name}' installed successfully.`,
        );
        return true;
      } else {
        // Clean up on failure
        try {
          await fs.unlink(destinationPath);
        } catch {
          // Ignore cleanup errors
        }
        this.logService.log(`Failed to install plugin: ${result.errorMessage}`);
        return false;
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error installing plugin: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async uninstallPluginAsync(pluginName: string): Promise<boolean> {
    try {
      // Get metadata before unloading (since unloadPluginAsync deletes it)
      const metadata = this.pluginMetadata.get(pluginName);
      const pluginPath = metadata ? metadata.path : null;

      // Unload plugin
      const unloaded = await this.unloadPluginAsync(pluginName);
      if (!unloaded) {
        return false;
      }

      // Remove plugin file
      if (pluginPath && pluginPath !== "Built-in") {
        try {
          await fs.unlink(pluginPath);
        } catch (error: unknown) {
          this.logService.log(
            `Warning: Could not delete plugin file: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logService.log(`Plugin '${pluginName}' uninstalled successfully.`);
      return true;
    } catch (error: unknown) {
      this.logService.log(
        `Error uninstalling plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  getPluginsDirectory(): string {
    return path.join(os.homedir(), "AppData", "Roaming", "InvolveX", "Plugins");
  }

  async loadEnabledPluginsAsync(): Promise<void> {
    try {
      const appPluginsDir = path.join(__dirname, "..", "plugins"); // Built-in plugins
      const userPluginsDir = this.getPluginsDirectory(); // User-installed plugins

      const allPluginFiles: string[] = [];

      // Read built-in plugins
      try {
        const builtInFiles = await fs.readdir(appPluginsDir);
        allPluginFiles.push(
          ...builtInFiles.map(file => path.join(appPluginsDir, file)),
        );
      } catch (e: unknown) {
        this.logService.log(
          `Warning: Built-in plugins directory not found or readable: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      // Read user-installed plugins
      try {
        const userFiles = await fs.readdir(userPluginsDir);
        allPluginFiles.push(
          ...userFiles.map(file => path.join(userPluginsDir, file)),
        );
      } catch (e: unknown) {
        this.logService.log(
          `Warning: User plugins directory not found or readable: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      for (const pluginPath of allPluginFiles) {
        if (path.extname(pluginPath) === ".js") {
          try {
            const result = await this.loadPluginAsync(pluginPath);
            if (result.success) {
              this.logService.log(
                `Auto-loaded plugin: ${result.plugin?.name || "Unknown"}`,
              );
            } else {
              this.logService.log(
                `Failed to auto-load plugin ${path.basename(pluginPath)}: ${result.errorMessage}`,
              );
            }
          } catch (error: unknown) {
            this.logService.log(
              `Error auto-loading plugin ${path.basename(pluginPath)}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    } catch (error: unknown) {
      this.logService.log(
        `Error loading enabled plugins: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
