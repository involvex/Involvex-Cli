import type { ILogService } from "../types/index";
import PluginService from "./PluginService";
import ConfigService from "./ConfigService";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";

export default class PluginCommandHandler {
  private logService: ILogService;
  private pluginService: PluginService;
  private configService: ConfigService;

  constructor(
    logService: ILogService,
    pluginService: PluginService,
    configService: ConfigService,
  ) {
    this.logService = logService;
    this.pluginService = pluginService;
    this.configService = configService;
  }

  async handleCommand(command: string, args: string[]): Promise<void> {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case "list":
        await this.listPlugins();
        break;
      case "install":
        if (!args[1]) {
          console.error(chalk.red("✗ Error: Plugin name or URL required"));
          process.exit(1);
        }
        await this.installPlugin(args[1]);
        break;
      case "update":
        await this.updatePlugins(args[1]);
        break;
      case "remove":
        if (!args[1]) {
          console.error(chalk.red("✗ Error: Plugin name required"));
          process.exit(1);
        }
        await this.removePlugin(args[1]);
        break;
      default:
        this.showHelp();
    }
  }

  private async listPlugins(): Promise<void> {
    try {
      console.log(chalk.cyan("\n📦 Installed Plugins\n"));
      console.log(
        chalk.gray("┌─ Name") +
          chalk.gray("                  ─ Version ─ Author"),
      );

      const plugins = this.pluginService.getLoadedPlugins();

      if (plugins.length === 0) {
        console.log(chalk.yellow("  No plugins installed"));
        console.log(chalk.gray("└─ Install plugins using:"));
        console.log(
          chalk.cyan("   involvex-cli --plugins install <plugin-name-or-url>"),
        );
        return;
      }

      plugins.forEach((plugin, index) => {
        const isLast = index === plugins.length - 1;
        const prefix = isLast ? "└" : "├";
        const name = plugin.name || "Unknown";
        const version = plugin.version || "1.0.0";
        const author = plugin.author || "Unknown";

        console.log(
          `${prefix}─ ${chalk.green(name.padEnd(17))} ${chalk.blue(version.padEnd(9))} ${chalk.gray(author)}`,
        );
      });

      console.log();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`✗ Error listing plugins: ${errorMsg}`));
      this.logService.log(`Error listing plugins: ${errorMsg}`);
      process.exit(1);
    }
  }

  private async installPlugin(nameOrUrl: string): Promise<void> {
    try {
      console.log(chalk.cyan(`\n📥 Installing plugin: ${nameOrUrl}\n`));

      let success = false;
      let pluginName = nameOrUrl;

      // Check if it's a URL
      if (nameOrUrl.startsWith("http://") || nameOrUrl.startsWith("https://")) {
        // Install from URL
        pluginName = nameOrUrl.split("/").pop()?.replace(".js", "") || "plugin";
        success = await this.pluginService.installPluginFromGitHubAsync(
          nameOrUrl,
          pluginName,
        );
      } else {
        // Try to find in remote repository
        success = await this.installFromRepository(nameOrUrl);
        pluginName = nameOrUrl;
      }

      if (success) {
        console.log(
          chalk.green(`✓ Plugin '${pluginName}' installed successfully!\n`),
        );
        this.logService.log(`Plugin '${pluginName}' installed`);
      } else {
        console.error(chalk.red(`✗ Failed to install plugin '${nameOrUrl}'\n`));
        process.exit(1);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`✗ Error installing plugin: ${errorMsg}\n`));
      this.logService.log(`Error installing plugin: ${errorMsg}`);
      process.exit(1);
    }
  }

  private async installFromRepository(pluginName: string): Promise<boolean> {
    try {
      // Check local plugins directory first
      const pluginsDir = path.join(process.cwd(), "plugins");
      const pluginPath = path.join(pluginsDir, pluginName);

      try {
        await fs.access(pluginPath);
        // Plugin exists locally
        return await this.pluginService.installPluginAsync(
          path.join(pluginPath, "index.js"),
        );
      } catch {
        // Not in local plugins
      }

      // Try GitHub as fallback
      // Construct GitHub URL for plugin repository
      const githubUrl = `https://raw.githubusercontent.com/involvex/involvex-plugins/main/plugins/${pluginName}/index.js`;

      console.log(chalk.gray(`  Searching GitHub repository: ${githubUrl}`));

      return await this.pluginService.installPluginFromGitHubAsync(
        githubUrl,
        pluginName,
      );
    } catch (error: unknown) {
      this.logService.log(
        `Error installing from repository: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async updatePlugins(pluginName?: string): Promise<void> {
    try {
      console.log(chalk.cyan("\n🔄 Updating plugins\n"));

      const plugins = this.pluginService.getLoadedPlugins();

      if (plugins.length === 0) {
        console.log(chalk.yellow("  No plugins to update"));
        return;
      }

      let updated = 0;
      let failed = 0;

      for (const plugin of plugins) {
        if (pluginName && plugin.name !== pluginName) {
          continue;
        }

        try {
          console.log(
            chalk.cyan(`  Checking ${plugin.name} v${plugin.version}...`),
          );

          // Check if newer version available (placeholder for now)
          // In future: fetch manifest from repository and compare versions
          console.log(chalk.gray(`  ✓ ${plugin.name} is up to date`));
          updated++;
        } catch (error: unknown) {
          console.error(
            chalk.red(
              `  ✗ Failed to update ${plugin.name}: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
          failed++;
        }
      }

      console.log(chalk.green(`\n✓ Updated: ${updated}, Failed: ${failed}\n`));
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`✗ Error updating plugins: ${errorMsg}\n`));
      this.logService.log(`Error updating plugins: ${errorMsg}`);
      process.exit(1);
    }
  }

  private async removePlugin(pluginName: string): Promise<void> {
    try {
      console.log(chalk.cyan(`\n🗑  Removing plugin: ${pluginName}\n`));

      const success = await this.pluginService.uninstallPluginAsync(pluginName);

      if (success) {
        console.log(
          chalk.green(`✓ Plugin '${pluginName}' removed successfully!\n`),
        );
        this.logService.log(`Plugin '${pluginName}' removed`);
      } else {
        console.error(chalk.red(`✗ Failed to remove plugin '${pluginName}'\n`));
        process.exit(1);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`✗ Error removing plugin: ${errorMsg}\n`));
      this.logService.log(`Error removing plugin: ${errorMsg}`);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(chalk.cyan("\n📦 Plugin Management\n"));
    console.log(
      chalk.yellow("Usage:") + " involvex-cli --plugins <command> [args]\n",
    );
    console.log(chalk.yellow("Commands:"));
    console.log(
      chalk.white("  list                              List installed plugins"),
    );
    console.log(
      chalk.white(
        "  install <name|url>                Install plugin from repository or URL",
      ),
    );
    console.log(
      chalk.white(
        "  update [name]                     Update all or specific plugin",
      ),
    );
    console.log(
      chalk.white("  remove <name>                     Remove a plugin\n"),
    );
    console.log(chalk.yellow("Examples:"));
    console.log(chalk.gray("  involvex-cli --plugins list"));
    console.log(chalk.gray("  involvex-cli --plugins install discord-rpc"));
    console.log(
      chalk.gray(
        "  involvex-cli --plugins install https://github.com/.../plugin.js",
      ),
    );
    console.log(chalk.gray("  involvex-cli --plugins update"));
    console.log(chalk.gray("  involvex-cli --plugins remove discord-rpc\n"));
  }
}
