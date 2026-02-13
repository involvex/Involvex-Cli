import type { ILogService } from "../types/index";
import chalk from "chalk";

export interface ILogoService {
  showStartupLogo(): void;
  showMenuLogo(): void;
  showCacheLogo(): void;
  clearScreen(): void;
  showAnimatedLogo(frames: string[]): void;
  getSpinnerFrames(): string[];
  getCacheAnimationFrames(): string[];
  getMemoryAnimationFrames(): string[];
  showTransition(): void;
}

export default class LogoService implements ILogoService {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  /**
   * Display startup logo (single clean display, no animation)
   */
  showStartupLogo(): void {
    this.clearScreen();
    const logo = chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║            ${chalk.bold.yellow("⚙  INVOLVEX CLI v1.5.1")}${chalk.cyan(
      "                       ",
    )}║
║                                                            ║
║     ${chalk.gray("Windows System Administration Toolkit")}${chalk.cyan(
      "              ",
    )}║
║                                                            ║
║  ${chalk.green("✓ Cache Management")}${chalk.cyan(
      "  ",
    )}${chalk.green("✓ System Tools")}${chalk.cyan(
      "       ",
    )}${chalk.green("✓ Animations")}${chalk.cyan("     ")}║
║                                                            ║
║              ${chalk.cyan("[ Ready to Start ]")}${chalk.cyan(
      "                       ",
    )}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    console.log(logo);
    this.logService.log("Startup logo displayed");
  }

  /**
   * Display menu section logo
   */
  showMenuLogo(): void {
    const logo = chalk.cyan(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║          ${chalk.bold.yellow("⚙  INVOLVEX CLI")}${chalk.cyan(
      "                           ",
    )}║
    ║                                                       ║
    ║        ${chalk.gray("Windows System Administration Toolkit")}        ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);
    console.log(logo);
    this.logService.log("Menu logo displayed");
  }

  /**
   * Display cache management logo
   */
  showCacheLogo(): void {
    const logo = chalk.green(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║        ${chalk.bold.cyan("🗑  CACHE MANAGEMENT")}${chalk.green(
      "                     ",
    )}║
    ║                                                       ║
    ║   ${chalk.gray("npm • pnpm • bun • gradle")}${chalk.green(
      "                    ",
    )}║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);
    console.log(logo);
    this.logService.log("Cache logo displayed");
  }

  /**
   * Clear the terminal screen
   */
  clearScreen(): void {
    console.clear();
    this.logService.log("Screen cleared");
  }

  /**
   * Display animated logo with frames
   */
  showAnimatedLogo(frames: string[]): void {
    frames.forEach((frame, index) => {
      console.log(frame);
      this.logService.log(`Animated logo frame ${index + 1}`);
    });
  }

  /**
   * Get startup logo frames (animated)
   */
  private getStartupLogoFrames(): string[] {
    return [
      // Frame 1: Basic structure
      chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                    ${chalk.bold.yellow("INVOLVEX")}${chalk.cyan(
        "                              ",
      )}║
║                     ${chalk.bold.blue("CLI v1.5.1")}${chalk.cyan(
        "                            ",
      )}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `),

      // Frame 2: With description
      chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║            ${chalk.bold.yellow("⚙  INVOLVEX CLI v1.5.1")}${chalk.cyan(
        "                       ",
      )}║
║                                                            ║
║     ${chalk.gray("Windows System Administration Toolkit")}${chalk.cyan(
        "              ",
      )}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `),

      // Frame 3: With features
      chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║            ${chalk.bold.yellow("⚙  INVOLVEX CLI v1.5.1")}${chalk.cyan(
        "                       ",
      )}║
║                                                            ║
║     ${chalk.gray("Windows System Administration Toolkit")}${chalk.cyan(
        "              ",
      )}║
║                                                            ║
║  ${chalk.green("✓ Cache Management")}${chalk.cyan(
        "  ",
      )}${chalk.green("✓ System Tools")}${chalk.cyan(
        "       ",
      )}${chalk.green("✓ Animations")}${chalk.cyan("     ")}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `),

      // Frame 4: Ready
      chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║            ${chalk.bold.yellow("⚙  INVOLVEX CLI v1.5.1")}${chalk.cyan(
        "                       ",
      )}║
║                                                            ║
║     ${chalk.gray("Windows System Administration Toolkit")}${chalk.cyan(
        "              ",
      )}║
║                                                            ║
║  ${chalk.green("✓ Cache Management")}${chalk.cyan(
        "  ",
      )}${chalk.green("✓ System Tools")}${chalk.cyan(
        "       ",
      )}${chalk.green("✓ Animations")}${chalk.cyan("     ")}║
║                                                            ║
║                  ${chalk.bold.cyan("[ Ready to Start ]")}${chalk.cyan(
        "                   ",
      )}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `),
    ];
  }

  /**
   * Get animated spinner frames
   */
  getSpinnerFrames(): string[] {
    return [
      chalk.cyan("⠋"),
      chalk.blue("⠙"),
      chalk.cyan("⠹"),
      chalk.green("⠸"),
      chalk.yellow("⠼"),
      chalk.cyan("⠴"),
      chalk.blue("⠦"),
      chalk.cyan("⠧"),
      chalk.green("⠇"),
      chalk.yellow("⠏"),
    ];
  }

  /**
   * Get cache clearing animation frames
   */
  getCacheAnimationFrames(): string[] {
    return [
      chalk.yellow("🗑  [          ] 0%"),
      chalk.yellow("🗑  [█         ] 10%"),
      chalk.yellow("🗑  [██        ] 20%"),
      chalk.yellow("🗑  [███       ] 30%"),
      chalk.yellow("🗑  [████      ] 40%"),
      chalk.yellow("🗑  [█████     ] 50%"),
      chalk.yellow("🗑  [██████    ] 60%"),
      chalk.yellow("🗑  [███████   ] 70%"),
      chalk.yellow("🗑  [████████  ] 80%"),
      chalk.yellow("🗑  [█████████ ] 90%"),
      chalk.green("🗑  [██████████] 100%"),
    ];
  }

  /**
   * Display transition animation
   */
  showTransition(): void {
    const transitions = ["═", "─", "·", "·", "─"];

    transitions.forEach(char => {
      const line = chalk.cyan(char.repeat(60));
      console.log(line);
    });
  }

  /**
   * Get memory clearing animation frames
   */
  getMemoryAnimationFrames(): string[] {
    return [
      chalk.magenta("RAM [          ] 0%"),
      chalk.magenta("RAM [████      ] 25%"),
      chalk.magenta("RAM [████████  ] 50%"),
      chalk.blue("RAM [███████████] 75%"),
      chalk.green("RAM [██████████] 100%"),
    ];
  }
}
