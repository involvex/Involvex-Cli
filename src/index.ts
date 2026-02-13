#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import version from package.json
import packageJson from "../package.json";

const VERSION = packageJson.version;

// Import services
import StorageManagerService from "./services/StorageManagerService";
import PackageManagerService from "./services/PackageManagerService";
import SystemRestoreService from "./services/SystemRestoreService";
import PluginCommandHandler from "./services/PluginCommandHandler";
import ConfigurationManager from "./services/ConfigurationManager";
import UninstallerService from "./services/UninstallerService";
import UIAnimationHelper from "./services/UIAnimationHelper";
import AutoUpdateService from "./services/AutoUpdateService";
import SettingsService from "./services/SettingsService";
import StartupService from "./services/StartupService";
import NetworkService from "./services/NetworkService";
import PluginService from "./services/PluginService";
import ConfigService from "./services/ConfigService";
import CacheService from "./services/CacheService";
import LogoService from "./services/LogoService";
import LogService from "./services/LogService";
import DnsService from "./services/DnsService";
import WebServer from "./server/webServer";
import CLIUI from "./cli/TUI";

// Initialize services
const logService = new LogService();
const configService = new ConfigService(logService);
const settingsService = new SettingsService(logService);
const packageManagerService = new PackageManagerService(logService);
const networkService = new NetworkService(logService);
const cacheService = new CacheService(logService);
const uiAnimationHelper = new UIAnimationHelper(logService);
const logoService = new LogoService(logService);
const startupService = new StartupService(logService);
const uninstallerService = new UninstallerService(logService);
const dnsService = new DnsService(logService);
const systemRestoreService = new SystemRestoreService(logService);
const pluginService = new PluginService(logService, configService);
const autoUpdateService = new AutoUpdateService({
  logService,
  settingsService: settingsService as any,
  packageManagerService: packageManagerService as any,
});
const storageManagerService = new StorageManagerService(logService);
const webServer = new WebServer(logService, {
  packageManager: packageManagerService,
  autoUpdate: autoUpdateService,
  cache: cacheService,
  startup: startupService,
  uninstaller: uninstallerService,
  dns: dnsService,
  storageManager: storageManagerService,
  settings: settingsService,
  plugin: pluginService,
  network: networkService,
});

// Initialize CLI
async function main() {
  // Handle command-line arguments
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`InvolveX CLI v${VERSION}`);
    console.log("Usage: involvex-cli [options]");
    console.log("Options:");
    console.log("  --help, -h               Show this help message");
    console.log("  --version, -v            Show version");
    console.log(
      "  --web, --webserver       Start web server mode (default: CLI UI)",
    );
    console.log(
      "  --plugins <cmd> [args]   Plugin management (list/install/update/remove)",
    );
    console.log(
      "  --install-plugin <url>   Install plugin from GitHub URL (legacy)",
    );
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle plugin commands (new system)
  const pluginsIdx = args.indexOf("--plugins");
  if (pluginsIdx !== -1) {
    const logService = new LogService();
    const configService = new ConfigService(logService);
    const pluginService = new PluginService(logService, configService);
    const pluginCommandHandler = new PluginCommandHandler(
      logService,
      pluginService,
      configService,
    );

    const pluginArgs = args.slice(pluginsIdx + 1);
    await pluginCommandHandler.handleCommand("plugins", pluginArgs);
    process.exit(0);
  }

  // Handle plugin installation (legacy)
  const installIdx = args.indexOf("--install-plugin");
  if (installIdx !== -1 && installIdx + 1 < args.length) {
    const pluginUrl = args[installIdx + 1];
    if (!pluginUrl) {
      console.error("✗ Plugin URL is required");
      process.exit(1);
    }

    const logService = new LogService();
    const configService = new ConfigService(logService);
    const pluginService = new PluginService(logService, configService);

    console.log(`Installing plugin from: ${pluginUrl}`);
    const pluginName =
      pluginUrl.split("/").pop()?.replace(".js", "") || "plugin";

    try {
      const success = await pluginService.installPluginFromGitHubAsync(
        pluginUrl,
        pluginName,
      );
      if (success) {
        console.log(`✓ Plugin '${pluginName}' installed successfully!`);
        process.exit(0);
      } else {
        console.error(`✗ Failed to install plugin from ${pluginUrl}`);
        process.exit(1);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error installing plugin: ${errorMsg}`);
      process.exit(1);
    }
  }

  try {
    // Show startup logo only once at the very beginning
    logoService.showStartupLogo();
    await new Promise(resolve => setTimeout(resolve, 1500));

    uiAnimationHelper.showHeader(`InvolveX CLI v${VERSION}`);
    uiAnimationHelper.showSection("Loading configuration...");
    await configService.loadConfigAsync();
    uiAnimationHelper.showSuccess("Configuration loaded");

    uiAnimationHelper.showSection("Loading settings...");
    await settingsService.loadSettingsAsync();
    uiAnimationHelper.showSuccess("Settings loaded");

    // Initialize user configuration
    const configurationManager = new ConfigurationManager(logService);
    uiAnimationHelper.showSection("Initializing user configuration...");
    await configurationManager.initializeAsync();
    uiAnimationHelper.showSuccess("User configuration initialized");

    // Initialize plugin service
    uiAnimationHelper.showSection("Initializing plugins...");
    await pluginService.initializeAsync();
    uiAnimationHelper.showSuccess("Plugins initialized");

    // Create system restore point before making changes (skip in dev mode)
    if (process.env.NODE_ENV !== "development") {
      uiAnimationHelper.showSection("Creating system restore point...");
      const restorePointDescription = `Before InvolveX CLI v${VERSION} operations`;
      await systemRestoreService.createRestorePoint(restorePointDescription);
      uiAnimationHelper.showSuccess("System restore point created");
    }

    // Determine whether to start web server or CLI UI
    const useWebServer = args.includes("--web") || args.includes("--webserver");

    if (useWebServer) {
      // Start the web server
      uiAnimationHelper.showSection(
        "Starting web server on http://0.0.0.0:3000...",
      );
      await webServer.start(3000, "0.0.0.0");
      uiAnimationHelper.showSuccess("Web server started");

      // Run auto-update check (don't await, let it run in background)
      autoUpdateService.performAutoUpdate().catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Auto-update check failed: ${errorMessage}`);
      });

      uiAnimationHelper.showInfo(
        "InvolveX CLI is ready. Press Ctrl+C to exit.",
      );

      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        uiAnimationHelper.showWarning("Shutting down...");
        await webServer.stop();
        process.exit(0);
      });
    } else {
      // Start CLI UI by default
      const cli = new CLIUI(
        {
          log: logService,
          packageManager: packageManagerService,
          storage: storageManagerService,
          uninstaller: uninstallerService,
          settings: settingsService,
        },
        VERSION,
      );

      // Start web server in background
      await webServer.start(3000, "0.0.0.0");
      autoUpdateService.performAutoUpdate().catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logService.log(`Auto-update check failed: ${errorMessage}`);
      });

      await cli.start();

      // Handle exit
      process.on("SIGINT", async () => {
        cli.stop();
        await webServer.stop();
        process.exit(0);
      });
    }
  } catch (error: any) {
    console.error(`Error during initialization: ${error.message}`);
    process.exit(1);
  }
}

main();
