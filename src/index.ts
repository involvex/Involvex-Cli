#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import version from package.json
import packageJson from "../package.json";

const VERSION = packageJson.version;

// Import services
import StorageManagerService from "./services/StorageManagerService";
import PackageManagerService from "./services/PackageManagerService";
import SystemRestoreService from "./services/SystemRestoreService";
import UninstallerService from "./services/UninstallerService";
import AutoUpdateService from "./services/AutoUpdateService";
import SettingsService from "./services/SettingsService";
import StartupService from "./services/StartupService";
import NetworkService from "./services/NetworkService";
import PluginService from "./services/PluginService";
import ConfigService from "./services/ConfigService";
import CacheService from "./services/CacheService";
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
    console.log("  --help, -h        Show this help message");
    console.log("  --version, -v     Show version");
    console.log("  --web, --webserver Start web server mode (default: CLI UI)");
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  try {
    console.log(`InvolveX CLI v${VERSION} starting...`);

    // Load configuration and settings
    console.log("Loading configuration...");
    await configService.loadConfigAsync();
    await settingsService.loadSettingsAsync();

    // Initialize plugin service
    console.log("Initializing plugins...");
    await pluginService.initializeAsync();

    // Create system restore point before making changes (skip in dev mode)
    if (process.env.NODE_ENV !== "development") {
      console.log("Creating system restore point...");
      const restorePointDescription = `Before InvolveX CLI v${VERSION} operations`;
      await systemRestoreService.createRestorePoint(restorePointDescription);
    }

    // Determine whether to start web server or CLI UI
    const useWebServer = args.includes("--web") || args.includes("--webserver");

    if (useWebServer) {
      // Start the web server
      console.log("Starting web server on http://0.0.0.0:3000...");
      await webServer.start(3000, "0.0.0.0");

      // Run auto-update check (don't await, let it run in background)
      autoUpdateService.performAutoUpdate().catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Auto-update check failed: ${errorMessage}`);
      });

      console.log("InvolveX CLI is ready. Press Ctrl+C to exit.");

      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        await webServer.stop();
        process.exit(0);
      });
    } else {
      // Start CLI UI by default
      console.clear();
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

      cli.start();

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
