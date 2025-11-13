#!/usr/bin/env node

// Version constant
const VERSION = '1.0.7';

const blessed = require('blessed');
const { Command } = require('commander');
const path = require('path');
const os = require('os');

// Import services
const LogService = require('./services/LogService');
const ConfigService = require('./services/ConfigService');
const PackageManagerService = require('./services/PackageManagerService');
const NetworkService = require('./services/NetworkService');
const CacheService = require('./services/CacheService');
const StartupService = require('./services/StartupService');
const UninstallerService = require('./services/UninstallerService');
const DnsService = require('./services/DnsService');
const DriverService = require('./services/DriverService');
const SystemRestoreService = require('./services/SystemRestoreService');
const PluginService = require('./services/PluginService');
const PluginRepositoryService = require('./services/PluginRepositoryService');
const SettingsService = require('./services/SettingsService');
const AutoUpdateService = require('./services/AutoUpdateService');
const WebServer = require('./server/webServer');

// Initialize services
const logService = new LogService();
const configService = new ConfigService(logService);
const settingsService = new SettingsService(logService);
const packageManagerService = new PackageManagerService(logService);
const networkService = new NetworkService(logService);
const cacheService = new CacheService(logService);
const startupService = new StartupService(logService);
const uninstallerService = new UninstallerService(logService);
const dnsService = new DnsService(logService);
const driverService = new DriverService(logService);
const systemRestoreService = new SystemRestoreService(logService);
const pluginService = new PluginService(logService, configService);
const pluginRepositoryService = new PluginRepositoryService(logService);
const autoUpdateService = new AutoUpdateService(logService, settingsService);

process.on('exit', () => {
  if (global.discordRPCPlugin) {
    try {
      global.discordRPCPlugin.stop();
    } catch {
      // ignore shutdown errors
    }
  }
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    if (global.discordRPCPlugin) {
      try {
        global.discordRPCPlugin.stop();
      } catch {
        // ignore
      }
    }
    process.exit(0);
  });
});

// Initialize configuration
async function initializeConfig() {
  try {
    await configService.loadConfigAsync();
    await settingsService.loadSettingsAsync();
    // Initialize plugin services
    await pluginService.initializeAsync();

    // Perform auto-tasks if enabled
    await performAutoTasks();
  } catch (error) {
    logService.log(`Failed to load configuration: ${error.message}`);
  }
}

// Perform auto-tasks based on settings
async function performAutoTasks() {
  try {
    // Auto-update CLI
    if (settingsService.getAutoUpdateEnabled()) {
      await autoUpdateService.performAutoUpdate();
    }

    // Auto cache clearing
    if (settingsService.shouldRunAutoCacheClearing()) {
      logService.log('Auto cache clearing triggered...');
      const success = await cacheService.clearSystemCache();
      if (success) {
        settingsService.setLastCacheCleared(Date.now());
        await settingsService.saveSettingsAsync();
      }
    }

    // Auto memory clearing
    if (settingsService.shouldRunAutoMemoryClearing()) {
      logService.log('Auto memory clearing triggered...');
      const success = await cacheService.clearMemory();
      if (success) {
        settingsService.setLastMemoryCleared(Date.now());
        await settingsService.saveSettingsAsync();
      }
    }

    // Auto package updates
    if (settingsService.getPackageAutoUpdateEnabled()) {
      await performAutoPackageUpdates();
    }

    // Discord RPC
    if (settingsService.getDiscordRPCEnabled()) {
      await initializeDiscordRPC();
    }
  } catch (error) {
    logService.log(`Error performing auto-tasks: ${error.message}`);
  }
}

// Initialize Discord RPC if enabled
async function initializeDiscordRPC() {
  try {
    const clientId = settingsService.getDiscordRPCClientId();
    if (!clientId) {
      logService.log('Discord RPC client ID not configured');
      return;
    }

    if (global.discordRPCPlugin && typeof global.discordRPCPlugin.stop === 'function') {
      try {
        await global.discordRPCPlugin.stop();
      } catch {
        // ignore stop errors
      }
      global.discordRPCPlugin = null;
    }

    const rpcPlugin = await loadBuiltinPlugin('DiscordRPCPlugin.js');
    if (!rpcPlugin) {
      logService.log('Discord RPC plugin not available.');
      return;
    }

    const interval = settingsService.getDiscordRPCUpdateInterval() * 1000;
    const started = await rpcPlugin.start(clientId, interval);

    if (started) {
      logService.log('Discord RPC started successfully');
      global.discordRPCPlugin = rpcPlugin;
    } else {
      logService.log('Failed to start Discord RPC');
      if (typeof rpcPlugin.shutdownAsync === 'function') {
        await rpcPlugin.shutdownAsync();
      } else if (typeof rpcPlugin.stop === 'function') {
        await rpcPlugin.stop();
      }
    }
  } catch (error) {
    logService.log(`Error initializing Discord RPC: ${error.message}`);
  }
}

// Perform auto package updates
async function performAutoPackageUpdates() {
  try {
    const managers = settingsService.getPackageAutoUpdateManagers();
    const updatePromises = [];

    if (managers.winget && (await packageManagerService.isWingetInstalled())) {
      updatePromises.push(
        packageManagerService.updateWinget().catch(err => {
          logService.log(`Auto-update winget failed: ${err.message}`);
        })
      );
    }

    if (managers.npm && (await packageManagerService.isNpmInstalled())) {
      updatePromises.push(
        packageManagerService.updateNpm().catch(err => {
          logService.log(`Auto-update npm failed: ${err.message}`);
        })
      );
    }

    if (managers.scoop && (await packageManagerService.isScoopInstalled())) {
      updatePromises.push(
        packageManagerService.updateScoop().catch(err => {
          logService.log(`Auto-update scoop failed: ${err.message}`);
        })
      );
    }

    if (managers.choco && (await packageManagerService.isChocoInstalled())) {
      updatePromises.push(
        packageManagerService.updateChoco().catch(err => {
          logService.log(`Auto-update choco failed: ${err.message}`);
        })
      );
    }

    if (managers.pip && (await packageManagerService.isPipInstalled())) {
      updatePromises.push(
        packageManagerService.updatePip().catch(err => {
          logService.log(`Auto-update pip failed: ${err.message}`);
        })
      );
    }

    await Promise.all(updatePromises);
    logService.log('Auto package updates completed');
  } catch (error) {
    logService.log(`Error performing auto package updates: ${error.message}`);
  }
}

// Auto updater functionality
async function checkForUpdates() {
  try {
    const https = require('https');
    const packageName = '@involvex/involvex-cli';

    return new Promise((resolve, reject) => {
      const url = `https://registry.npmjs.org/${packageName}/latest`;
      https
        .get(url, res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              const latestInfo = JSON.parse(data);
              const currentVersion = VERSION;
              const latestVersion = latestInfo.version;

              if (latestVersion > currentVersion) {
                resolve({
                  hasUpdate: true,
                  currentVersion,
                  latestVersion,
                  description: latestInfo.description || 'New version available',
                });
              } else {
                resolve({ hasUpdate: false });
              }
            } catch (error) {
              reject(error);
            }
          });
        })
        .on('error', reject);
    });
  } catch (error) {
    logService.log(`Failed to check for updates: ${error.message}`);
    return { hasUpdate: false };
  }
}

// Check if terminal is interactive
function isInteractiveTerminal() {
  // Check if stdin/stdout are redirected
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  // Check for CI/CD environment variables
  const ciVars = ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'TF_BUILD', 'GITHUB_ACTIONS'];
  if (ciVars.some(varName => process.env[varName])) {
    return false;
  }

  // Check for non-interactive terminal types
  if (process.env.TERM === 'dumb' || process.env.TMUX || process.env.SCREEN) {
    return false;
  }

  // On Windows, be permissive - allow all terminals with TTY
  if (process.platform === 'win32') {
    return true;
  }

  // For other platforms, allow if TTY is present
  return true;
}

