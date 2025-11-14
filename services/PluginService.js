const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PluginService {
  constructor(logService, configService) {
    this.logService = logService;
    this.configService = configService;
    this.loadedPlugins = new Map();
    this.pluginMetadata = new Map();
  }

  async initializeAsync() {
    this.logService.log('Initializing plugin service...');

    // Create plugins directory if it doesn't exist
    const pluginsDir = this.getPluginsDirectory();
    try {
      await fs.mkdir(pluginsDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Load enabled plugins
    await this.loadEnabledPluginsAsync();

    this.logService.log(`Plugin service initialized. Loaded ${this.loadedPlugins.size} plugins.`);
  }

  async shutdownAsync() {
    this.logService.log('Shutting down plugin service...');

    for (const [name, plugin] of this.loadedPlugins) {
      try {
        if (plugin.shutdownAsync) {
          await plugin.shutdownAsync();
        }
        this.logService.log(`Plugin '${name}' shut down successfully.`);
      } catch (error) {
        this.logService.log(`Error shutting down plugin '${name}': ${error.message}`);
      }
    }

    this.loadedPlugins.clear();
    this.pluginMetadata.clear();
    this.logService.log('Plugin service shut down.');
  }

  async loadPluginAsync(pluginPath) {
    const result = {
      success: false,
      plugin: null,
      metadata: null,
      errorMessage: '',
    };

    try {
      // Check if file exists
      await fs.access(pluginPath);

      // For JavaScript plugins, we'll require them
      let pluginModule;
      try {
        // Clear require cache to allow reloading
        delete require.cache[require.resolve(pluginPath)];
        pluginModule = require(pluginPath);
      } catch (error) {
        result.errorMessage = `Failed to load plugin module: ${error.message}`;
        return result;
      }

      // Get the plugin class/constructor
      const PluginClass = pluginModule.default || pluginModule;
      if (!PluginClass) {
        result.errorMessage = 'Plugin module does not export a default class or constructor';
        return result;
      }

      // Create plugin instance
      const plugin = new PluginClass();

      // Initialize the plugin
      if (plugin.initializeAsync) {
        await plugin.initializeAsync();
      }

      // Create metadata
      const metadata = {
        name: plugin.name || path.basename(pluginPath, path.extname(pluginPath)),
        description: plugin.description || 'No description available',
        version: plugin.version || '1.0.0',
        author: plugin.author || 'Unknown',
        path: pluginPath,
        enabled: true,
      };

      // Store the plugin
      this.loadedPlugins.set(metadata.name, plugin);
      this.pluginMetadata.set(metadata.name, metadata);

      result.success = true;
      result.plugin = plugin;
      result.metadata = metadata;

      this.logService.log(`Plugin '${metadata.name}' loaded successfully from ${pluginPath}`);
    } catch (error) {
      result.errorMessage = `Error loading plugin: ${error.message}`;
      this.logService.log(`Error loading plugin from ${pluginPath}: ${error.message}`);
    }

    return result;
  }

  async unloadPluginAsync(pluginName) {
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
    } catch (error) {
      this.logService.log(`Error unloading plugin '${pluginName}': ${error.message}`);
      return false;
    }
  }

  async executePluginMenuItemAsync(pluginName, menuItem) {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      this.logService.log(`Plugin '${pluginName}' not found.`);
      return false;
    }

    try {
      if (plugin.executeMenuItemAsync) {
        await plugin.executeMenuItemAsync(menuItem);
      } else {
        this.logService.log(`Plugin '${pluginName}' does not support menu item execution.`);
        return false;
      }
      this.logService.log(`Executed menu item '${menuItem}' for plugin '${pluginName}'`);
      return true;
    } catch (error) {
      this.logService.log(
        `Error executing menu item '${menuItem}' for plugin '${pluginName}': ${error.message}`
      );
      return false;
    }
  }

  async registerPluginAsync(plugin) {
    if (!plugin) {
      throw new Error('Plugin cannot be null or undefined');
    }

    const pluginName = plugin.name || 'Unknown Plugin';
    if (this.loadedPlugins.has(pluginName)) {
      this.logService.log(`Plugin '${pluginName}' is already registered.`);
      return;
    }

    try {
      // Initialize the plugin
      if (plugin.initializeAsync) {
        await plugin.initializeAsync();
      }

      // Create metadata
      const metadata = {
        name: pluginName,
        description: plugin.description || 'No description available',
        version: plugin.version || '1.0.0',
        author: plugin.author || 'Unknown',
        path: 'Built-in',
        enabled: true,
      };

      // Store the plugin
      this.loadedPlugins.set(metadata.name, plugin);
      this.pluginMetadata.set(metadata.name, metadata);

      this.logService.log(`Plugin '${metadata.name}' registered successfully.`);
    } catch (error) {
      this.logService.log(`Error registering plugin '${pluginName}': ${error.message}`);
      throw error;
    }
  }

  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  getPluginNames() {
    return Array.from(this.loadedPlugins.keys());
  }

  getPlugin(name) {
    return this.loadedPlugins.get(name) || null;
  }

  async getAllPluginMenuItemsAsync() {
    const allMenuItems = [];

    for (const [name, plugin] of this.loadedPlugins) {
      try {
        let menuItems = [];
        if (plugin.getMenuItemsAsync) {
          menuItems = await plugin.getMenuItemsAsync();
        } else if (plugin.menuItems) {
          menuItems = plugin.menuItems;
        }

        allMenuItems.push(...menuItems.map(item => `${name}: ${item}`));
      } catch (error) {
        this.logService.log(`Error getting menu items for plugin '${name}': ${error.message}`);
      }
    }

    return allMenuItems;
  }

  async installPluginAsync(pluginPath) {
    try {
      const fileName = path.basename(pluginPath);
      const destinationPath = path.join(this.getPluginsDirectory(), fileName);

      // Copy the plugin file
      await fs.copyFile(pluginPath, destinationPath);

      // Try to load it
      const result = await this.loadPluginAsync(destinationPath);

      if (result.success && result.metadata) {
        this.logService.log(`Plugin '${result.metadata.name}' installed successfully.`);
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
    } catch (error) {
      this.logService.log(`Error installing plugin: ${error.message}`);
      return false;
    }
  }

  async uninstallPluginAsync(pluginName) {
    try {
      // Get metadata before unloading (since unloadPluginAsync deletes it)
      const metadata = this.pluginMetadata.get(pluginName);
      const pluginPath = metadata ? metadata.path : null;

      // Unload the plugin
      const unloaded = await this.unloadPluginAsync(pluginName);
      if (!unloaded) {
        return false;
      }

      // Remove the plugin file
      if (pluginPath && pluginPath !== 'Built-in') {
        try {
          await fs.unlink(pluginPath);
        } catch (error) {
          this.logService.log(`Warning: Could not delete plugin file: ${error.message}`);
        }
      }

      this.logService.log(`Plugin '${pluginName}' uninstalled successfully.`);
      return true;
    } catch (error) {
      this.logService.log(`Error uninstalling plugin '${pluginName}': ${error.message}`);
      return false;
    }
  }

  getPluginsDirectory() {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'InvolveX', 'Plugins');
  }

  async loadEnabledPluginsAsync() {
    try {
      const appPluginsDir = path.join(__dirname, '..', 'plugins'); // Built-in plugins
      const userPluginsDir = this.getPluginsDirectory(); // User-installed plugins

      const allPluginFiles = [];

      // Read built-in plugins
      try {
        const builtInFiles = await fs.readdir(appPluginsDir);
        allPluginFiles.push(...builtInFiles.map(file => path.join(appPluginsDir, file)));
      } catch (e) {
        this.logService.log(
          `Warning: Built-in plugins directory not found or readable: ${e.message}`
        );
      }

      // Read user-installed plugins
      try {
        const userFiles = await fs.readdir(userPluginsDir);
        allPluginFiles.push(...userFiles.map(file => path.join(userPluginsDir, file)));
      } catch (e) {
        this.logService.log(`Warning: User plugins directory not found or readable: ${e.message}`);
      }

      for (const pluginPath of allPluginFiles) {
        if (path.extname(pluginPath) === '.js') {
          try {
            const result = await this.loadPluginAsync(pluginPath);
            if (result.success) {
              this.logService.log(`Auto-loaded plugin: ${result.plugin?.name || 'Unknown'}`);
            } else {
              this.logService.log(
                `Failed to auto-load plugin ${path.basename(pluginPath)}: ${result.errorMessage}`
              );
            }
          } catch (error) {
            this.logService.log(
              `Error auto-loading plugin ${path.basename(pluginPath)}: ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      this.logService.log(`Error loading enabled plugins: ${error.message}`);
    }
  }
}

module.exports = PluginService;
