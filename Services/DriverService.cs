using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace InvolveX.Cli.Services
{
    public class DriverService
    {
        private readonly LogService _logService;

        public DriverService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<List<string>> DetectDrivers()
        {
            _logService.Log("Detecting installed drivers.");
            var drivers = new List<string>();

            try
            {
                // Query Device Manager for installed drivers
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = "Get-WmiObject Win32_PnPSignedDriver | Select-Object DeviceName, DriverVersion, Manufacturer | Format-Table -AutoSize",
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
                    // Parse the output and add to drivers list
                    var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines.Skip(2)) // Skip header lines
                    {
                        if (!string.IsNullOrWhiteSpace(line) && !line.Contains("---"))
                        {
                            drivers.Add(line.Trim());
                        }
                    }
                    _logService.Log($"Detected {drivers.Count} drivers.");
                }
                else
                {
                    _logService.Log($"Error detecting drivers: {error}");
                    drivers.Add("Error: Could not retrieve driver information");
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception detecting drivers: {ex.Message}");
                drivers.Add($"Error: {ex.Message}");
            }

            return drivers;
        }

        public async Task<bool> UpdateDriver(string driverName)
        {
            _logService.Log($"Attempting to update driver: {driverName}");

            try
            {
                // Use pnputil.exe to enumerate and update drivers
                // Note: This is a simplified approach. Real driver updates often require specific manufacturer tools
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "pnputil.exe",
                        Arguments = "/enum-drivers",
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
                    _logService.Log($"Driver enumeration successful. Manual update may be required for: {driverName}");
                    return true;
                }
                else
                {
                    _logService.Log($"Error enumerating drivers: {error}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception updating driver {driverName}: {ex.Message}");
                return false;
            }
        }

        public async Task<List<string>> CheckForDriverUpdates()
        {
            _logService.Log("Checking for driver updates.");
            var updates = new List<string>();

            try
            {
                // This is a simplified check. In a real implementation, you might integrate with
                // Windows Update API or manufacturer-specific update tools
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = "Get-WindowsUpdate | Where-Object { $_.Categories -like '*Driver*' } | Select-Object Title",
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
                    foreach (var line in lines.Skip(1)) // Skip header
                    {
                        if (!string.IsNullOrWhiteSpace(line))
                        {
                            updates.Add(line.Trim());
                        }
                    }
                }
                else
                {
                    updates.Add("Could not check for driver updates automatically");
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception checking for driver updates: {ex.Message}");
                updates.Add($"Error checking updates: {ex.Message}");
            }

            return updates;
        }
    }
}
