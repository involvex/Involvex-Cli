using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace InvolveX.Cli.Services
{
    public class NetworkService
    {
        private readonly LogService _logService;

        public NetworkService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<string> RunPingTest(string host)
        {
            try
            {
                // Validate host input
                if (string.IsNullOrWhiteSpace(host))
                {
                    return "Error: Host cannot be empty";
                }

                // Use ping with 4 packets and timeout for better reliability
                var arguments = $"-n 4 -w 5000 {host}";

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "ping",
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

                _logService.Log($"[ping STDOUT]: {stdout}");
                _logService.Log($"[ping STDERR]: {stderr}");

                if (process.ExitCode != 0)
                {
                    return $"Ping test completed with warnings:\n{stdout}\n\nErrors:\n{stderr}";
                }

                return stdout;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error running ping test: {ex.Message}");
                return $"Error running ping test: {ex.Message}";
            }
        }

        public async Task<string> RunSpeedTest()
        {
            _logService.Log("Running internet speed test using speedtest CLI.");

            try
            {
                // Check if speedtest CLI is installed
                var checkProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "speedtest",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                checkProcess.Start();
                await checkProcess.WaitForExitAsync();

                if (checkProcess.ExitCode != 0)
                {
                    // Try to install speedtest CLI if not available
                    _logService.Log("Speedtest CLI not found, attempting to install...");

                    var installProcess = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "powershell",
                            Arguments = "winget install --id Ookla.Speedtest.CLI --accept-source-agreements --accept-package-agreements",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    };

                    installProcess.Start();
                    string installOutput = await installProcess.StandardOutput.ReadToEndAsync();
                    string installError = await installProcess.StandardError.ReadToEndAsync();
                    await installProcess.WaitForExitAsync();

                    if (installProcess.ExitCode != 0)
                    {
                        return $"Failed to install speedtest CLI. Error: {installError}";
                    }

                    _logService.Log("Speedtest CLI installed successfully.");
                }

                // Run the speed test
                var speedTestProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "speedtest",
                        Arguments = "--accept-license --accept-gdpr",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                speedTestProcess.Start();
                string output = await speedTestProcess.StandardOutput.ReadToEndAsync();
                string error = await speedTestProcess.StandardError.ReadToEndAsync();
                await speedTestProcess.WaitForExitAsync();

                if (speedTestProcess.ExitCode == 0)
                {
                    _logService.Log("Speed test completed successfully.");
                    return output;
                }
                else
                {
                    _logService.Log($"Speed test failed with exit code {speedTestProcess.ExitCode}: {error}");
                    return $"Speed test failed: {error}";
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception running speed test: {ex.Message}");
                return $"Error running speed test: {ex.Message}";
            }
        }
    }
}