// Show help information
function showHelp() {
  const helpText = `
InvolveX CLI - Windows System Administration Toolkit

USAGE:
    involvex-cli [COMMAND] [OPTIONS]
    involvex-cli [OPTIONS]

COMMANDS:
    plugin <action> [name]    Plugin management
        list                   List all installed plugins
        install <path>         Install a plugin from file path
        uninstall <name>       Uninstall a plugin by name
        update <name> [path]   Update a plugin (uninstall + reinstall)

OPTIONS:
    --help, -h, /?            Show this help message
    --version, -v             Show version information
    --update                  Check for available package updates
    --cache                   Clear system and memory caches
    --startup                 List startup programs
    --uninstall               List installed programs
    --dns                     Show DNS configuration
    --network                 Run network tests (ping)
    --driver                  Check for driver updates
    --restore                 List system restore points
    --plugins                 List installed plugins (legacy, use 'plugin list')
    --serve                   Start web server interface
    --port <port>             Port for web server (default: 3000)
    --host <host>             Host for web server (default: 0.0.0.0)
    --path <path>             Path to serve static files (optional)

DESCRIPTION:
    InvolveX CLI is a comprehensive Windows system administration toolkit
    that provides an easy-to-use interface for common system maintenance tasks.

FEATURES:
    • Package Management: Update winget, npm, scoop, choco, pip packages
    • System Monitoring: CPU, Memory, GPU, Drive usage monitoring
    • Cache Management: Clear system caches and memory
    • Startup Programs: List and disable startup programs
    • Program Management: List and uninstall installed programs
    • DNS Configuration: Set and reset DNS servers
    • Network Tools: Ping tests and speed tests
    • Driver Management: Check and update drivers
    • System Restore: Create and manage restore points
    • Plugin System: Extensible plugin architecture
    • Settings: Auto-update, auto-cache, auto-memory clearing
    • Discord RPC: Rich presence integration

PACKAGE MANAGERS SUPPORTED:
    • Winget (Windows Package Manager)
    • NPM (Node Package Manager)
    • Scoop (Command-line installer)
    • Chocolatey (Package manager for Windows)
    • Pip (Python Package Manager)

PLUGIN EXAMPLES:
    involvex-cli plugin list
    involvex-cli plugin install ./my-plugin.js
    involvex-cli plugin install --path ./my-plugin.js
    involvex-cli plugin uninstall SystemMonitor
    involvex-cli plugin update SystemMonitor --path ./updated-plugin.js

EXAMPLES:
    involvex-cli                    # Start interactive mode
    involvex-cli --help            # Show this help
    involvex-cli --version         # Show version
    involvex-cli --update          # Check for updates
    involvex-cli --cache           # Clear caches
    involvex-cli plugin list       # List plugins
    involvex-cli --serve           # Start web server on port 3000
    involvex-cli --serve --port 8080 --host 0.0.0.0  # Custom port and host
    involvex-cli --serve --path ./public  # Serve folder and CLI interface

SYSTEM REQUIREMENTS:
    • Windows 10/11
    • Node.js 16.0 or higher
    • Administrator privileges for some operations

For more information, visit: https://github.com/involvex/Involvex-Cli
`;
  console.log(helpText);
}

// Show version information
function showVersion() {
  console.log(`InvolveX CLI v${VERSION}`);
  console.log('Windows System Administration Toolkit');
  console.log('Built with Node.js');
}

// Show non-interactive error
function showNonInteractiveError() {
  const message = `
InvolveX CLI requires an interactive terminal to run.

This application uses a text-based user interface that cannot run in:
- Non-interactive terminals
- CI/CD environments
- IDE integrated terminals (like VS Code)
- When input/output is redirected

Please run the application in:
- Windows Command Prompt (cmd.exe)
- Windows PowerShell
- Windows Terminal
- Any interactive terminal emulator

For command-line usage, use:
  involvex-cli --help
  involvex-cli --version
`;
  console.log(message);
  process.exit(1);
}

// Main TUI application
async function startTUI() {
  // Create screen with terminal theme
  const screen = blessed.screen({
    smartCSR: true,
    title: 'InvolveX CLI',
    fullUnicode: true,
  });

  // Set terminal theme colors (green on black)
  screen.style.bg = 'black';
  screen.style.fg = 'green';

  // Create main layout with terminal theme
  const mainFrame = blessed.box({
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-2',
    border: {
      type: 'line',
    },
    style: {
      bg: 'black',
      border: {
        fg: 'green',
      },
    },
  });

  // Menu bar with terminal theme
  const menuBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: 'involvex-cli@terminal:~$',
    style: {
      bg: 'black',
      fg: 'green',
      bold: true,
    },
  });

  // Status bar with terminal theme
  const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  // InvolveX logo
  const logo = blessed.box({
    top: 1,
    left: 'center',
    width: '80%',
    height: 8,
    content: `
██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗
██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝
██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝
██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗
██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗
╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝

              Windows System Administration Toolkit
`,
    style: {
      fg: 'green',
      bold: true,
    },
  });

  // Main menu list
  const menuList = blessed.list({
    top: 10,
    left: 'center',
    width: '60%',
    height: '60%',
    border: {
      type: 'line',
    },
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
        bold: true,
      },
      item: {
        hover: {
          bg: '#003300',
          fg: '#00ff00',
        },
      },
    },
    mouse: true,
    interactive: true,
    invertSelected: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      track: {
        bg: 'cyan',
      },
      style: {
        inverse: true,
      },
    },
    items: [
      'Update',
      'Cache',
      'Startup',
      'Uninstall',
      'DNS',
      'Network',
      'Driver',
      'System Restore',
      'Plugins',
      'Settings',
      'Exit',
    ],
  });

  // Add elements to screen
  screen.append(menuBar);
  screen.append(mainFrame);
  screen.append(statusBar);
  mainFrame.append(logo);
  mainFrame.append(menuList);

  // Set status bar content with terminal style
  statusBar.setContent(
    ' {green-fg}F9: Help | F10: Quit | ESC: Back | Use arrow keys to navigate{/green-fg} '
  );

  // Menu selection handler
  menuList.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Update':
          await showUpdateMenu(screen);
          break;
        case 'Cache':
          await showCacheMenu(screen);
          break;
        case 'Startup':
          await showStartupMenu(screen);
          break;
        case 'Uninstall':
          await showUninstallMenu(screen);
          break;
        case 'DNS':
          await showDnsMenu(screen);
          break;
        case 'Network':
          await showNetworkMenu(screen);
          break;
        case 'Driver':
          await showDriverMenu(screen);
          break;
        case 'System Restore':
          await showSystemRestoreMenu(screen);
          break;
        case 'Plugins':
          await showPluginsMenu(screen);
          break;
        case 'Settings':
          await showSettingsMenu(screen);
          break;
        case 'Exit':
          screen.destroy();
          process.exit(0);
          break;
      }
    } catch (error) {
      showMessage(screen, 'Error', `Failed to open menu: ${error.message}`);
    }
  });

  // Explicit key handlers for navigation
  menuList.key(['up'], () => {
    const current = menuList.selected;
    let newIndex;
    if (current > 0) {
      newIndex = current - 1;
    } else {
      newIndex = menuList.items.length - 1; // Wrap to bottom
    }
    menuList.select(newIndex);
    screen.render();
  });

  menuList.key(['down'], () => {
    const current = menuList.selected;
    let newIndex;
    if (current < menuList.items.length - 1) {
      newIndex = current + 1;
    } else {
      newIndex = 0; // Wrap to top
    }
    menuList.select(newIndex);
    screen.render();
  });

  menuList.key(['enter'], () => {
    const selectedIndex = menuList.selected;
    const selectedItem = menuList.items[selectedIndex];
    if (selectedItem) {
      // Manually trigger the select event
      menuList.emit('select', selectedItem, selectedIndex);
    }
  });

  // Key bindings
  screen.key(['escape', 'q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key(['f10'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key(['f9'], () => {
    showHelpDialog(screen);
  });

  // Render screen and ensure focus
  screen.render();

  // Ensure menuList has focus after rendering
  menuList.focus();
  screen.render();
}

