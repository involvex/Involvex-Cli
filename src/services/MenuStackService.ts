import type { ILogService } from "../types/index";

export interface IMenuStackService {
  push(menu: string): void;
  pop(): string | undefined;
  current(): string;
  depth(): number;
  isMain(): boolean;
  clear(): void;
  history(): string[];
}

/**
 * MenuStackService - Manages menu navigation stack
 * Prevents input state bleed and tracks menu depth
 */
export default class MenuStackService implements IMenuStackService {
  private stack: string[] = ["main"];

  constructor(private logService: ILogService) {
    this.logService.log("MenuStackService initialized");
  }

  /**
   * Push a menu onto the stack
   */
  push(menu: string): void {
    this.stack.push(menu);
    this.logService.log(`Menu pushed: ${menu} (depth: ${this.stack.length})`);
  }

  /**
   * Pop current menu from stack
   */
  pop(): string | undefined {
    if (this.stack.length <= 1) {
      this.logService.log("Cannot pop main menu");
      return undefined;
    }
    const popped = this.stack.pop();
    this.logService.log(`Menu popped: ${popped} (depth: ${this.stack.length})`);
    return popped;
  }

  /**
   * Get current active menu
   */
  current(): string {
    return this.stack[this.stack.length - 1] || "main";
  }

  /**
   * Get menu stack depth
   */
  depth(): number {
    return this.stack.length;
  }

  /**
   * Check if at main menu
   */
  isMain(): boolean {
    return this.stack.length === 1 && this.stack[0] === "main";
  }

  /**
   * Clear stack and return to main
   */
  clear(): void {
    this.stack = ["main"];
    this.logService.log("Menu stack cleared");
  }

  /**
   * Get full history
   */
  history(): string[] {
    return [...this.stack];
  }
}
