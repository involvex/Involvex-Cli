const SettingsService = require('../services/SettingsService');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// Mock os.homedir
jest.mock('os', () => ({
  homedir: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('SettingsService', () => {
  let settingsService;
  const mockHomeDir = '/mock/home';
  const mockSettingsPath = path.join(mockHomeDir, 'involvex-cli', 'settings.json');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    settingsService = new SettingsService(mockLogService);
  });

  describe('getDefaultSettings', () => {
    test('should return default settings object', () => {
      const defaults = settingsService.getDefaultSettings();

      expect(defaults).toBeDefined();
      expect(defaults.autoUpdate).toBeDefined();
      expect(defaults.packageAutoUpdate).toBeDefined();
      expect(defaults.autoCacheClearing).toBeDefined();
      expect(defaults.autoMemoryClearing).toBeDefined();
      expect(defaults.notifications).toBeDefined();
      expect(defaults.discordRPC).toBeDefined();
      expect(defaults.autoUpdate.enabled).toBe(false);
    });
  });

  describe('loadSettingsAsync', () => {
    test('should load settings from file if it exists', async () => {
      const mockSettings = {
        autoUpdate: { enabled: true },
        packageAutoUpdate: { enabled: false },
      };

      fs.mkdir.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(mockSettings));

      await settingsService.loadSettingsAsync();

      expect(fs.readFile).toHaveBeenCalledWith(mockSettingsPath, 'utf8');
      expect(settingsService.getSettings().autoUpdate.enabled).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith('Settings loaded successfully');
    });

    test('should create default settings file if it does not exist', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();

      await settingsService.loadSettingsAsync();

      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Created default settings file');
    });

    test('should use defaults if file read fails', async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue(new Error('Read error'));

      await settingsService.loadSettingsAsync();

      expect(settingsService.getSettings()).toEqual(settingsService.getDefaultSettings());
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load settings')
      );
    });

    test('should merge loaded settings with defaults', async () => {
      const partialSettings = {
        autoUpdate: { enabled: true },
      };

      fs.mkdir.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(partialSettings));

      await settingsService.loadSettingsAsync();

      const settings = settingsService.getSettings();
      expect(settings.autoUpdate.enabled).toBe(true);
      expect(settings.packageAutoUpdate).toBeDefined(); // Should have defaults
    });
  });

  describe('saveSettingsAsync', () => {
    test('should save settings to file', async () => {
      const mockSettings = { autoUpdate: { enabled: true } };
      settingsService.updateSettings(mockSettings);

      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await settingsService.saveSettingsAsync();

      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(mockSettingsPath), { recursive: true });
      // Settings are merged with defaults, so we check that writeFile was called with the merged settings
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockSettingsPath,
        JSON.stringify(settingsService.getSettings(), null, 2),
        'utf8'
      );
      expect(mockLogService.log).toHaveBeenCalledWith('Settings saved successfully');
    });

    test('should return false if save fails', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Write error'));

      const result = await settingsService.saveSettingsAsync();

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save settings')
      );
    });
  });

  describe('getSettings and updateSettings', () => {
    test('should return current settings', () => {
      const settings = settingsService.getSettings();

      expect(settings).toBeDefined();
      expect(settings).toEqual(settingsService.getDefaultSettings());
    });

    test('should update settings', () => {
      const updates = { autoUpdate: { enabled: true } };

      settingsService.updateSettings(updates);

      expect(settingsService.getSettings().autoUpdate.enabled).toBe(true);
    });

    test('should merge updates with existing settings', () => {
      settingsService.updateSettings({ autoUpdate: { enabled: true } });
      settingsService.updateSettings({ packageAutoUpdate: { enabled: true } });

      const settings = settingsService.getSettings();
      expect(settings.autoUpdate.enabled).toBe(true);
      expect(settings.packageAutoUpdate.enabled).toBe(true);
    });
  });

  describe('getter methods', () => {
    beforeEach(() => {
      settingsService.updateSettings({
        autoUpdate: {
          enabled: true,
          autoInstall: true,
        },
        packageAutoUpdate: {
          enabled: true,
          managers: {
            winget: true,
            npm: false,
          },
        },
        autoCacheClearing: {
          enabled: true,
          intervalHours: 48,
        },
        autoMemoryClearing: {
          enabled: true,
          thresholdMB: 2048,
          intervalMinutes: 30,
        },
        discordRPC: {
          enabled: true,
          clientId: 'test-id',
          updateIntervalSeconds: 30,
        },
      });
    });

    test('getAutoUpdateEnabled should return correct value', () => {
      expect(settingsService.getAutoUpdateEnabled()).toBe(true);
    });

    test('getAutoUpdateAutoInstall should return correct value', () => {
      expect(settingsService.getAutoUpdateAutoInstall()).toBe(true);
    });

    test('getPackageAutoUpdateEnabled should return correct value', () => {
      expect(settingsService.getPackageAutoUpdateEnabled()).toBe(true);
    });

    test('getPackageAutoUpdateManagers should return correct value', () => {
      const managers = settingsService.getPackageAutoUpdateManagers();
      expect(managers.winget).toBe(true);
      expect(managers.npm).toBe(false);
    });

    test('getAutoCacheClearingEnabled should return correct value', () => {
      expect(settingsService.getAutoCacheClearingEnabled()).toBe(true);
    });

    test('getAutoCacheClearingInterval should return correct value', () => {
      expect(settingsService.getAutoCacheClearingInterval()).toBe(48);
    });

    test('getAutoMemoryClearingEnabled should return correct value', () => {
      expect(settingsService.getAutoMemoryClearingEnabled()).toBe(true);
    });

    test('getAutoMemoryClearingThreshold should return correct value', () => {
      expect(settingsService.getAutoMemoryClearingThreshold()).toBe(2048);
    });

    test('getAutoMemoryClearingInterval should return correct value', () => {
      expect(settingsService.getAutoMemoryClearingInterval()).toBe(30);
    });

    test('getDiscordRPCEnabled should return correct value', () => {
      expect(settingsService.getDiscordRPCEnabled()).toBe(true);
    });

    test('getDiscordRPCClientId should return correct value', () => {
      expect(settingsService.getDiscordRPCClientId()).toBe('test-id');
    });

    test('getDiscordRPCUpdateInterval should return correct value', () => {
      expect(settingsService.getDiscordRPCUpdateInterval()).toBe(30);
    });

    test('getters should return defaults when values are missing', () => {
      // Reset to defaults
      settingsService.settings = settingsService.getDefaultSettings();
      settingsService.updateSettings({});

      // After merging empty object, defaults should still be present
      expect(settingsService.getAutoUpdateEnabled()).toBe(false);
      expect(settingsService.getAutoCacheClearingInterval()).toBe(168);
      expect(settingsService.getAutoMemoryClearingThreshold()).toBe(4096);
    });
  });

  describe('setLastCacheCleared and setLastMemoryCleared', () => {
    test('should set last cache cleared timestamp', () => {
      const timestamp = Date.now();

      settingsService.setLastCacheCleared(timestamp);

      expect(settingsService.getSettings().autoCacheClearing.lastCleared).toBe(timestamp);
    });

    test('should create autoCacheClearing object if it does not exist', () => {
      settingsService.updateSettings({});
      const timestamp = Date.now();

      settingsService.setLastCacheCleared(timestamp);

      expect(settingsService.getSettings().autoCacheClearing).toBeDefined();
      expect(settingsService.getSettings().autoCacheClearing.lastCleared).toBe(timestamp);
    });

    test('should set last memory cleared timestamp', () => {
      const timestamp = Date.now();

      settingsService.setLastMemoryCleared(timestamp);

      expect(settingsService.getSettings().autoMemoryClearing.lastCleared).toBe(timestamp);
    });

    test('should create autoMemoryClearing object if it does not exist', () => {
      settingsService.updateSettings({});
      const timestamp = Date.now();

      settingsService.setLastMemoryCleared(timestamp);

      expect(settingsService.getSettings().autoMemoryClearing).toBeDefined();
      expect(settingsService.getSettings().autoMemoryClearing.lastCleared).toBe(timestamp);
    });
  });

  describe('shouldRunAutoCacheClearing', () => {
    test('should return false if auto cache clearing is disabled', () => {
      settingsService.updateSettings({
        autoCacheClearing: { enabled: false },
      });

      expect(settingsService.shouldRunAutoCacheClearing()).toBe(false);
    });

    test('should return true if lastCleared is not set', () => {
      settingsService.updateSettings({
        autoCacheClearing: { enabled: true },
      });

      expect(settingsService.shouldRunAutoCacheClearing()).toBe(true);
    });

    test('should return true if interval has passed', () => {
      const oldTimestamp = Date.now() - 50 * 60 * 60 * 1000; // 50 hours ago
      settingsService.updateSettings({
        autoCacheClearing: {
          enabled: true,
          intervalHours: 24,
          lastCleared: oldTimestamp,
        },
      });

      expect(settingsService.shouldRunAutoCacheClearing()).toBe(true);
    });

    test('should return false if interval has not passed', () => {
      const recentTimestamp = Date.now() - 10 * 60 * 60 * 1000; // 10 hours ago
      settingsService.updateSettings({
        autoCacheClearing: {
          enabled: true,
          intervalHours: 24,
          lastCleared: recentTimestamp,
        },
      });

      expect(settingsService.shouldRunAutoCacheClearing()).toBe(false);
    });
  });

  describe('shouldRunAutoMemoryClearing', () => {
    test('should return false if auto memory clearing is disabled', () => {
      settingsService.updateSettings({
        autoMemoryClearing: { enabled: false },
      });

      expect(settingsService.shouldRunAutoMemoryClearing()).toBe(false);
    });

    test('should return true if lastCleared is not set', () => {
      settingsService.updateSettings({
        autoMemoryClearing: { enabled: true },
      });

      expect(settingsService.shouldRunAutoMemoryClearing()).toBe(true);
    });

    test('should return true if interval has passed', () => {
      const oldTimestamp = Date.now() - 70 * 60 * 1000; // 70 minutes ago
      settingsService.updateSettings({
        autoMemoryClearing: {
          enabled: true,
          intervalMinutes: 60,
          lastCleared: oldTimestamp,
        },
      });

      expect(settingsService.shouldRunAutoMemoryClearing()).toBe(true);
    });

    test('should return false if interval has not passed', () => {
      const recentTimestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago
      settingsService.updateSettings({
        autoMemoryClearing: {
          enabled: true,
          intervalMinutes: 60,
          lastCleared: recentTimestamp,
        },
      });

      expect(settingsService.shouldRunAutoMemoryClearing()).toBe(false);
    });
  });
});
