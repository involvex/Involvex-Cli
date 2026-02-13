import type { ILogService } from "../types/index";
import chalk from "chalk";
import ora from "ora";

export interface IUIAnimationHelper {
  showHeader(text: string): void;
  showSection(text: string): void;
  showSuccess(text: string): void;
  showError(text: string): void;
  showWarning(text: string): void;
  showInfo(text: string): void;
  createSpinner(text: string): ReturnType<typeof ora>;
  showSeparator(): void;
  showTable(title: string, rows: string[][]): void;
}

export default class UIAnimationHelper implements IUIAnimationHelper {
  private logService: ILogService;

  constructor(logService: ILogService) {
    this.logService = logService;
  }

  /**
   * Display an animated header banner
   */
  showHeader(text: string): void {
    const lines = [
      "",
      chalk.cyan("╔" + "═".repeat(text.length + 4) + "╗"),
      chalk.cyan("║ ") + chalk.bold.cyan(text) + chalk.cyan(" ║"),
      chalk.cyan("╚" + "═".repeat(text.length + 4) + "╝"),
      "",
    ];
    lines.forEach(line => {
      console.log(line);
      this.logService.log(line);
    });
  }

  /**
   * Display a section header with separator
   */
  showSection(text: string): void {
    const line = `\n${chalk.bold.green("▶")} ${chalk.bold.green(text)}`;
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Display a success message with checkmark
   */
  showSuccess(text: string): void {
    const line = chalk.green(`  ✓ ${text}`);
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Display an error message with X mark
   */
  showError(text: string): void {
    const line = chalk.red(`  ✗ ${text}`);
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Display a warning message with exclamation
   */
  showWarning(text: string): void {
    const line = chalk.yellow(`  ⚠ ${text}`);
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Display an info message with info icon
   */
  showInfo(text: string): void {
    const line = chalk.blue(`  ℹ ${text}`);
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Create and return an ora spinner for long operations
   */
  createSpinner(text: string): ReturnType<typeof ora> {
    const spinner = ora({
      text: chalk.cyan(text),
      prefixText: "  ",
    });
    return spinner;
  }

  /**
   * Display a visual separator
   */
  showSeparator(): void {
    const line = chalk.gray("─".repeat(60));
    console.log(line);
    this.logService.log(line);
  }

  /**
   * Display a formatted table
   */
  showTable(title: string, rows: string[][]): void {
    if (rows.length === 0) {
      this.showWarning(`No data for ${title}`);
      return;
    }

    const lines: string[] = [];

    // Title
    lines.push("");
    lines.push(chalk.bold.cyan(`📋 ${title}`));
    lines.push(chalk.gray("─".repeat(60)));

    // Calculate column widths
    const firstRow = rows[0] || [];
    const colWidths: number[] = firstRow.map((_, colIdx) =>
      Math.max(...rows.map(row => (row[colIdx] || "").length)),
    );

    // Rows
    rows.forEach((row, rowIdx) => {
      const formatted = row
        .map((cell, colIdx) => {
          const width = colWidths[colIdx] || 0;
          return (cell || "").padEnd(width);
        })
        .join("  ");

      if (rowIdx === 0) {
        lines.push(chalk.bold.yellow(formatted));
        lines.push(chalk.gray("─".repeat(60)));
      } else {
        lines.push(formatted);
      }
    });

    lines.push("");

    lines.forEach(line => {
      console.log(line);
      this.logService.log(line);
    });
  }
}
