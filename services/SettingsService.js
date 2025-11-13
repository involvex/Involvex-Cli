const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SettingsService {
  constructor(logService) {
    this.logService = logService;
    this.settingsPath = path.join(os.homedir(), 'involvex-cli', 'settings.json');
    this.settings = this.getDefaultSettings();
  }

  getDefaultSettings() {
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
        clientId: '1438575785228242994',
        updateIntervalSeconds: 15,
      },
    };
  }

  async loadSettingsAsync() {
    try {
      const settingsDir = path.dirname(this.settingsPath);
      await fs.mkdir(settingsDir, { recursive: true });

      try {
        const data = await fs.readFile(this.settingsPath, 'utf8');
        const loaded = JSON.parse(data);
        this.settings = { ...this.getDefaultSettings(), ...loaded };
        this.logService.log('Settings loaded successfully');
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, use defaults
          await this.saveSettingsAsync();
          this.logService.log('Created default settings file');
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.logService.log(`Failed to load settings: ${error.message}`);
      this.settings = this.getDefaultSettings();
    }
  }

  async saveSettingsAsync() {
    try {
      const settingsDir = path.dirname(this.settingsPath);
      await fs.mkdir(settingsDir, { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
      this.logService.log('Settings saved successfully');
      return true;
    } catch (error) {
      this.logService.log(`Failed to save settings: ${error.message}`);
      return false;
    }
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
  }

  getAutoUpdateEnabled() {
    return this.settings.autoUpdate?.enabled || false;
  }

  getAutoUpdateAutoInstall() {
    return this.settings.autoUpdate?.autoInstall || false;
  }

  getPackageAutoUpdateEnabled() {
    return this.settings.packageAutoUpdate?.enabled || false;
  }

  getPackageAutoUpdateManagers() {
    return this.settings.packageAutoUpdate?.managers || {};
  }

  getAutoCacheClearingEnabled() {
    return this.settings.autoCacheClearing?.enabled || false;
  }

  getAutoCacheClearingInterval() {
    return this.settings.autoCacheClearing?.intervalHours || 168;
  }

  getAutoMemoryClearingEnabled() {
    return this.settings.autoMemoryClearing?.enabled || false;
  }

  getAutoMemoryClearingThreshold() {
    return this.settings.autoMemoryClearing?.thresholdMB || 4096;
  }

  getAutoMemoryClearingInterval() {
    return this.settings.autoMemoryClearing?.intervalMinutes || 60;
  }

  setLastCacheCleared(timestamp) {
    if (!this.settings.autoCacheClearing) {
      this.settings.autoCacheClearing = {};
    }
    this.settings.autoCacheClearing.lastCleared = timestamp;
  }

  setLastMemoryCleared(timestamp) {
    if (!this.settings.autoMemoryClearing) {
      this.settings.autoMemoryClearing = {};
    }
    this.settings.autoMemoryClearing.lastCleared = timestamp;
  }

  shouldRunAutoCacheClearing() {
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

  shouldRunAutoMemoryClearing() {
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

  getDiscordRPCEnabled() {
    return this.settings.discordRPC?.enabled || false;
  }

  getDiscordRPCClientId() {
    return this.settings.discordRPC?.clientId || '';
  }

  getDiscordRPCUpdateInterval() {
    return this.settings.discordRPC?.updateIntervalSeconds || 15;
  }
}

module.exports = SettingsService;
