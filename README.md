# InvolveX CLI

A comprehensive Windows system administration CLI toolkit built with .NET and Terminal.Gui. This tool provides a user-friendly interface for managing various Windows system tasks including driver updates, startup programs, package management, network diagnostics, and more.

## Features

### 🖥️ System Management
- **Driver Management**: Detect, list, and update device drivers
- **Startup Programs**: View and manage programs that start with Windows
- **Uninstaller**: Browse and remove installed programs
- **Cache Management**: Clear system caches and temporary files
- **Memory Management**: Clear RAM and optimize memory usage

### 📦 Package Management
- **Winget**: Windows Package Manager integration
- **Chocolatey**: Chocolatey package manager support
- **Scoop**: Scoop package manager support
- **NPM**: Node Package Manager integration
- **PowerShell Modules**: Update and manage PowerShell modules

### 🌐 Network Tools
- **Network Diagnostics**: Ping tests and connectivity checks
- **Speed Test**: Internet speed testing with Ookla Speedtest CLI
- **DNS Management**: DNS cache clearing and configuration

### 🔒 Security & Verification
- **File Verification**: Hash verification for downloaded files
- **Security Scanning**: Basic security checks
- **Trusted Publishers**: Certificate validation

### 📊 Reporting & Analytics
- **System Reports**: Comprehensive system analysis
- **Performance Monitoring**: System performance metrics
- **Export Options**: Multiple report formats (JSON, CSV, HTML)

### 🔌 Plugin System
- **Extensible Architecture**: Custom plugins for additional functionality
- **Plugin Management**: Load, manage, and execute plugins
- **Example Plugins**: Sample implementations included

## Installation

### Option 1: Download from GitHub Releases
```powershell
# Download and run the latest release
irm https://raw.githubusercontent.com/involvex/Involvex-Cli/main/install.ps1 | iex
```

### Option 2: Build from Source
```bash
# Clone the repository
git clone https://github.com/involvex/Involvex-Cli.git
cd Involvex-Cli

# Build the project
dotnet build --configuration Release

# Run the application
dotnet run --project InvolveX.Cli.csproj
```

### Option 3: Publish for Distribution
```bash
# Create a self-contained executable
dotnet publish --configuration Release --runtime win-x64 --self-contained true

# The executable will be in bin/Release/net8.0/win-x64/publish/
```

## Usage

### Starting the Application
```bash
# If built from source
dotnet run

# If using published executable
./InvolveX.Cli.exe
```

### Navigation
- Use **Arrow Keys** to navigate menus
- **Enter** to select options
- **F10** or **ESC** to exit
- **Tab** to switch between controls

### Main Menu Options

#### 1. Driver Management
- **List Drivers**: View all installed device drivers
- **Check Updates**: Scan for driver updates
- **Update Drivers**: Install available driver updates

#### 2. Startup Programs
- **View Startup Programs**: List all programs that start with Windows
- **Disable Programs**: Remove programs from startup
- **Enable Programs**: Add programs back to startup

#### 3. Program Uninstaller
- **List Installed Programs**: Browse all installed applications
- **Uninstall Programs**: Remove selected programs
- **Search Programs**: Find specific installed programs

#### 4. Package Managers
- **Update All Packages**: Update packages across all managers
- **Update Winget**: Update Windows Package Manager packages
- **Update Chocolatey**: Update Chocolatey packages
- **Update Scoop**: Update Scoop packages
- **Update NPM**: Update Node.js packages
- **Update PowerShell**: Update PowerShell modules

#### 5. Cache & Memory
- **Clear System Cache**: Remove temporary system files
- **Clear Browser Cache**: Clear browser caches
- **Clear RAM**: Free up system memory
- **Clear DNS Cache**: Flush DNS resolver cache

#### 6. Network Tools
- **Ping Test**: Test connectivity to hosts
- **Speed Test**: Run internet speed test
- **Network Info**: View network configuration

#### 7. Security
- **File Verification**: Verify file integrity with hashes
- **Security Scan**: Basic security checks
- **Certificate Check**: Validate certificates

#### 8. Reports
- **System Report**: Generate comprehensive system analysis
- **Performance Report**: Monitor system performance
- **Export Reports**: Save reports in various formats

#### 9. Plugins
- **Load Plugins**: Load available plugins
- **Manage Plugins**: View and manage loaded plugins
- **Execute Plugins**: Run plugin functions

#### 10. Settings
- **Configuration**: Modify application settings
- **Update Sources**: Configure update sources
- **Exclusions**: Set programs/packages to exclude from updates

## Configuration

The application uses a YAML configuration file (`config.yml`) for settings:

```yaml
# Update sources
update_sources:
  winget: true
  chocolatey: true
  scoop: true
  npm: true
  powershell: true

# Exclusions
exclusions:
  packages:
    - "example-package"
  programs:
    - "example-program"

# Plugin settings
plugins:
  enabled: true
  directory: "./Plugins"

# Security settings
security:
  verify_hashes: true
  trusted_publishers_only: false

# UI settings
ui:
  theme: "default"
  animations: true
  show_progress: true
```

## Plugin Development

### Creating a Plugin

1. Create a class that implements `IPlugin`:
```csharp
using InvolveX.Models.Plugin;

namespace MyPlugin
{
    public class MyCustomPlugin : IPlugin
    {
        public string Name => "My Custom Plugin";
        public string Description => "A custom plugin example";
        public string Version => "1.0.0";
        public string Author => "Your Name";

        public void Execute()
        {
            // Plugin logic here
            Console.WriteLine("Plugin executed!");
        }

        public void Initialize()
        {
            // Initialization logic
        }

        public void Dispose()
        {
            // Cleanup logic
        }
    }
}
```

2. Compile your plugin as a DLL
3. Place the DLL in the `Plugins` directory
4. The plugin will be automatically loaded on startup

## Requirements

- **Operating System**: Windows 10/11
- **.NET Runtime**: .NET 8.0 or later
- **Permissions**: Administrator privileges for some operations
- **Optional Tools**:
  - Winget (Windows Package Manager)
  - Chocolatey
  - Scoop
  - Node.js (for NPM)
  - PowerShell 7+ (for module updates)
  - Ookla Speedtest CLI (for speed tests)

## Troubleshooting

### Common Issues

1. **"Access Denied" Errors**
   - Run the application as Administrator
   - Some operations require elevated privileges

2. **Package Manager Not Found**
   - Install the required package manager
   - Check PATH environment variable

3. **Plugin Loading Errors**
   - Ensure plugin DLL is in the correct directory
   - Check plugin dependencies

4. **Network Test Failures**
   - Check internet connectivity
   - Install Ookla Speedtest CLI for speed tests

### Logs

Application logs are stored in:
- `bin/Debug/logs/` (Debug builds)
- `bin/Release/logs/` (Release builds)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup

```bash
# Clone and setup
git clone https://github.com/involvex/Involvex-Cli.git
cd Involvex-Cli

# Restore dependencies
dotnet restore

# Build
dotnet build

# Run tests (when available)
dotnet test

# Run the application
dotnet run
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/involvex/Involvex-Cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/involvex/Involvex-Cli/discussions)
- **Documentation**: [Wiki](https://github.com/involvex/Involvex-Cli/wiki)

## Changelog

### Version 1.0.0
- Initial release
- Core system management features
- Package manager integration
- Plugin architecture
- Comprehensive reporting
- Security features

---

**Made with ❤️ for Windows system administrators**
