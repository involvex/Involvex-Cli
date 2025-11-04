using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
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

        public async Task<string> RunPingTest(string host, CancellationToken cancellationToken = default)
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

                // Create tasks for reading output and waiting for exit
                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();
                var exitTask = process.WaitForExitAsync();

                // Wait for all tasks with cancellation support
                var completedTask = await Task.WhenAny(
                    Task.WhenAll(outputTask, errorTask, exitTask),
                    Task.Delay(Timeout.Infinite, cancellationToken)
                );

                if (cancellationToken.IsCancellationRequested)
                {
                    try
                    {
                        if (!process.HasExited)
                        {
                            process.Kill();
                            _logService.Log("Ping test cancelled by user");
                            return "Ping test cancelled by user.";
                        }
                    }
                    catch (Exception killEx)
                    {
                        _logService.Log($"Error killing ping process: {killEx.Message}");
                    }
                }

                string stdout = await outputTask;
                string stderr = await errorTask;

                _logService.Log($"[ping STDOUT]: {stdout}");
                _logService.Log($"[ping STDERR]: {stderr}");

                if (process.ExitCode != 0)
                {
                    return $"Ping test completed with warnings:\n{stdout}\n\nErrors:\n{stderr}";
                }

                return stdout;
            }
            catch (OperationCanceledException)
            {
                _logService.Log("Ping test was cancelled");
                return "Ping test cancelled.";
            }
            catch (Exception ex)
            {
                _logService.Log($"Error running ping test: {ex.Message}");
                return $"Error running ping test: {ex.Message}";
            }
        }

        public async Task<string> RunSpeedTest()
        {
            _logService.Log("Running internet speed test using Python speedtest service.");

            try
            {
                // Get the path to the Python script
                var scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Services", "Speedtest.py");

                if (!File.Exists(scriptPath))
                {
                    return "Error: Speedtest service not found. Please ensure Speedtest.py exists in the Services directory.";
                }

                // Check if Python is available
                var pythonCheckProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                pythonCheckProcess.Start();
                await pythonCheckProcess.WaitForExitAsync();

                string pythonCommand = "python";
                if (pythonCheckProcess.ExitCode != 0)
                {
                    // Try python3
                    var python3CheckProcess = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "python3",
                            Arguments = "--version",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    };

                    python3CheckProcess.Start();
                    await python3CheckProcess.WaitForExitAsync();

                    if (python3CheckProcess.ExitCode != 0)
                    {
                        return "Error: Python is not installed or not available in PATH. Please install Python 3.x to use speedtest.";
                    }

                    pythonCommand = "python3";
                }

                // Run the Python speedtest script
                var speedTestProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = pythonCommand,
                        Arguments = $"\"{scriptPath}\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WorkingDirectory = Path.GetDirectoryName(scriptPath) ?? AppDomain.CurrentDomain.BaseDirectory
                    }
                };

                speedTestProcess.Start();
                string output = await speedTestProcess.StandardOutput.ReadToEndAsync();
                string error = await speedTestProcess.StandardError.ReadToEndAsync();
                await speedTestProcess.WaitForExitAsync();

                if (speedTestProcess.ExitCode == 0)
                {
                    _logService.Log("Speed test completed successfully.");
                    return output.Trim();
                }
                else
                {
                    _logService.Log($"Speed test failed with exit code {speedTestProcess.ExitCode}: {error}");
                    return $"Speed test failed: {error}\nOutput: {output}".Trim();
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
