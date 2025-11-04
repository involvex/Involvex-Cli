using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Runtime.Versioning;
using InvolveX.Cli.Utils;

namespace InvolveX.Cli.Services
{
    [SupportedOSPlatform("windows")]
    public class SystemRestoreService
    {
        private readonly LogService _logService;

        public SystemRestoreService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<bool> CreateRestorePoint(string description)
        {
            if (!WindowsUtils.IsUserAnAdmin())
            {
                _logService.Log("Error: Administrator privileges are required to create a system restore point.");
                return false;
            }

            try
            {
                // wmic /namespace:\root\default path SystemRestore call CreateRestorePoint "My Restore Point", 100, 7
                var arguments = $@"/namespace:\\root\default path SystemRestore call CreateRestorePoint ""{description}"", 100, 7";
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "wmic",
                        Arguments = arguments,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                string stdout = await process.StandardOutput.ReadToEndAsync();
                string stderr = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                _logService.Log($"[wmic STDOUT]: {stdout}");
                _logService.Log($"[wmic STDERR]: {stderr}");

                return process.ExitCode == 0;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error creating restore point: {ex.Message}");
                return false;
            }
        }
    }
}