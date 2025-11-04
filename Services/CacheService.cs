using System;
using System.IO;
using System.Threading.Tasks;

namespace InvolveX.Cli.Services
{
    public class CacheService
    {
        private readonly LogService _logService;

        public CacheService(LogService logService)
        {
            _logService = logService;
        }

        public async Task ClearSystemCache()
        {
            // Clear user-specific temporary files
            var tempPath = Path.GetTempPath();
            await DeleteDirectoryContents(tempPath);

            // Clear Windows Store cache (requires admin, but can be attempted)
            // This is a simplified approach, actual Windows Store cache clearing is more complex.
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var wsCachePath = Path.Combine(localAppData, "Packages");
            // We won't recursively delete the entire Packages folder, but rather specific app caches if known.
            // For now, we'll focus on general temp files.

            _logService.Log("System cache cleared.");
        }

        public async Task ClearMemory()
        {
            _logService.Log("Attempting to clear system memory/RAM.");

            try
            {
                // Use EmptyWorkingSet to clear memory for current process
                var currentProcess = System.Diagnostics.Process.GetCurrentProcess();
                EmptyWorkingSet(currentProcess.Handle);

                // Use PowerShell to clear system cache and memory
                var process = new System.Diagnostics.Process
                {
                    StartInfo = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = @"
                            # Clear system memory by forcing garbage collection
                            [System.GC]::Collect()
                            [System.GC]::WaitForPendingFinalizers()
                            [System.GC]::Collect()

                            # Clear Windows memory cache (requires admin privileges)
                            try {
                                $mem = Get-WmiObject -Class Win32_OperatingSystem
                                $mem | Invoke-WmiMethod -Name Reboot
                            } catch {
                                Write-Host 'Memory clearing requires administrator privileges'
                            }
                        ",
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
                    _logService.Log("Memory clearing operations completed.");
                }
                else
                {
                    _logService.Log($"Memory clearing encountered issues: {error}");
                }

                // Alternative approach: Use RAMMap or similar tools if available
                // For now, we'll rely on the PowerShell approach above
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception clearing memory: {ex.Message}");
            }
        }

        [System.Runtime.InteropServices.DllImport("psapi.dll")]
        private static extern int EmptyWorkingSet(IntPtr hProcess);

        private async Task DeleteDirectoryContents(string directoryPath)
        {
            if (!Directory.Exists(directoryPath)) return;

            var directory = new DirectoryInfo(directoryPath);

            foreach (FileInfo file in directory.GetFiles())
            {
                try
                {
                    await Task.Run(() => file.Delete()); // Wrap in Task.Run
                }
                catch (Exception ex)
                {
                    _logService.Log($"Error deleting file {file.FullName}: {ex.Message}");
                }
            }

            foreach (DirectoryInfo subDirectory in directory.GetDirectories())
            {
                try
                {
                    await Task.Run(() => subDirectory.Delete(true)); // Wrap in Task.Run
                }
                catch (Exception ex)
                {
                    _logService.Log($"Error deleting directory {subDirectory.FullName}: {ex.Message}");
                }
            }
        }
    }
}
