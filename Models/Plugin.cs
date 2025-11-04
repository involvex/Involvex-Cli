using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace InvolveX.Cli.Models
{
    public interface IPlugin
    {
        string Name { get; }
        string Description { get; }
        string Version { get; }
        string Author { get; }
        List<string> MenuItems { get; }

        Task InitializeAsync();
        Task ShutdownAsync();
        Task ExecuteMenuItemAsync(string menuItem);
        Task<List<string>> GetMenuItemsAsync();
    }

    public abstract class BasePlugin : IPlugin
    {
        public abstract string Name { get; }
        public abstract string Description { get; }
        public abstract string Version { get; }
        public abstract string Author { get; }

        public virtual List<string> MenuItems => new();

        public virtual Task InitializeAsync()
        {
            return Task.CompletedTask;
        }

        public virtual Task ShutdownAsync()
        {
            return Task.CompletedTask;
        }

        public virtual Task ExecuteMenuItemAsync(string menuItem)
        {
            return Task.CompletedTask;
        }

        public virtual Task<List<string>> GetMenuItemsAsync()
        {
            return Task.FromResult(MenuItems);
        }
    }

    public class PluginMetadata
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public string AssemblyPath { get; set; } = string.Empty;
        public string ClassName { get; set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public Dictionary<string, string> Settings { get; set; } = new();
    }

    public class PluginLoadResult
    {
        public bool Success { get; set; }
        public IPlugin? Plugin { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
        public PluginMetadata? Metadata { get; set; }
    }
}
