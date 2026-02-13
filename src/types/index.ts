// Import service classes for type references
import StorageManagerService from "../services/StorageManagerService";

/**
 * Log service interface
 */
export interface ILogService {
  log(message: string): void;
}

/**
 * Menu Stack service interface
 */
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
 * Result from executing a process command
 */
export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Package update information
 */
export interface PackageUpdate {
  packageManager: string;
  packageName: string;
  packageId?: string;
  currentVersion: string;
  availableVersion: string;
}

/**
 * Base plugin interface that all plugins must implement
 */
export interface Plugin {
  name: string;
  description: string;
  version: string;
  author: string;
  initializeAsync?(): Promise<void>;
  shutdownAsync?(): Promise<void>;
  execute?(screen: unknown): Promise<void>;
  getMenuItemsAsync?(): Promise<string[]>;
  menuItems?: string[];
}

/**
 * Package Manager service interface
 */
export interface IPackageManagerService {
  isInstalled(): Promise<boolean>;
  listInstalledPrograms(): Promise<string[]>;
  updateNpm(): Promise<ProcessResult>;
  updateScoop(): Promise<ProcessResult>;
  updateChoco(): Promise<ProcessResult>;
  updatePip(): Promise<ProcessResult>;
  listPackages(): Promise<PackageUpdate[]>;
}

/**
 * Settings service interface
 */
export interface ISettingsService {
  getSettings(): unknown;
  saveSettings(updates: unknown): void;
}

/**
 * Startup service interface
 */
export interface IStartupService {
  listStartupPrograms(): Promise<string[]>;
}

/**
 * Uninstaller service interface
 */
export interface IUninstallerService {
  uninstallProgram(packageName: string): Promise<boolean>;
}

/**
 * DNS service interface
 */
export interface IDnsService {
  setDns(primaryDns: string, secondaryDns: string): Promise<void>;
}

/**
 * Network service interface
 */
export interface INetworkService {
  runPingTest(host: string, timeoutMs?: number): Promise<string>;
  runSpeedTest(): Promise<string>;
}

/**
 * Cache service interface
 */
export interface ICacheService {
  clearSystemCache(): Promise<boolean>;
}

/**
 * UI Animation Helper interface
 */
export interface IUIAnimationHelper {
  showHeader(text: string): void;
  showSection(text: string): void;
  showSuccess(text: string): void;
  showError(text: string): void;
  showWarning(text: string): void;
  showInfo(text: string): void;
  createSpinner(text: string): ReturnType<typeof import("ora").default>;
  showSeparator(): void;
  showTable(title: string, rows: string[][]): void;
}

/**
 * Clear Cache service interface
 */
export interface IClearCacheService {
  clearAllCaches(): Promise<
    Array<{ name: string; success: boolean; error?: string; size?: string }>
  >;
  clearSelectiveCaches(
    caches: string[],
  ): Promise<
    Array<{ name: string; success: boolean; error?: string; size?: string }>
  >;
  clearMemory(): Promise<boolean>;
  clearStandbyMemory(): Promise<boolean>;
  getCacheSizes(): Promise<
    Array<{ name: string; success: boolean; error?: string; size?: string }>
  >;
}

/**
 * Logo Service Interface
 */
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

/**
 * Plugin service interface
 */
export interface IPluginService {
  loadPluginAsync(pluginPath: string): Promise<boolean>;
  unloadPluginAsync(pluginName: string): Promise<boolean>;
  listLoadedPluginsAsync(): Promise<string[]>;
  getAvailablePluginsAsync(): Promise<PackageUpdate[]>;
  installPluginAsync(pluginInfo: unknown): Promise<boolean>;
  validatePluginAsync(pluginPath: string): Promise<boolean>;
}

/**
 * Auto Update service interface
 */
export interface IAutoUpdateService {
  performAutoUpdate(): Promise<boolean | null>;
}

/**
 * Service collection interface
 */
export interface Services {
  packageManager: IPackageManagerService;
  autoUpdate: IAutoUpdateService;
  cache: ICacheService;
  startup: IStartupService;
  uninstaller: IUninstallerService;
  dns: IDnsService;
  network: INetworkService;
  storageManager: StorageManagerService;
  settings: ISettingsService;
  plugin: IPluginService;
}