// Menu implementations
async function showUpdateMenu(screen) {
  const updateDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Update Package Managers{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: [
      'Show Available Updates',
      'Update Winget',
      'Update NPM',
      'Update Scoop',
      'Update Chocolatey',
      'Update Pip',
      'Update PowerShell Modules',
      'Update All',
      'Back',
    ],
  });

  screen.append(updateDialog);
  screen.render();

  updateDialog.focus();

  updateDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Show Available Updates': {
          await showAvailableUpdates(screen);
          break;
        }
        case 'Update Winget': {
          await runPackageUpdate(screen, 'winget', () => packageManagerService.updateWinget());
          break;
        }
        case 'Update NPM': {
          await runPackageUpdate(screen, 'npm', () => packageManagerService.updateNpm());
          break;
        }
        case 'Update Scoop': {
          await runPackageUpdate(screen, 'scoop', () => packageManagerService.updateScoop());
          break;
        }
        case 'Update Chocolatey': {
          await runPackageUpdate(screen, 'choco', () => packageManagerService.updateChoco());
          break;
        }
        case 'Update Pip': {
          await runPackageUpdate(screen, 'pip', () => packageManagerService.updatePip());
          break;
        }
        case 'Update PowerShell Modules': {
          await runPackageUpdate(screen, 'PowerShell Modules', () =>
            packageManagerService.updatePowerShellModules()
          );
          break;
        }
        case 'Update All': {
          await runUpdateAll(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Update failed: ${error.message}`);
    }

    updateDialog.destroy();
    screen.render();
  });

  updateDialog.key(['escape'], () => {
    updateDialog.destroy();
    screen.render();
  });
}

async function showCacheMenu(screen) {
  const cacheDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Cache Management{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['Clear System Cache', 'Clear Memory', 'Back'],
  });

  screen.append(cacheDialog);
  screen.render();
  cacheDialog.focus();

  cacheDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      let success = false;
      switch (selected) {
        case 'Clear System Cache': {
          success = await cacheService.clearSystemCache();
          break;
        }
        case 'Clear Memory': {
          success = await cacheService.clearMemory();
          break;
        }
      }

      if (success) {
        showMessage(screen, 'Success', 'Operation completed successfully!');
      } else {
        showMessage(screen, 'Error', 'Operation failed or was not supported.');
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    cacheDialog.destroy();
    screen.render();
  });

  cacheDialog.key(['escape'], () => {
    cacheDialog.destroy();
    screen.render();
  });
}

async function showStartupMenu(screen) {
  const startupDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Startup Programs{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['List Startup Programs', 'Disable Startup Program', 'Back'],
  });

  screen.append(startupDialog);
  screen.render();
  startupDialog.focus();

  startupDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'List Startup Programs': {
          const programs = await startupService.listStartupPrograms();
          showListDialog(screen, 'Startup Programs', programs);
          break;
        }
        case 'Disable Startup Program': {
          await showDisableStartupDialog(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    if (selected !== 'Disable Startup Program') {
      startupDialog.destroy();
      screen.render();
    }
  });

  startupDialog.key(['escape'], () => {
    startupDialog.destroy();
    screen.render();
  });
}

async function showUninstallMenu(screen) {
  const uninstallDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Program Management{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['List Installed Programs', 'Uninstall Program', 'Back'],
  });

  screen.append(uninstallDialog);
  screen.render();
  uninstallDialog.focus();

  uninstallDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'List Installed Programs': {
          const programs = await uninstallerService.listInstalledPrograms();
          showListDialog(screen, 'Installed Programs', programs);
          break;
        }
        case 'Uninstall Program': {
          await showUninstallProgramDialog(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    if (selected !== 'Uninstall Program') {
      uninstallDialog.destroy();
      screen.render();
    }
  });

  uninstallDialog.key(['escape'], () => {
    uninstallDialog.destroy();
    screen.render();
  });
}

async function showDnsMenu(screen) {
  const dnsDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}DNS Configuration{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['Set DNS Servers', 'Reset DNS', 'Back'],
  });

  screen.append(dnsDialog);
  screen.render();
  dnsDialog.focus();

  dnsDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Set DNS Servers': {
          await showSetDnsDialog(screen);
          break;
        }
        case 'Reset DNS': {
          const resetSuccess = await dnsService.resetDns();
          if (resetSuccess) {
            showMessage(screen, 'Success', 'DNS settings reset to DHCP!');
          } else {
            showMessage(screen, 'Error', 'Failed to reset DNS settings.');
          }
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `DNS operation failed: ${error.message}`);
    }

    if (selected !== 'Set DNS Servers') {
      dnsDialog.destroy();
      screen.render();
    }
  });

  dnsDialog.key(['escape'], () => {
    dnsDialog.destroy();
    screen.render();
  });
}

async function showNetworkMenu(screen) {
  const networkDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Network Tools{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['Run Ping Test', 'Run Speed Test', 'Back'],
  });

  screen.append(networkDialog);
  screen.render();
  networkDialog.focus();

  networkDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Run Ping Test': {
          await showPingTestDialog(screen);
          break;
        }
        case 'Run Speed Test': {
          const speedResult = await networkService.runSpeedTest();
          showMessage(screen, 'Speed Test Results', speedResult);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Network test failed: ${error.message}`);
    }

    if (selected !== 'Run Ping Test') {
      networkDialog.destroy();
      screen.render();
    }
  });

  networkDialog.key(['escape'], () => {
    networkDialog.destroy();
    screen.render();
  });
}

