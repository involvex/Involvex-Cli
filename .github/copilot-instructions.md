# Copilot Instructions for InvolveX CLI

This document provides essential context for Copilot sessions working on the InvolveX CLI project.

## Quick Commands

### Build, Test & Lint

```bash
# Development/testing
bun run dev                    # Run CLI directly from source
bun run build                  # Build TypeScript to dist/index.js
bun run test                   # Run all tests
bun run test:watch            # Watch mode for tests
npm test -- path/to/test.ts   # Run specific test file
bun run test:coverage         # Generate coverage report

# Code quality
bun run lint                   # Run ESLint
bun run lint:fix              # Fix linting issues automatically
bun run format                # Format code with Prettier
bun run format:check          # Check formatting without changes
bun run typecheck             # Type-check without emitting

# Pre-build checks (runs automatically before build)
bun run prebuild              # format + lint:fix + typecheck
```

## Architecture Overview

### Service-Oriented Design

The application is built as a collection of **domain-specific services** that handle distinct responsibilities:

- **LogService**: Centralized file-based logging (no console output to avoid corrupting TUI)
- **ConfigService**: YAML-based persistent configuration
- **SettingsService**: Application settings and user preferences
- **PackageManagerService**: Multi-package manager orchestration (winget, npm, scoop, chocolatey)
- **StorageManagerService**: Cross-service state persistence
- **SystemRestoreService**: Windows system restore point management
- **UninstallerService**: Program uninstallation via WMI/registry
- **AutoUpdateService**: Automatic dependency updates
- **CacheService**: System cache and temp file cleanup
- **StartupService**: Startup program management
- **NetworkService**: Ping and speed testing
- **DnsService**: DNS configuration via netsh
- **DriverService**: Driver update management
- **PluginService**: Dynamic plugin loading and management

### Layer Structure

```
src/
├── index.ts           # Main entry, service initialization & CLI launch
├── services/          # Domain logic (no direct UI dependencies)
├── cli/
│   └── TUI.ts        # Terminal UI using Blessed.js (only layer accessing services)
├── server/
│   └── webServer.ts  # Optional Express-based HTTP API
└── types/
    └── index.ts      # Interface definitions for services
```

### Key Patterns

1. **Services receive LogService in constructor**: All services accept `logService` as their first parameter for logging.

2. **Interface-driven**: Services define interfaces in `src/types/index.ts` (e.g., `ILogService`, `IPackageManagerService`). Implementations match interface contracts.

3. **Asynchronous by default**: Service methods use `async/await`. No synchronous wrappers.

4. **ProcessResult type**: External command execution returns `{ code: number; stdout: string; stderr: string }`.

5. **Plugin architecture**: Plugins implement the `Plugin` interface and expose menu items dynamically. Loaded via `PluginService.loadPluginAsync()`.

6. **Windows-specific**: Leverages PowerShell, WMI, registry, and Windows APIs. Not cross-platform.

## Key Conventions

### TypeScript & Code Quality

- **Strict mode enabled**: `tsconfig.json` enforces `"strict": true`
- **ESLint + Prettier**: Auto-formatting on prebuild; no style debates
- **Organize imports plugin**: Prettier automatically groups imports (stdlib, third-party, local)
- **80 character line limit**: Enforced by Prettier
- **No unused variables/params**: Disabled in config for flexibility, but clean code is expected

### Logging

- **Never console.log in services**: Use `logService.log()` to write to file only
- **TUI must never be corrupted**: The terminal UI runs in Blessed.js; console output breaks it
- **Log file location**: `src/logs/update.log` (or custom via environment)

### Testing

- **Test location**: `__tests__/**/*.test.ts` (watched by Jest)
- **Test environment**: Node.js (not browser)
- **Single worker mode**: Jest runs with `maxWorkers: 1` to prevent hanging
- **Force exit**: Tests force exit after completion to clean up process handles
- **Timeout**: 10 seconds per test (increase via test config if needed)

### Error Handling

- Services throw errors; callers handle them (TUI catches and displays)
- No silent failures in services; always log errors via logService

### Build Process

- **prebuild hook**: Runs `format`, `lint:fix`, and `typecheck` automatically
- **Build output**: `dist/index.js` (single file, bun bundle target=node)
- **Entry point**: `src/index.ts` (TypeScript, no JavaScript source)

## Plugin System

- Plugins must export a class/object implementing the `Plugin` interface
- Plugins are discovered from `plugins-repository.json`
- `PluginService` dynamically requires and initializes plugins
- Plugins receive `screen` (Blessed.js screen object) to build custom TUI elements
- Plugin errors are caught and logged; won't crash the main app

## Windows-Specific Details

- **Admin privileges**: Some operations (DNS, system restore, driver updates) require elevated permissions
- **PowerShell integration**: Services use `child_process.exec()` to run PowerShell commands
- **Registry access**: System restore and startup programs via Windows registry
- **WMI usage**: Uninstaller service queries WMI for installed programs

## Development Workflow

1. **Feature branches**: Create feature branches for all changes
2. **Pre-commit checks**: `prebuild` runs automatically; ensure it passes before committing
3. **Tests first (optional)**: Jest is configured; tests encouraged but not enforced
4. **Type safety**: TypeScript strict mode; fix type errors before submitting
5. **Environment**: Requires Windows 10/11 and Node.js 16+; use `bun` for package management

## Known Limitations & Quirks

- **TUI in CI/CD**: The CLI requires an interactive terminal; it won't run in GitHub Actions or non-TTY environments
- **Admin mode**: Some service methods silently fail if not run as administrator (check logs)
- **Package manager availability**: Services check if package managers are installed; gracefully skip if unavailable
- **Single-worker Jest**: Tests run sequentially to avoid hanging (side effect of child_process spawning)

## Configuration

- **App config location**: `%APPDATA%\InvolveX\config.yaml`
- **Settings**: Persisted via `StorageManagerService` to the config file
- **Plugin repository**: Defined in `plugins-repository.json` at project root
