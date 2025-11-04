using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using InvolveX.Cli.Models;

namespace InvolveX.Cli.Services
{
    public class PluginService
    {
        private readonly LogService _logService;
        private readonly ConfigService _configService;
        private readonly Dictionary<string, IPlugin> _loadedPlugins;
        private readonly Dictionary<string, PluginMetadata> _pluginMetadata;

        public PluginService(LogService logService, ConfigService configService)
        {
            _logService = logService;
            _configService = configService;
            _loadedPlugins = new Dictionary<string, IPlugin>();
            _pluginMetadata = new Dictionary<string, PluginMetadata>();
        }

        public async Task InitializeAsync()
        {
            _logService.Log("Initializing plugin service...");

            // Create plugins directory if it doesn't exist
            var pluginsDir = GetPluginsDirectory();
            Directory.CreateDirectory(pluginsDir);

            // Load plugin configurations
            await LoadPluginConfigurationsAsync();

            // Load enabled plugins
            await LoadEnabledPluginsAsync();

            _logService.Log($"Plugin service initialized. Loaded {_loadedPlugins.Count} plugins.");
        }

        public async Task ShutdownAsync()
        {
            _logService.Log("Shutting down plugin service...");

            foreach (var plugin in _loadedPlugins.Values)
            {
                try
                {
                    await plugin.ShutdownAsync();
                    _logService.Log($"Plugin '{plugin.Name}' shut down successfully.");
                }
                catch (Exception ex)
                {
                    _logService.Log($"Error shutting down plugin '{plugin.Name}': {ex.Message}");
                }
            }

            _loadedPlugins.Clear();
            _logService.Log("Plugin service shut down.");
        }

        public async Task<PluginLoadResult> LoadPluginAsync(string pluginPath)
        {
            var result = new PluginLoadResult();

            try
            {
                if (!File.Exists(pluginPath))
                {
                    result.ErrorMessage = $"Plugin file not found: {pluginPath}";
                    return result;
                }

                // Load the assembly
                var assembly = Assembly.LoadFrom(pluginPath);

                // Find plugin types
                var pluginTypes = assembly.GetTypes()
                    .Where(t => typeof(IPlugin).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface)
                    .ToList();

                if (!pluginTypes.Any())
                {
                    result.ErrorMessage = $"No plugin types found in assembly: {pluginPath}";
                    return result;
                }

                // For now, load the first plugin type found
                var pluginType = pluginTypes.First();
                var plugin = (IPlugin)Activator.CreateInstance(pluginType);

                if (plugin == null)
                {
                    result.ErrorMessage = $"Failed to create plugin instance: {pluginType.FullName}";
                    return result;
                }

                // Initialize the plugin
                await plugin.InitializeAsync();

                // Create metadata
                var metadata = new PluginMetadata
                {
                    Name = plugin.Name,
                    Description = plugin.Description,
                    Version = plugin.Version,
                    Author = plugin.Author,
                    AssemblyPath = pluginPath,
                    ClassName = pluginType.FullName,
                    Enabled = true
                };

                // Store the plugin
                _loadedPlugins[plugin.Name] = plugin;
                _pluginMetadata[plugin.Name] = metadata;

                result.Success = true;
                result.Plugin = plugin;
                result.Metadata = metadata;

                _logService.Log($"Plugin '{plugin.Name}' loaded successfully from {pluginPath}");
            }
            catch (Exception ex)
            {
                result.ErrorMessage = $"Error loading plugin: {ex.Message}";
                _logService.Log($"Error loading plugin from {pluginPath}: {ex.Message}");
            }

            return result;
        }

        public async Task<bool> UnloadPluginAsync(string pluginName)
        {
            if (!_loadedPlugins.TryGetValue(pluginName, out var plugin))
            {
                _logService.Log($"Plugin '{pluginName}' not found.");
                return false;
            }

            try
            {
                await plugin.ShutdownAsync();
                _loadedPlugins.Remove(pluginName);
                _pluginMetadata.Remove(pluginName);

                _logService.Log($"Plugin '{pluginName}' unloaded successfully.");
                return true;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error unloading plugin '{pluginName}': {ex.Message}");
                return false;
            }
        }