async function showDriverMenu(screen) {
  const driverDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '40%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Driver Management{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: ['Check for Driver Updates', 'Update Drivers', 'Back'],
  });

  screen.append(driverDialog);
  screen.render();
  driverDialog.focus();

  driverDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Check for Driver Updates': {
          const drivers = await driverService.detectDrivers();
          showListDialog(screen, 'Available Driver Updates', drivers);
          break;
        }
        case 'Update Drivers': {
          await showUpdateDriverDialog(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Driver operation failed: ${error.message}`);
    }

    if (selected !== 'Update Drivers') {
      driverDialog.destroy();
      screen.render();
    }
  });

  driverDialog.key(['escape'], () => {
    driverDialog.destroy();
    screen.render();
  });
}

async function showSystemRestoreMenu(screen) {
  const restoreDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '40%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}System Restore{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: [
      'Create Restore Point',
      'List Restore Points',
      'Delete Restore Point',
      'Clean Old Restore Points',
      'Back',
    ],
  });

  screen.append(restoreDialog);
  screen.render();
  restoreDialog.focus();

  restoreDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Create Restore Point': {
          await showCreateRestorePointDialog(screen);
          break;
        }
        case 'List Restore Points': {
          const restorePoints = await systemRestoreService.listRestorePoints();
          showMessage(screen, 'System Restore Points', restorePoints);
          break;
        }
        case 'Delete Restore Point': {
          await showDeleteRestorePointDialog(screen);
          break;
        }
        case 'Clean Old Restore Points': {
          const cleanSuccess = await systemRestoreService.deleteOldRestorePoints(5);
          if (cleanSuccess) {
            showMessage(screen, 'Success', 'Old restore points cleaned successfully!');
          } else {
            showMessage(screen, 'Info', 'Operation completed or not supported.');
          }
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `System restore operation failed: ${error.message}`);
    }

    if (!['Create Restore Point', 'Delete Restore Point'].includes(selected)) {
      restoreDialog.destroy();
      screen.render();
    }
  });

  restoreDialog.key(['escape'], () => {
    restoreDialog.destroy();
    screen.render();
  });
}

// Helper dialog functions
function showMessage(screen, title, message) {
  const dialog = blessed.box({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '40%',
    border: {
      type: 'line',
    },
    label: ` {green-fg}${title}{/green-fg} `,
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
    scrollable: true,
    alwaysScroll: true,
    content: message,
    keys: true,
  });

  screen.append(dialog);
  screen.render();

  dialog.key(['enter', 'escape', 'q'], () => {
    dialog.destroy();
    screen.render();
  });

  dialog.focus();
}

function showListDialog(screen, title, items) {
  const dialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '70%',
    height: '60%',
    border: {
      type: 'line',
    },
    label: ` ${title} `,
    style: {
      border: {
        fg: 'cyan',
      },
      selected: {
        bg: 'blue',
      },
    },
    scrollable: true,
    items: items,
  });

  screen.append(dialog);
  screen.render();
  dialog.focus();

  dialog.key(['escape'], () => {
    dialog.destroy();
    screen.render();
  });
}

async function showAvailableUpdates(screen) {
  const progressDialog = blessed.loading({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Checking for Updates ',
    style: {
      border: {
        fg: 'yellow',
      },
    },
  });

  screen.append(progressDialog);

  // Animated loading messages
  const loadingMessages = [
    'Scanning package managers for updates...',
    'Checking Winget packages...',
    'Checking NPM packages...',
    'Checking Scoop packages...',
    'Checking Chocolatey packages...',
    'Checking Pip packages...',
    'Analyzing update information...',
  ];

  let messageIndex = 0;
  const messageInterval = setInterval(() => {
    if (messageIndex < loadingMessages.length) {
      progressDialog.load(loadingMessages[messageIndex]);
      screen.render();
      messageIndex++;
    }
  }, 800);

  try {
    const updates = await packageManagerService.getAvailableUpdatesAsync();
    clearInterval(messageInterval);

    progressDialog.stop();
    progressDialog.destroy();
    screen.render();

    if (updates.length === 0) {
      showMessage(
        screen,
        'Available Updates',
        'No updates available. All packages are up to date!'
      );
    } else {
      const updateText = updates
        .map(
          update =>
            `${update.packageManager.toUpperCase()}: ${update.packageName} (${update.currentVersion} → ${update.availableVersion})`
        )
        .join('\n');

      showMessage(
        screen,
        'Available Updates',
        `Found ${updates.length} available update(s):\n\n${updateText}`
      );
    }
  } catch (error) {
    clearInterval(messageInterval);
    progressDialog.stop();
    progressDialog.destroy();
    screen.render();
    showMessage(screen, 'Error', `Failed to check for updates: ${error.message}`);
  }
}

async function runPackageUpdate(screen, managerName, updateFunction) {
  const progressDialog = blessed.loading({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ` Updating ${managerName} `,
    style: {
      border: {
        fg: 'green',
      },
    },
  });

  screen.append(progressDialog);

  // Animated loading messages
  const loadingMessages = [
    `Initializing ${managerName} update...`,
    `Connecting to ${managerName} repository...`,
    `Downloading package information...`,
    `Installing updates...`,
    `Finalizing ${managerName} update...`,
  ];

  let messageIndex = 0;
  const messageInterval = setInterval(() => {
    if (messageIndex < loadingMessages.length) {
      progressDialog.load(loadingMessages[messageIndex]);
      screen.render();
      messageIndex++;
    }
  }, 1000);

  try {
    await updateFunction();
    clearInterval(messageInterval);
    progressDialog.stop();
    progressDialog.destroy();

    // Success animation
    const successDialog = blessed.box({
      top: 'center',
      left: 'center',
      width: '40%',
      height: '15%',
      border: {
        type: 'line',
      },
      label: ' Success ',
      content: `\n${managerName} update completed successfully!\n\nPress any key to continue...`,
      style: {
        border: {
          fg: 'green',
        },
        fg: 'green',
      },
    });

    screen.append(successDialog);
    screen.render();

    // Auto-close after 2 seconds
    setTimeout(() => {
      successDialog.destroy();
      screen.render();
    }, 2000);

    successDialog.key(['enter', 'escape', 'space'], () => {
      successDialog.destroy();
      screen.render();
    });
    successDialog.focus();
  } catch (error) {
    clearInterval(messageInterval);
    progressDialog.stop();
    progressDialog.destroy();
    showMessage(screen, 'Error', `Failed to update ${managerName}: ${error.message}`);
  }
}

async function runUpdateAll(screen) {
  const progressDialog = blessed.loading({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '25%',
    border: {
      type: 'line',
    },
    label: ' Updating All Package Managers ',
    style: {
      border: {
        fg: 'green',
      },
    },
  });

  screen.append(progressDialog);

  // Animated loading message
  let loadingDots = 0;
  const loadingInterval = setInterval(() => {
    const dots = '.'.repeat((loadingDots % 4) + 1);
    progressDialog.load(`Updating all package managers${dots}`);
    screen.render();
    loadingDots++;
  }, 300);

  try {
    // Check which managers are available
    const [winget, npm, scoop, choco, pip] = await Promise.all([
      packageManagerService.isWingetInstalled(),
      packageManagerService.isNpmInstalled(),
      packageManagerService.isScoopInstalled(),
      packageManagerService.isChocoInstalled(),
      packageManagerService.isPipInstalled(),
    ]);

    clearInterval(loadingInterval);

    const availableManagers = [];
    if (winget) availableManagers.push('winget');
    if (npm) availableManagers.push('npm');
    if (scoop) availableManagers.push('scoop');
    if (choco) availableManagers.push('choco');
    if (pip) availableManagers.push('pip');

    if (availableManagers.length === 0) {
      progressDialog.stop();
      progressDialog.destroy();
      showMessage(
        screen,
        'No Package Managers',
        'No supported package managers found on this system.'
      );
      return;
    }

    // Update all managers
    const results = [];
    for (let i = 0; i < availableManagers.length; i++) {
      const manager = availableManagers[i];
      const progress = Math.round(((i + 1) / availableManagers.length) * 100);
      progressDialog.load(
        `Updating ${manager}... (${i + 1}/${availableManagers.length}) [${progress}%]`
      );
      screen.render();

      try {
        switch (manager) {
          case 'winget': {
            await packageManagerService.updateWinget();
            break;
          }
          case 'npm': {
            await packageManagerService.updateNpm();
            break;
          }
          case 'scoop': {
            await packageManagerService.updateScoop();
            break;
          }
          case 'choco': {
            await packageManagerService.updateChoco();
            break;
          }
          case 'pip': {
            await packageManagerService.updatePip();
            break;
          }
        }
        results.push(`${manager}: Success`);
      } catch (error) {
        results.push(`${manager}: Failed - ${error.message}`);
      }
    }

    // Update PowerShell modules
    progressDialog.load('Updating PowerShell modules... [Finalizing]');
    screen.render();

    try {
      await packageManagerService.updatePowerShellModules();
      results.push('PowerShell Modules: Success');
    } catch (error) {
      results.push(`PowerShell Modules: Failed - ${error.message}`);
    }

    clearInterval(loadingInterval);
    progressDialog.stop();
    progressDialog.destroy();

    const resultText = results.join('\n');
    showMessage(screen, 'Update Results', `Update Complete!\n\n${resultText}`);
  } catch (error) {
    if (loadingInterval) clearInterval(loadingInterval);
    progressDialog.stop();
    progressDialog.destroy();
    showMessage(screen, 'Error', `Update process failed: ${error.message}`);
  }
}

async function showDisableStartupDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Disable Startup Program ',
    style: {
      border: {
        fg: 'magenta',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter program name to disable:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    try {
      const success = await startupService.disableStartupProgram(value);
      if (success) {
        showMessage(screen, 'Success', `Successfully disabled startup program: ${value}`);
      } else {
        showMessage(screen, 'Error', `Failed to disable startup program: ${value}`);
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    inputDialog.destroy();
    screen.render();
  });
}

async function showUninstallProgramDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Uninstall Program ',
    style: {
      border: {
        fg: 'red',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter program name to uninstall:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    try {
      const success = await uninstallerService.uninstallProgram(value);
      if (success) {
        showMessage(screen, 'Success', `Successfully initiated uninstall for: ${value}`);
      } else {
        showMessage(screen, 'Error', `Failed to uninstall: ${value}`);
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    inputDialog.destroy();
    screen.render();
  });
}

async function showSetDnsDialog(screen) {
  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '30%',
    border: {
      type: 'line',
    },
    label: ' Set DNS Servers ',
    style: {
      border: {
        fg: 'cyan',
      },
    },
  });

  const primaryInput = blessed.textbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' Primary DNS ',
  });

  const secondaryInput = blessed.textbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' Secondary DNS (optional) ',
  });

  const submitButton = blessed.button({
    parent: form,
    top: 10,
    left: 2,
    width: 10,
    height: 3,
    content: 'Set DNS',
    style: {
      bg: 'green',
      fg: 'white',
      focus: {
        bg: 'blue',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 10,
    left: 15,
    width: 10,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'red',
      fg: 'white',
      focus: {
        bg: 'blue',
      },
    },
  });

  screen.append(form);
  screen.render();
  primaryInput.focus();

  submitButton.on('press', async () => {
    const primary = primaryInput.getValue();
    const secondary = secondaryInput.getValue();

    if (!primary) {
      showMessage(screen, 'Error', 'Primary DNS is required.');
      return;
    }

    try {
      const success = await dnsService.setDns(primary, secondary);
      if (success) {
        showMessage(screen, 'Success', 'DNS settings updated successfully!');
      } else {
        showMessage(screen, 'Error', 'Failed to update DNS settings.');
      }
    } catch (error) {
      showMessage(screen, 'Error', `DNS operation failed: ${error.message}`);
    }

    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showPingTestDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Ping Test ',
    style: {
      border: {
        fg: 'blue',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter host to ping (default: 8.8.8.8):', '8.8.8.8', async (error, value) => {
    if (error) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    const host = value || '8.8.8.8';

    const progressDialog = blessed.loading({
      top: 'center',
      left: 'center',
      width: '50%',
      height: '20%',
      border: {
        type: 'line',
      },
      label: ' Running Ping Test ',
      style: {
        border: {
          fg: 'blue',
        },
      },
    });

    inputDialog.destroy();
    screen.append(progressDialog);
    progressDialog.load(`Pinging ${host}...`);
    screen.render();

    try {
      const result = await networkService.runPingTest(host);
      progressDialog.stop();
      progressDialog.destroy();
      showMessage(screen, 'Ping Test Results', result);
    } catch (error) {
      progressDialog.stop();
      progressDialog.destroy();
      showMessage(screen, 'Error', `Ping test failed: ${error.message}`);
    }
  });
}

async function showUpdateDriverDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Update Driver ',
    style: {
      border: {
        fg: 'yellow',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter driver name to update:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    try {
      const success = await driverService.updateDriver(value);
      if (success) {
        showMessage(screen, 'Success', `Driver update initiated for: ${value}`);
      } else {
        showMessage(screen, 'Error', `Failed to update driver: ${value}`);
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    inputDialog.destroy();
    screen.render();
  });
}

async function showCreateRestorePointDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Create Restore Point ',
    style: {
      border: {
        fg: 'red',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input(
    'Enter description for restore point:',
    'Manual System Restore Point',
    async (error, value) => {
      if (error) {
        inputDialog.destroy();
        screen.render();
        return;
      }

      const description = value || 'Manual System Restore Point';

      const progressDialog = blessed.loading({
        top: 'center',
        left: 'center',
        width: '50%',
        height: '20%',
        border: {
          type: 'line',
        },
        label: ' Creating Restore Point ',
        style: {
          border: {
            fg: 'red',
          },
        },
      });

      inputDialog.destroy();
      screen.append(progressDialog);
      progressDialog.load('Creating system restore point...');
      screen.render();

      try {
        const success = await systemRestoreService.createRestorePoint(description);
        progressDialog.stop();
        progressDialog.destroy();

        if (success) {
          showMessage(screen, 'Success', 'System restore point created successfully!');
        } else {
          showMessage(screen, 'Error', 'Failed to create system restore point.');
        }
      } catch (error) {
        progressDialog.stop();
        progressDialog.destroy();
        showMessage(screen, 'Error', `Failed to create restore point: ${error.message}`);
      }
    }
  );
}

async function showDeleteRestorePointDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Delete Restore Point ',
    style: {
      border: {
        fg: 'red',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter sequence number to delete:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    const sequenceNumber = parseInt(value);
    if (isNaN(sequenceNumber)) {
      showMessage(screen, 'Error', 'Please enter a valid sequence number.');
      inputDialog.destroy();
      screen.render();
      return;
    }

    try {
      const success = await systemRestoreService.deleteRestorePoint(sequenceNumber);
      if (success) {
        showMessage(screen, 'Success', 'Restore point deleted successfully!');
      } else {
        showMessage(screen, 'Error', 'Failed to delete restore point or operation not supported.');
      }
    } catch (error) {
      showMessage(screen, 'Error', `Operation failed: ${error.message}`);
    }

    inputDialog.destroy();
    screen.render();
  });
}

async function loadBuiltinPlugin(pluginFileName) {
  const userPluginsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'InvolveX', 'Plugins');
  const candidatePaths = [
    path.join(__dirname, 'plugins', pluginFileName),
    path.join(userPluginsDir, pluginFileName),
  ];

  for (const pluginPath of candidatePaths) {
    try {
      const resolvedPath = require.resolve(pluginPath);
      delete require.cache[resolvedPath];
      const PluginClass = require(pluginPath);
      if (typeof PluginClass !== 'function') {
        continue;
      }
      const pluginInstance = new PluginClass();
      if (typeof pluginInstance.initializeAsync === 'function') {
        await pluginInstance.initializeAsync();
      }
      return pluginInstance;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        logService.log(`Failed to load plugin '${pluginFileName}': ${error.message}`);
      }
    }
  }

  return null;
}

async function loadBuiltinPluginsForMenu() {
  const builtinFiles = [
    'SystemMonitorPlugin.js',
    'ProcessManagerPlugin.js',
    'ServiceManagerPlugin.js',
  ];

  const plugins = [];
  for (const fileName of builtinFiles) {
    const plugin = await loadBuiltinPlugin(fileName);
    if (plugin) {
      plugins.push(plugin);
    }
  }
  return plugins;
}

async function runBuiltinPlugin(screen, pluginFileName, method = 'execute') {
  const plugin = await loadBuiltinPlugin(pluginFileName);
  if (!plugin) {
    showMessage(screen, 'Plugin Missing', 'Plugin not available. Ensure it is installed.');
    return;
  }

  try {
    if (typeof plugin[method] === 'function') {
      await plugin[method](screen);
    } else if (typeof plugin.execute === 'function') {
      await plugin.execute(screen);
    } else {
      showMessage(
        screen,
        'Plugin Error',
        `Plugin '${plugin.name || 'Unknown'}' does not support interactive execution.`
      );
    }
  } catch (error) {
    showMessage(screen, 'Plugin Error', `Plugin execution failed: ${error.message}`);
  } finally {
    if (typeof plugin.shutdownAsync === 'function') {
      await plugin.shutdownAsync();
    }
  }
}

async function showSystemMonitor(screen) {
  await runBuiltinPlugin(screen, 'SystemMonitorPlugin.js', 'displayMonitor');
}

async function showProcessManager(screen) {
  await runBuiltinPlugin(screen, 'ProcessManagerPlugin.js');
}

async function showServiceManager(screen) {
  await runBuiltinPlugin(screen, 'ServiceManagerPlugin.js');
}

async function showPluginsMenu(screen) {
  const pluginsDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Plugin Management{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: [
      'List Installed Plugins',
      'Browse Plugin Repository',
      'Install Plugin',
      'Uninstall Plugin',
      'Execute Plugin',
      'System Monitor',
      'Process Manager',
      'Service Manager',
      'Back',
    ],
  });

  screen.append(pluginsDialog);
  screen.render();
  pluginsDialog.focus();

  pluginsDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'List Installed Plugins': {
          const plugins = pluginService.getLoadedPlugins();
          const pluginNames = plugins.map(
            p => `${p.name || 'Unknown'} - ${p.description || 'No description'}`
          );
          showListDialog(screen, 'Installed Plugins', pluginNames);
          break;
        }
        case 'Browse Plugin Repository': {
          await showPluginRepositoryDialog(screen);
          break;
        }
        case 'Install Plugin': {
          await showInstallPluginDialog(screen);
          break;
        }
        case 'Uninstall Plugin': {
          await showUninstallPluginDialog(screen);
          break;
        }
        case 'Execute Plugin': {
          await showExecutePluginDialog(screen);
          break;
        }
        case 'System Monitor': {
          await showSystemMonitor(screen);
          break;
        }
        case 'Process Manager': {
          await showProcessManager(screen);
          break;
        }
        case 'Service Manager': {
          await showServiceManager(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Plugin operation failed: ${error.message}`);
    }

    if (
      ![
        'Browse Plugin Repository',
        'Install Plugin',
        'Uninstall Plugin',
        'Execute Plugin',
        'System Monitor',
        'Process Manager',
        'Service Manager',
      ].includes(selected)
    ) {
      pluginsDialog.destroy();
      screen.render();
    }
  });

  pluginsDialog.key(['escape'], () => {
    pluginsDialog.destroy();
    screen.render();
  });
}

