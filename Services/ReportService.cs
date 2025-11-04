using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace InvolveX.Cli.Services
{
    public class ReportService
    {
        private readonly LogService _logService;
        private readonly ConfigService _configService;
        private readonly StringBuilder _reportBuilder;

        public ReportService(LogService logService, ConfigService configService)
        {
            _logService = logService;
            _configService = configService;
            _reportBuilder = new StringBuilder();
        }

        public void StartReport(string title, string description = null)
        {
            _reportBuilder.Clear();
            _reportBuilder.AppendLine("=".PadRight(80, '='));
            _reportBuilder.AppendLine($"InvolveX CLI Report - {title}");
            _reportBuilder.AppendLine($"Generated: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            _reportBuilder.AppendLine("=".PadRight(80, '='));

            if (!string.IsNullOrEmpty(description))
            {
                _reportBuilder.AppendLine(description);
                _reportBuilder.AppendLine();
            }
        }

        public void AddSection(string sectionTitle, Dictionary<string, object> data = null)
        {
            _reportBuilder.AppendLine($"[{sectionTitle.ToUpper()}]");
            _reportBuilder.AppendLine("-".PadRight(40, '-'));

            if (data != null && data.Any())
            {
                foreach (var item in data)
                {
                    _reportBuilder.AppendLine($"{item.Key}: {item.Value}");
                }
            }

            _reportBuilder.AppendLine();
        }

        public void AddListSection(string sectionTitle, IEnumerable<string> items)
        {
            _reportBuilder.AppendLine($"[{sectionTitle.ToUpper()}]");
            _reportBuilder.AppendLine("-".PadRight(40, '-'));

            if (items != null && items.Any())
            {
                foreach (var item in items)
                {
                    _reportBuilder.AppendLine($"• {item}");
                }
            }
            else
            {
                _reportBuilder.AppendLine("No items found.");
            }

            _reportBuilder.AppendLine();
        }

        public void AddTableSection(string sectionTitle, List<Dictionary<string, string>> tableData, List<string> headers = null)
        {
            _reportBuilder.AppendLine($"[{sectionTitle.ToUpper()}]");
            _reportBuilder.AppendLine("-".PadRight(40, '-'));

            if (tableData == null || !tableData.Any())
            {
                _reportBuilder.AppendLine("No data available.");
                _reportBuilder.AppendLine();
                return;
            }

            // Determine columns from data or headers
            var columns = headers ?? tableData.First().Keys.ToList();

            // Calculate column widths
            var columnWidths = new Dictionary<string, int>();
            foreach (var column in columns)
            {
                var maxWidth = Math.Max(column.Length,
                    tableData.Max(row => row.TryGetValue(column, out var value) ? value?.Length ?? 0 : 0));
                columnWidths[column] = Math.Min(maxWidth, 30); // Cap at 30 chars
            }

            // Header row
            _reportBuilder.AppendLine(string.Join(" | ", columns.Select(col => col.PadRight(columnWidths[col]))));
            _reportBuilder.AppendLine(string.Join("-+-", columns.Select(col => "".PadRight(columnWidths[col], '-'))));

            // Data rows
            foreach (var row in tableData)
            {
                var values = columns.Select(col =>
                    row.TryGetValue(col, out var value) ? (value ?? "").PadRight(columnWidths[col]) : "".PadRight(columnWidths[col]));
                _reportBuilder.AppendLine(string.Join(" | ", values));
            }

            _reportBuilder.AppendLine();
        }

        public void AddSummary(string summaryText)
        {
            _reportBuilder.AppendLine("[SUMMARY]");
            _reportBuilder.AppendLine("-".PadRight(40, '-'));
            _reportBuilder.AppendLine(summaryText);
            _reportBuilder.AppendLine();
        }

        public void AddError(string errorMessage)
        {
            _reportBuilder.AppendLine($"[ERROR] {errorMessage}");
            _reportBuilder.AppendLine();
        }

        public void AddWarning(string warningMessage)
        {
            _reportBuilder.AppendLine($"[WARNING] {warningMessage}");
            _reportBuilder.AppendLine();
        }

        public async Task<string> GenerateReportAsync()
        {
            _reportBuilder.AppendLine("=".PadRight(80, '='));
            _reportBuilder.AppendLine("End of Report");
            _reportBuilder.AppendLine("=".PadRight(80, '='));

            var report = _reportBuilder.ToString();
            _logService.Log("Report generated successfully.");
            return report;
        }

        public async Task SaveReportAsync(string fileName = null)
        {
            try
            {
                var reportContent = await GenerateReportAsync();

                if (string.IsNullOrEmpty(fileName))
                {
                    fileName = $"InvolveX_Report_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
                }

                var reportsDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    "InvolveX",
                    "Reports"
                );

                Directory.CreateDirectory(reportsDir);
                var filePath = Path.Combine(reportsDir, fileName);

                await File.WriteAllTextAsync(filePath, reportContent);
                _logService.Log($"Report saved to: {filePath}");
            }
            catch (Exception ex)
            {
                _logService.Log($"Error saving report: {ex.Message}");
                throw;
            }
        }

        public async Task<string> GenerateSystemReportAsync()
        {
            StartReport("System Status Report", "Comprehensive overview of system components and status");

            // System Information
            var systemInfo = new Dictionary<string, object>
            {
                ["Operating System"] = Environment.OSVersion.ToString(),
                ["Machine Name"] = Environment.MachineName,
                ["User Name"] = Environment.UserName,
                [".NET Version"] = Environment.Version.ToString(),
                ["64-bit Process"] = Environment.Is64BitProcess,
                ["Processor Count"] = Environment.ProcessorCount,
                ["System Directory"] = Environment.SystemDirectory,
                ["Current Directory"] = Environment.CurrentDirectory
            };
            AddSection("System Information", systemInfo);

            // Configuration Summary
            var config = _configService.GetConfig();
            var configSummary = new Dictionary<string, object>
            {
                ["Package Managers Enabled"] = string.Join(", ", config.PackageManagers.EnabledManagers),
                ["Auto Updates"] = config.Updates.AutoCheck,
                ["Hash Verification"] = config.Security.VerifyHashes,
                ["Certificate Checking"] = config.Security.CheckCertificates,
                ["UI Animations"] = config.UI.ShowAnimations,
                ["Log Level"] = config.Logging.Level
            };
            AddSection("Configuration Summary", configSummary);

            // Trusted Publishers
            AddListSection("Trusted Publishers", config.Security.TrustedPublishers);

            // Excluded Categories
            AddListSection("Excluded Update Categories", config.Updates.ExcludedCategories);

            return await GenerateReportAsync();
        }

        public async Task<string> GenerateUpdateReportAsync(Dictionary<string, List<string>> updateResults)
        {
            StartReport("Update Report", "Results of package manager and system updates");

            foreach (var category in updateResults)
            {
                AddListSection($"{category.Key} Updates", category.Value);
            }

            var totalUpdates = updateResults.Sum(x => x.Value.Count);
            AddSummary($"Total updates processed: {totalUpdates}");

            return await GenerateReportAsync();
        }

        public async Task<string> GenerateSecurityReportAsync(Dictionary<string, bool> securityChecks)
        {
            StartReport("Security Report", "Security scan results and recommendations");

            var securityTable = new List<Dictionary<string, string>>();
            var issues = 0;

            foreach (var check in securityChecks)
            {
                securityTable.Add(new Dictionary<string, string>
                {
                    ["Check"] = check.Key,
                    ["Status"] = check.Value ? "PASS" : "FAIL",
                    ["Details"] = check.Value ? "No issues found" : "Security concern detected"
                });

                if (!check.Value) issues++;
            }

            AddTableSection("Security Checks", securityTable, new List<string> { "Check", "Status", "Details" });

            var summary = issues == 0
                ? "All security checks passed. System appears secure."
                : $"{issues} security issue(s) found. Review and address immediately.";

            AddSummary(summary);

            return await GenerateReportAsync();
        }

        public async Task<string> GeneratePerformanceReportAsync(Dictionary<string, TimeSpan> operationTimes)
        {
            StartReport("Performance Report", "Operation execution times and performance metrics");

            var performanceTable = new List<Dictionary<string, string>>();

            foreach (var operation in operationTimes)
            {
                performanceTable.Add(new Dictionary<string, string>
                {
                    ["Operation"] = operation.Key,
                    ["Duration"] = $"{operation.Value.TotalSeconds:F2} seconds",
                    ["Status"] = operation.Value.TotalSeconds > 30 ? "Slow" : "Normal"
                });
            }

            AddTableSection("Performance Metrics", performanceTable, new List<string> { "Operation", "Duration", "Status" });

            var avgTime = operationTimes.Values.Average(t => t.TotalSeconds);
            var maxTime = operationTimes.Values.Max();
            var minTime = operationTimes.Values.Min();

            AddSummary($"Average operation time: {avgTime:F2}s | Fastest: {minTime.TotalSeconds:F2}s | Slowest: {maxTime.TotalSeconds:F2}s");

            return await GenerateReportAsync();
        }

        public async Task ExportReportToJsonAsync(string fileName = null)
        {
            try
            {
                // This would serialize the report data to JSON format
                // For now, just save the text report
                await SaveReportAsync(fileName?.Replace(".txt", ".json") ?? $"InvolveX_Report_{DateTime.Now:yyyyMMdd_HHmmss}.json");
            }
            catch (Exception ex)
            {
                _logService.Log($"Error exporting JSON report: {ex.Message}");
            }
        }

        public async Task ExportReportToCsvAsync(string fileName = null)
        {
            try
            {
                // This would convert tabular data to CSV format
                // For now, just save the text report
                await SaveReportAsync(fileName?.Replace(".txt", ".csv") ?? $"InvolveX_Report_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
            }
            catch (Exception ex)
            {
                _logService.Log($"Error exporting CSV report: {ex.Message}");
            }
        }
    }
}
