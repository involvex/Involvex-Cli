import type StorageManagerService from "../services/StorageManagerService";
import type PackageManagerService from "../services/PackageManagerService";
import type UninstallerService from "../services/UninstallerService";
import type SettingsService from "../services/SettingsService";
import UIAnimationHelper from "../services/UIAnimationHelper";
import ClearCacheService from "../services/ClearCacheService";
import type { ILogService } from "../types/index.js";
import LogoService from "../services/LogoService";
import * as readline from "readline";
import chalk from "chalk";
import ora from "ora";

interface CLIUIServices {
  log: ILogService;
  packageManager: PackageManagerService;
  storage: StorageManagerService;
  uninstaller: UninstallerService;
  settings: SettingsService;
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
  private logoService: LogoService;
  private rl: readline.Interface;
  private currentMenu: number = 0;

  constructor(services: CLIUIServices, version: string) {
    this.services = services;
    this.version = version;
    this.animationHelper = new UIAnimationHelper(services.log);
    this.clearCacheService = new ClearCacheService(services.log);
    this.logoService = new LogoService(services.log);

    this.menuItems = [
      {
        name: "Package Manager",
        description: "Update and manage installed packages",
        handler: async () => this.showPackageManager(),
      },
      {
        name: "Cache Management",
        description: "Clear package manager and system caches",
        handler: async () => this.showCacheManagement(),
      },
      {
        name: "System Tools",
        description: "System utilities and maintenance tools",
        handler: async () => this.showSystemTools(),
      },
      {
        name: "Settings",
        description: "Application settings and preferences",
        handler: async () => this.showSettings(),
      },
      {
        name: "Exit",
        description: "Exit the application",
        handler: async () => this.exit(),
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
    console.clear();
    this.animationHelper.showHeader("Package Manager");
    console.log(chalk.cyan("\nFeatures:"));
    console.log(chalk.white("  • Update packages"));
    console.log(chalk.white("  • Install new packages"));
    console.log(chalk.white("  • Remove packages\n"));
    console.log(chalk.yellow("[This feature will be implemented]\n"));
    await this.pressAnyKeyToContinue();
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
    console.clear();
    this.animationHelper.showHeader("Settings");
    console.log(chalk.cyan("\nCurrent Settings:"));
    console.log(chalk.white("  • Auto-update: Enabled"));
    console.log(chalk.white("  • Theme: Dark"));
    console.log(chalk.white("  • Log level: Info\n"));
    console.log(chalk.yellow("[Settings management coming soon]\n"));
    await this.pressAnyKeyToContinue();
  }

  private async pressAnyKeyToContinue(): Promise<void> {
    return new Promise(resolve => {
      this.rl.question(chalk.gray("Press Enter to continue..."), () => {
        resolve();
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

    process.stdin.on("data", handleKeypress);

    while (isRunning) {
      this.displayMenu();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

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
