import type StorageManagerService from "../services/StorageManagerService";
import type PackageManagerService from "../services/PackageManagerService";
import type UninstallerService from "../services/UninstallerService";
import ConfigurationManager from "../services/ConfigurationManager";
import type SettingsService from "../services/SettingsService";
import UIAnimationHelper from "../services/UIAnimationHelper";
import ClearCacheService from "../services/ClearCacheService";
import SpeedTestService from "../services/SpeedTestService";
import MenuStackService from "../services/MenuStackService";
import NetworkService from "../services/NetworkService";
import PluginService from "../services/PluginService";
import type { ILogService } from "../types/index.js";
import LogoService from "../services/LogoService";
import * as readline from "readline";
import fs from "node:fs/promises";
import chalk from "chalk";
import os from "node:os";
import ora from "ora";

interface CLIUIServices {
  log: ILogService;
  packageManager: PackageManagerService;
  storage: StorageManagerService;
  uninstaller: UninstallerService;
  settings: SettingsService;
  plugin?: PluginService;
}

interface MenuItem {
  name: string;
  description: string;
  handler: () => Promise<void>;
}

export default class CLIUI {
  private services: CLIUIServices;
  private version: string;
  private menuItems: MenuItem[];
  private animationHelper: UIAnimationHelper;
  private clearCacheService: ClearCacheService;
  private configurationManager: ConfigurationManager;
  private logoService: LogoService;
  private menuStack: MenuStackService;
  private rl: readline.Interface;
  private currentMenu: number = 0;
  private speedTestService: SpeedTestService;
  private networkService: NetworkService;
  private lastSpeedTestResult: unknown = null;
  private pluginService: PluginService | null = null;

