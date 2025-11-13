```
██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗
██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝
██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝
██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗
██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗
╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝

              Windows System Administration Toolkit
```

# InvolveX CLI - JavaScript Edition

A comprehensive Windows system administration toolkit built with Node.js, providing an easy-to-use terminal user interface for common system maintenance tasks.

## Features

### Package Management

- Update Winget, NPM, Scoop, Chocolatey packages
- Check for available updates across all package managers
- Update PowerShell modules
- Bulk update operations

### System Maintenance

- Clear system caches and temporary files
- Memory optimization and cleanup
- Startup program management
- Program uninstallation

### Network Tools

- Ping tests with customizable hosts
- Internet speed tests
- DNS configuration management

### System Administration

- Driver update checking and installation
- System restore point creation and management
- Registry-based configuration management

### User Interface

- Text-based user interface using Blessed.js
- Interactive menus and dialogs
- Progress indicators and status updates
- Keyboard navigation support

## Installation

### Prerequisites

- Windows 10/11
- Node.js 16.0 or higher
- Administrator privileges for some operations

### Install from NPM (when published)

```bash
npm install -g involvex-cli
```

### Manual Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Make the script executable (optional):

```bash
chmod +x index.js
```

## Usage

### Interactive Mode

```bash
node index.js
# or if installed globally
involvex-cli
```

### Command Line Options

```bash
involvex-cli --help       # Show help information
involvex-cli --version    # Show version information
```

### Navigation

- Use arrow keys to navigate menus
- Press Enter to select options
- Press F10 or Escape to quit
- Press F9 for help

## Supported Package Managers

### Winget (Windows Package Manager)

- Modern Windows package manager from Microsoft
- Supports app updates and installations

### NPM (Node Package Manager)

- Updates global npm packages
- Manages Node.js development tools

### Scoop

- Command-line installer for Windows
- Lightweight package manager

### Chocolatey

- Popular Windows package manager
- Extensive package repository

### PowerShell Modules

- Updates PowerShell modules and cmdlets
- Supports both Windows PowerShell and PowerShell Core

## System Requirements

- **Operating System**: Windows 10/11
- **Runtime**: Node.js 16.0 or higher
- **Permissions**: Administrator privileges required for some operations
- **Terminal**: Interactive terminal emulator (Command Prompt, PowerShell, Windows Terminal)

## Architecture

### Core Services

- **LogService**: Centralized logging functionality
- **ConfigService**: YAML-based configuration management
- **PackageManagerService**: Multi-package manager support
- **NetworkService**: Ping and speed test capabilities
- **CacheService**: System cache management
- **StartupService**: Startup program management
- **UninstallerService**: Program uninstallation
- **DnsService**: DNS configuration
- **DriverService**: Driver update management
- **SystemRestoreService**: System restore point management

### User Interface

- Built with Blessed.js for terminal UI
- Modular dialog system
- Progress indicators and loading screens
- Keyboard-driven navigation

## Configuration

The application stores configuration in:

```
%APPDATA%\InvolveX\config.yaml
```

Default configuration includes:

- Enabled package managers
- Update settings
- UI preferences
- Logging configuration

## Logging

Logs are stored in:

```
./logs/update.log
```

All operations are logged with timestamps for troubleshooting and audit purposes.

## Development

### Project Structure

```
involvex_cli_js/
├── index.js              # Main application entry point
├── package.json          # Node.js dependencies and scripts
├── services/             # Core service modules
│   ├── LogService.js
│   ├── ConfigService.js
│   ├── PackageManagerService.js
│   ├── NetworkService.js
│   ├── CacheService.js
│   ├── StartupService.js
│   ├── UninstallerService.js
│   ├── DnsService.js
│   ├── DriverService.js
│   └── SystemRestoreService.js
├── logs/                 # Application logs
└── README.md            # This file
```

### Adding New Features

1. Create new service in `services/` directory
2. Implement required methods
3. Add menu integration in `index.js`
4. Update configuration if needed
5. Test functionality

### Dependencies

- **blessed**: Terminal UI framework
- **commander**: Command-line argument parsing
- **chalk**: Terminal text styling
- **ora**: Loading spinners
- **inquirer**: Interactive prompts
- **fs-extra**: Enhanced file system operations
- **js-yaml**: YAML configuration parsing

## Troubleshooting

### Common Issues

**"InvolveX CLI requires an interactive terminal"**

- Run in Command Prompt, PowerShell, or Windows Terminal
- Avoid running in IDE terminals or CI/CD environments

**"Administrator privileges required"**

- Some operations require elevated permissions
- Run as administrator for DNS changes, system restore, etc.

**"Package manager not found"**

- Ensure package managers are installed
- Check PATH environment variable

### Debug Mode

Enable debug logging by modifying the LogService configuration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions:

- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and get help

## Changelog

### v1.0.0

- Initial JavaScript port from C# version
- Complete feature parity with original application
- Blessed.js-based terminal user interface
- All core services implemented
- Multi-package manager support
- System administration tools

## Acknowledgments

- Original C# version by InvolveX
- Blessed.js for terminal UI capabilities
- Node.js community for excellent tooling