async function showPluginRepositoryDialog(screen) {
  const progressDialog = blessed.loading({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Loading Plugin Repository ',
    style: {
      border: {
        fg: 'magenta',
      },
    },
  });

  screen.append(progressDialog);
  progressDialog.load('Fetching available plugins...');
  screen.render();

  try {
    const plugins = await pluginRepositoryService.getAvailablePluginsAsync();

    progressDialog.stop();
    progressDialog.destroy();

    if (plugins.length === 0) {
      showMessage(
        screen,
        'Plugin Repository',
        'No plugins available in repository or unable to fetch repository.'
      );
    } else {
      const pluginList = plugins.map(p => `${p.name} v${p.version} - ${p.description}`);
      showListDialog(screen, 'Available Plugins', pluginList);
    }
  } catch (error) {
    progressDialog.stop();
    progressDialog.destroy();
    showMessage(screen, 'Error', `Failed to load plugin repository: ${error.message}`);
  }
}

async function showInstallPluginDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Install Plugin ',
    style: {
      border: {
        fg: 'magenta',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter plugin file path to install:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    const progressDialog = blessed.loading({
      top: 'center',
      left: 'center',
      width: '50%',
      height: '20%',
      border: {
        type: 'line',
      },
      label: ' Installing Plugin ',
      style: {
        border: {
          fg: 'magenta',
        },
      },
    });

    inputDialog.destroy();
    screen.append(progressDialog);
    progressDialog.load('Installing plugin...');
    screen.render();

    try {
      const success = await pluginService.installPluginAsync(value);
      progressDialog.stop();
      progressDialog.destroy();

      if (success) {
        showMessage(screen, 'Success', 'Plugin installed successfully!');
      } else {
        showMessage(screen, 'Error', 'Failed to install plugin.');
      }
    } catch (error) {
      progressDialog.stop();
      progressDialog.destroy();
      showMessage(screen, 'Error', `Plugin installation failed: ${error.message}`);
    }
  });
}

async function showUninstallPluginDialog(screen) {
  const plugins = pluginService.getLoadedPlugins();
  if (plugins.length === 0) {
    showMessage(screen, 'No Plugins', 'No plugins are currently loaded.');
    return;
  }

  const pluginList = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Select Plugin to Uninstall{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: plugins.map(p => `${p.name || 'Unknown'} - ${p.description || 'No description'}`),
  });

  screen.append(pluginList);
  screen.render();
  pluginList.focus();

  pluginList.on('select', async (item, index) => {
    const plugin = plugins[index];
    pluginList.destroy();
    screen.render();

    if (!plugin?.name) {
      showMessage(screen, 'Error', 'Invalid plugin selected.');
      return;
    }

    try {
      const success = await pluginService.uninstallPluginAsync(plugin.name);
      if (success) {
        showMessage(screen, 'Success', `Plugin '${plugin.name}' uninstalled successfully!`);
      } else {
        showMessage(screen, 'Error', `Failed to uninstall plugin '${plugin.name}'.`);
      }
    } catch (error) {
      showMessage(screen, 'Error', `Plugin uninstallation failed: ${error.message}`);
    }
  });

  pluginList.key(['escape'], () => {
    pluginList.destroy();
    screen.render();
  });
}

