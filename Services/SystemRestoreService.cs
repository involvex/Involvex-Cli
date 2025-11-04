using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace InvolveX.Cli.Services
{
    public class SystemRestoreService
    {
        private readonly LogService _logService;

        public SystemRestoreService(LogService logService)
        {
            _logService = logService;
        }

        public async Task<bool> CreateRestorePoint(string description = "InvolveX CLI Manual Restore Point")
        {
            try
            {
                _logService.Log($"Creating system restore point: {description}");

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"-Command \"Checkpoint-Computer -Description '{description}' -RestorePointType 'MODIFY_SETTINGS'\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        Verb = "runas" // Request admin privileges
                    }
                };

                process.Start();

                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();

                await Task.WhenAll(outputTask, errorTask);
                await process.WaitForExitAsync();

                var output = outputTask.Result;
                var error = errorTask.Result;

                _logService.Log($"[Create Restore Point STDOUT]: {output}");
                _logService.Log($"[Create Restore Point STDERR]: {error}");

                if (process.ExitCode == 0)
                {
                    _logService.Log("System restore point created successfully");
                    return true;
                }
                else
                {
                    _logService.Log($"Failed to create restore point. Exit code: {process.ExitCode}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception creating restore point: {ex.Message}");
                return false;
            }
        }

        public async Task<string> ListRestorePoints()
        {
            try
            {
                _logService.Log("Listing system restore points");

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = "-Command \"Get-ComputerRestorePoint | Select-Object -Property SequenceNumber, Description, CreationTime, RestorePointType | Sort-Object -Property CreationTime -Descending | Format-Table -AutoSize\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();

                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();

                await Task.WhenAll(outputTask, errorTask);
                await process.WaitForExitAsync();

                var output = outputTask.Result;
                var error = errorTask.Result;

                _logService.Log($"[List Restore Points STDOUT]: {output}");
                _logService.Log($"[List Restore Points STDERR]: {error}");

                if (process.ExitCode == 0)
                {
                    return string.IsNullOrWhiteSpace(output) ? "No restore points found." : output;
                }
                else
                {
                    return $"Error listing restore points: {error}";
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception listing restore points: {ex.Message}");
                return $"Error: {ex.Message}";
            }
        }

        public async Task<bool> DeleteRestorePoint(int sequenceNumber)
        {
            try
            {
                _logService.Log($"Deleting restore point with sequence number: {sequenceNumber}");

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"-Command \"Remove-ComputerRestorePoint -SequenceNumber {sequenceNumber} -Confirm:$false\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        Verb = "runas" // Request admin privileges
                    }
                };

                process.Start();

                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();

                await Task.WhenAll(outputTask, errorTask);
                await process.WaitForExitAsync();

                var output = outputTask.Result;
                var error = errorTask.Result;

                _logService.Log($"[Delete Restore Point STDOUT]: {output}");
                _logService.Log($"[Delete Restore Point STDERR]: {error}");

                if (process.ExitCode == 0)
                {
                    _logService.Log("System restore point deleted successfully");
                    return true;
                }
                else
                {
                    _logService.Log($"Failed to delete restore point. Exit code: {process.ExitCode}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception deleting restore point: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> DeleteOldRestorePoints(int keepCount = 5)
        {
            try
            {
                _logService.Log($"Deleting old restore points, keeping {keepCount} most recent");

                // First get all restore points
                var listProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = "-Command \"Get-ComputerRestorePoint | Select-Object -Property SequenceNumber | Sort-Object -Property SequenceNumber -Descending\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                listProcess.Start();

                var listOutputTask = listProcess.StandardOutput.ReadToEndAsync();
                var listErrorTask = listProcess.StandardError.ReadToEndAsync();

                await Task.WhenAll(listOutputTask, listErrorTask);
                await listProcess.WaitForExitAsync();

                if (listProcess.ExitCode != 0)
                {
                    _logService.Log("Failed to list restore points for cleanup");
                    return false;
                }

                var output = listOutputTask.Result;
                var sequenceNumbers = new System.Collections.Generic.List<int>();

                // Parse sequence numbers from output
                foreach (var line in output.Split('\n'))
                {
                    if (int.TryParse(line.Trim(), out int seqNum))
                    {
                        sequenceNumbers.Add(seqNum);
                    }
                }

                if (sequenceNumbers.Count <= keepCount)
                {
                    _logService.Log($"Only {sequenceNumbers.Count} restore points found, no cleanup needed");
                    return true;
                }

                // Delete old restore points (keep the most recent ones)
                var deletedCount = 0;
                for (int i = keepCount; i < sequenceNumbers.Count; i++)
                {
                    var success = await DeleteRestorePoint(sequenceNumbers[i]);
                    if (success)
                    {
                        deletedCount++;
                    }
                }

                _logService.Log($"Deleted {deletedCount} old restore points");
                return true;
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception cleaning up restore points: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> IsSystemRestoreEnabled()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = "-Command \"(Get-ComputerRestorePoint).Count -gt 0\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();

                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();

                await Task.WhenAll(outputTask, errorTask);
                await process.WaitForExitAsync();

                var output = outputTask.Result.Trim();

                return process.ExitCode == 0 && output == "True";
            }
            catch (Exception ex)
            {
                _logService.Log($"Exception checking system restore status: {ex.Message}");
                return false;
            }
        }
    }
}
