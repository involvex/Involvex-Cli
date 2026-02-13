# InvolveX Plugins - Repository Guide

## Overview

The InvolveX plugin system allows you to extend the CLI with custom functionality. Plugins can be:

- Hosted in the official `involvex-plugins` GitHub repository
- Created locally in the `plugins/` directory
- Installed remotely from GitHub URLs

## Plugin Repository Structure

The recommended structure for a plugin repository is:

```
involvex-plugins/
├── README.md                 # Repository documentation
├── repository.json          # Central plugin registry
└── plugins/
    ├── discord-rpc/
    │   ├── index.js
    │   ├── manifest.json
    │   └── README.md
    ├── process-manager/
    │   ├── index.js
    │   ├── manifest.json
    │   └── README.md
    └── system-monitor/
        ├── index.js
        ├── manifest.json
        └── README.md
```

## Plugin Manifest Format (manifest.json)

Each plugin MUST include a `manifest.json` file:

```json
{
  "id": "unique-plugin-identifier",
  "name": "Plugin Display Name",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "entry": "index.js",
  "keywords": ["cache", "utilities", "system"],
  "dependencies": {
    "chalk": "^5.0.0"
  },
  "repository": "https://github.com/involvex/involvex-plugins",
  "license": "MIT"
}
```

### Manifest Fields

| Field          | Required | Type   | Description                          |
| -------------- | -------- | ------ | ------------------------------------ |
| `id`           | Yes      | string | Unique identifier (kebab-case)       |
| `name`         | Yes      | string | Display name in CLI menu             |
| `version`      | Yes      | string | Plugin version (semver)              |
| `description`  | Yes      | string | Brief description                    |
| `author`       | No       | string | Author name                          |
| `entry`        | Yes      | string | Main file (usually `index.js`)       |
| `keywords`     | No       | array  | Search tags                          |
| `dependencies` | No       | object | npm package dependencies             |
| `repository`   | No       | string | GitHub repo URL                      |
| `license`      | No       | string | License type (MIT, Apache-2.0, etc.) |

## Creating a Plugin

### Step 1: Create Plugin Class

```javascript
// plugins/my-plugin/index.js
class MyPlugin {
  constructor(services) {
    this.services = services;
    this.name = "My Plugin";
    this.description = "My awesome plugin";
    this.version = "1.0.0";
    this.author = "Your Name";
  }

  // Get menu items (required)
  getMenuItems() {
    return [
      {
        name: "Feature 1",
        description: "Do something awesome",
        handler: async () => this.handleFeature1(),
      },
      {
        name: "Feature 2",
        description: "Do something else",
        handler: async () => this.handleFeature2(),
      },
    ];
  }

  async handleFeature1() {
    // Implementation here
  }

  async handleFeature2() {
    // Implementation here
  }

  // Optional: Plugin initialization
  async initializeAsync() {
    console.log("Plugin initializing...");
  }

  // Optional: Plugin shutdown
  async shutdownAsync() {
    console.log("Plugin shutting down...");
  }
}

module.exports = MyPlugin;
```

### Step 2: Create Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "entry": "index.js",
  "license": "MIT"
}
```

### Step 3: Place in Repository

```bash
mkdir -p involvex-plugins/plugins/my-plugin
cp index.js involvex-plugins/plugins/my-plugin/
cp manifest.json involvex-plugins/plugins/my-plugin/
```

## Installing Plugins

### From Local Directory

Plugins in the local `plugins/` directory are automatically loaded:

```bash
involvex-cli  # Loads all plugins from ./plugins/
```

### From GitHub Repository

Install a plugin directly from GitHub:

```bash
# Install from official repository
involvex-cli --install-plugin github:involvex-plugins/my-plugin

# Install from raw GitHub URL
involvex-cli --install-plugin https://raw.githubusercontent.com/involvex/involvex-plugins/main/plugins/my-plugin/index.js

# Install from user/org repository
involvex-cli --install-plugin https://raw.githubusercontent.com/user/repo/main/plugins/plugin-name/index.js
```

## Available Services

Plugins receive access to InvolveX services through the constructor:

```javascript
class MyPlugin {
  constructor(services) {
    // Available services:
    this.logService = services.log; // Logging
    this.animationHelper = services.animation; // UI animations
    this.cacheService = services.cache; // Cache operations
    this.packageManager = services.packageManager;
    this.storage = services.storage;
    this.uninstaller = services.uninstaller;
    this.settings = services.settings;
  }
}
```

## Plugin Development Tips

### Logging

Always use the log service instead of `console.log`:

```javascript
this.services.log.log("This is a log message");
```

### Animations

Use the animation helper for consistent UI:

```javascript
this.services.animation.showHeader("Section Title");
this.services.animation.showSuccess("Operation completed!");
this.services.animation.showError("Something went wrong");
```

### Error Handling

Handle errors gracefully:

```javascript
async handleFeature() {
  try {
    // Your code here
  } catch (error) {
    this.services.animation.showError(error.message);
    this.services.log.log(`Error: ${error.message}`);
  }
}
```

## Official Plugins

Current official plugins in the repository:

1. **discord-rpc** - Display CLI status in Discord
2. **process-manager** - Advanced process management
3. **service-manager** - Windows service utilities
4. **system-monitor** - Real-time system monitoring

## Submitting Your Plugin

To have your plugin included in the official repository:

1. **Fork** https://github.com/involvex/involvex-plugins
2. **Create** a plugin directory: `plugins/your-plugin/`
3. **Implement** your plugin with manifest
4. **Document** your plugin (README.md in plugin directory)
5. **Test** thoroughly
6. **Submit** a Pull Request

### PR Requirements

- Plugin follows the structure defined above
- Manifest.json is valid and complete
- README.md explains the plugin purpose
- Code is clean and well-commented
- No dependencies on proprietary code
- License is clearly stated

## Plugin Registry (repository.json)

The central registry file lists all available plugins:

```json
{
  "version": "1.0.0",
  "plugins": [
    {
      "id": "discord-rpc",
      "name": "Discord RPC",
      "description": "Display CLI status in Discord",
      "url": "https://raw.githubusercontent.com/involvex/involvex-plugins/main/plugins/discord-rpc/index.js",
      "manifest": "https://raw.githubusercontent.com/involvex/involvex-plugins/main/plugins/discord-rpc/manifest.json",
      "version": "1.2.0",
      "author": "InvolveX Team",
      "downloads": 245
    }
  ]
}
```

## Troubleshooting

### Plugin won't load

- Verify `manifest.json` exists and is valid JSON
- Check that `entry` file exists
- Review plugin logs: `src/logs/update.log`
- Ensure plugin class is exported with `module.exports`

### Plugin installation fails

- Verify GitHub URL is correct
- Check GitHub raw URL accessibility
- Ensure plugin file is valid JavaScript
- Review CLI logs for error messages

### Plugin menu not appearing

- Verify `getMenuItems()` method exists
- Check that menu items have `name`, `description`, and `handler`
- Ensure plugin is loaded (check logs)

## Advanced: Plugin Configuration

Plugins can access InvolveX settings:

```javascript
async handleFeature() {
  const settings = await this.services.settings.getSettings();
  const logLevel = settings.logLevel || "info";

  // Use settings in your plugin
}
```

## Support & Community

- **Issues**: https://github.com/involvex/involvex-plugins/issues
- **Discussions**: https://github.com/involvex/involvex-plugins/discussions
- **Contributing**: See CONTRIBUTING.md in the repository

## License

All plugins in the official repository are MIT licensed. Custom plugins may use other licenses.

---

**Happy plugin development!** 🚀
