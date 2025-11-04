using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Terminal.Gui;

namespace InvolveX.Cli.Services
{
    public class ErrorHandlerService
    {
        private readonly LogService _logService;
        private readonly ReportService _reportService;
        private readonly Dictionary<string, ErrorRecoveryAction> _errorRecoveryActions;
        private readonly List<ErrorInfo> _errorHistory;

        public ErrorHandlerService(LogService logService, ReportService reportService)
        {
            _logService = logService;
            _reportService = reportService;
            _errorRecoveryActions = new Dictionary<string, ErrorRecoveryAction>();
            _errorHistory = new List<ErrorInfo>();

            InitializeDefaultRecoveryActions();
        }

        private void InitializeDefaultRecoveryActions()
        {
            // Network-related errors
            _errorRecoveryActions["NetworkTimeout"] = new ErrorRecoveryAction
            {
                Description = "Network operation timed out",
                UserMessage = "The network operation timed out. Please check your internet connection and try again.",
                RecoverySteps = new[] { "Check internet connection", "Retry operation", "Contact support if issue persists" },
                CanRetry = true,
                MaxRetries = 3
            };

            _errorRecoveryActions["NetworkUnavailable"] = new ErrorRecoveryAction
            {
                Description = "Network is unavailable",
                UserMessage = "Network connection is not available. Please check your network settings.",
                RecoverySteps = new[] { "Check network cable/connection", "Restart network adapter", "Contact network administrator" },
                CanRetry = false
            };

            // Permission-related errors
            _errorRecoveryActions["AccessDenied"] = new ErrorRecoveryAction
            {
                Description = "Access denied - insufficient permissions",
                UserMessage = "You don't have sufficient permissions to perform this operation. Please run as administrator or contact your system administrator.",
                RecoverySteps = new[] { "Run application as administrator", "Check user permissions", "Contact system administrator" },
                CanRetry = false
            };

            // File system errors
            _errorRecoveryActions["FileNotFound"] = new ErrorRecoveryAction
            {
                Description = "File or directory not found",
                UserMessage = "The specified file or directory could not be found. Please verify the path and try again.",
                RecoverySteps = new[] { "Verify file path exists", "Check file permissions", "Try different location" },
                CanRetry = true,
                MaxRetries = 2
            };

            _errorRecoveryActions["DiskFull"] = new ErrorRecoveryAction
            {
                Description = "Disk is full",
                UserMessage = "There is not enough disk space to complete this operation. Please free up some space and try again.",
                RecoverySteps = new[] { "Delete unnecessary files", "Empty recycle bin", "Move files to external storage" },
                CanRetry = true,
                MaxRetries = 1
            };

            // Service-related errors
            _errorRecoveryActions["ServiceUnavailable"] = new ErrorRecoveryAction
            {
                Description = "Required service is not available",
                UserMessage = "A required system service is not running. The operation cannot continue.",
                RecoverySteps = new[] { "Start required services", "Check service status", "Restart computer if needed" },
                CanRetry = true,
                MaxRetries = 2
            };

            // Registry errors
            _errorRecoveryActions["RegistryAccessError"] = new ErrorRecoveryAction
            {
                Description = "Cannot access Windows Registry",
                UserMessage = "Unable to access the Windows Registry. This may be due to permission issues.",
                RecoverySteps = new[] { "Run as administrator", "Check registry permissions", "Scan for malware" },
                CanRetry = false
            };

            // Generic errors
            _errorRecoveryActions["GenericError"] = new ErrorRecoveryAction
            {
                Description = "An unexpected error occurred",
                UserMessage = "An unexpected error occurred. Please try again or contact support if the problem persists.",
                RecoverySteps = new[] { "Try operation again", "Restart application", "Contact support" },
                CanRetry = true,
                MaxRetries = 2
            };
        }

        public async Task<ErrorResult> HandleErrorAsync(Exception exception, string operation = "", object? context = null)
        {
            var errorInfo = new ErrorInfo
            {
                Timestamp = DateTime.Now,
                Exception = exception,
                Operation = operation,
                Context = context,
                ErrorId = Guid.NewGuid().ToString()
            };

            _errorHistory.Add(errorInfo);

            // Log the error
            _logService.Log($"ERROR [{errorInfo.ErrorId}]: {exception.Message} in operation '{operation}'");

            // Determine error type and get recovery action
            var errorType = ClassifyError(exception);
            var recoveryAction = GetRecoveryAction(errorType);

            // Create user-friendly error result
            var result = new ErrorResult
            {
                ErrorId = errorInfo.ErrorId,
                Success = false,
                UserMessage = recoveryAction.UserMessage,
                TechnicalDetails = exception.Message,
                RecoverySteps = recoveryAction.RecoverySteps.ToList(),
                CanRetry = recoveryAction.CanRetry,
                MaxRetries = recoveryAction.MaxRetries,
                ErrorType = errorType
            };

            // Show error dialog to user
            await ShowErrorDialogAsync(result);

            return result;
        }

