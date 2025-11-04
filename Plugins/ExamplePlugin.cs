using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using InvolveX.Cli.Models;
using Terminal.Gui;

namespace InvolveX.Cli.Plugins
{
    public class ExamplePlugin : BasePlugin
    {
        public override string Name => "Example Plugin";
        public override string Description => "A sample plugin demonstrating the plugin system";
        public override string Version => "1.0.0";
        public override string Author => "InvolveX Team";

        public override List<string> MenuItems => new()
        {
            "Show System Info",
            "Display Message",
            "Run Custom Command"
        };

        public override async Task InitializeAsync()
        {
            // Plugin initialization logic
            await Task.Delay(100); // Simulate initialization
            Console.WriteLine($"Plugin '{Name}' initialized.");
        }

        public override async Task ShutdownAsync()
        {
            // Plugin cleanup logic
            await Task.Delay(50); // Simulate cleanup
            Console.WriteLine($"Plugin '{Name}' shut down.");
        }

        public override async Task ExecuteMenuItemAsync(string menuItem)
        {
            switch (menuItem)
            {
                case "Show System Info":
                    await ShowSystemInfoAsync();
                    break;
                case "Display Message":
                    await DisplayCustomMessageAsync();
                    break;
                case "Run Custom Command":
                    await RunCustomCommandAsync();
                    break;
                default:
                    Console.WriteLine($"Unknown menu item: {menuItem}");
                    break;
            }
        }

        private async Task ShowSystemInfoAsync()
        {
            var info = new Dictionary<string, object>
            {
                ["Plugin Name"] = Name,
                ["Plugin Version"] = Version,
                ["Plugin Author"] = Author,
                [".NET Version"] = Environment.Version.ToString(),
                ["OS Version"] = Environment.OSVersion.ToString(),
                ["Current Time"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            };

            // In a real implementation, this would show a dialog
            // For now, we'll just log the information
            foreach (var item in info)
            {
                Console.WriteLine($"{item.Key}: {item.Value}");
            }

            await Task.CompletedTask;
        }

        private async Task DisplayCustomMessageAsync()
        {
            var message = $"Hello from {Name} plugin!\n\nThis is a demonstration of the plugin system.\n\nCurrent time: {DateTime.Now:HH:mm:ss}";
            Console.WriteLine(message);

            await Task.CompletedTask;
        }

        private async Task RunCustomCommandAsync()
        {
            try
            {
                // Example: Run a simple command
                var startInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c echo Plugin executed: Hello World!",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = System.Diagnostics.Process.Start(startInfo))
                {
                    if (process != null)
                    {
                        var output = await process.StandardOutput.ReadToEndAsync();
                        await process.WaitForExitAsync();
                        Console.WriteLine($"Command output: {output.Trim()}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error running custom command: {ex.Message}");
            }
        }
    }
}
