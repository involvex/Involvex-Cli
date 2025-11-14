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
    // Middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files if folder is provided
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
          'Speedtest',
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

    this.app.post('/api/network/speedtest', async (req, res) => {
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        // Try multiple speedtest commands in order of preference
        const commands = [
          'speedtest --json --accept-license', // Official Ookla speedtest
          'speedtest-cli --json', // Alternative speedtest-cli
          'fast --json', // Fast.com speedtest
        ];

        let result = null;
        let lastError = null;

        for (const command of commands) {
          try {
            console.log(`Trying speedtest command: ${command}`);
            const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

            if (stderr && !stdout) {
              console.log(`Command ${command} stderr:`, stderr);
              lastError = stderr;
              continue;
            }

            // Try to parse JSON output
            try {
              result = JSON.parse(stdout);
              console.log(`Command ${command} succeeded`);
              break;
            } catch {
              console.log(`Command ${command} output is not JSON:`, stdout);
              // If not JSON, try to extract speed info from text
              const downloadMatch = stdout.match(/Download:\s*([\d.]+)\s*(Mbps|MBit\/s|MB\/s)/i);
              const uploadMatch = stdout.match(/Upload:\s*([\d.]+)\s*(Mbps|MBit\/s|MB\/s)/i);
              const pingMatch = stdout.match(/Ping:\s*([\d.]+)\s*ms/i);

              if (downloadMatch || uploadMatch || pingMatch) {
                result = {
                  download: downloadMatch ? parseFloat(downloadMatch[1]) * 1000000 : 0,
                  upload: uploadMatch ? parseFloat(uploadMatch[1]) * 1000000 : 0,
                  ping: pingMatch ? parseFloat(pingMatch[1]) : 0,
                  server: { name: 'Unknown', sponsor: 'Unknown' },
                  timestamp: new Date().toISOString(),
                  bytes_sent: 0,
                  bytes_received: 0,
                  client: { ip: 'Unknown' },
                };
                console.log(`Parsed text output from ${command}`);
                break;
              }
              lastError = `Could not parse output: ${stdout}`;
            }
          } catch (cmdError) {
            console.log(`Command ${command} failed:`, cmdError.message);
            lastError = cmdError.message;
          }
        }

        if (result) {
          res.json({ success: true, result });
        } else {
          res.json({
            success: false,
            error: `All speedtest commands failed. Last error: ${lastError}. Please install speedtest-cli or fast.com CLI.`,
          });
        }
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

    // Settings API endpoints
    this.app.get('/api/settings', async (req, res) => {
      try {
        const settings = this.services.settings.getSettings();
        res.json({ success: true, settings });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/settings', async (req, res) => {
      try {
        const { updates } = req.body;
        this.services.settings.updateSettings(updates);
        const success = await this.services.settings.saveSettingsAsync();
        res.json({ success });
      } catch (error) {
        res.json({ success: false, error: error.message });
      }
    });

    // Test route
    this.app.post('/api/test', (req, res) => {
      console.log('Raw body:', req.rawBody);
      console.log('Parsed body:', req.body);
      res.json({ body: req.body, hasBody: !!req.body, rawBody: req.rawBody });
    });

    // Individual package update endpoint
    this.app.post('/api/update/package/:packageName', async (req, res) => {
      try {
        const { packageName } = req.params;
        const packageManager = req.body ? req.body.packageManager : null;
        let result = false;

        if (!packageManager) {
          return res.json({ success: false, error: 'packageManager is required in request body' });
        }

        // Find the update in available updates
        const updates = await this.services.packageManager.getAvailableUpdatesAsync();
        const update = updates.find(
          u => u.packageName === packageName && u.packageManager === packageManager
        );

        if (update) {
          // Use the auto update service to install this specific update
          await this.services.autoUpdate.installSelectedUpdates([update]);
          result = true;
        }

        res.json({ success: result });
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
        .speedtest-container {
            text-align: center;
            margin: 20px 0;
        }
        .speed-gauge {
            width: 200px;
            height: 200px;
            margin: 20px auto;
            border-radius: 50%;
            border: 4px solid #00ff00;
            position: relative;
            display: inline-block;
        }
        .speed-gauge::after {
            content: '';
            position: absolute;
            top: 10px;
            left: 50%;
            width: 4px;
            height: 80px;
            background: #00ff00;
            transform-origin: bottom center;
            transform: rotate(0deg);
            transition: transform 0.5s ease;
        }
        .speed-value {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            font-weight: bold;
            color: #00ff00;
        }
        .speed-label {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            color: #00ff88;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: rgba(0, 255, 0, 0.1);
            border: 1px solid #00ff00;
            border-radius: 10px;
            margin: 10px 0;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #00ff88);
            width: 0%;
            transition: width 0.3s ease;
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

        const menuItems = ['Update', 'Cache', 'Startup', 'Uninstall', 'DNS', 'Network', 'Speedtest', 'Driver', 'System Restore', 'Storage Manager', 'Plugins', 'Settings'];
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
                        await loadUpdates();
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
                    case 'Speedtest':
                        content.innerHTML = \`
                            <h2>Internet Speed Test</h2>
                            <div class="speedtest-container">
                                <div class="speed-gauge" id="speedGauge">
                                    <div class="speed-value" id="speedValue">0</div>
                                    <div class="speed-label" id="speedLabel">Mbps</div>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progressFill"></div>
                                </div>
                                <p id="speedStatus">Click to start speed test</p>
                                <button onclick="runSpeedtest()">Start Speed Test</button>
                            </div>
                        \`;
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
                        await loadSettings();
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

        async function runSpeedtest() {
            const speedValue = document.getElementById('speedValue');
            const speedLabel = document.getElementById('speedLabel');
            const progressFill = document.getElementById('progressFill');
            const speedStatus = document.getElementById('speedStatus');
            const speedGauge = document.getElementById('speedGauge');

            speedStatus.textContent = 'Initializing speed test...';
            progressFill.style.width = '10%';

            try {
                // Start the speed test
                const response = await fetch('/api/network/speedtest', { method: 'POST' });

                if (!response.ok) {
                    throw new Error('Speed test failed to start');
                }

                speedStatus.textContent = 'Running speed test...';
                progressFill.style.width = '50%';

                const result = await response.json();

                if (result.success) {
                    const downloadSpeed = (result.result.download / 1000000).toFixed(2); // Convert to Mbps
                    speedValue.textContent = downloadSpeed;
                    speedStatus.textContent = 'Speed test completed!';
                    progressFill.style.width = '100%';

                    // Animate the gauge needle
                    const maxSpeed = 100; // Assume 100 Mbps max for gauge
                    const angle = Math.min((downloadSpeed / maxSpeed) * 180, 180);
                    speedGauge.style.setProperty('--needle-rotation', angle + 'deg');

                    setTimeout(() => {
                        speedStatus.innerHTML = \`
                            <strong>Results:</strong><br>
                            Download: \${downloadSpeed} Mbps<br>
                            Upload: \${(result.result.upload / 1000000).toFixed(2)} Mbps<br>
                            Ping: \${result.result.ping} ms
                        \`;
                    }, 1000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                speedStatus.textContent = 'Speed test failed: ' + error.message;
                progressFill.style.width = '0%';
                speedValue.textContent = '0';
            }
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

        async function loadUpdates() {
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
                updates.updates.forEach(update => {
                    html += '<div style="margin: 10px 0; padding: 10px; border: 1px solid #00ff00; border-radius: 4px;">';
                    html += '<strong>' + update.packageManager.toUpperCase() + ':</strong> ' + update.packageName + '<br>';
                    html += '<small>Current: ' + update.currentVersion + ' → Latest: ' + update.availableVersion + '</small><br>';
                    html += '<button onclick="updatePackage(\\"' + update.packageName.replace(/'/g, '&#39;') + '\\", \\"' + update.packageManager + '\\")">Update This Package</button>';
                    html += '</div>';
                });
            } else {
                html += '<h3>Package Manager Updates</h3><p>No package updates available</p>';
            }

            content.innerHTML = html;
        }

        async function updatePackage(packageName, packageManager) {
            const result = await fetch('/api/update/package/' + encodeURIComponent(packageName), {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ packageManager })
            }).then(r => r.json());
            if (result.success) {
                alert('Package ' + packageName + ' updated successfully!');
                loadUpdates(); // Refresh the updates list
            } else {
                alert('Failed to update package: ' + result.error);
            }
        }

        async function loadSettings() {
            const settingsResponse = await fetch('/api/settings').then(r => r.json());
            if (!settingsResponse.success) {
                content.innerHTML = '<p class="error">Error loading settings: ' + settingsResponse.error + '</p>';
                return;
            }

            const settings = settingsResponse.settings;
            let html = '<h2>Settings</h2>';
            html += '<form onsubmit="saveSettings(event)">';

            // Auto Update CLI
            html += '<h3>CLI Auto-Update</h3>';
            html += '<label><input type="checkbox" id="autoUpdateEnabled" ' + (settings.autoUpdate?.enabled ? 'checked' : '') + '> Enable Auto-Update</label><br>';
            html += '<label><input type="checkbox" id="autoUpdateAutoInstall" ' + (settings.autoUpdate?.autoInstall ? 'checked' : '') + '> Auto-Install Updates</label><br>';
            html += '<label>Check Interval (hours): <input type="number" id="autoUpdateInterval" value="' + (settings.autoUpdate?.checkIntervalHours || 24) + '"></label><br><br>';

            // Package Auto-Update
            html += '<h3>Package Auto-Update</h3>';
            html += '<label><input type="checkbox" id="packageAutoUpdateEnabled" ' + (settings.packageAutoUpdate?.enabled ? 'checked' : '') + '> Enable Package Auto-Update</label><br>';
            html += '<label><input type="checkbox" id="wingetEnabled" ' + (settings.packageAutoUpdate?.managers?.winget ? 'checked' : '') + '> Winget</label><br>';
            html += '<label><input type="checkbox" id="npmEnabled" ' + (settings.packageAutoUpdate?.managers?.npm ? 'checked' : '') + '> NPM</label><br>';
            html += '<label><input type="checkbox" id="scoopEnabled" ' + (settings.packageAutoUpdate?.managers?.scoop ? 'checked' : '') + '> Scoop</label><br>';
            html += '<label><input type="checkbox" id="chocoEnabled" ' + (settings.packageAutoUpdate?.managers?.choco ? 'checked' : '') + '> Chocolatey</label><br>';
            html += '<label><input type="checkbox" id="pipEnabled" ' + (settings.packageAutoUpdate?.managers?.pip ? 'checked' : '') + '> Pip</label><br>';
            html += '<label>Check Interval (hours): <input type="number" id="packageAutoUpdateInterval" value="' + (settings.packageAutoUpdate?.checkIntervalHours || 24) + '"></label><br><br>';

            // Auto Cache Clearing
            html += '<h3>Auto Cache Clearing</h3>';
            html += '<label><input type="checkbox" id="autoCacheEnabled" ' + (settings.autoCacheClearing?.enabled ? 'checked' : '') + '> Enable Auto Cache Clearing</label><br>';
            html += '<label>Interval (hours): <input type="number" id="autoCacheInterval" value="' + (settings.autoCacheClearing?.intervalHours || 168) + '"></label><br><br>';

            // Auto Memory Clearing
            html += '<h3>Auto Memory Clearing</h3>';
            html += '<label><input type="checkbox" id="autoMemoryEnabled" ' + (settings.autoMemoryClearing?.enabled ? 'checked' : '') + '> Enable Auto Memory Clearing</label><br>';
            html += '<label>Threshold (MB): <input type="number" id="autoMemoryThreshold" value="' + (settings.autoMemoryClearing?.thresholdMB || 4096) + '"></label><br>';
            html += '<label>Interval (minutes): <input type="number" id="autoMemoryInterval" value="' + (settings.autoMemoryClearing?.intervalMinutes || 60) + '"></label><br><br>';

            // Discord RPC
            html += '<h3>Discord Rich Presence</h3>';
            html += '<label><input type="checkbox" id="discordRPCEnabled" ' + (settings.discordRPC?.enabled ? 'checked' : '') + '> Enable Discord RPC</label><br>';
            html += '<label>Client ID: <input type="text" id="discordRPCClientId" value="' + (settings.discordRPC?.clientId || '') + '"></label><br>';
            html += '<label>Update Interval (seconds): <input type="number" id="discordRPCInterval" value="' + (settings.discordRPC?.updateIntervalSeconds || 15) + '"></label><br><br>';

            html += '<button type="submit">Save Settings</button>';
            html += '</form>';

            content.innerHTML = html;
        }

        async function saveSettings(event) {
            event.preventDefault();

            const updates = {
                autoUpdate: {
                    enabled: document.getElementById('autoUpdateEnabled').checked,
                    autoInstall: document.getElementById('autoUpdateAutoInstall').checked,
                    checkIntervalHours: parseInt(document.getElementById('autoUpdateInterval').value)
                },
                packageAutoUpdate: {
                    enabled: document.getElementById('packageAutoUpdateEnabled').checked,
                    managers: {
                        winget: document.getElementById('wingetEnabled').checked,
                        npm: document.getElementById('npmEnabled').checked,
                        scoop: document.getElementById('scoopEnabled').checked,
                        choco: document.getElementById('chocoEnabled').checked,
                        pip: document.getElementById('pipEnabled').checked
                    },
                    checkIntervalHours: parseInt(document.getElementById('packageAutoUpdateInterval').value)
                },
                autoCacheClearing: {
                    enabled: document.getElementById('autoCacheEnabled').checked,
                    intervalHours: parseInt(document.getElementById('autoCacheInterval').value)
                },
                autoMemoryClearing: {
                    enabled: document.getElementById('autoMemoryEnabled').checked,
                    thresholdMB: parseInt(document.getElementById('autoMemoryThreshold').value),
                    intervalMinutes: parseInt(document.getElementById('autoMemoryInterval').value)
                },
                discordRPC: {
                    enabled: document.getElementById('discordRPCEnabled').checked,
                    clientId: document.getElementById('discordRPCClientId').value,
                    updateIntervalSeconds: parseInt(document.getElementById('discordRPCInterval').value)
                }
            };

            const result = await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ updates })
            }).then(r => r.json());

            if (result.success) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings: ' + result.error);
            }
        }
    </script>
</body>
</html>`;
  }
}

module.exports = WebServer;