        public async Task<bool> ExecutePluginMenuItemAsync(string pluginName, string menuItem)
        {
            if (!_loadedPlugins.TryGetValue(pluginName, out var plugin))
            {
                _logService.Log($"Plugin '{pluginName}' not found.");
                return false;
            }

            try
            {
                await plugin.ExecuteMenuItemAsync(menuItem);
                _logService.Log($"Executed menu item '{menuItem}' for plugin '{pluginName}'");
                return true;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error executing menu item '{menuItem}' for plugin '{pluginName}': {ex.Message}");
                return false;
            }
        }

        public List<IPlugin> GetLoadedPlugins()
        {
            return _loadedPlugins.Values.ToList();
        }

        public List<string> GetPluginNames()
        {
            return _loadedPlugins.Keys.ToList();
        }

        public IPlugin? GetPlugin(string name)
        {
            return _loadedPlugins.TryGetValue(name, out var plugin) ? plugin : null;
        }

        public async Task<List<string>> GetAllPluginMenuItemsAsync()
        {
            var allMenuItems = new List<string>();

            foreach (var plugin in _loadedPlugins.Values)
            {
                try
                {
                    var menuItems = await plugin.GetMenuItemsAsync();
                    allMenuItems.AddRange(menuItems.Select(item => $"{plugin.Name}: {item}"));
                }
                catch (Exception ex)
                {
                    _logService.Log($"Error getting menu items for plugin '{plugin.Name}': {ex.Message}");
                }
            }

            return allMenuItems;
        }

        public async Task<bool> InstallPluginAsync(string pluginPath)
        {
            try
            {
                var fileName = Path.GetFileName(pluginPath);
                var destinationPath = Path.Combine(GetPluginsDirectory(), fileName);

                // Copy the plugin file
                File.Copy(pluginPath, destinationPath, true);

                // Try to load it
                var result = await LoadPluginAsync(destinationPath);

                if (result.Success && result.Metadata != null)
                {
                    // Save configuration
                    await SavePluginConfigurationAsync(result.Metadata);
                    _logService.Log($"Plugin '{result.Metadata.Name}' installed successfully.");
                    return true;
                }
                else
                {
                    // Clean up on failure
                    if (File.Exists(destinationPath))
                    {
                        File.Delete(destinationPath);
                    }
                    _logService.Log($"Failed to install plugin: {result.ErrorMessage}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error installing plugin: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> UninstallPluginAsync(string pluginName)
        {
            try
            {
                // Unload the plugin
                var unloaded = await UnloadPluginAsync(pluginName);
                if (!unloaded)
                {
                    return false;
                }

                // Remove the plugin file
                if (_pluginMetadata.TryGetValue(pluginName, out var metadata))
                {
                    if (File.Exists(metadata.AssemblyPath))
                    {
                        File.Delete(metadata.AssemblyPath);
                    }

                    // Remove from configuration
                    await RemovePluginConfigurationAsync(pluginName);
                }

                _logService.Log($"Plugin '{pluginName}' uninstalled successfully.");
                return true;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error uninstalling plugin '{pluginName}': {ex.Message}");
                return false;
            }
        }

        private string GetPluginsDirectory()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "InvolveX",
                "Plugins"
            );
        }

        private async Task LoadPluginConfigurationsAsync()
        {
            try
            {
                var config = _configService.GetConfig();
                // Plugin configurations would be stored in the main config
                // For now, we'll scan the plugins directory
            }
            catch (Exception ex)
            {
                _logService.Log($"Error loading plugin configurations: {ex.Message}");
            }
        }

        private async Task LoadEnabledPluginsAsync()
        {
            try
            {
                var pluginsDir = GetPluginsDirectory();
                if (!Directory.Exists(pluginsDir))
                {
                    return;
                }

                var pluginFiles = Directory.GetFiles(pluginsDir, "*.dll");
                foreach (var pluginFile in pluginFiles)
                {
                    try
                    {
                        await LoadPluginAsync(pluginFile);
                    }
                    catch (Exception ex)
                    {
                        _logService.Log($"Error loading plugin {pluginFile}: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error loading enabled plugins: {ex.Message}");
            }
        }

        private async Task SavePluginConfigurationAsync(PluginMetadata metadata)
        {
            // This would save plugin metadata to config
            // For now, we'll just log it
            _logService.Log($"Plugin configuration saved for: {metadata.Name}");
        }

        private async Task RemovePluginConfigurationAsync(string pluginName)
        {
            // This would remove plugin metadata from config
            _logService.Log($"Plugin configuration removed for: {pluginName}");
        }
    }
}
