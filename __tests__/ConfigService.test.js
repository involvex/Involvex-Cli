const ConfigService = require('../services/ConfigService');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));

// Mock os.homedir
jest.mock('os', () => ({
  homedir: jest.fn(),
}));

// Mock js-yaml
jest.mock('js-yaml', () => ({
  load: jest.fn(),
  dump: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('ConfigService', () => {
  let configService;
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, 'AppData', 'Roaming', 'InvolveX', 'config.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    configService = new ConfigService(mockLogService);
  });

  describe('getDefaultConfig', () => {
    test('should return the default configuration object', () => {
      const defaultConfig = configService.getDefaultConfig();
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.packageManagers).toBeDefined();
      expect(defaultConfig.updates).toBeDefined();
      expect(defaultConfig.security).toBeDefined();
      expect(defaultConfig.ui).toBeDefined();
      expect(defaultConfig.logging).toBeDefined();
      expect(defaultConfig.packageManagers.enabledManagers).toEqual([
        'winget',
        'npm',
        'scoop',
        'choco',
      ]);
    });
  });

  describe('loadConfigAsync', () => {
    test('should load config from file if it exists', async () => {
      const mockYamlContent = 'packageManagers:\n  enabledManagers:\n    - custom';
      const mockParsedConfig = { packageManagers: { enabledManagers: ['custom'] } };

      fs.access.mockResolvedValue(); // File exists
      fs.readFile.mockResolvedValue(mockYamlContent);
      yaml.load.mockReturnValue(mockParsedConfig);

      await configService.loadConfigAsync();

      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(yaml.load).toHaveBeenCalledWith(mockYamlContent);
      expect(configService.getConfig()).toEqual(mockParsedConfig);
      expect(mockLogService.log).toHaveBeenCalledWith('Configuration loaded successfully.');
    });

    test('should create default config if file does not exist', async () => {
      fs.access.mockRejectedValue({ code: 'ENOENT' }); // File does not exist
      yaml.dump.mockReturnValue('default config yaml');
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();

      await configService.loadConfigAsync();

      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
      expect(yaml.dump).toHaveBeenCalledWith(configService.getDefaultConfig());
      expect(fs.writeFile).toHaveBeenCalledWith(mockConfigPath, 'default config yaml', 'utf8');
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(mockConfigPath), { recursive: true });
      expect(configService.getConfig()).toEqual(configService.getDefaultConfig());
      expect(mockLogService.log).toHaveBeenCalledWith('Default configuration created.');
    });

    test('should log error and use defaults if file reading fails', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockRejectedValue(new Error('Read error'));

      await configService.loadConfigAsync();

      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(configService.getConfig()).toEqual(configService.getDefaultConfig());
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration: Read error. Using defaults.')
      );
    });

    test('should log error and use defaults if YAML parsing fails', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('invalid yaml');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      await configService.loadConfigAsync();

      expect(fs.access).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(yaml.load).toHaveBeenCalledWith('invalid yaml');
      expect(configService.getConfig()).toEqual(configService.getDefaultConfig());
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration: YAML parse error. Using defaults.')
      );
    });
  });

  describe('saveConfigAsync', () => {
    test('should save the current configuration to file', async () => {
      const mockConfig = { ui: { theme: 'dark' } };
      const mockYamlContent = 'ui:\n  theme: dark\n';

      configService.updateConfig(mockConfig);
      yaml.dump.mockReturnValue(mockYamlContent);
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();

      await configService.saveConfigAsync();

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(mockConfigPath), { recursive: true });
      expect(yaml.dump).toHaveBeenCalledWith(mockConfig);
      expect(fs.writeFile).toHaveBeenCalledWith(mockConfigPath, mockYamlContent, 'utf8');
      expect(mockLogService.log).toHaveBeenCalledWith('Configuration saved successfully.');
    });

    test('should throw error and log if file writing fails', async () => {
      const mockConfig = { ui: { theme: 'dark' } };
      configService.updateConfig(mockConfig);
      yaml.dump.mockReturnValue('yaml content');
      fs.writeFile.mockRejectedValue(new Error('Write error'));
      fs.mkdir.mockResolvedValue();

      await expect(configService.saveConfigAsync()).rejects.toThrow('Write error');
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error saving configuration: Write error')
      );
    });
  });

  describe('getConfig and updateConfig', () => {
    test('should return the current configuration', () => {
      const currentConfig = configService.getConfig();
      expect(currentConfig).toEqual(configService.getDefaultConfig());
    });

    test('should update the configuration', () => {
      const newConfig = { ui: { theme: 'dark' } };
      configService.updateConfig(newConfig);
      expect(configService.getConfig()).toEqual(newConfig);
    });

    test('updateConfig should throw error if config is null or undefined', () => {
      expect(() => configService.updateConfig(null)).toThrow('Config cannot be null or undefined');
      expect(() => configService.updateConfig(undefined)).toThrow(
        'Config cannot be null or undefined'
      );
    });
  });

  describe('Convenience methods for config access', () => {
    beforeEach(() => {
      configService.updateConfig({
        packageManagers: {
          enabledManagers: ['winget', 'npm'],
          settings: {
            npm: { excludedPackages: ['express'] },
          },
        },
        updates: {
          categorySettings: {
            cli: { enabled: false },
          },
        },
        security: {
          verifyHashes: true,
        },
        ui: {
          showAnimations: true,
        },
        logging: {
          level: 'debug',
        },
      });
    });

    test('isPackageManagerEnabled should return correct status', () => {
      expect(configService.isPackageManagerEnabled('winget')).toBe(true);
      expect(configService.isPackageManagerEnabled('scoop')).toBe(false);
    });

    test('shouldAutoUpdate should return correct status', () => {
      expect(configService.shouldAutoUpdate('cli')).toBe(false);
      expect(configService.shouldAutoUpdate('other')).toBe(true); // Default to true
    });

    test('getExcludedPackages should return correct list', () => {
      expect(configService.getExcludedPackages('npm')).toEqual(['express']);
      expect(configService.getExcludedPackages('winget')).toEqual([]);
    });

    test('shouldVerifyHashes should return correct status', () => {
      expect(configService.shouldVerifyHashes()).toBe(true);
    });

    test('getLogLevel should return correct level', () => {
      expect(configService.getLogLevel()).toBe('debug');
    });

    test('shouldShowAnimations should return correct status', () => {
      expect(configService.shouldShowAnimations()).toBe(true);
    });
  });

  describe('Configuration update methods', () => {
    beforeEach(() => {
      configService.updateConfig(configService.getDefaultConfig());
    });

    test('setPackageManagerEnabled should enable a manager', () => {
      configService.setPackageManagerEnabled('scoop', true);
      expect(configService.isPackageManagerEnabled('scoop')).toBe(true);
    });

    test('setPackageManagerEnabled should disable a manager', () => {
      configService.setPackageManagerEnabled('npm', false);
      expect(configService.isPackageManagerEnabled('npm')).toBe(false);
    });

    test('addExcludedPackage should add a package to exclusion list', () => {
      configService.addExcludedPackage('npm', 'jest');
      expect(configService.getExcludedPackages('npm')).toContain('jest');
    });

    test('removeExcludedPackage should remove a package from exclusion list', () => {
      configService.addExcludedPackage('npm', 'jest'); // Add first
      configService.removeExcludedPackage('npm', 'jest');
      expect(configService.getExcludedPackages('npm')).not.toContain('jest');
    });

    test('setUpdateCategoryEnabled should set category status', () => {
      configService.setUpdateCategoryEnabled('cli', false);
      expect(configService.shouldAutoUpdate('cli')).toBe(false);
    });

    test('setSecurityVerification should set security settings', () => {
      configService.setSecurityVerification(false, false);
      expect(configService.shouldVerifyHashes()).toBe(false);
      expect(configService.getConfig().security.checkCertificates).toBe(false);
    });

    test('setUIAnimations should set UI animation settings', () => {
      configService.setUIAnimations(false, 50);
      expect(configService.shouldShowAnimations()).toBe(false);
      expect(configService.getConfig().ui.animationSpeed).toBe(50);
    });

    test('setLoggingLevel should set logging level', () => {
      configService.setLoggingLevel('error');
      expect(configService.getLogLevel()).toBe('error');
    });
  });
});
