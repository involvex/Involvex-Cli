using System;
using System.Diagnostics;
using System.Threading.Tasks;
using InvolveX.Cli.Utils;

using System.Runtime.Versioning;

namespace InvolveX.Cli.Services
{
    [SupportedOSPlatform("windows")]
    public class DnsService
    {
        private readonly LogService _logService;

        public DnsService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<bool> SetDns(string primaryDns, string secondaryDns)
        {
            if (!WindowsUtils.IsUserAnAdmin())
            {
                _logService.Log("Error: Administrator privileges are required to set DNS servers.");
                return false;
            }

            try
            {
                // Set primary DNS
                var result1 = await RunNetshCommand(
                    $"interface ip set dns name=\"Ethernet\" static {primaryDns} primary");
                if (result1.ExitCode != 0) return false;

                // Add secondary DNS
                var result2 = await RunNetshCommand(
                    $"interface ip add dns name=\"Ethernet\" {secondaryDns} index=2");
                return result2.ExitCode == 0;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error setting DNS: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> ResetDns()
        {
            if (!WindowsUtils.IsUserAnAdmin())
            {
                _logService.Log("Error: Administrator privileges are required to reset DNS servers.");
                return false;
            }

            try
            {
                var result = await RunNetshCommand("interface ip set dns name=\"Ethernet\" dhcp");
                return result.ExitCode == 0;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error resetting DNS: {ex.Message}");
                return false;
            }
        }

        private async Task<ProcessResult> RunNetshCommand(string arguments)
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "netsh",
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

            _logService.Log($"[netsh STDOUT]: {stdout}");
            _logService.Log($"[netsh STDERR]: {stderr}");

            return new ProcessResult(process.ExitCode, stdout, stderr);
        }

        private class ProcessResult
        {
            public int ExitCode { get; } // Changed from private set to public get
            public string StdOut { get; } // Changed from private set to public get
            public string StdErr { get; } // Changed from private set to public get

            public ProcessResult(int exitCode, string stdOut, string stdErr)
            {
                ExitCode = exitCode;
                StdOut = stdOut;
                StdErr = stdErr;
            }
        }
    }
}
