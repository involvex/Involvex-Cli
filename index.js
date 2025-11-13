#!/usr/bin/env node

const blessed = require('blessed');
const { Command } = require('commander');

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

// Initialize services
const logService = new LogService();
const configService = new ConfigService(logService);
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

// Initialize configuration
async function initializeConfig() {
  try {
    await configService.loadConfigAsync();
    // Initialize plugin services
    await pluginService.initializeAsync();
  } catch (error) {
    logService.log(`Failed to load configuration: ${error.message}`);
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
              const currentVersion = '1.0.0';
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

  // Check if we're in CI/CD environment
  const ciVars = ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'TF_BUILD', 'GITHUB_ACTIONS'];
  if (ciVars.some(varName => process.env[varName])) {
    return false;
  }

  // Check if we're in VS Code or similar IDE terminal
  const term = process.env.TERM;
  const termProgram = process.env.TERM_PROGRAM;
  const wtSession = process.env.WT_SESSION; // Windows Terminal
  const psModulePath = process.env.PSModulePath; // PowerShell

  // More comprehensive checks for non-interactive environments
  if (
    term === 'dumb' ||
    process.env.TMUX ||
    process.env.SCREEN ||
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS
  ) {
    return false;
  }

  // Allow PowerShell and Windows Terminal as interactive, even in VS Code
  if (psModulePath || wtSession || termProgram?.toLowerCase().includes('powershell')) {
    return true;
  }

  // For Windows, be very permissive - allow all terminals with TTY
  if (process.platform === 'win32') {
    // On Windows, if we have TTY, assume interactive
    // This includes VS Code integrated terminal, Command Prompt, PowerShell, etc.
    return true;
  }

  // For other platforms, check for VS Code but allow it if TTY is present
  if (termProgram?.toLowerCase().includes('vscode') || process.env.VSCODE_PID) {
    // Allow VS Code on non-Windows platforms if TTY is present
    return true;
  }

  return true;
}

// Show help information
function showHelp() {
  const helpText = `
InvolveX CLI - Windows System Administration Toolkit

USAGE:
    involvex-cli [OPTIONS]

OPTIONS:
    --help, -h, /?     Show this help message
    --version, -v      Show version information

DESCRIPTION:
    InvolveX CLI is a comprehensive Windows system administration toolkit
    that provides an easy-to-use interface for common system maintenance tasks.

FEATURES:
    • Package Management: Update winget, npm, scoop, choco packages
    • System Monitoring: CPU, Memory, GPU, Drive usage monitoring
    • Cache Management: Clear system caches
    • Startup Programs: List and disable startup programs
    • Program Management: List and uninstall installed programs
    • DNS Configuration: Set and reset DNS servers
    • Network Tools: Ping tests and speed tests
    • Driver Management: Check and update drivers
    • System Restore: Create and manage restore points
    • Plugin System: Extensible plugin architecture

PACKAGE MANAGERS SUPPORTED:
    • Winget (Windows Package Manager)
    • NPM (Node Package Manager)
    • Scoop (Command-line installer)
    • Chocolatey (Package manager for Windows)

SYSTEM REQUIREMENTS:
    • Windows 10/11
    • Node.js 16.0 or higher
    • Administrator privileges for some operations

EXAMPLES:
    involvex-cli              # Start interactive mode
    involvex-cli --help       # Show this help
    involvex-cli --version    # Show version

For more information, visit: https://github.com/involvex/Involvex-Cli
`;
  console.log(helpText);
}

