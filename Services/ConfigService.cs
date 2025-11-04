using System;
using System.IO;
using System.Threading.Tasks;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using InvolveX.Cli.Models;

namespace InvolveX.Cli.Services
{
    public class ConfigService
    {
        private readonly LogService _logService;
        private readonly string _configPath;
        private AppConfig _config;

        public ConfigService(LogService logService)
        {
            _logService = logService;
            _configPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "InvolveX",
                "config.yaml"
            );
            _config = new AppConfig();
        }

        public async Task LoadConfigAsync()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var yaml = await File.ReadAllTextAsync(_configPath);
                    var deserializer = new DeserializerBuilder()
                        .WithNamingConvention(UnderscoredNamingConvention.Instance)
                        .Build();

                    _config = deserializer.Deserialize<AppConfig>(yaml) ?? new AppConfig();
                    _logService.Log("Configuration loaded successfully.");
                }
                else
                {
                    // Create default config
                    _config = new AppConfig();
                    await SaveConfigAsync();
                    _logService.Log("Default configuration created.");
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error loading configuration: {ex.Message}. Using defaults.");
                _config = new AppConfig();
            }
        }

        public async Task SaveConfigAsync()
        {
            try
            {
                var directory = Path.GetDirectoryName(_configPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var serializer = new SerializerBuilder()
                    .WithNamingConvention(UnderscoredNamingConvention.Instance)
                    .Build();

                var yaml = serializer.Serialize(_config);
                await File.WriteAllTextAsync(_configPath, yaml);
                _logService.Log("Configuration saved successfully.");
            }
            catch (Exception ex)
            {
                _logService.Log($"Error saving configuration: {ex.Message}");
                throw;
            }
        }

        public AppConfig GetConfig() => _config;

        public void UpdateConfig(AppConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        // Convenience methods for common config access
        public bool IsPackageManagerEnabled(string manager) =>
            _config.PackageManagers.EnabledManagers.Contains(manager);

        public bool ShouldAutoUpdate(string category) =>
            _config.Updates.CategorySettings.TryGetValue(category, out var settings)
                ? settings.Enabled
                : true;

        public List<string> GetExcludedPackages(string manager) =>
            _config.PackageManagers.Settings.TryGetValue(manager, out var settings)
                ? settings.ExcludedPackages
                : new List<string>();

        public bool ShouldVerifyHashes() => _config.Security.VerifyHashes;

        public string GetLogLevel() => _config.Logging.Level;

        public bool ShouldShowAnimations() => _config.UI.ShowAnimations;

        // Configuration update methods
        public void SetPackageManagerEnabled(string manager, bool enabled)
        {
            if (enabled && !_config.PackageManagers.EnabledManagers.Contains(manager))
            {
                _config.PackageManagers.EnabledManagers.Add(manager);
            }
            else if (!enabled)
            {
                _config.PackageManagers.EnabledManagers.Remove(manager);
            }
        }

        public void AddExcludedPackage(string manager, string package)
        {
            if (!_config.PackageManagers.Settings.ContainsKey(manager))
            {
                _config.PackageManagers.Settings[manager] = new Models.PackageManagerSettings();
            }

            if (!_config.PackageManagers.Settings[manager].ExcludedPackages.Contains(package))
            {
                _config.PackageManagers.Settings[manager].ExcludedPackages.Add(package);
            }
        }

        public void RemoveExcludedPackage(string manager, string package)
        {
            if (_config.PackageManagers.Settings.ContainsKey(manager))
            {
                _config.PackageManagers.Settings[manager].ExcludedPackages.Remove(package);
            }
        }

        public void SetUpdateCategoryEnabled(string category, bool enabled)
        {
            if (!_config.Updates.CategorySettings.ContainsKey(category))
            {
                _config.Updates.CategorySettings[category] = new Models.UpdateSettings();
            }

            _config.Updates.CategorySettings[category].Enabled = enabled;
        }

        public void SetSecurityVerification(bool verifyHashes, bool checkCertificates)
        {
            _config.Security.VerifyHashes = verifyHashes;
            _config.Security.CheckCertificates = checkCertificates;
        }

        public void SetUIAnimations(bool enabled, int speed = 100)
        {
            _config.UI.ShowAnimations = enabled;
            _config.UI.AnimationSpeed = speed;
        }

        public void SetLoggingLevel(string level)
        {
            _config.Logging.Level = level;
        }
    }
}
