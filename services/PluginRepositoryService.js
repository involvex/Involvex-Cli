const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PluginRepositoryService {
  constructor(logService) {
    this.logService = logService;
    this.repositoryUrl =
      'https://raw.githubusercontent.com/involvex/Involvex-Cli/main/plugins-repository.json';
    this.localRepositoryPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'InvolveX',
      'plugins-repository.json'
    );
  }

  async getAvailablePluginsAsync() {
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
    } catch (error) {
      this.logService.log(`Error getting available plugins: ${error.message}`);
      return [];
    }
  }

  async fetchRemoteRepositoryAsync() {
    try {
      const https = require('https');

      return new Promise((resolve, _reject) => {
        const request = https.get(this.repositoryUrl, response => {
          let data = '';

          response.on('data', chunk => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const plugins = JSON.parse(data);
              resolve(plugins);
            } catch (parseError) {
              this.logService.log(`Error parsing remote repository: ${parseError.message}`);
              resolve(null);
            }
          });
        });

        request.on('error', error => {
          this.logService.log(`Error fetching remote repository: ${error.message}`);
          resolve(null);
        });

        request.setTimeout(10000, () => {
          request.destroy();
          this.logService.log('Timeout fetching remote repository');
          resolve(null);
        });
      });
    } catch (error) {
      this.logService.log(`Error in fetchRemoteRepositoryAsync: ${error.message}`);
      return null;
    }
  }

  async loadLocalRepositoryAsync() {
    try {
      const data = await fs.readFile(this.localRepositoryPath, 'utf8');
      const plugins = JSON.parse(data);
      return plugins;
    } catch {
      // File doesn't exist or is invalid
      return null;
    }
  }

  async saveLocalRepositoryAsync(plugins) {
    try {
      const dir = path.dirname(this.localRepositoryPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.localRepositoryPath, JSON.stringify(plugins, null, 2), 'utf8');
    } catch (error) {
      this.logService.log(`Error saving local repository: ${error.message}`);
    }
  }

  async downloadAndInstallPluginAsync(pluginInfo, pluginsDir) {
    try {
      const https = require('https');
      const fs = require('fs');

      if (!pluginInfo.downloadUrl) {
        this.logService.log('Plugin does not have a download URL');
        return false;
      }

      const fileName = `${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_${pluginInfo.version}.js`;
      const filePath = path.join(pluginsDir, fileName);

      return new Promise((resolve, _reject) => {
        const file = fs.createWriteStream(filePath);

        const request = https.get(pluginInfo.downloadUrl, response => {
          if (response.statusCode !== 200) {
            file.close();
            fs.unlink(filePath, () => {});
            resolve(false);
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            this.logService.log(`Downloaded plugin to: ${filePath}`);
            resolve(true);
          });
        });

        request.on('error', error => {
          file.close();
          fs.unlink(filePath, () => {});
          this.logService.log(`Error downloading plugin: ${error.message}`);
          resolve(false);
        });

        request.setTimeout(30000, () => {
          request.destroy();
          file.close();
          fs.unlink(filePath, () => {});
          this.logService.log('Timeout downloading plugin');
          resolve(false);
        });
      });
    } catch (error) {
      this.logService.log(`Error in downloadAndInstallPluginAsync: ${error.message}`);
      return false;
    }
  }

  async validatePluginAsync(pluginPath, _pluginInfo) {
    try {
      // Basic validation - check if file exists and is readable
      await fs.access(pluginPath);

      // Try to load the plugin module to validate it
      const pluginModule = require(pluginPath);

      // Check if it has the required exports
      const PluginClass = pluginModule.default || pluginModule;
      if (!PluginClass) {
        this.logService.log('Plugin validation failed: No default export');
        return false;
      }

      // Try to create an instance
      const plugin = new PluginClass();

      // Check for required properties
      if (!plugin.name) {
        this.logService.log('Plugin validation failed: Missing name property');
        return false;
      }

      this.logService.log(`Plugin validation successful for: ${plugin.name}`);
      return true;
    } catch (error) {
      this.logService.log(`Plugin validation failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = PluginRepositoryService;