// Show version information
function showVersion() {
  console.log('InvolveX CLI v1.0.0');
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
  // Create screen
  const screen = blessed.screen({
    smartCSR: true,
    title: 'InvolveX CLI',
  });

  // Create main layout
  const mainFrame = blessed.box({
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-2',
    border: {
      type: 'line',
    },
    style: {
      border: {
        fg: 'cyan',
      },
    },
  });

  // Menu bar
  const menuBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: {
      bg: 'blue',
      fg: 'white',
    },
  });

  // Status bar
  const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    style: {
      bg: 'blue',
      fg: 'white',
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
      border: {
        fg: 'white',
      },
      selected: {
        bg: 'blue',
        fg: 'white',
        bold: true,
      },
      item: {
        hover: {
          bg: 'cyan',
        },
      },
    },
    keys: ['up', 'down', 'enter'],
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
      'Exit',
    ],
  });

  // Add elements to screen
  screen.append(menuBar);
  screen.append(mainFrame);
  screen.append(statusBar);
  mainFrame.append(logo);
  mainFrame.append(menuList);

  // Set status bar content
  statusBar.setContent(' F9: Help | F10: Quit | Use arrow keys to navigate ');

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
    if (current > 0) {
      menuList.select(current - 1);
    } else {
      menuList.select(menuList.items.length - 1); // Wrap to bottom
    }
    screen.render();
  });

  menuList.key(['down'], () => {
    const current = menuList.selected;
    if (current < menuList.items.length - 1) {
      menuList.select(current + 1);
    } else {
      menuList.select(0); // Wrap to top
    }
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
    label: ' Update Package Managers ',
    style: {
      border: {
        fg: 'yellow',
      },
      selected: {
        bg: 'blue',
      },
    },
    keys: true,
    items: [
      'Show Available Updates',
      'Update Winget',
      'Update NPM',
      'Update Scoop',
      'Update Chocolatey',
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
    label: ' Cache Management ',
    style: {
      border: {
        fg: 'green',
      },
      selected: {
        bg: 'blue',
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
    label: ' Startup Programs ',
    style: {
      border: {
        fg: 'magenta',
      },
      selected: {
        bg: 'blue',
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
    label: ' Program Management ',
    style: {
      border: {
        fg: 'red',
      },
      selected: {
        bg: 'blue',
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
    label: ' DNS Configuration ',
    style: {
      border: {
        fg: 'cyan',
      },
      selected: {
        bg: 'blue',
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
    label: ' Network Tools ',
    style: {
      border: {
        fg: 'blue',
      },
      selected: {
        bg: 'blue',
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
    label: ' Driver Management ',
    style: {
      border: {
        fg: 'yellow',
      },
      selected: {
        bg: 'blue',
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
    label: ' System Restore ',
    style: {
      border: {
        fg: 'red',
      },
      selected: {
        bg: 'blue',
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
  const dialog = blessed.message({
    top: 'center',
    left: 'center',
    width: '60%',
    height: '40%',
    border: {
      type: 'line',
    },
    label: ` ${title} `,
    style: {
      border: {
        fg: 'green',
      },
    },
    scrollable: true,
    alwaysScroll: true,
    content: message,
  });

  screen.append(dialog);
  screen.render();

  dialog.key(['enter', 'escape'], () => {
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
  progressDialog.load('Scanning package managers for updates...');
  screen.render();

  try {
    const updates = await packageManagerService.getAvailableUpdatesAsync();

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
  progressDialog.load(`Updating ${managerName}, please wait...`);
  screen.render();

  try {
    await updateFunction();
    progressDialog.stop();
    progressDialog.destroy();
    showMessage(screen, 'Success', `${managerName} update completed successfully!`);
  } catch (error) {
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
  progressDialog.load('Updating all package managers...');
  screen.render();

  try {
    // Check which managers are available
    const [winget, npm, scoop, choco] = await Promise.all([
      packageManagerService.isWingetInstalled(),
      packageManagerService.isNpmInstalled(),
      packageManagerService.isScoopInstalled(),
      packageManagerService.isChocoInstalled(),
    ]);

    const availableManagers = [];
    if (winget) availableManagers.push('winget');
    if (npm) availableManagers.push('npm');
    if (scoop) availableManagers.push('scoop');
    if (choco) availableManagers.push('choco');

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
    for (const manager of availableManagers) {
      progressDialog.load(`Updating ${manager}...`);
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
        }
        results.push(`${manager}: Success`);
      } catch (error) {
        results.push(`${manager}: Failed - ${error.message}`);
      }
    }

    // Update PowerShell modules
    progressDialog.load('Updating PowerShell modules...');
    screen.render();

    try {
      await packageManagerService.updatePowerShellModules();
      results.push('PowerShell Modules: Success');
    } catch (error) {
      results.push(`PowerShell Modules: Failed - ${error.message}`);
    }

    progressDialog.stop();
    progressDialog.destroy();

    const resultText = results.join('\n');
    showMessage(screen, 'Update Results', `Update Complete!\n\n${resultText}`);
  } catch (error) {
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

async function showPluginsMenu(screen) {
  const pluginsDialog = blessed.list({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%',
    border: {
      type: 'line',
    },
    label: ' Plugin Management ',
    style: {
      border: {
        fg: 'magenta',
      },
      selected: {
        bg: 'blue',
      },
    },
    keys: true,
    items: [
      'List Installed Plugins',
      'Browse Plugin Repository',
      'Install Plugin',
      'Uninstall Plugin',
      'Execute Plugin',
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
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Uninstall Plugin ',
    style: {
      border: {
        fg: 'magenta',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter plugin name to uninstall:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    try {
      const success = await pluginService.uninstallPluginAsync(value);
      if (success) {
        showMessage(screen, 'Success', `Plugin '${value}' uninstalled successfully!`);
      } else {
        showMessage(screen, 'Error', `Failed to uninstall plugin '${value}'.`);
      }
    } catch (error) {
      showMessage(screen, 'Error', `Plugin uninstallation failed: ${error.message}`);
    }

    inputDialog.destroy();
    screen.render();
  });
}

async function showExecutePluginDialog(screen) {
  const inputDialog = blessed.prompt({
    top: 'center',
    left: 'center',
    width: '50%',
    height: '20%',
    border: {
      type: 'line',
    },
    label: ' Execute Plugin ',
    style: {
      border: {
        fg: 'magenta',
      },
    },
  });

  screen.append(inputDialog);
  screen.render();

  inputDialog.input('Enter plugin name to execute:', '', async (error, value) => {
    if (error || !value) {
      inputDialog.destroy();
      screen.render();
      return;
    }

    // For now, just show a message that plugin execution is not implemented
    // In a full implementation, this would show plugin menu items
    showMessage(
      screen,
      'Plugin Execution',
      `Plugin '${value}' execution not yet implemented in this demo.`
    );

    inputDialog.destroy();
    screen.render();
  });
}

function showHelpDialog(screen) {
  const helpContent = `
██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗
██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝
██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝
██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗
██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗
╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝

              Windows System Administration Toolkit

NAVIGATION:
• Use arrow keys to navigate menus
• Press Enter to select an option
• Press F10 or Escape to quit
• Press F9 for this help

FEATURES:
• Update: Update package managers and packages
• Cache: Clear system and memory caches
• Startup: Manage startup programs
• Uninstall: Remove installed programs
• DNS: Configure DNS settings
• Network: Ping and speed tests
• Driver: Check and update drivers
• System Restore: Manage restore points
• Plugins: Extensible plugin system

SHORTCUTS:
• F10: Quit application
• F9: Show help
• Escape: Go back/Cancel

For more information, visit: https://github.com/involvex/Involvex-Cli
`;

  showMessage(screen, 'Help', helpContent);
}

// Main function
async function main() {
  // Set up command line interface
  const program = new Command();

  program
    .name('involvex-cli')
    .description('Windows System Administration Toolkit')
    .version('1.0.0')
    .option('--help', 'Show help information')
    .option('--version', 'Show version information')
    .option('--update', 'Update package managers and packages')
    .option('--cache', 'Clear system and memory caches')
    .option('--startup', 'List startup programs')
    .option('--uninstall', 'List installed programs')
    .option('--dns', 'Show DNS configuration')
    .option('--network', 'Run network tests')
    .option('--driver', 'Check for driver updates')
    .option('--restore', 'List system restore points')
    .option('--plugins', 'List installed plugins');

  // Parse arguments
  program.parse();

  const options = program.opts();

  // Handle command line arguments
  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
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
          console.log(`  ${plugin.name || 'Unknown'} - ${plugin.description || 'No description'}`)
        );
      }
    } catch (error) {
      console.error(`Failed to list plugins: ${error.message}`);
    }
    return;
  }

  // Check if terminal is interactive
  // TEMP: Allow VS Code for development
  const forceInteractive =
    process.env.FORCE_INTERACTIVE === 'true' ||
    process.env.VSCODE_PID ||
    process.platform === 'win32';

  if (!forceInteractive && !isInteractiveTerminal()) {
    showNonInteractiveError();
    return;
  }

  // Initialize configuration
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
}

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, showHelp, showVersion };
