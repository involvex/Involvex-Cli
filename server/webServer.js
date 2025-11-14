const express = require('express');

class WebServer {
  constructor(logService, services) {
    this.logService = logService;
    this.app = express();
    this.server = null;
    this.services = services;
    this.setupRoutes();
  }

  setupRoutes() {
    // Serve static files if folder is provided
    this.app.use(express.json());
    this.app.use(express.static('public'));
    // Serve favicon
    this.app.use('/favicon.png', express.static('favicon.png'));

    // Main API routes
    this.app.get('/', (req, res) => {
      res.send(this.getMainHTML());
    });

    this.app.get('/api/menu', (req, res) => {
      res.json({
        items: [
          'Update',
          'Cache',
          'Startup',
          'Uninstall',
          'DNS',
          'Network',
          'Driver',
          'System Restore',
          'Storage Manager',
          'Plugins',
          'Settings',
        ],
      });
    });

    this.app.get('/api/updates', async (req, res) => {
      try {
        const updates = await this.services.packageManager.getAvailableUpdatesAsync();
        res.json({ success: true, updates });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/cli-updates', async (req, res) => {
      try {
        const updateInfo = await this.services.autoUpdate.checkForUpdates();
        res.json({ success: true, updateInfo });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/cli-updates/install', async (req, res) => {
      try {
        const result = await this.services.autoUpdate.installUpdate();
        res.json({ success: result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/update/:manager', async (req, res) => {
      try {
        const { manager } = req.params;
        let result = false;
        switch (manager) {
          case 'winget':
            result = await this.services.packageManager.updateWinget();
            break;
          case 'npm':
            result = await this.services.packageManager.updateNpm();
            break;
          case 'scoop':
            result = await this.services.packageManager.updateScoop();
            break;
          case 'choco':
            result = await this.services.packageManager.updateChoco();
            break;
          case 'pip':
            result = await this.services.packageManager.updatePip();
            break;
        }
        res.json({ success: result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/cache/clear', async (req, res) => {
      try {
        const result = await this.services.cache.clearSystemCache();
        res.json({ success: result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/cache/memory', async (req, res) => {
      try {
        const result = await this.services.cache.clearMemory();
        res.json({ success: result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/startup', async (req, res) => {
      try {
        const programs = await this.services.startup.listStartupPrograms();
        res.json({ success: true, programs });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/programs', async (req, res) => {
      try {
        const programs = await this.services.uninstaller.listInstalledPrograms();
        res.json({ success: true, programs });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/dns', async (req, res) => {
      try {
        const dnsInfo = await this.services.dns.getCurrentDns();
        res.json({ success: true, dns: dnsInfo });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/network/ping', async (req, res) => {
      try {
        const { host } = req.body;
        const result = await this.services.network.runPingTest(host || '8.8.8.8');
        res.json({ success: true, result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/plugins', async (req, res) => {
      try {
        const plugins = this.services.plugin.getLoadedPlugins();
        res.json({
          success: true,
          plugins: plugins.map(p => ({
            name: p.name,
            description: p.description,
            version: p.version,
          })),
        });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/system/monitor', async (req, res) => {
      try {
        const SystemMonitorPlugin = require('../plugins/SystemMonitorPlugin');
        const monitor = new SystemMonitorPlugin();
        await monitor.initializeAsync();
        const cpu = await monitor.getCpuUsage();
        const memory = await monitor.getMemoryUsage();
        const drives = await monitor.getDriveUsage();
        await monitor.shutdownAsync();
        res.json({ success: true, cpu, memory, drives });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    // Storage Manager API endpoints
    this.app.get('/api/storage/disk-info', async (req, res) => {
      try {
        const diskInfo = await this.services.storageManager.getDiskInfo();
        res.json({ success: true, diskInfo });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/storage/defragment/:drive', async (req, res) => {
      try {
        const { drive } = req.params;
        const result = await this.services.storageManager.defragmentDrive(drive);
        res.json({ success: true, result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/storage/cleanup-targets', async (req, res) => {
      try {
        const targets = await this.services.storageManager.getCleanupTargets();
        res.json({ success: true, targets });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/storage/clean-temp', async (req, res) => {
      try {
        const { targetPaths } = req.body;
        const result = await this.services.storageManager.cleanTempFiles(targetPaths);
        res.json({ success: true, result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/storage/scan-directory', async (req, res) => {
      try {
        const { directoryPath, minSizeMB } = req.body;
        const result = await this.services.storageManager.scanDirectory(directoryPath, minSizeMB);
        res.json({ success: true, result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/storage/delete-items', async (req, res) => {
      try {
        const { items } = req.body;
        const result = await this.services.storageManager.deleteItems(items);
        res.json({ success: true, result });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });
  }

  serveFolder(folderPath) {
    this.app.use(express.static(folderPath));
    this.logService.log(`Serving folder: ${folderPath}`);
  }

  async start(port = 3000, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          this.logService.log(`Web server started on http://${host}:${port}`);
          resolve();
        });
        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          this.logService.log('Web server stopped');
          resolve();
        });
      } else {
        this.logService.log('Web server stopped');
        resolve();
      }
    });
  }

  getMainHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InvolveX CLI - Web Interface</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            background: #000000;
            color: #00ff00;
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }
        .matrix-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            opacity: 0.1;
            pointer-events: none;
        }
        .scanlines {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            pointer-events: none;
            background: linear-gradient(transparent 50%, rgba(0, 255, 0, 0.03) 50%);
            background-size: 100% 4px;
            animation: scanline 8s linear infinite;
        }
        @keyframes scanline {
            0% { background-position: 0 0; }
            100% { background-position: 0 100%; }
        }
        .terminal-container {
            position: relative;
            z-index: 1;
            max-width: 1400px;
            margin: 20px auto;
            padding: 20px;
        }
        .terminal {
            background: #0a0a0a;
            border: 2px solid #00ff00;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.05);
            overflow: hidden;
            position: relative;
        }
        .terminal-header {
            background: #001100;
            padding: 10px 15px;
            border-bottom: 1px solid #00ff00;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .terminal-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
            animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .terminal-title {
            color: #00ff00;
            font-size: 12px;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
        }
        .terminal-content {
            padding: 30px;
            min-height: 80vh;
            font-size: 14px;
            line-height: 1.8;
        }
        .ascii-logo {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            line-height: 1.2;
            color: #00ff00;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.8), 0 0 20px rgba(0, 255, 0, 0.4);
            white-space: pre;
            margin-bottom: 30px;
            animation: glitch 3s infinite;
            overflow-x: auto;
        }
        @keyframes glitch {
            0%, 100% {
                text-shadow: 0 0 10px rgba(0, 255, 0, 0.8), 0 0 20px rgba(0, 255, 0, 0.4);
            }
            25% {
                text-shadow: -2px 0 rgba(255, 0, 0, 0.8), 2px 0 rgba(0, 255, 255, 0.8), 0 0 10px rgba(0, 255, 0, 0.8);
            }
            50% {
                text-shadow: 2px 0 rgba(255, 0, 0, 0.8), -2px 0 rgba(0, 255, 255, 0.8), 0 0 10px rgba(0, 255, 0, 0.8);
            }
        }
        .menu {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        .menu-item {
            background: rgba(0, 255, 0, 0.05);
            border: 1px solid rgba(0, 255, 0, 0.3);
            border-radius: 4px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            color: #00ff00;
        }
        .menu-item:hover {
            background: rgba(0, 255, 0, 0.1);
            border-color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
            transform: translateY(-2px);
        }
        .content {
            border: 2px solid #00ff00;
            padding: 20px;
            min-height: 400px;
            background: rgba(0, 255, 0, 0.05);
            border-radius: 4px;
        }
        .loading { color: #00ff88; }
        .error { color: #ff4444; }
        .success { color: #00ff00; }
        button {
            background: transparent;
            border: 1px solid #00ff00;
            color: #00ff00;
            padding: 12px 24px;
            cursor: pointer;
            margin: 10px 10px 10px 0;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: rgba(0, 255, 0, 0.1);
            transition: left 0.3s ease;
        }
        button:hover {
            background: rgba(0, 255, 0, 0.1);
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
            transform: translateY(-2px);
        }
        button:hover::before {
            left: 100%;
        }
        pre {
            background: rgba(0, 0, 0, 0.5);
            padding: 15px;
            overflow-x: auto;
            border: 1px solid rgba(0, 255, 0, 0.3);
            border-radius: 4px;
            color: #00ff88;
        }
        h2 {
            color: #00ff00;
            margin-bottom: 15px;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
        }
        .prompt {
            color: #00ff00;
            margin: 20px 0;
        }
        .prompt::before {
            content: '> ';
            color: #00ff00;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="matrix-bg" id="matrixBg"></div>
    <div class="scanlines"></div>
    <div class="terminal-container">
        <div class="terminal">
            <div class="terminal-header">
                <div class="terminal-dot"></div>
                <div class="terminal-title">involvex-cli@web:~$</div>
            </div>
            <div class="terminal-content">
                <div class="ascii-logo" id="asciiLogo"></div>
                <div class="menu" id="menu"></div>
                <div class="content" id="content">
                    <p class="prompt">Select a menu item to get started...</p>
                </div>
            </div>
        </div>
    </div>
    <script>
        const asciiLogo = \`██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗
██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝
██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝
██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗
██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗
╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝

              Windows System Administration Toolkit\`;
        document.getElementById('asciiLogo').textContent = asciiLogo;
        
        const matrixBg = document.getElementById('matrixBg');
        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
        const numChars = 50;
        for (let i = 0; i < numChars; i++) {
            const char = document.createElement('div');
            char.className = 'matrix-char';
            char.textContent = chars[Math.floor(Math.random() * chars.length)];
            char.style.left = Math.random() * 100 + '%';
            char.style.animationDuration = Math.random() * 3 + 2 + 's';
            char.style.animationDelay = Math.random() * 2 + 's';
            char.style.fontSize = Math.random() * 10 + 10 + 'px';
            matrixBg.appendChild(char);
        }
        
        const menuItems = ['Update', 'Cache', 'Startup', 'Uninstall', 'DNS', 'Network', 'Driver', 'System Restore', 'Storage Manager', 'Plugins', 'Settings'];
        const menu = document.getElementById('menu');
        const content = document.getElementById('content');

        menuItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.textContent = item;
            div.onclick = () => handleMenuClick(item);
            menu.appendChild(div);
        });

        async function handleMenuClick(item) {
            content.innerHTML = '<p class="loading">Loading...</p>';
            try {
                switch(item) {
                    case 'Update':
                        const updates = await fetch('/api/updates').then(r => r.json());
                        const cliUpdates = await fetch('/api/cli-updates').then(r => r.json());
                        let html = '<h2>Available Updates</h2>';

                        if (cliUpdates.success && cliUpdates.updateInfo.hasUpdate) {
                            html += '<h3>CLI Updates</h3>';
                            html += '<p>Latest version: ' + cliUpdates.updateInfo.latestVersion + '</p>';
                            html += '<p>' + cliUpdates.updateInfo.description + '</p>';
                            html += '<button onclick="installCliUpdate()">Install CLI Update</button>';
                        } else {
                            html += '<h3>CLI Updates</h3><p>No CLI updates available</p>';
                        }

                        if (updates.success && updates.updates.length > 0) {
                            html += '<h3>Package Manager Updates</h3>';
                            html += '<pre>' + JSON.stringify(updates.updates, null, 2) + '</pre>';
                        } else {
                            html += '<h3>Package Manager Updates</h3><p>No package updates available</p>';
                        }

                        content.innerHTML = html;
                        break;
                    case 'Cache':
                        content.innerHTML = '<h2>Cache Management</h2><button onclick="clearCache()">Clear System Cache</button><button onclick="clearMemory()">Clear Memory</button>';
                        break;
                    case 'Startup':
                        const startup = await fetch('/api/startup').then(r => r.json());
                        if (startup.success) {
                            content.innerHTML = '<h2>Startup Programs</h2><pre>' + JSON.stringify(startup.programs, null, 2) + '</pre>';
                        } else {
                            content.innerHTML = '<p class="error">Error: ' + startup.error + '</p>';
                        }
                        break;
                    case 'Uninstall':
                        const programs = await fetch('/api/programs').then(r => r.json());
                        if (programs.success) {
                            content.innerHTML = '<h2>Installed Programs</h2><pre>' + JSON.stringify(programs.programs, null, 2) + '</pre>';
                        } else {
                            content.innerHTML = '<p class="error">Error: ' + programs.error + '</p>';
                        }
                        break;
                    case 'DNS':
                        const dns = await fetch('/api/dns').then(r => r.json());
                        if (dns.success) {
                            content.innerHTML = '<h2>DNS Configuration</h2><pre>' + JSON.stringify(dns.dns, null, 2) + '</pre>';
                        } else {
                            content.innerHTML = '<p class="error">Error: ' + dns.error + '</p>';
                        }
                        break;
                    case 'Network':
                        content.innerHTML = '<h2>Network Tools</h2><button onclick="runPing()">Run Ping Test</button>';
                        break;
                    case 'Plugins':
                        const plugins = await fetch('/api/plugins').then(r => r.json());
                        if (plugins.success) {
                            content.innerHTML = '<h2>Installed Plugins</h2><pre>' + JSON.stringify(plugins.plugins, null, 2) + '</pre>';
                        } else {
                            content.innerHTML = '<p class="error">Error: ' + plugins.error + '</p>';
                        }
                        break;
                    case 'Storage Manager':
                        const diskInfo = await fetch('/api/storage/disk-info').then(r => r.json());
                        if (diskInfo.success) {
                            let html = '<h2>Storage Manager</h2>';
                            html += '<h3>Disk Information</h3>';
                            html += '<pre>' + JSON.stringify(diskInfo.diskInfo, null, 2) + '</pre>';
                            html += '<button onclick="getCleanupTargets()">Show Cleanup Targets</button>';
                            html += '<button onclick="scanDirectory()">Scan Directory</button>';
                            content.innerHTML = html;
                        } else {
                            content.innerHTML = '<p class="error">Error: ' + diskInfo.error + '</p>';
                        }
                        break;
                    case 'System Restore':
                        content.innerHTML = '<h2>System Restore</h2><p>System restore functionality</p>';
                        break;
                    case 'Settings':
                        content.innerHTML = '<h2>Settings</h2><p>Settings management</p>';
                        break;
                    default:
                        content.innerHTML = '<h2>' + item + '</h2><p>Feature coming soon...</p>';
                }
            } catch (error) {
                content.innerHTML = '<p class="error">Error: ' + error.message + '</p>';
            }
        }

        async function clearCache() {
            const result = await fetch('/api/cache/clear', { method: 'POST' }).then(r => r.json());
            content.innerHTML = '<p class="' + (result.success ? 'success' : 'error') + '">' + (result.success ? 'Cache cleared successfully!' : 'Error: ' + result.error) + '</p>';
        }

        async function clearMemory() {
            const result = await fetch('/api/cache/memory', { method: 'POST' }).then(r => r.json());
            content.innerHTML = '<p class="' + (result.success ? 'success' : 'error') + '">' + (result.success ? 'Memory cleared successfully!' : 'Error: ' + result.error) + '</p>';
        }

        async function runPing() {
            const result = await fetch('/api/network/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({host: '8.8.8.8'}) }).then(r => r.json());
            content.innerHTML = '<h2>Ping Results</h2><pre>' + JSON.stringify(result, null, 2) + '</pre>';
        }

        async function installCliUpdate() {
            const result = await fetch('/api/cli-updates/install', { method: 'POST' }).then(r => r.json());
            content.innerHTML = '<p class="' + (result.success ? 'success' : 'error') + '">' + (result.success ? 'CLI updated successfully!' : 'Error: ' + result.error) + '</p>';
        }

        async function getCleanupTargets() {
            const result = await fetch('/api/storage/cleanup-targets').then(r => r.json());
            if (result.success) {
                content.innerHTML = '<h2>Cleanup Targets</h2><pre>' + JSON.stringify(result.targets, null, 2) + '</pre>';
            } else {
                content.innerHTML = '<p class="error">Error: ' + result.error + '</p>';
            }
        }

        async function scanDirectory() {
            const directoryPath = prompt('Enter directory path to scan:', 'C:\\\\');
            if (directoryPath) {
                const minSizeMB = prompt('Enter minimum file size in MB:', '100');
                const result = await fetch('/api/storage/scan-directory', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ directoryPath, minSizeMB: parseInt(minSizeMB) })
                }).then(r => r.json());
                if (result.success) {
                    content.innerHTML = '<h2>Directory Scan Results</h2><pre>' + JSON.stringify(result.result, null, 2) + '</pre>';
                } else {
                    content.innerHTML = '<p class="error">Error: ' + result.error + '</p>';
                }
            }
        }
    </script>
</body>
</html>`;
  }
}

module.exports = WebServer;