async function showExecutePluginDialog(screen) {
  const builtinPlugins = await loadBuiltinPluginsForMenu();
  const loadedPlugins = pluginService.getLoadedPlugins();
  const allPlugins = [...builtinPlugins, ...loadedPlugins].filter(
    plugin => typeof plugin.execute === 'function' || typeof plugin.displayMonitor === 'function'
  );

  if (allPlugins.length === 0) {
    showMessage(screen, 'No Plugins', 'No plugins are currently available to execute.');
    return;
  }

  const pluginList = blessed.list({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '60%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Select Plugin to Execute{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: allPlugins.map(
      plugin => `${plugin.name || 'Unknown'} - ${plugin.description || 'No description'}`
    ),
  });

  screen.append(pluginList);
  screen.render();
  pluginList.focus();

  pluginList.on('select', async (item, index) => {
    const plugin = allPlugins[index];
    pluginList.destroy();
    screen.render();

    if (!plugin) {
      showMessage(screen, 'Plugin Error', 'Unable to load the selected plugin.');
      return;
    }

    try {
      if (typeof plugin.execute === 'function') {
        await plugin.execute(screen);
      } else if (typeof plugin.displayMonitor === 'function') {
        await plugin.displayMonitor(screen);
      } else {
        showMessage(
          screen,
          'Plugin Execution',
          `Plugin '${plugin.name || 'Unknown'}' does not provide an executable action.`
        );
      }
    } catch (error) {
      showMessage(screen, 'Plugin Execution', `Plugin execution failed: ${error.message}`);
    } finally {
      if (typeof plugin.shutdownAsync === 'function') {
        await plugin.shutdownAsync();
      }
    }
  });

  pluginList.key(['escape'], () => {
    pluginList.destroy();
    screen.render();
  });
}

async function showSettingsMenu(screen) {
  const settingsDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '60%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'green',
        fg: 'black',
      },
    },
    keys: true,
    items: [
      'Auto-Update CLI',
      'Package Auto-Update',
      'Auto Cache Clearing',
      'Auto Memory Clearing',
      'Discord RPC',
      'View Settings',
      'Back',
    ],
  });

  screen.append(settingsDialog);
  screen.render();
  settingsDialog.focus();

  settingsDialog.on('select', async (item, _index) => {
    const selected = item.getText();

    try {
      switch (selected) {
        case 'Auto-Update CLI': {
          await showAutoUpdateSettings(screen);
          break;
        }
        case 'Package Auto-Update': {
          await showPackageAutoUpdateSettings(screen);
          break;
        }
        case 'Auto Cache Clearing': {
          await showAutoCacheClearingSettings(screen);
          break;
        }
        case 'Auto Memory Clearing': {
          await showAutoMemoryClearingSettings(screen);
          break;
        }
        case 'Discord RPC': {
          await showDiscordRPCSettings(screen);
          break;
        }
        case 'View Settings': {
          await showViewSettings(screen);
          break;
        }
      }
    } catch (error) {
      showMessage(screen, 'Error', `Settings operation failed: ${error.message}`);
    }

    if (
      selected !== 'Auto-Update CLI' &&
      selected !== 'Package Auto-Update' &&
      selected !== 'Auto Cache Clearing' &&
      selected !== 'Auto Memory Clearing' &&
      selected !== 'Discord RPC'
    ) {
      settingsDialog.destroy();
      screen.render();
    }
  });

  settingsDialog.key(['escape'], () => {
    settingsDialog.destroy();
    screen.render();
  });
}

