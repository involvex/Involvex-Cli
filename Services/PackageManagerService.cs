using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace InvolveX.Cli.Services
{
    public class PackageManagerService
    {
        private readonly LogService _logService;

        public PackageManagerService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<bool> IsWingetInstalled() => await IsCommandInstalled("winget");
        public async Task<bool> IsNpmInstalled() => await IsCommandInstalled("npm");
        public async Task<bool> IsScoopInstalled() => await IsCommandInstalled("scoop");
        public async Task<bool> IsChocoInstalled() => await IsCommandInstalled("choco");

        public async Task UpdateWinget() => await RunUpdateCommand("winget", "update --include-unknown");
        public async Task UpdateNpm() => await RunUpdateCommand("npm", "outdated -g");
        public async Task UpdateScoop() => await RunUpdateCommand("scoop", "update");
        public async Task UpdateChoco() => await RunUpdateCommand("choco", "upgrade all -y");

        public async Task UpdatePowerShellModules()
        {
            _logService.Log("Updating PowerShell modules.");

            try
            {
                // Update modules using Update-Module
                var updateModuleProcess = new Process
                {
                    StartInfo = new ProcessStartInfo()
                    {
                        FileName = "powershell",
                        Arguments = "Update-Module -Force -Confirm:$false",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    }
                };
                updateModuleProcess.Start();

                var stdoutTask = updateModuleProcess.StandardOutput.ReadToEndAsync();
                var stderrTask = updateModuleProcess.StandardError.ReadToEndAsync();

                await Task.WhenAll(stdoutTask, stderrTask);

                _logService.Log($"[Update-Module STDOUT]: {stdoutTask.Result}");
                _logService.Log($"[Update-Module STDERR]: {stderrTask.Result}");

                await updateModuleProcess.WaitForExitAsync();

                if (updateModuleProcess.ExitCode != 0)
                {
                    _logService.Log($"Error updating PowerShell modules. Exit Code: {updateModuleProcess.ExitCode}");
                }

                // Also try Update-PSResource for PowerShell 7+
                var updatePSResourceProcess = new Process
                {
                    StartInfo = new ProcessStartInfo()
                    {
                        FileName = "pwsh",
                        Arguments = "Update-PSResource -Force",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    }
                };

                try
                {
                    updatePSResourceProcess.Start();

                    var psStdoutTask = updatePSResourceProcess.StandardOutput.ReadToEndAsync();
                    var psStderrTask = updatePSResourceProcess.StandardError.ReadToEndAsync();

                    await Task.WhenAll(psStdoutTask, psStderrTask);

                    _logService.Log($"[Update-PSResource STDOUT]: {psStdoutTask.Result}");
                    _logService.Log($"[Update-PSResource STDERR]: {psStderrTask.Result}");

                    await updatePSResourceProcess.WaitForExitAsync();

                    if (updatePSResourceProcess.ExitCode != 0)
                    {
                        _logService.Log($"Error updating PSResources. Exit Code: {updatePSResourceProcess.ExitCode}");
                    }
                }
                catch (Exception ex)
                {
                    _logService.Log($"PowerShell 7+ not available or Update-PSResource failed: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error updating PowerShell modules: {ex.Message}");
            }
        }

        private async Task<bool> IsCommandInstalled(string command)
        {
            try
            {
                var process = new Process()
                {
                    StartInfo = new ProcessStartInfo()
                    {
                        FileName = "where",
                        Arguments = command,
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    }
                };
                process.Start();
                await process.WaitForExitAsync();
                return process.ExitCode == 0;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error checking if {command} is installed: {ex.Message}");
                return false;
            }
        }

        private async Task RunUpdateCommand(string command, string arguments)
        {
            try
            {
                var process = new Process()
                {
                    StartInfo = new ProcessStartInfo()
                    {
                        FileName = command,
                        Arguments = arguments,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    }
                };
                process.Start();

                var stdoutTask = process.StandardOutput.ReadToEndAsync();
                var stderrTask = process.StandardError.ReadToEndAsync();

                await Task.WhenAll(stdoutTask, stderrTask);

                _logService.Log($"[{command} STDOUT]: {stdoutTask.Result}");
                _logService.Log($"[{command} STDERR]: {stderrTask.Result}");

                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    _logService.Log($"Error updating {command}. Exit Code: {process.ExitCode}");
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error running {command} update: {ex.Message}");
            }
        }
    }
}