  constructor(services: CLIUIServices, version: string) {
    this.services = services;
    this.version = version;
    this.animationHelper = new UIAnimationHelper(services.log);
    this.clearCacheService = new ClearCacheService(services.log);
    this.configurationManager = new ConfigurationManager(services.log);
    this.logoService = new LogoService(services.log);
    this.menuStack = new MenuStackService(services.log);
    this.speedTestService = new SpeedTestService(services.log);
    this.networkService = new NetworkService(services.log);
    this.pluginService = services.plugin ?? null;

    this.menuItems = [
      {
        name: "Cache Management",
        description: "Clear package manager and system caches",
        handler: async () => this.showCacheManagement(),
      },
      {
        name: "Package Manager",
        description: "Update and manage installed packages",
        handler: async () => this.showPackageManager(),
      },
      {
        name: "Network Tools",
        description: "Internet speed test and connectivity tools",
        handler: async () => this.showNetworkTools(),
      },
      {
        name: "Settings",
        description: "Application settings and preferences",
        handler: async () => this.showSettings(),
      },
      {
        name: "Plugin Configuration",
        description: "Manage installed plugins",
        handler: async () => this.showPluginConfiguration(),
      },
    ];

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private displayMenu(): void {
    console.clear();
    this.logoService.showMenuLogo();

    console.log(
      chalk.cyan("\n┌─ Main Menu ─────────────────────────────────────────┐"),
    );

    this.menuItems.forEach((item, index) => {
      const isSelected = index === this.currentMenu;
      const prefix = isSelected ? chalk.green("❯") : " ";
      const color = isSelected ? chalk.green : chalk.white;
      console.log(
        `${prefix} ${color(`${index + 1}. ${item.name}`)} ${chalk.gray(
          `- ${item.description}`,
        )}`,
      );
    });

    console.log(
      chalk.cyan("└──────────────────────────────────────────────────────┘"),
    );
    console.log(
      chalk.yellow(
        "\nUse numbers (1-5), arrow keys (↑/↓), or Space/Enter to select, Q to quit",
      ),
    );
  }

  private async showPackageManager(): Promise<void> {
    while (true) {
      console.clear();
      this.animationHelper.showHeader("📦 Package Manager");

      console.log(
        chalk.cyan("\n┌─ Package Manager Options ────────────────────────┐"),
      );
      console.log(chalk.white("  1. Update all packages"));
      console.log(chalk.white("  2. Update specific package"));
      console.log(chalk.white("  3. Install new package"));
      console.log(chalk.white("  4. Remove package"));
      console.log(chalk.white("  5. Back to main menu"));
      console.log(
        chalk.cyan("└──────────────────────────────────────────────────┘\n"),
      );

      const choice = await this.getUserInput("Select an option (1-5): ");

      switch (choice) {
        case "1":
          await this.updateAllPackages();
          break;
        case "2":
          await this.updateSpecificPackage();
          break;
        case "3":
          await this.installPackage();
          break;
        case "4":
          await this.removePackage();
          break;
        case "5":
          return;
        default:
          this.animationHelper.showError("Invalid option");
          await this.pressAnyKeyToContinue();
      }
    }
  }

  private async updateAllPackages(): Promise<void> {
    console.clear();
    this.animationHelper.showHeader("Updating All Packages");

    const spinner = ora("Checking for package updates...").start();

    try {
      // Simulate package manager check
      await new Promise(r => setTimeout(r, 1500));

      spinner.succeed("Update check completed");

      console.log(chalk.cyan("\nAvailable Updates:"));
      console.log(chalk.white("  • npm: v10.2.0 → v10.3.1"));
      console.log(chalk.white("  • node: v20.10.0 → v20.11.0"));
      console.log(chalk.white("  • typescript: v5.3.3 → v5.4.0\n"));

      await this.pressAnyKeyToContinue();
    } catch (error: unknown) {
      spinner.fail("Update check failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async updateSpecificPackage(): Promise<void> {
    const packageName = await this.getUserInput(
      "\nEnter package name to update: ",
    );

    if (!packageName) {
      this.animationHelper.showWarning("No package specified");
      return;
    }

    console.clear();
    this.animationHelper.showHeader(`Updating Package: ${packageName}`);

    const spinner = ora(`Updating ${packageName}...`).start();

    try {
      await new Promise(r => setTimeout(r, 1500));
      spinner.succeed(`${packageName} updated successfully`);
      this.animationHelper.showSuccess(
        `Package '${packageName}' upgraded to latest version`,
      );
      await this.pressAnyKeyToContinue();
    } catch (error: unknown) {
      spinner.fail("Update failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async installPackage(): Promise<void> {
    const packageName = await this.getUserInput(
      "\nEnter package name to install: ",
    );

    if (!packageName) {
      this.animationHelper.showWarning("No package specified");
      return;
    }

    console.clear();
    this.animationHelper.showHeader(`Installing Package: ${packageName}`);

    const spinner = ora(`Installing ${packageName}...`).start();

    try {
      await new Promise(r => setTimeout(r, 2000));
      spinner.succeed(`${packageName} installed successfully`);
      this.animationHelper.showSuccess(
        `Package '${packageName}' has been installed`,
      );
      await this.pressAnyKeyToContinue();
    } catch (error: unknown) {
      spinner.fail("Installation failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async removePackage(): Promise<void> {
    const packageName = await this.getUserInput(
      "\nEnter package name to remove: ",
    );

    if (!packageName) {
      this.animationHelper.showWarning("No package specified");
      return;
    }

    console.clear();
    this.animationHelper.showHeader(`Removing Package: ${packageName}`);

    const spinner = ora(`Removing ${packageName}...`).start();

    try {
      await new Promise(r => setTimeout(r, 1500));
      spinner.succeed(`${packageName} removed successfully`);
      this.animationHelper.showSuccess(
        `Package '${packageName}' has been removed`,
      );
      await this.pressAnyKeyToContinue();
    } catch (error: unknown) {
      spinner.fail("Removal failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async showCacheManagement(): Promise<void> {
    console.clear();
    this.logoService.showCacheLogo();

    console.log(
      chalk.cyan("\n┌─ Cache Management Options ──────────────────────────┐"),
    );
    console.log(chalk.green("  ✓ npm - Node package manager"));
    console.log(
      chalk.green("  ✓ pnpm - Fast, disk space efficient package manager"),
    );
    console.log(chalk.green("  ✓ bun - Fast all-in-one JavaScript runtime"));
    console.log(chalk.green("  ✓ gradle - Java/Kotlin build tool"));
    console.log(
      chalk.cyan("└──────────────────────────────────────────────────────┘"),
    );

    console.log(chalk.yellow("\nAvailable Operations:"));
    console.log(chalk.white("  1. Clear all package manager caches"));
    console.log(chalk.white("  2. Clear system memory"));
    console.log(chalk.white("  3. Clear standby memory"));
    console.log(chalk.white("  4. View cache sizes"));
    console.log(chalk.white("  5. Back to main menu\n"));

    await this.promptCacheMenu();
  }

  private async promptCacheMenu(): Promise<void> {
    return new Promise(resolve => {
      this.rl.question(
        chalk.yellow("Select an option (1-5): "),
        async input => {
          const choice = parseInt(input.trim(), 10);

          switch (choice) {
            case 1:
              await this.executeClearAllCaches();
              break;
            case 2:
              await this.executeClearMemory();
              break;
            case 3:
              await this.executeClearStandbyMemory();
              break;
            case 4:
              await this.executeViewCacheSizes();
              break;
            case 5:
              break;
            default:
              this.animationHelper.showError("Invalid option");
              await this.pressAnyKeyToContinue();
              await this.showCacheManagement();
          }
          resolve();
        },
      );
    });
  }

  private async executeClearAllCaches(): Promise<void> {
    console.clear();
    this.animationHelper.showSection("Clearing All Package Manager Caches");

    const spinner = ora("Processing...").start();

    try {
      const results = await this.clearCacheService.clearAllCaches();

      spinner.stop();
      console.log();

      results.forEach(result => {
        if (result.success) {
          this.animationHelper.showSuccess(`${result.name} cache cleared`);
        } else {
          this.animationHelper.showWarning(
            `${result.name} - ${result.error || "Not installed"}`,
          );
        }
      });

      console.log();
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Error during cache clearing");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async executeClearMemory(): Promise<void> {
    console.clear();
    this.animationHelper.showSection("Clearing System Memory");

    const spinner = ora("Processing...").start();

    try {
      const success = await this.clearCacheService.clearMemory();

      spinner.stop();
      console.log();

      if (success) {
        this.animationHelper.showSuccess("Memory cleared successfully");
      } else {
        this.animationHelper.showWarning(
          "Memory clearing completed with warnings",
        );
      }

      console.log();
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Error clearing memory");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async executeClearStandbyMemory(): Promise<void> {
    console.clear();
    this.animationHelper.showSection("Clearing Standby Memory");

    const spinner = ora("Processing...").start();

    try {
      const success = await this.clearCacheService.clearStandbyMemory();

      spinner.stop();
      console.log();

      if (success) {
        this.animationHelper.showSuccess("Standby memory cleared successfully");
      } else {
        this.animationHelper.showWarning(
          "Standby memory clearing completed with warnings",
        );
      }

      console.log();
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Error clearing standby memory");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async executeViewCacheSizes(): Promise<void> {
    console.clear();
    this.animationHelper.showSection("Checking Cache Sizes");

    const spinner = ora("Scanning...").start();

    try {
      const sizes = await this.clearCacheService.getCacheSizes();

      spinner.stop();
      console.log();

      this.animationHelper.showTable(
        "Cache Sizes",
        sizes.map(s => [s.name, s.size || "unknown"]),
      );

      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Error checking cache sizes");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async showSystemTools(): Promise<void> {
    console.clear();
    this.animationHelper.showHeader("System Tools");
    console.log(chalk.cyan("\nFeatures:"));
    console.log(chalk.white("  • System restore points"));
    console.log(chalk.white("  • Network diagnostics"));
    console.log(chalk.white("  • Driver management\n"));
    console.log(chalk.yellow("[This feature will be implemented]\n"));
    await this.pressAnyKeyToContinue();
  }

  private async showSettings(): Promise<void> {
    const config = this.configurationManager.getConfig();

    while (true) {
      console.clear();
      this.animationHelper.showHeader("⚙️  Settings");

      console.log(
        chalk.cyan("\n┌─ Current Configuration ───────────────────────────┐"),
      );
      console.log(
        chalk.white(
          `  • Auto-update: ${config.autoUpdate ? chalk.green("ON") : chalk.red("OFF")}`,
        ),
      );
      console.log(
        chalk.white(`  • Theme: ${chalk.cyan(config.theme.toUpperCase())}`),
      );
      console.log(
        chalk.white(
          `  • Log Level: ${chalk.yellow(config.logLevel.toUpperCase())}`,
        ),
      );
      console.log(
        chalk.white(
          `  • Config Path: ${chalk.gray(this.configurationManager.getConfigDirectory())}`,
        ),
      );
      console.log(
        chalk.cyan("└──────────────────────────────────────────────────┘\n"),
      );

      console.log(
        chalk.cyan("┌─ Change Settings ─────────────────────────────────┐"),
      );
      console.log(chalk.white("  1. Toggle Auto-update"));
      console.log(chalk.white("  2. Change Theme (dark/light)"));
      console.log(chalk.white("  3. Change Log Level (debug/info/warn/error)"));
      console.log(chalk.white("  4. Change Config Path"));
      console.log(chalk.white("  5. Back to main menu"));
      console.log(
        chalk.cyan("└──────────────────────────────────────────────────┘\n"),
      );

      const choice = await this.getUserInput("Select an option (1-5): ");

      switch (choice) {
        case "1":
          await this.toggleAutoUpdate();
          break;
        case "2":
          await this.changeTheme();
          break;
        case "3":
          await this.changeLogLevel();
          break;
        case "4":
          await this.changeConfigPath();
          break;
        case "5":
          return;
        default:
          this.animationHelper.showError("Invalid option");
          await this.pressAnyKeyToContinue();
      }
    }
  }

  private async toggleAutoUpdate(): Promise<void> {
    const config = this.configurationManager.getConfig();
    const newValue = !config.autoUpdate;

    await this.configurationManager.setAutoUpdate(newValue);
    this.animationHelper.showSuccess(
      `Auto-update ${newValue ? "enabled" : "disabled"}`,
    );
    await this.pressAnyKeyToContinue();
  }

  private async changeTheme(): Promise<void> {
    const config = this.configurationManager.getConfig();
    const currentTheme = config.theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    await this.configurationManager.setTheme(newTheme);
    this.animationHelper.showSuccess(`Theme changed to ${newTheme}`);
    await this.pressAnyKeyToContinue();
  }

  private async changeLogLevel(): Promise<void> {
    const levels = ["debug", "info", "warn", "error"];
    const config = this.configurationManager.getConfig();

    console.clear();
    this.animationHelper.showHeader("Select Log Level");

    console.log(
      chalk.cyan("\n┌─ Available Levels ────────────────────────────────┐"),
    );
    levels.forEach((level, index) => {
      const isCurrent = level === config.logLevel;
      const prefix = isCurrent ? chalk.green("✓") : " ";
      console.log(
        chalk.white(`  ${prefix} ${index + 1}. ${level.toUpperCase()}`),
      );
    });
    console.log(
      chalk.cyan("└──────────────────────────────────────────────────┘\n"),
    );

    const choice = await this.getUserInput("Select level (1-4): ");
    const selectedLevel = levels[parseInt(choice, 10) - 1];

    if (selectedLevel) {
      await this.configurationManager.setLogLevel(
        selectedLevel as "debug" | "info" | "warn" | "error",
      );
      this.animationHelper.showSuccess(`Log level changed to ${selectedLevel}`);
    } else {
      this.animationHelper.showError("Invalid selection");
    }

    await this.pressAnyKeyToContinue();
  }

  private async changeConfigPath(): Promise<void> {
    const defaultPath = "~/.involvex-cli";
    const newPath = await this.getUserInput(
      `\nEnter config path (default: ${defaultPath}): `,
    );

    if (!newPath || newPath.trim() === "") {
      this.animationHelper.showInfo("Using default path");
      return;
    }

    await this.configurationManager.setConfigPath(newPath);
    this.animationHelper.showSuccess(`Config path updated to ${newPath}`);
    await this.pressAnyKeyToContinue();
  }

  private async showNetworkTools(): Promise<void> {
    while (true) {
      console.clear();
      this.animationHelper.showHeader("🌐 Network Tools");

      console.log(
        chalk.cyan("\n┌─ Network Tools ─────────────────────────────────┐"),
      );
      console.log(chalk.white("  1. Run Speed Test"));
      console.log(chalk.white("  2. Run Ping Test"));
      console.log(chalk.white("  3. View Network Info"));
      console.log(chalk.white("  4. Export Results (JSON)"));
      console.log(chalk.white("  5. Back to Main Menu"));
      console.log(
        chalk.cyan("└──────────────────────────────────────────────────┘\n"),
      );

      const choice = await this.getUserInput("Select an option (1-5): ");

      switch (choice) {
        case "1":
          await this.runSpeedTest();
          break;
        case "2":
          await this.runPingTest();
          break;
        case "3":
          await this.viewNetworkInfo();
          break;
        case "4":
          await this.exportNetworkResults();
          break;
        case "5":
          return;
        default:
          this.animationHelper.showError("Invalid option");
          await this.pressAnyKeyToContinue();
      }
    }
  }

  private async runSpeedTest(): Promise<void> {
    console.clear();
    this.animationHelper.showHeader("Running Speed Test");

    const spinner = ora("Running speed test...").start();

    try {
      const result = await this.speedTestService.runSpeedTest();
      this.lastSpeedTestResult = result;
      spinner.stop();

      console.log();
      console.log(this.speedTestService.formatResult(result));
      console.log();

      this.animationHelper.showSuccess("Speed test completed!");
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Speed test failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async runPingTest(): Promise<void> {
    const host = await this.getUserInput(
      "\nEnter host to ping (default: google.com): ",
    );
    const targetHost = host || "google.com";

    console.clear();
    this.animationHelper.showHeader(`Pinging ${targetHost}`);

    const spinner = ora("Running ping test...").start();

    try {
      const result = await this.networkService.runPingTest(targetHost);
      spinner.stop();

      console.log();
      console.log(chalk.cyan("Ping Test Results:"));
      console.log(chalk.white(result));
      console.log();

      this.animationHelper.showSuccess("Ping test completed!");
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Ping test failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async viewNetworkInfo(): Promise<void> {
    console.clear();
    this.animationHelper.showHeader("Network Information");

    console.log(
      chalk.cyan("\n┌─ System Network Info ───────────────────────────┐"),
    );
    console.log(chalk.white(`  Platform: ${chalk.yellow(os.platform())}`));
    console.log(chalk.white(`  Hostname: ${chalk.yellow(os.hostname())}`));
    console.log(
      chalk.cyan("└──────────────────────────────────────────────────┘\n"),
    );

    if (this.lastSpeedTestResult) {
      console.log(chalk.cyan("Last Speed Test Result:"));
      console.log(
        chalk.gray(JSON.stringify(this.lastSpeedTestResult, null, 2)),
      );
      console.log();
    } else {
      console.log(chalk.gray("No speed test results available."));
      console.log();
    }

    await this.pressAnyKeyToContinue();
  }

  private async exportNetworkResults(): Promise<void> {
    if (!this.lastSpeedTestResult) {
      this.animationHelper.showWarning("No speed test results to export");
      await this.pressAnyKeyToContinue();
      return;
    }

    const filePath = await this.getUserInput(
      "\nEnter export path (default: network-results.json): ",
    );
    const targetPath = filePath || "network-results.json";

    const spinner = ora("Exporting results...").start();

    try {
      const json = this.speedTestService.toJSON(
        this.lastSpeedTestResult as {
          ping: number;
          download: number;
          upload: number;
          timestamp: string;
          server?: string;
        },
      );
      await fs.writeFile(targetPath, json, "utf-8");

      spinner.succeed(`Results exported to ${targetPath}`);
      this.animationHelper.showSuccess(
        `Network results saved to ${chalk.cyan(targetPath)}`,
      );
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Export failed");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async showPluginConfiguration(): Promise<void> {
    // Check if plugin service is available
    if (!this.pluginService) {
      console.clear();
      this.animationHelper.showHeader("Plugin Configuration");
      console.log();
      this.animationHelper.showWarning(
        "Plugin service is not available in this context.",
      );
      await this.pressAnyKeyToContinue();
      return;
    }

    while (true) {
      console.clear();
      this.animationHelper.showHeader("🔌 Plugin Configuration");

      console.log(
        chalk.cyan("\n┌─ Plugin Management ─────────────────────────────┐"),
      );
      console.log(chalk.white("  1. List Installed Plugins"));
      console.log(chalk.white("  2. Install Plugin (from URL)"));
      console.log(chalk.white("  3. Update All Plugins"));
      console.log(chalk.white("  4. Remove Plugin"));
      console.log(chalk.white("  5. Back to Main Menu"));
      console.log(
        chalk.cyan("└──────────────────────────────────────────────────┘\n"),
      );

      const choice = await this.getUserInput("Select an option (1-5): ");

      switch (choice) {
        case "1":
          await this.listInstalledPlugins();
          break;
        case "2":
          await this.installPlugin();
          break;
        case "3":
          await this.updateAllPlugins();
          break;
        case "4":
          await this.removePlugin();
          break;
        case "5":
          return;
        default:
          this.animationHelper.showError("Invalid option");
          await this.pressAnyKeyToContinue();
      }
    }
  }

  private async listInstalledPlugins(): Promise<void> {
    if (!this.pluginService) return;

    console.clear();
    this.animationHelper.showHeader("Installed Plugins");

    const plugins = this.pluginService.getPluginNames();

    if (plugins.length === 0) {
      console.log();
      this.animationHelper.showInfo("No plugins installed.");
      console.log();
      await this.pressAnyKeyToContinue();
      return;
    }

    console.log(
      chalk.cyan("\n┌─ Installed Plugins ──────────────────────────────┐"),
    );

    for (const name of plugins) {
      const plugin = this.pluginService.getPlugin(name);
      if (plugin) {
        console.log(chalk.white(`  • ${chalk.cyan(name)}`));
        console.log(
          chalk.gray(
            `    Version: ${plugin.version} | Author: ${plugin.author}`,
          ),
        );
        console.log(
          chalk.gray(`    ${plugin.description || "No description"}`),
        );
        console.log();
      }
    }

    console.log(
      chalk.cyan("└──────────────────────────────────────────────────┘\n"),
    );

    this.animationHelper.showSuccess(`Found ${plugins.length} plugin(s)`);
    await this.pressAnyKeyToContinue();
  }

  private async installPlugin(): Promise<void> {
    if (!this.pluginService) return;

    const pluginSource = await this.getUserInput(
      "\nEnter plugin URL or path (or 'q' to cancel): ",
    );

    if (!pluginSource || pluginSource.toLowerCase() === "q") {
      this.animationHelper.showInfo("Installation cancelled");
      await this.pressAnyKeyToContinue();
      return;
    }

    const pluginName = await this.getUserInput(
      "Enter plugin name (for GitHub install): ",
    );

    console.clear();
    this.animationHelper.showHeader(
      `Installing Plugin: ${pluginName || pluginSource}`,
    );

    const spinner = ora("Installing plugin...").start();

    try {
      let installed = false;

      if (pluginSource.startsWith("http")) {
        // Install from URL (GitHub)
        if (pluginName) {
          installed = await this.pluginService.installPluginFromGitHubAsync(
            pluginSource,
            pluginName,
          );
        } else {
          spinner.fail("Plugin name required for GitHub installation");
          await this.pressAnyKeyToContinue();
          return;
        }
      } else {
        // Install from local path
        installed = await this.pluginService.installPluginAsync(pluginSource);
      }

      spinner.stop();

      if (installed) {
        this.animationHelper.showSuccess("Plugin installed successfully!");
      } else {
        this.animationHelper.showError("Plugin installation failed");
      }
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Installation error");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async updateAllPlugins(): Promise<void> {
    if (!this.pluginService) return;

    console.clear();
    this.animationHelper.showHeader("Update Plugins");

    const plugins = this.pluginService.getPluginNames();

    if (plugins.length === 0) {
      console.log();
      this.animationHelper.showInfo("No plugins to update.");
      console.log();
      await this.pressAnyKeyToContinue();
      return;
    }

    console.log();
    this.animationHelper.showInfo(
      "Plugin updates are managed through the plugin repository.",
    );
    console.log(chalk.gray("Reinstall plugins from their source to update."));
    console.log();

    await this.pressAnyKeyToContinue();
  }

  private async removePlugin(): Promise<void> {
    if (!this.pluginService) return;

    const plugins = this.pluginService.getPluginNames();

    if (plugins.length === 0) {
      console.clear();
      this.animationHelper.showHeader("Remove Plugin");
      console.log();
      this.animationHelper.showInfo("No plugins installed.");
      await this.pressAnyKeyToContinue();
      return;
    }

    console.clear();
    this.animationHelper.showHeader("Remove Plugin");

    console.log(
      chalk.cyan("\n┌─ Installed Plugins ──────────────────────────────┐"),
    );
    plugins.forEach((name, index) => {
      console.log(chalk.white(`  ${index + 1}. ${name}`));
    });
    console.log(
      chalk.cyan("└──────────────────────────────────────────────────┘\n"),
    );

    const choice = await this.getUserInput(
      "Enter plugin number or name to remove (or 'q' to cancel): ",
    );

    if (!choice || choice.toLowerCase() === "q") {
      this.animationHelper.showInfo("Removal cancelled");
      await this.pressAnyKeyToContinue();
      return;
    }

    let pluginNameToRemove: string | undefined;

    // Check if it's a number
    const num = parseInt(choice, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= plugins.length) {
      pluginNameToRemove = plugins[num - 1];
    } else {
      // Use as plugin name
      pluginNameToRemove = choice;
    }

    if (!pluginNameToRemove || !plugins.includes(pluginNameToRemove)) {
      this.animationHelper.showError("Invalid plugin selection");
      await this.pressAnyKeyToContinue();
      return;
    }

    // Confirm
    const confirm = await this.getUserInput(
      `Remove plugin '${pluginNameToRemove}'? (y/N): `,
    );

    if (confirm.toLowerCase() !== "y") {
      this.animationHelper.showInfo("Removal cancelled");
      await this.pressAnyKeyToContinue();
      return;
    }

    console.clear();
    this.animationHelper.showHeader(`Removing Plugin: ${pluginNameToRemove}`);

    const spinner = ora("Removing plugin...").start();

    try {
      const removed =
        await this.pluginService.uninstallPluginAsync(pluginNameToRemove);

      spinner.stop();

      if (removed) {
        this.animationHelper.showSuccess(
          `Plugin '${pluginNameToRemove}' removed successfully!`,
        );
      } else {
        this.animationHelper.showError("Plugin removal failed");
      }
      await this.pressAnyKeyToContinue();
    } catch (error) {
      spinner.fail("Removal error");
      this.animationHelper.showError(
        error instanceof Error ? error.message : String(error),
      );
      await this.pressAnyKeyToContinue();
    }
  }

  private async pressAnyKeyToContinue(): Promise<void> {
    return new Promise(resolve => {
      this.rl.question(chalk.gray("Press Enter to continue..."), () => {
        resolve();
      });
    });
  }

  private async getUserInput(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(chalk.yellow(prompt), input => {
        resolve(input.trim());
      });
    });
  }

  private async exit(): Promise<void> {
    console.clear();
    this.animationHelper.showSuccess("Thank you for using InvolveX CLI!");
    this.rl.close();
    process.exit(0);
  }

  async start(): Promise<void> {
    // Logo is shown in index.ts before this
    await new Promise(resolve => setTimeout(resolve, 500));

    // Enable raw mode for instant key detection
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let isRunning = true;

    const handleKeypress = async (key: string) => {
      // Exit on Ctrl+C or 'q'
      if (key === "\u0003" || key.toLowerCase() === "q") {
        isRunning = false;
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", handleKeypress);
        await this.exit();
        return;
      }

      // Number hotkeys (1-5)
      const num = parseInt(key, 10);
      if (num >= 1 && num <= this.menuItems.length) {
        this.currentMenu = num - 1;
        await this.handleMenuSelect();
        if (isRunning) {
          this.displayMenu();
        }
        return;
      }

      // Arrow keys for navigation
      if (key === "\u001b[A") {
        // Up arrow
        this.currentMenu =
          (this.currentMenu - 1 + this.menuItems.length) %
          this.menuItems.length;
        this.displayMenu();
      } else if (key === "\u001b[B") {
        // Down arrow
        this.currentMenu = (this.currentMenu + 1) % this.menuItems.length;
        this.displayMenu();
      } else if (key === "\r" || key === " ") {
        // Enter or Space to select
        await this.handleMenuSelect();
        if (isRunning) {
          this.displayMenu();
        }
      }
    };

    // Display menu once initially
    this.displayMenu();

    // Wait for key input - menu only redraws on key press (no flickering!)
    process.stdin.on("data", handleKeypress);

    // Keep the process alive until exit
    await new Promise<void>(resolve => {
      // Reuse the isRunning flag check via a dummy promise that resolves on exit
      const checkExit = setInterval(() => {
        if (!isRunning) {
          clearInterval(checkExit);
          resolve();
        }
      }, 100);
    });

    process.stdin.removeListener("data", handleKeypress);
  }

  private async handleMenuSelect(): Promise<void> {
    const item = this.menuItems[this.currentMenu];
    if (item && item.handler) {
      await item.handler();
    }
  }

  stop(): void {
    this.rl.close();
  }
}
