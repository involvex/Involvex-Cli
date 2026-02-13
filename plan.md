# InvolveX CLI Enhancement Plan

## Overview

Enhance the InvolveX CLI user experience with:

1. **New ClearCacheService** - Dedicated service for clearing package manager caches (npm, pnpm, bun, gradle) and system memory
2. **Animation System** - Full UI redesign with chalk animations across all CLI operations
3. **Centralized UI Utility** - Create `UIAnimationHelper` for consistent, reusable animations
4. **Dual Cache Clearing Modes** - Global (clear all) and selective (choose which) modes

## Problem Statement

- Current CacheService only handles basic NPM cache and system memory
- CLI lacks visual feedback and animations, making it feel less polished
- No support for modern package managers (pnpm, bun) or build tools (gradle)
- UI lacks consistent animation patterns across operations

## Proposed Solution

### 1. Create UIAnimationHelper Service

**Location:** `src/services/UIAnimationHelper.ts`

- Use chalk for coloring and formatting
- Provide reusable methods for:
  - Animated headers and banners
  - Spinners for long-running operations
  - Progress indicators for batch operations
  - Success/error/warning messages with animations
  - Section separators with colors
  - Loading animations
- Replace hardcoded console.logs with animated equivalents

### 2. Create ClearCacheService

**Location:** `src/services/ClearCacheService.ts`

- Methods for clearing:
  - **npm**: `npm cache clean --force`
  - **pnpm**: Check pnpm store and clear via `pnpm store prune`
  - **bun**: Clear bun cache directory (`~/.bun/cache`)
  - **gradle**: Clear gradle cache (`~/.gradle/caches`)
  - **System Memory**: Existing PowerShell memory clearing logic
  - **Standby Memory**: Use PowerShell to clear standby lists
- Support both modes:
  - `clearAllCaches()` - Clear all detected package managers + memory
  - `clearSelectiveCaches(options: string[])` - Clear only specified caches
- Use UIAnimationHelper for progress feedback
- Return structured results (success/failed caches with error details)

### 3. Enhanced TUI Integration

**Location:** `src/cli/TUI.ts`

- Add new menu items:
  - "Cache Management" (submenu):
    - Clear All Caches (global mode)
    - Clear Selective Caches (choose which)
    - Clear Memory/Standby Memory
    - View Cache Status (report sizes)
- Integrate UIAnimationHelper for menu transitions and operation feedback
- Add animated loading states during operations

### 4. Index Integration

**Location:** `src/index.ts`

- Initialize ClearCacheService and UIAnimationHelper
- Update startup messages to use animations
- Pass services to TUI

## File Changes Summary

| File                                | Change Type | Details                                   |
| ----------------------------------- | ----------- | ----------------------------------------- |
| `src/services/UIAnimationHelper.ts` | **CREATE**  | Centralized animation utility using chalk |
| `src/services/ClearCacheService.ts` | **CREATE**  | Package manager + memory cache clearing   |
| `src/cli/TUI.ts`                    | **MODIFY**  | Add cache menu, integrate animations      |
| `src/index.ts`                      | **MODIFY**  | Initialize new services, update startup   |
| `src/types/index.ts`                | **MODIFY**  | Add interfaces for new services           |

## Implementation Order

1. **UIAnimationHelper** - Foundation for all animations (used by everything else)
2. **ClearCacheService** - Core cache clearing logic
3. **Type definitions** - Add interfaces for new services
4. **TUI updates** - Add menu items and integrate animations
5. **Index integration** - Wire everything up
6. **Testing & validation** - Verify all commands work

## Animation Design Goals

- Use **chalk** for consistent coloring
- Provide **visual feedback** for every operation
- Support **progress indicators** for long-running tasks
- Keep animations **non-intrusive** (optional disable via settings?)
- Maintain **accessibility** (don't break on non-TTY environments)

## Package Manager Support

- **npm**: Stable, widely used
- **pnpm**: Growing adoption, different cache structure
- **bun**: Modern bundler/package manager
- **gradle**: Java/Kotlin build tool cache

## Notes

- Chalk v5+ already in dependencies ✓
- ora (spinner) already in dependencies ✓
- Blessed.js for TUI already in use ✓
- PowerShell used for Windows-specific operations (consistent with existing code)
- All operations require appropriate permissions (admin for memory clearing)
- Cache clearing should provide detailed logs for debugging

## Finish

- [ ] UIAnimationHelper
- [ ] ClearCacheService
- [ ] Type definitions
- [ ] TUI updates
- [ ] Index integration
- [ ] Testing & validation
- [ ] remove Blessed.js and mitigate to use chalk + ora + ora-blessed (awesome tui experience with animations color and progress indicators)
- [ ] implement src/services/LogoService.ts full immersive Ascii Logo Display (static and animated, with color and animation + clear screen on menu switch + transition animation and display logo on top of screen)
- [ ] verify integration of all services and animations (cache clearing, logo display, animations, etc. full windows support and functionality)
