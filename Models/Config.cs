using System.Collections.Generic;

namespace InvolveX.Cli.Models
{
    public class AppConfig
    {
        public PackageManagerConfig PackageManagers { get; set; } = new();
        public UpdateConfig Updates { get; set; } = new();
        public SecurityConfig Security { get; set; } = new();
        public UiConfig UI { get; set; } = new();
        public LoggingConfig Logging { get; set; } = new();
    }

    public class PackageManagerConfig
    {
        public List<string> EnabledManagers { get; set; } = new() { "winget", "npm", "scoop", "choco" };
        public Dictionary<string, PackageManagerSettings> Settings { get; set; } = new();
    }

    public class PackageManagerSettings
    {
        public bool AutoUpdate { get; set; } = true;
        public List<string> ExcludedPackages { get; set; } = new();
        public Dictionary<string, string> CustomSources { get; set; } = new();
    }

    public class UpdateConfig
    {
        public bool AutoCheck { get; set; } = true;
        public int CheckIntervalHours { get; set; } = 24;
        public bool IncludePreReleases { get; set; } = false;
        public List<string> ExcludedCategories { get; set; } = new();
        public Dictionary<string, UpdateSettings> CategorySettings { get; set; } = new();
    }

    public class UpdateSettings
    {
        public bool Enabled { get; set; } = true;
        public bool RequireConfirmation { get; set; } = true;
        public int MaxConcurrentUpdates { get; set; } = 3;
    }

    public class SecurityConfig
    {
        public bool VerifyHashes { get; set; } = true;
        public bool CheckCertificates { get; set; } = true;
        public List<string> TrustedPublishers { get; set; } = new();
        public Dictionary<string, string> KnownHashes { get; set; } = new();
        public bool SandboxMode { get; set; } = false;
    }

    public class UiConfig
    {
        public string Theme { get; set; } = "default";
        public bool ShowAnimations { get; set; } = true;
        public int AnimationSpeed { get; set; } = 100;
        public bool ShowProgressBars { get; set; } = true;
        public bool AutoCloseDialogs { get; set; } = false;
        public int DialogTimeoutSeconds { get; set; } = 30;
    }

    public class LoggingConfig
    {
        public string Level { get; set; } = "info";
        public bool LogToFile { get; set; } = true;
        public bool LogToConsole { get; set; } = true;
        public int MaxLogFiles { get; set; } = 10;
        public long MaxLogSizeBytes { get; set; } = 10485760; // 10MB
        public List<string> ExcludedCategories { get; set; } = new();
    }
}
