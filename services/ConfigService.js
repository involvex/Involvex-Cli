const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

class ConfigService {
  constructor(logService) {
    this.logService = logService;
    this.configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'InvolveX', 'config.yaml');
    this.config = this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      packageManagers: {
        enabledManagers: ['winget', 'npm', 'scoop', 'choco'],
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
        theme: 'default',
        showAnimations: true,
        animationSpeed: 100,
        showProgressBars: true,
        autoCloseDialogs: false,
        dialogTimeoutSeconds: 30,
      },
      logging: {
        level: 'info',
        logToFile: true,
        logToConsole: true,
        maxLogFiles: 10,
        maxLogSizeBytes: 10485760, // 10MB
        excludedCategories: [],
      },
    };
  }

  async loadConfigAsync() {
    try {
      if (await this.fileExists(this.configPath)) {
        const yamlContent = await fs.readFile(this.configPath, 'utf8');
        this.config = yaml.load(yamlContent) || this.getDefaultConfig();
        this.logService.log('Configuration loaded successfully.');
      } else {
        // Create default config
        this.config = this.getDefaultConfig();
        await this.saveConfigAsync();
        this.logService.log('Default configuration created.');
      }
    } catch (error) {
      this.logService.log(`Error loading configuration: ${error.message}. Using defaults.`);
      this.config = this.getDefaultConfig();
    }
  }

  async saveConfigAsync() {
    try {
      const directory = path.dirname(this.configPath);
      await fs.mkdir(directory, { recursive: true });

      const yamlContent = yaml.dump(this.config);
      await fs.writeFile(this.configPath, yamlContent, 'utf8');
      this.logService.log('Configuration saved successfully.');
    } catch (error) {
      this.logService.log(`Error saving configuration: ${error.message}`);
      throw error;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getConfig() {
    return this.config;
  }

  updateConfig(config) {
    if (!config) {
      throw new Error('Config cannot be null or undefined');
    }
    this.config = config;
  }

  // Convenience methods for common config access
  isPackageManagerEnabled(manager) {
    return this.config.packageManagers.enabledManagers.includes(manager);
  }

  shouldAutoUpdate(category) {
    const settings = this.config.updates.categorySettings[category];
    return settings ? settings.enabled : true;
  }

  getExcludedPackages(manager) {
    const settings = this.config.packageManagers.settings[manager];
    return settings ? settings.excludedPackages || [] : [];
  }

  shouldVerifyHashes() {
    return this.config.security.verifyHashes;
  }

  getLogLevel() {
    return this.config.logging.level;
  }

  shouldShowAnimations() {
    return this.config.ui.showAnimations;
  }

  // Configuration update methods
  setPackageManagerEnabled(manager, enabled) {
    if (enabled && !this.config.packageManagers.enabledManagers.includes(manager)) {
      this.config.packageManagers.enabledManagers.push(manager);
    } else if (!enabled) {
      const index = this.config.packageManagers.enabledManagers.indexOf(manager);
      if (index > -1) {
        this.config.packageManagers.enabledManagers.splice(index, 1);
      }
    }
  }

  addExcludedPackage(manager, packageName) {
    if (!this.config.packageManagers.settings[manager]) {
      this.config.packageManagers.settings[manager] = {
        autoUpdate: true,
        excludedPackages: [],
        customSources: {},
      };
    }

    if (!this.config.packageManagers.settings[manager].excludedPackages.includes(packageName)) {
      this.config.packageManagers.settings[manager].excludedPackages.push(packageName);
    }
  }

  removeExcludedPackage(manager, packageName) {
    const settings = this.config.packageManagers.settings[manager];
    if (settings && settings.excludedPackages) {
      const index = settings.excludedPackages.indexOf(packageName);
      if (index > -1) {
        settings.excludedPackages.splice(index, 1);
      }
    }
  }

  setUpdateCategoryEnabled(category, enabled) {
    if (!this.config.updates.categorySettings[category]) {
      this.config.updates.categorySettings[category] = {
        enabled: true,
        requireConfirmation: true,
        maxConcurrentUpdates: 3,
      };
    }

    this.config.updates.categorySettings[category].enabled = enabled;
  }

  setSecurityVerification(verifyHashes, checkCertificates) {
    this.config.security.verifyHashes = verifyHashes;
    this.config.security.checkCertificates = checkCertificates;
  }

  setUIAnimations(enabled, speed = 100) {
    this.config.ui.showAnimations = enabled;
    this.config.ui.animationSpeed = speed;
  }

  setLoggingLevel(level) {
    this.config.logging.level = level;
  }
}

module.exports = ConfigService;
