using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace InvolveX.Cli.Services
{
    public class UninstallerService
    {
        private readonly LogService _logService;

        public UninstallerService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<List<string>> ListInstalledPrograms()
        {
            _logService.Log("Listing installed programs from registry.");
            var programs = new List<string>();

            try
            {
                // Check both 32-bit and 64-bit uninstall registry keys
                var uninstallKeys = new[]
                {
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
                };

                foreach (var keyPath in uninstallKeys)
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(keyPath))
                    {
                        if (key != null)
                        {
                            foreach (var subKeyName in key.GetSubKeyNames())
                            {
                                using (var subKey = key.OpenSubKey(subKeyName))
                                {
                                    if (subKey != null)
                                    {
                                        var displayName = subKey.GetValue("DisplayName") as string;
                                        var displayVersion = subKey.GetValue("DisplayVersion") as string;
                                        var publisher = subKey.GetValue("Publisher") as string;
                                        var uninstallString = subKey.GetValue("UninstallString") as string;

                                        if (!string.IsNullOrEmpty(displayName))
                                        {
                                            var programInfo = displayName;
                                            if (!string.IsNullOrEmpty(displayVersion))
                                                programInfo += $" (v{displayVersion})";
                                            if (!string.IsNullOrEmpty(publisher))
                                                programInfo += $" - {publisher}";
                                            if (!string.IsNullOrEmpty(uninstallString))
                                                programInfo += " [Uninstallable]";

                                            programs.Add(programInfo);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Also check user-specific installations
                using (var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"))
                {
                    if (key != null)
                    {
                        foreach (var subKeyName in key.GetSubKeyNames())
                        {
                            using (var subKey = key.OpenSubKey(subKeyName))
                            {
                                if (subKey != null)
                                {
                                    var displayName = subKey.GetValue("DisplayName") as string;
                                    var displayVersion = subKey.GetValue("DisplayVersion") as string;
                                    var publisher = subKey.GetValue("Publisher") as string;

                                    if (!string.IsNullOrEmpty(displayName))
                                    {
                                        var programInfo = $"[User] {displayName}";
                                        if (!string.IsNullOrEmpty(displayVersion))
                                            programInfo += $" (v{displayVersion})";
                                        if (!string.IsNullOrEmpty(publisher))
                                            programInfo += $" - {publisher}";

                                        programs.Add(programInfo);
                                    }
                                }
                            }
                        }
                    }
                }

                _logService.Log($"Found {programs.Count} installed programs.");
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception listing installed programs: {ex.Message}");
                programs.Add($"Error: {ex.Message}");
            }

            return programs;
        }

        public async Task<bool> UninstallProgram(string programName)
        {
            _logService.Log($"Attempting to uninstall program: {programName}");

            try
            {
                // Find the uninstall string for the program
                string uninstallString = null;
                var uninstallKeys = new[]
                {
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
                };

                foreach (var keyPath in uninstallKeys)
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(keyPath))
                    {
                        if (key != null)
                        {
                            foreach (var subKeyName in key.GetSubKeyNames())
                            {
                                using (var subKey = key.OpenSubKey(subKeyName))
                                {
                                    if (subKey != null)
                                    {
                                        var displayName = subKey.GetValue("DisplayName") as string;
                                        if (!string.IsNullOrEmpty(displayName) &&
                                            displayName.IndexOf(programName, StringComparison.OrdinalIgnoreCase) >= 0)
                                        {
                                            uninstallString = subKey.GetValue("UninstallString") as string;
                                            if (!string.IsNullOrEmpty(uninstallString))
                                                break;
                                        }
                                    }
                                }
                                if (!string.IsNullOrEmpty(uninstallString))
                                    break;
                            }
                        }
                    }
                    if (!string.IsNullOrEmpty(uninstallString))
                        break;
                }

                if (string.IsNullOrEmpty(uninstallString))
                {
                    _logService.Log($"Could not find uninstall string for: {programName}");
                    return false;
                }

                // Execute the uninstall string
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = $"/c \"{uninstallString}\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                await process.WaitForExitAsync();

                if (process.ExitCode == 0)
                {
                    _logService.Log($"Successfully initiated uninstall for: {programName}");
                    return true;
                }
                else
                {
                    _logService.Log($"Uninstall process exited with code {process.ExitCode} for: {programName}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception uninstalling program {programName}: {ex.Message}");
                return false;
            }
        }
    }
}
