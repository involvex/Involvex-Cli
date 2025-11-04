using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace InvolveX.Cli.Services
{
    public class StartupService
    {
        private readonly LogService _logService;

        public StartupService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<List<string>> ListStartupPrograms()
        {
            _logService.Log("Listing startup programs from registry and Task Scheduler.");
            var startupPrograms = new List<string>();

            try
            {
                // Check Run registry keys
                var runKeys = new[]
                {
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce"
                };

                foreach (var keyPath in runKeys)
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(keyPath))
                    {
                        if (key != null)
                        {
                            foreach (var valueName in key.GetValueNames())
                            {
                                var value = key.GetValue(valueName);
                                if (value != null)
                                {
                                    startupPrograms.Add($"Registry ({keyPath}): {valueName} -> {value}");
                                }
                            }
                        }
                    }

                    using (var key = Registry.CurrentUser.OpenSubKey(keyPath))
                    {
                        if (key != null)
                        {
                            foreach (var valueName in key.GetValueNames())
                            {
                                var value = key.GetValue(valueName);
                                if (value != null)
                                {
                                    startupPrograms.Add($"Registry (CurrentUser): {valueName} -> {value}");
                                }
                            }
                        }
                    }
                }

                // Check Startup folder
                var startupFolder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                if (System.IO.Directory.Exists(startupFolder))
                {
                    var files = System.IO.Directory.GetFiles(startupFolder);
                    foreach (var file in files)
                    {
                        startupPrograms.Add($"Startup Folder: {System.IO.Path.GetFileName(file)}");
                    }
                }

                // Check Task Scheduler startup tasks
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "schtasks",
                        Arguments = "/query /tn \"\\Microsoft\\Windows\\*\" /fo csv /nh",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                string output = await process.StandardOutput.ReadToEndAsync();
                string error = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        if (!string.IsNullOrWhiteSpace(line) && line.Contains("Ready") || line.Contains("Running"))
                        {
                            var parts = line.Split(',');
                            if (parts.Length > 0)
                            {
                                startupPrograms.Add($"Task Scheduler: {parts[0].Trim('\"')}");
                            }
                        }
                    }
                }

                _logService.Log($"Found {startupPrograms.Count} startup programs.");
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception listing startup programs: {ex.Message}");
                startupPrograms.Add($"Error: {ex.Message}");
            }

            return startupPrograms;
        }

        public async Task<bool> DisableStartupProgram(string programName)
        {
            _logService.Log($"Attempting to disable startup program: {programName}");

            try
            {
                // This is a simplified implementation. In practice, you'd need to identify
                // the source (registry, startup folder, task scheduler) and handle accordingly
                var runKeys = new[]
                {
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce"
                };

                foreach (var keyPath in runKeys)
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(keyPath, true))
                    {
                        if (key != null && Array.Exists(key.GetValueNames(), name => name.Equals(programName, StringComparison.OrdinalIgnoreCase)))
                        {
                            key.DeleteValue(programName);
                            _logService.Log($"Disabled startup program from registry: {programName}");
                            return true;
                        }
                    }

                    using (var key = Registry.CurrentUser.OpenSubKey(keyPath, true))
                    {
                        if (key != null && Array.Exists(key.GetValueNames(), name => name.Equals(programName, StringComparison.OrdinalIgnoreCase)))
                        {
                            key.DeleteValue(programName);
                            _logService.Log($"Disabled startup program from registry: {programName}");
                            return true;
                        }
                    }
                }

                // For Task Scheduler items, this would require more complex logic
                // For now, we'll log that manual intervention may be needed
                _logService.Log($"Could not automatically disable: {programName}. Manual intervention may be required.");
                return false;
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception disabling startup program {programName}: {ex.Message}");
                return false;
            }
        }
    }
}