        public async Task<ErrorResult> HandleErrorWithRetryAsync(Func<Task<bool>> operation, string operationName, int maxRetries = 3)
        {
            var attempts = 0;
            Exception? lastException = null;

            while (attempts < maxRetries)
            {
                try
                {
                    attempts++;
                    var success = await operation();

                    if (success)
                    {
                        return new ErrorResult { Success = true };
                    }
                    else
                    {
                        // Operation returned false but didn't throw exception
                        return new ErrorResult
                        {
                            Success = false,
                            UserMessage = "Operation failed without specific error details.",
                            CanRetry = attempts < maxRetries
                        };
                    }
                }
                catch (Exception ex)
                {
                    lastException = ex;

                    var errorResult = await HandleErrorAsync(ex, operationName);
                    errorResult.RetryCount = attempts;

                    if (!errorResult.CanRetry || attempts >= maxRetries)
                    {
                        return errorResult;
                    }

                    // Wait before retry with exponential backoff
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempts - 1));
                    await Task.Delay(delay);

                    _logService.Log($"Retrying operation '{operationName}' (attempt {attempts + 1}/{maxRetries})");
                }
            }

            // All retries exhausted
            return new ErrorResult
            {
                Success = false,
                UserMessage = $"Operation failed after {maxRetries} attempts. {lastException?.Message ?? "Unknown error"}",
                TechnicalDetails = lastException?.ToString(),
                CanRetry = false,
                RetryCount = maxRetries
            };
        }

        private string ClassifyError(Exception exception)
        {
            var message = exception.Message.ToLowerInvariant();
            var type = exception.GetType();

            // Network errors
            if (type == typeof(System.Net.WebException) ||
                type == typeof(System.Net.Sockets.SocketException) ||
                message.Contains("timeout") || message.Contains("network"))
            {
                return message.Contains("timeout") ? "NetworkTimeout" : "NetworkUnavailable";
            }

            // Permission errors
            if (type == typeof(UnauthorizedAccessException) ||
                message.Contains("access denied") || message.Contains("permission"))
            {
                return "AccessDenied";
            }

            // File system errors
            if (type == typeof(FileNotFoundException) ||
                type == typeof(DirectoryNotFoundException) ||
                message.Contains("file not found") || message.Contains("directory not found"))
            {
                return "FileNotFound";
            }

            if (type == typeof(IOException) && message.Contains("disk"))
            {
                return "DiskFull";
            }

            // Registry errors
            if (message.Contains("registry") || message.Contains("hkey"))
            {
                return "RegistryAccessError";
            }

            // Service errors
            if (message.Contains("service") || message.Contains("unavailable"))
            {
                return "ServiceUnavailable";
            }

            return "GenericError";
        }

        private ErrorRecoveryAction GetRecoveryAction(string errorType)
        {
            return _errorRecoveryActions.TryGetValue(errorType, out var action)
                ? action
                : _errorRecoveryActions["GenericError"];
        }

        private async Task ShowErrorDialogAsync(ErrorResult errorResult)
        {
            var dialog = new Dialog("Error", 80, 20)
            {
                ColorScheme = Colors.Error
            };

            var y = 1;

            // Error message
            var messageLabel = new Label(errorResult.UserMessage)
            {
                X = 1,
                Y = y++,
                Width = Dim.Fill() - 2
            };
            dialog.Add(messageLabel);

            y++; // Empty line

            // Recovery steps
            if (errorResult.RecoverySteps.Any())
            {
                var stepsLabel = new Label("Suggested recovery steps:")
                {
                    X = 1,
                    Y = y++,
                    ColorScheme = Colors.Dialog
                };
                dialog.Add(stepsLabel);

                foreach (var step in errorResult.RecoverySteps)
                {
                    var stepLabel = new Label($"• {step}")
                    {
                        X = 3,
                        Y = y++,
                        Width = Dim.Fill() - 4
                    };
                    dialog.Add(stepLabel);
                }

                y++; // Empty line
            }

            // Error ID for support
            var errorIdLabel = new Label($"Error ID: {errorResult.ErrorId}")
            {
                X = 1,
                Y = y++,
                ColorScheme = Colors.Dialog
            };
            dialog.Add(errorIdLabel);

            // Buttons
            var buttonY = dialog.Bounds.Height - 4;
            var okButton = new Button("OK")
            {
                X = Pos.Center() - 5,
                Y = buttonY,
                IsDefault = true
            };

            var retryButton = new Button("Retry")
            {
                X = Pos.Center() + 2,
                Y = buttonY,
                IsDefault = false
            };

            okButton.Clicked += () => Application.RequestStop();
            retryButton.Clicked += () =>
            {
                // Set a flag to indicate retry was requested
                errorResult.ShouldRetry = true;
                Application.RequestStop();
            };

            dialog.AddButton(okButton);

            if (errorResult.CanRetry && errorResult.RetryCount < errorResult.MaxRetries)
            {
                dialog.AddButton(retryButton);
            }

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(dialog);
                dialogClosed.SetResult(true);
            });

            await dialogClosed.Task;
        }

        public async Task GenerateErrorReportAsync()
        {
            if (!_errorHistory.Any())
            {
                _reportService.StartReport("Error Report", "No errors have been recorded.");
                _reportService.AddSection("Summary", new Dictionary<string, object>
                {
                    ["Total Errors"] = 0,
                    ["Time Period"] = "N/A"
                });
            }
            else
            {
                _reportService.StartReport("Error Report", "Summary of errors encountered during application execution");

                // Summary
                var summary = new Dictionary<string, object>
                {
                    ["Total Errors"] = _errorHistory.Count,
                    ["Time Period"] = $"{_errorHistory.Min(e => e.Timestamp):yyyy-MM-dd HH:mm} to {_errorHistory.Max(e => e.Timestamp):yyyy-MM-dd HH:mm}",
                    ["Most Common Error Type"] = _errorHistory
                        .GroupBy(e => ClassifyError(e.Exception))
                        .OrderByDescending(g => g.Count())
                        .First().Key
                };
                _reportService.AddSection("Summary", summary);

                // Error details table
                var errorTable = new List<Dictionary<string, string>>();
                foreach (var error in _errorHistory.OrderByDescending(e => e.Timestamp).Take(20))
                {
                    errorTable.Add(new Dictionary<string, string>
                    {
                        ["Time"] = error.Timestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                        ["Operation"] = error.Operation,
                        ["Error Type"] = ClassifyError(error.Exception),
                        ["Message"] = error.Exception.Message.Length > 50
                            ? error.Exception.Message.Substring(0, 47) + "..."
                            : error.Exception.Message,
                        ["Error ID"] = error.ErrorId
                    });
                }
                _reportService.AddTableSection("Recent Errors", errorTable, new List<string> { "Time", "Operation", "Error Type", "Message", "Error ID" });
            }

            await _reportService.SaveReportAsync("Error_Report");
        }

        public void ClearErrorHistory()
        {
            _errorHistory.Clear();
            _logService.Log("Error history cleared.");
        }

        public List<ErrorInfo> GetErrorHistory()
        {
            return _errorHistory.ToList();
        }
    }

    public class ErrorRecoveryAction
    {
        public string Description { get; set; } = string.Empty;
        public string UserMessage { get; set; } = string.Empty;
        public string[] RecoverySteps { get; set; } = Array.Empty<string>();
        public bool CanRetry { get; set; }
        public int MaxRetries { get; set; } = 1;
    }

    public class ErrorResult
    {
        public bool Success { get; set; }
        public string ErrorId { get; set; } = string.Empty;
        public string UserMessage { get; set; } = string.Empty;
        public string TechnicalDetails { get; set; } = string.Empty;
        public List<string> RecoverySteps { get; set; } = new();
        public bool CanRetry { get; set; }
        public int MaxRetries { get; set; }
        public int RetryCount { get; set; }
        public bool ShouldRetry { get; set; }
        public string ErrorType { get; set; } = string.Empty;
    }

    public class ErrorInfo
    {
        public DateTime Timestamp { get; set; }
        public Exception Exception { get; set; } = new Exception();
        public string Operation { get; set; } = string.Empty;
        public object? Context { get; set; }
        public string ErrorId { get; set; } = string.Empty;
    }
}