async function showAutoUpdateSettings(screen) {
  const settings = settingsService.getSettings();
  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Auto-Update CLI Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const enabledCheckbox = blessed.checkbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Enable Auto-Update',
    checked: settings.autoUpdate?.enabled || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const autoInstallCheckbox = blessed.checkbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Auto-Install Updates (if globally installed)',
    checked: settings.autoUpdate?.autoInstall || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const intervalInput = blessed.textbox({
    parent: form,
    top: 10,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Check Interval (hours){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.autoUpdate?.checkIntervalHours || 24),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const saveButton = blessed.button({
    parent: form,
    top: 14,
    left: 2,
    width: 12,
    height: 3,
    content: 'Save',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 14,
    left: 16,
    width: 12,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  screen.append(form);
  screen.render();
  enabledCheckbox.focus();

  saveButton.on('press', async () => {
    const enabled = enabledCheckbox.checked;
    const autoInstall = autoInstallCheckbox.checked;
    const interval = parseInt(intervalInput.getValue()) || 24;

    settingsService.updateSettings({
      autoUpdate: {
        enabled,
        autoInstall,
        checkIntervalHours: interval,
      },
    });

    await settingsService.saveSettingsAsync();
    showMessage(screen, 'Success', 'Auto-update settings saved!');
    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showPackageAutoUpdateSettings(screen) {
  const settings = settingsService.getSettings();
  const managers = settings.packageAutoUpdate?.managers || {};

  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '60%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Package Auto-Update Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const enabledCheckbox = blessed.checkbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Enable Package Auto-Update',
    checked: settings.packageAutoUpdate?.enabled || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const wingetCheckbox = blessed.checkbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Winget',
    checked: managers.winget || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const npmCheckbox = blessed.checkbox({
    parent: form,
    top: 9,
    left: 2,
    width: '90%',
    height: 3,
    content: 'NPM',
    checked: managers.npm || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const scoopCheckbox = blessed.checkbox({
    parent: form,
    top: 12,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Scoop',
    checked: managers.scoop || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const chocoCheckbox = blessed.checkbox({
    parent: form,
    top: 15,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Chocolatey',
    checked: managers.choco || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const pipCheckbox = blessed.checkbox({
    parent: form,
    top: 18,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Pip',
    checked: managers.pip || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const intervalInput = blessed.textbox({
    parent: form,
    top: 21,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Check Interval (hours){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.packageAutoUpdate?.checkIntervalHours || 24),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const saveButton = blessed.button({
    parent: form,
    top: 25,
    left: 2,
    width: 12,
    height: 3,
    content: 'Save',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 25,
    left: 16,
    width: 12,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  screen.append(form);
  screen.render();
  enabledCheckbox.focus();

  saveButton.on('press', async () => {
    const enabled = enabledCheckbox.checked;
    const interval = parseInt(intervalInput.getValue()) || 24;

    settingsService.updateSettings({
      packageAutoUpdate: {
        enabled,
        managers: {
          winget: wingetCheckbox.checked,
          npm: npmCheckbox.checked,
          scoop: scoopCheckbox.checked,
          choco: chocoCheckbox.checked,
          pip: pipCheckbox.checked,
        },
        checkIntervalHours: interval,
      },
    });

    await settingsService.saveSettingsAsync();
    showMessage(screen, 'Success', 'Package auto-update settings saved!');
    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showAutoCacheClearingSettings(screen) {
  const settings = settingsService.getSettings();
  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '40%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Auto Cache Clearing Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const enabledCheckbox = blessed.checkbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Enable Auto Cache Clearing',
    checked: settings.autoCacheClearing?.enabled || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const intervalInput = blessed.textbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Interval (hours){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.autoCacheClearing?.intervalHours || 168),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const saveButton = blessed.button({
    parent: form,
    top: 10,
    left: 2,
    width: 12,
    height: 3,
    content: 'Save',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 10,
    left: 16,
    width: 12,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  screen.append(form);
  screen.render();
  enabledCheckbox.focus();

  saveButton.on('press', async () => {
    const enabled = enabledCheckbox.checked;
    const interval = parseInt(intervalInput.getValue()) || 168;

    settingsService.updateSettings({
      autoCacheClearing: {
        enabled,
        intervalHours: interval,
        lastCleared: settings.autoCacheClearing?.lastCleared || null,
      },
    });

    await settingsService.saveSettingsAsync();
    showMessage(screen, 'Success', 'Auto cache clearing settings saved!');
    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showAutoMemoryClearingSettings(screen) {
  const settings = settingsService.getSettings();
  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Auto Memory Clearing Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const enabledCheckbox = blessed.checkbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Enable Auto Memory Clearing',
    checked: settings.autoMemoryClearing?.enabled || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const thresholdInput = blessed.textbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Threshold (MB){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.autoMemoryClearing?.thresholdMB || 4096),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const intervalInput = blessed.textbox({
    parent: form,
    top: 10,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Interval (minutes){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.autoMemoryClearing?.intervalMinutes || 60),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const saveButton = blessed.button({
    parent: form,
    top: 14,
    left: 2,
    width: 12,
    height: 3,
    content: 'Save',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 14,
    left: 16,
    width: 12,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  screen.append(form);
  screen.render();
  enabledCheckbox.focus();

  saveButton.on('press', async () => {
    const enabled = enabledCheckbox.checked;
    const threshold = parseInt(thresholdInput.getValue()) || 4096;
    const interval = parseInt(intervalInput.getValue()) || 60;

    settingsService.updateSettings({
      autoMemoryClearing: {
        enabled,
        thresholdMB: threshold,
        intervalMinutes: interval,
        lastCleared: settings.autoMemoryClearing?.lastCleared || null,
      },
    });

    await settingsService.saveSettingsAsync();
    showMessage(screen, 'Success', 'Auto memory clearing settings saved!');
    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showDiscordRPCSettings(screen) {
  const settings = settingsService.getSettings();
  const form = blessed.form({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Discord RPC Settings{/green-fg} ',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const enabledCheckbox = blessed.checkbox({
    parent: form,
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    content: 'Enable Discord Rich Presence',
    checked: settings.discordRPC?.enabled || false,
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const clientIdInput = blessed.textbox({
    parent: form,
    top: 6,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Discord Application Client ID{/green-fg} ',
    inputOnFocus: true,
    value: settings.discordRPC?.clientId || '',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  const intervalInput = blessed.textbox({
    parent: form,
    top: 10,
    left: 2,
    width: '90%',
    height: 3,
    border: {
      type: 'line',
    },
    label: ' {green-fg}Update Interval (seconds){/green-fg} ',
    inputOnFocus: true,
    value: String(settings.discordRPC?.updateIntervalSeconds || 15),
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
  });

  blessed.box({
    parent: form,
    top: 14,
    left: 2,
    width: '90%',
    height: 3,
    content: '{green-fg}Note: Create a Discord app at discord.com/developers{/green-fg}',
    style: {
      bg: 'black',
      fg: 'green',
    },
  });

  const saveButton = blessed.button({
    parent: form,
    top: 18,
    left: 2,
    width: 12,
    height: 3,
    content: 'Save',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  const cancelButton = blessed.button({
    parent: form,
    top: 18,
    left: 16,
    width: 12,
    height: 3,
    content: 'Cancel',
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
      focus: {
        bg: 'green',
        fg: 'black',
      },
    },
  });

  screen.append(form);
  screen.render();
  enabledCheckbox.focus();

  saveButton.on('press', async () => {
    const enabled = enabledCheckbox.checked;
    const clientId = clientIdInput.getValue().trim();
    const interval = parseInt(intervalInput.getValue()) || 15;

    if (enabled && !clientId) {
      showMessage(screen, 'Error', 'Discord Client ID is required when enabled!');
      return;
    }

    settingsService.updateSettings({
      discordRPC: {
        enabled,
        clientId,
        updateIntervalSeconds: interval,
      },
    });

    await settingsService.saveSettingsAsync();

    // Restart Discord RPC if enabled
    if (enabled && global.discordRPCPlugin) {
      await global.discordRPCPlugin.stop();
      delete global.discordRPCPlugin;
    }

    if (enabled) {
      await initializeDiscordRPC();
    } else if (global.discordRPCPlugin) {
      await global.discordRPCPlugin.stop();
      delete global.discordRPCPlugin;
    }

    showMessage(screen, 'Success', 'Discord RPC settings saved!');
    form.destroy();
    screen.render();
  });

  cancelButton.on('press', () => {
    form.destroy();
    screen.render();
  });

  form.key(['escape'], () => {
    form.destroy();
    screen.render();
  });
}

async function showViewSettings(screen) {
  const settings = settingsService.getSettings();
  const settingsText = JSON.stringify(settings, null, 2);
  showMessage(screen, 'Current Settings', settingsText);
}

function showHelpDialog(screen) {
  const helpContent = `{green-fg}██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗
██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝
██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝
██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗
██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗
╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝

              Windows System Administration Toolkit{/green-fg}

{green-fg}NAVIGATION:{/green-fg}
• Use arrow keys to navigate menus
• Press Enter to select an option
• Press F10 or Escape to quit
• Press F9 for this help

{green-fg}FEATURES:{/green-fg}
• Update: Update package managers and packages
• Cache: Clear system and memory caches
• Startup: Manage startup programs
• Uninstall: Remove installed programs
• DNS: Configure DNS settings
• Network: Ping and speed tests
• Driver: Check and update drivers
• System Restore: Manage restore points
• Plugins: Extensible plugin system
• Settings: Configure auto-updates and automation

{green-fg}SHORTCUTS:{/green-fg}
• F10: Quit application
• F9: Show help
• Escape: Go back/Cancel

{green-fg}For more information, visit: https://github.com/involvex/Involvex-Cli{/green-fg}`;

  const helpDialog = blessed.box({
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    border: {
      type: 'line',
    },
    label: ' {green-fg}Help{/green-fg} ',
    content: helpContent,
    style: {
      bg: 'black',
      fg: 'green',
      border: {
        fg: 'green',
      },
    },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
  });

  screen.append(helpDialog);
  screen.render();

  helpDialog.key(['enter', 'escape', 'q'], () => {
    helpDialog.destroy();
    screen.render();
  });

  helpDialog.focus();
}

// Main function
async function main() {
  // Set up command line interface
  const program = new Command();

  program
    .name('involvex-cli')
    .description('Windows System Administration Toolkit')
    .version(VERSION)
    .allowUnknownOption(false)
    .allowExcessArguments(false)
    .configureHelp({
      helpWidth: 120,
    });

  // Prevent commander from showing help automatically
  program.exitOverride();

  // Suppress help output when we don't want it
  const originalHelp = program.helpInformation;
  program.helpInformation = function () {
    // Only show help if explicitly requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      return originalHelp.call(this);
    }
    return '';
  };

  // Plugin management commands
  program
    .command('plugin')
    .description('Plugin management commands')
    .argument('[action]', 'Action: list, install, uninstall, update')
    .argument('[name]', 'Plugin name (for install/uninstall/update)')
    .option('-p, --path <path>', 'Plugin file path (for install)')
    .action(async (action, name, options) => {
      await initializeConfig();

      if (!action || action === 'list') {
        // List plugins
        try {
          const plugins = pluginService.getLoadedPlugins();
          if (plugins.length === 0) {
            console.log('No plugins installed.');
          } else {
            console.log('Installed Plugins:');
            plugins.forEach(plugin => {
              console.log(
                `  ${plugin.name || 'Unknown'} v${plugin.version || '1.0.0'} - ${plugin.description || 'No description'}`
              );
            });
          }
        } catch (error) {
          console.error(`Failed to list plugins: ${error.message}`);
          process.exit(1);
        }
      } else if (action === 'install') {
        // Install plugin
        if (!options.path && !name) {
          console.error(
            'Error: Plugin path required. Use --path <path> or provide plugin file path.'
          );
          process.exit(1);
        }
        const pluginPath = options.path || name;
        try {
          console.log(`Installing plugin from: ${pluginPath}`);
          const success = await pluginService.installPluginAsync(pluginPath);
          if (success) {
            console.log('Plugin installed successfully!');
          } else {
            console.error('Failed to install plugin.');
            process.exit(1);
          }
        } catch (error) {
          console.error(`Failed to install plugin: ${error.message}`);
          process.exit(1);
        }
      } else if (action === 'uninstall') {
        // Uninstall plugin
        if (!name) {
          console.error('Error: Plugin name required.');
          process.exit(1);
        }
        try {
          console.log(`Uninstalling plugin: ${name}`);
          const success = await pluginService.uninstallPluginAsync(name);
          if (success) {
            console.log('Plugin uninstalled successfully!');
          } else {
            console.error('Failed to uninstall plugin.');
            process.exit(1);
          }
        } catch (error) {
          console.error(`Failed to uninstall plugin: ${error.message}`);
          process.exit(1);
        }
      } else if (action === 'update') {
        // Update plugin
        if (!name) {
          console.error('Error: Plugin name required.');
          process.exit(1);
        }
        try {
          console.log(`Updating plugin: ${name}`);
          // First uninstall, then reinstall if path provided
          const uninstalled = await pluginService.uninstallPluginAsync(name);
          if (uninstalled && options.path) {
            const installed = await pluginService.installPluginAsync(options.path);
            if (installed) {
              console.log('Plugin updated successfully!');
            } else {
              console.error('Failed to reinstall plugin after uninstall.');
              process.exit(1);
            }
          } else {
            console.log('Plugin uninstalled. Use "plugin install --path <path>" to reinstall.');
          }
        } catch (error) {
          console.error(`Failed to update plugin: ${error.message}`);
          process.exit(1);
        }
      } else {
        console.error(`Unknown plugin action: ${action}`);
        console.log('Available actions: list, install, uninstall, update');
        process.exit(1);
      }
    });

  // Legacy options for backward compatibility
  program
    .option('--update', 'Update package managers and packages')
    .option('--cache', 'Clear system and memory caches')
    .option('--startup', 'List startup programs')
    .option('--uninstall', 'List installed programs')
    .option('--dns', 'Show DNS configuration')
    .option('--network', 'Run network tests')
    .option('--driver', 'Check for driver updates')
    .option('--restore', 'List system restore points')
    .option('--plugins', 'List installed plugins (use "plugin list" instead)')
    .option('--serve', 'Start web server interface')
    .option('--port <port>', 'Port for web server (default: 3000)', '3000')
    .option('--host <host>', 'Host for web server (default: 0.0.0.0)', '0.0.0.0')
    .option('--path <path>', 'Path to serve static files (optional)');

  // Parse arguments - suppress help output and catch exit
  const originalExit = process.exit;
  const originalWrite = process.stdout.write;
  const originalErrWrite = process.stderr.write;
  let suppressOutput = false;

  process.exit = code => {
    // Don't prevent exit if serve is running - let it handle its own lifecycle
    if (
      code === 0 &&
      !process.argv.includes('--help') &&
      !process.argv.includes('-h') &&
      !process.argv.includes('--serve')
    ) {
      // Commander wants to exit, but we'll handle it ourselves
      return;
    }
    originalExit(code);
  };

  // Temporarily suppress output during parsing if not explicitly requesting help
  // But don't suppress if serve is being used (we want to see server messages)
  if (
    !process.argv.includes('--help') &&
    !process.argv.includes('-h') &&
    !process.argv.includes('--serve')
  ) {
    suppressOutput = true;
    process.stdout.write = () => true;
    process.stderr.write = () => true;
  }

  try {
    program.parse(process.argv);
  } catch {
    // Ignore parse errors, we'll handle them ourselves
  } finally {
    // Restore process.exit after parsing, but only if not serving
    if (!process.argv.includes('--serve')) {
      process.exit = originalExit;
    }
    if (suppressOutput) {
      process.stdout.write = originalWrite;
      process.stderr.write = originalErrWrite;
    }
  }

  const options = program.opts();

  // Check if any command or option was provided
  const hasOptions = Object.keys(options).length > 0;
  const hasCommand = program.args.length > 0 && program.args[0] !== 'help';

  // Handle command line arguments
  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  // Check for serve option early (before other option handlers)
  if (options.serve) {
    await initializeConfig();
    const port = parseInt(options.port || '3000', 10);
    const host = options.host || '0.0.0.0';

    const webServer = new WebServer(logService, {
      packageManager: packageManagerService,
      cache: cacheService,
      startup: startupService,
      uninstaller: uninstallerService,
      dns: dnsService,
      network: networkService,
      plugin: pluginService,
    });

    // Serve folder if path provided
    if (options.path) {
      const fs = require('fs');
      const path = require('path');
      const folderPath = path.resolve(options.path);
      try {
        const stats = await fs.promises.stat(folderPath);
        if (stats.isDirectory()) {
          webServer.serveFolder(folderPath);
          console.log(`Serving folder: ${folderPath}`);
        } else {
          console.error(`Error: ${folderPath} is not a directory`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error accessing folder: ${error.message}`);
        process.exit(1);
      }
    }

    try {
      await webServer.start(port, host);
      console.log(`\n🌐 Web server running at http://${host}:${port}`);
      console.log('Press Ctrl+C to stop the server\n');

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log('\nShutting down web server...');
        await webServer.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // The Express server keeps the event loop alive, so the process won't exit
      // We return here to prevent further execution, but the server will keep running
      return;
    } catch (error) {
      console.error(`Failed to start web server: ${error.message}`);
      process.exit(1);
    }
  }

  // Handle direct command execution
  if (options.update) {
    await initializeConfig();
    console.log('Checking for available updates...');
    try {
      const updates = await packageManagerService.getAvailableUpdatesAsync();
      if (updates.length === 0) {
        console.log('No updates available. All packages are up to date!');
      } else {
        console.log(`Found ${updates.length} available update(s):`);
        updates.forEach(update => {
          console.log(
            `${update.packageManager.toUpperCase()}: ${update.packageName} (${update.currentVersion} → ${update.availableVersion})`
          );
        });
      }
    } catch (error) {
      console.error(`Failed to check for updates: ${error.message}`);
    }
    return;
  }

  if (options.cache) {
    await initializeConfig();
    console.log('Clearing system caches...');
    try {
      const success = await cacheService.clearSystemCache();
      if (success) {
        console.log('System cache cleared successfully!');
      } else {
        console.log('Cache clearing not supported or failed.');
      }
    } catch (error) {
      console.error(`Failed to clear cache: ${error.message}`);
    }
    return;
  }

  if (options.startup) {
    await initializeConfig();
    console.log('Listing startup programs...');
    try {
      const programs = await startupService.listStartupPrograms();
      if (programs.length === 0) {
        console.log('No startup programs found.');
      } else {
        console.log('Startup Programs:');
        programs.forEach(program => console.log(`  ${program}`));
      }
    } catch (error) {
      console.error(`Failed to list startup programs: ${error.message}`);
    }
    return;
  }

  if (options.uninstall) {
    await initializeConfig();
    console.log('Listing installed programs...');
    try {
      const programs = await uninstallerService.listInstalledPrograms();
      if (programs.length === 0) {
        console.log('No installed programs found.');
      } else {
        console.log('Installed Programs:');
        programs.forEach(program => console.log(`  ${program}`));
      }
    } catch (error) {
      console.error(`Failed to list installed programs: ${error.message}`);
    }
    return;
  }

  if (options.dns) {
    await initializeConfig();
    console.log('DNS Configuration:');
    try {
      const dnsInfo = await dnsService.getCurrentDns();
      console.log(dnsInfo);
    } catch (error) {
      console.error(`Failed to get DNS configuration: ${error.message}`);
    }
    return;
  }

  if (options.network) {
    await initializeConfig();
    console.log('Running network tests...');
    try {
      const pingResult = await networkService.runPingTest('8.8.8.8');
      console.log('Ping Test Results:');
      console.log(pingResult);
    } catch (error) {
      console.error(`Failed to run network tests: ${error.message}`);
    }
    return;
  }

  if (options.driver) {
    await initializeConfig();
    console.log('Checking for driver updates...');
    try {
      const drivers = await driverService.detectDrivers();
      if (drivers.length === 0) {
        console.log('No driver updates available.');
      } else {
        console.log('Available Driver Updates:');
        drivers.forEach(driver => console.log(`  ${driver}`));
      }
    } catch (error) {
      console.error(`Failed to check for driver updates: ${error.message}`);
    }
    return;
  }

  if (options.restore) {
    await initializeConfig();
    console.log('Listing system restore points...');
    try {
      const restorePoints = await systemRestoreService.listRestorePoints();
      console.log('System Restore Points:');
      console.log(restorePoints);
    } catch (error) {
      console.error(`Failed to list restore points: ${error.message}`);
    }
    return;
  }

  if (options.plugins) {
    await initializeConfig();
    console.log('Listing installed plugins...');
    try {
      const plugins = pluginService.getLoadedPlugins();
      if (plugins.length === 0) {
        console.log('No plugins installed.');
      } else {
        console.log('Installed Plugins:');
        plugins.forEach(plugin =>
          console.log(
            `  ${plugin.name || 'Unknown'} v${plugin.version || '1.0.0'} - ${plugin.description || 'No description'}`
          )
        );
      }
    } catch (error) {
      console.error(`Failed to list plugins: ${error.message}`);
    }
    return;
  }

  // If no options or commands provided, start interactive TUI
  if (!hasOptions && !hasCommand) {
    // Check if terminal is interactive
    const forceInteractive =
      process.env.FORCE_INTERACTIVE === 'true' ||
      process.env.VSCODE_PID ||
      process.platform === 'win32';

    if (!forceInteractive && !isInteractiveTerminal()) {
      showNonInteractiveError();
      return;
    }

    // Initialize and start TUI
    await initializeConfig();

    // Check for updates (only in interactive mode)
    try {
      const updateInfo = await checkForUpdates();
      if (updateInfo.hasUpdate) {
        console.log(
          `\n📦 Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`
        );
        console.log(`Run 'npm install -g @involvex/involvex-cli@latest' to update.\n`);
      }
    } catch {
      // Silently ignore update check errors
    }

    // Start TUI
    try {
      await startTUI();
    } catch (error) {
      console.error(`Failed to start TUI: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Check if terminal is interactive for command execution
  const forceInteractive =
    process.env.FORCE_INTERACTIVE === 'true' ||
    process.env.VSCODE_PID ||
    process.platform === 'win32';

  if (!forceInteractive && !isInteractiveTerminal()) {
    // Don't show error if we're in a command context (plugin commands, etc.)
    // Only show error if no commands were executed
    const hasExecutableCommand =
      options.update ||
      options.cache ||
      options.startup ||
      options.uninstall ||
      options.dns ||
      options.network ||
      options.driver ||
      options.restore ||
      options.plugins ||
      options.serve ||
      hasCommand;

    if (!hasExecutableCommand) {
      showNonInteractiveError();
      return;
    }
  }

  // Initialize configuration for command execution
  await initializeConfig();
}

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, showHelp, showVersion };
