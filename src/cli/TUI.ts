/* eslint-disable @typescript-eslint/no-explicit-any */
import type StorageManagerService from "../services/StorageManagerService";
import type PackageManagerService from "../services/PackageManagerService";
import type UninstallerService from "../services/UninstallerService";
import type SettingsService from "../services/SettingsService";
import type { ILogService } from "../types/index.js";
import blessed from "blessed";

interface CLIUIServices {
  log: ILogService;
  packageManager: PackageManagerService;
  storage: StorageManagerService;
  uninstaller: UninstallerService;
  settings: SettingsService;
}

interface MenuItem {
  name: string;
  handler?: () => void;
}

export default class CLIUI {
  private screen: any;
  private menu: any;
  private content: any;
  private services: CLIUIServices;
  private version: string;
  private menuItems: MenuItem[];

  constructor(services: CLIUIServices, version: string) {
    this.services = services;
    this.version = version;
    this.menuItems = [
      {
        name: "Package Manager",
        handler: () => this.showPackageManager(),
      },
      {
        name: "System Tools",
        handler: () => this.showSystemTools(),
      },
      {
        name: "Settings",
        handler: () => this.showSettings(),
      },
      {
        name: "Exit",
        handler: () => this.exit(),
      },
    ];
    this.screen = this._createScreen();
  }

  private _createScreen(): any {
    const screen = blessed.screen({
      mouse: true,
      title: `InvolveX CLI v${this.version}`,
      smartCSR: true,
    });

    // Header
    blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: `{center}{bold}InvolveX CLI v${this.version}{/bold}{/center}`,
      style: {
        fg: "black",
        bg: "green",
        bold: true,
      },
      border: "line",
    });

    // Main menu list
    this.menu = blessed.list({
      parent: screen,
      top: 3,
      left: 0,
      width: "30%",
      bottom: 3,
      mouse: true,
      keys: true,
      vi: false,
      border: "line",
      label: " Menu ",
      style: {
        selected: { bg: "green", fg: "black", bold: true },
        item: { fg: "white" },
      },
      items: this.menuItems.map(item => item.name),
    });

    // Content display area
    this.content = blessed.box({
      parent: screen,
      top: 3,
      left: "30%",
      right: 0,
      bottom: 3,
      content:
        "{center}{bold}Welcome to InvolveX CLI{/bold}\n\nSelect an option from the menu{/center}",
      style: { fg: "white" },
      border: "line",
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      label: " Info ",
    });

    // Status bar
    blessed.box({
      parent: screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      content:
        "{center}{yellow}↑↓{/yellow} Navigate {yellow}Enter{/yellow} Select {yellow}h{/yellow} Help {yellow}q{/yellow} Quit{/center}",
      style: { fg: "cyan", bg: "black" },
      border: "line",
    });

    // Menu selection handler
    this.menu.on("select", () => {
      const selectedIndex = this.menu.selected;
      const selectedItem = this.menuItems[selectedIndex];

      if (selectedItem && selectedItem.handler) {
        selectedItem.handler();
      }

      screen.render();
    });

    // Global key bindings
    screen.key(["q"], () => {
      this.exit();
    });

    screen.key(["C-c"], () => {
      this.exit();
    });

    screen.key(["h", "?"], () => {
      this.showHelp();
      screen.render();
    });

    screen.key(["tab"], () => {
      if (screen.focused === this.menu) {
        this.content.focus();
      } else {
        this.menu.focus();
      }
    });

    // Focus menu initially
    this.menu.focus();

    return screen;
  }

  private showPackageManager(): void {
    this.content.setContent(
      "{bold}Package Manager{/bold}\n\n" +
        "Features:\n" +
        "  • Update packages\n" +
        "  • Install new packages\n" +
        "  • Remove packages\n\n" +
        "{yellow}[This feature will be implemented]{/yellow}",
    );
  }

  private showSystemTools(): void {
    this.content.setContent(
      "{bold}System Tools{/bold}\n\n" +
        "Features:\n" +
        "  • System restore points\n" +
        "  • Network diagnostics\n" +
        "  • Driver management\n\n" +
        "{yellow}[This feature will be implemented]{/yellow}",
    );
  }

  private showSettings(): void {
    this.content.setContent(
      "{bold}Settings{/bold}\n\n" +
        "Available settings:\n" +
        "  • Auto-update: Enabled\n" +
        "  • Theme: Dark\n" +
        "  • Log level: Info\n\n" +
        "{yellow}[This feature will be implemented]{/yellow}",
    );
  }

  private showHelp(): void {
    this.content.setContent(
      "{bold}{cyan}Help{/cyan}{/bold}\n\n" +
        "{yellow}Navigation:{/yellow}\n" +
        "  ↑↓      - Move between menu items\n" +
        "  Enter   - Select menu item\n" +
        "  Tab     - Switch between menu and content\n\n" +
        "{yellow}Commands:{/yellow}\n" +
        "  h / ?   - Show this help\n" +
        "  q       - Quit application\n" +
        "  Ctrl+C  - Exit immediately\n\n" +
        "{yellow}Tips:{/yellow}\n" +
        "  • Use arrow keys to navigate\n" +
        "  • Press Enter to select an option\n" +
        "  • Content area is scrollable",
    );
  }

  private exit(): void {
    this.screen.destroy();
    process.exit(0);
  }

  start(): void {
    this.screen.render();
    this.services.log.log("CLI UI started");
  }

  stop(): void {
    if (this.screen) {
      try {
        this.screen.destroy();
      } catch {
        // Ignore errors during screen destruction
      }
    }
  }
}
