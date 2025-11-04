using System;
using System.IO;

namespace InvolveX.Cli.Services
{
    public class LogService
    {
        private readonly string _logFilePath;

        public LogService()
        {
            var logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
            if (!Directory.Exists(logDirectory))
            {
                Directory.CreateDirectory(logDirectory);
            }
            _logFilePath = Path.Combine(logDirectory, "update.log");
        }

        public void Log(string message)
        {
            try
            {
                File.AppendAllText(_logFilePath, $"{DateTime.Now}: {message}{Environment.NewLine}");
            }
            catch (Exception ex)
            {
                // Fallback: log to console if file logging fails
                Console.Error.WriteLine($"Error writing to log file: {ex.Message} - Message: {message}");
            }
        }
    }
}