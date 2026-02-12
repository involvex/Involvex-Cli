/* eslint-disable @typescript-eslint/no-explicit-any */
import express, {
  type Request,
  type Response,
  type Application,
} from "express";
import type StorageManagerService from "../services/StorageManagerService.js";
import type PackageManagerService from "../services/PackageManagerService.js";
import type UninstallerService from "../services/UninstallerService.js";
import type AutoUpdateService from "../services/AutoUpdateService.js";
import type SettingsService from "../services/SettingsService.js";
import type StartupService from "../services/StartupService.js";
import type NetworkService from "../services/NetworkService.js";
import type PluginService from "../services/PluginService.js";
import type CacheService from "../services/CacheService.js";
import type DnsService from "../services/DnsService.js";
import type { ILogService } from "../types/index.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Server } from "node:http";

const execAsync = promisify(exec);

interface WebServerServices {
  packageManager: PackageManagerService;
  autoUpdate: AutoUpdateService;
  cache: CacheService;
  startup: StartupService;
  uninstaller: UninstallerService;
  dns: DnsService;
  network: NetworkService;
  plugin: PluginService;
  storageManager: StorageManagerService;
  settings: SettingsService;
}

interface SpeedtestResult {
  download: number;
  upload: number;
  ping: number;
  server: {
    name: string;
    sponsor: string;
  };
  timestamp: string;
  bytes_sent: number;
  bytes_received: number;
  client: {
    ip: string;
  };
}

export default class WebServer {
  private logService: ILogService;
  private app: Application;
  private server: Server | null;
  private services: WebServerServices;

  constructor(logService: ILogService, services: WebServerServices) {
    this.logService = logService;
    this.app = express();
    this.server = null;
    this.services = services;
    this.setupRoutes();
  }

  setupRoutes(): void {
    // Middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files if folder is provided
    this.app.use(express.static("public"));
    // Serve favicon
    this.app.use("/favicon.png", express.static("favicon.png"));

    // Main API routes
    this.app.get("/", (req: Request, res: Response) => {
      res.send(this.getMainHTML());
    });

    this.app.get("/api/menu", (req: Request, res: Response) => {
      res.json({
        items: [
          "Update",
          "Cache",
          "Startup",
          "Uninstall",
          "DNS",
          "Network",
          "Speedtest",
          "Driver",
          "System Restore",
          "Storage Manager",
          "Plugins",
          "Settings",
        ],
      });
    });

    this.app.get("/api/updates", async (req: Request, res: Response) => {
      try {
        const updates =
          await this.services.packageManager.getAvailableUpdatesAsync();
        res.json({ success: true, updates });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.get("/api/cli-updates", async (req: Request, res: Response) => {
      try {
        const updateInfo = await this.services.autoUpdate.checkForUpdates();
        res.json({ success: true, updateInfo });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.post(
      "/api/cli-updates/install",
      async (req: Request, res: Response) => {
        try {
          const result = await this.services.autoUpdate.installUpdate();
          res.json({ success: result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post(
      "/api/update/:manager",
      async (req: Request, res: Response) => {
        try {
          const { manager } = req.params;
          let result: boolean = false;
          switch (manager) {
            case "winget":
              await this.services.packageManager.updateWinget();
              result = true;
              break;
            case "npm":
              await this.services.packageManager.updateNpm();
              result = true;
              break;
            case "scoop":
              await this.services.packageManager.updateScoop();
              result = true;
              break;
            case "choco":
              await this.services.packageManager.updateChoco();
              result = true;
              break;
            case "pip":
              await this.services.packageManager.updatePip();
              result = true;
              break;
          }
          res.json({ success: result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post("/api/cache/clear", async (req: Request, res: Response) => {
      try {
        const result = await this.services.cache.clearSystemCache();
        res.json({ success: result });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.post("/api/cache/memory", async (req: Request, res: Response) => {
      try {
        const result = await this.services.cache.clearMemory();
        res.json({ success: result });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.get("/api/startup", async (req: Request, res: Response) => {
      try {
        const programs = await this.services.startup.listStartupPrograms();
        res.json({ success: true, programs });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.get("/api/programs", async (req: Request, res: Response) => {
      try {
        const programs =
          await this.services.uninstaller.listInstalledPrograms();
        res.json({ success: true, programs });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.get("/api/dns", async (req: Request, res: Response) => {
      try {
        // DNS retrieval not yet implemented - return placeholder
        res.json({
          success: true,
          dns: { primary: "8.8.8.8", secondary: "8.8.4.4" },
        });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.post("/api/network/ping", async (req: Request, res: Response) => {
      try {
        const { host } = req.body;
        const result = await this.services.network.runPingTest(
          host || "8.8.8.8",
        );
        res.json({ success: true, result });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.post(
      "/api/network/speedtest",
      async (req: Request, res: Response) => {
        try {
          // Try multiple speedtest commands in order of preference
          const commands = [
            "speedtest --json --accept-license", // Official Ookla speedtest
            "speedtest-cli --json", // Alternative speedtest-cli
            "fast --json", // Fast.com speedtest
          ];

          let result: SpeedtestResult | null = null;
          let lastError: string | null = null;

          for (const command of commands) {
            try {
              this.logService.log(`Trying speedtest command: ${command}`);
              const { stdout, stderr } = await execAsync(command, {
                timeout: 120000,
              });

              if (stderr && !stdout) {
                this.logService.log(`Command ${command} stderr: ${stderr}`);
                lastError = stderr;
                continue;
              }

              // Try to parse JSON output
              try {
                result = JSON.parse(stdout) as SpeedtestResult;
                this.logService.log(`Command ${command} succeeded`);
                break;
              } catch {
                this.logService.log(
                  `Command ${command} output is not JSON: ${stdout}`,
                );
                // If not JSON, try to extract speed info from text
                const downloadMatch = stdout.match(
                  /Download:\s*([\d.]+)\s*(Mbps|MBit\/s|MB\/s)/i,
                );
                const uploadMatch = stdout.match(
                  /Upload:\s*([\d.]+)\s*(Mbps|MBit\/s|MB\/s)/i,
                );
                const pingMatch = stdout.match(/Ping:\s*([\d.]+)\s*ms/i);

                if (downloadMatch || uploadMatch || pingMatch) {
                  result = {
                    download: downloadMatch
                      ? parseFloat(downloadMatch[1]!) * 1000000
                      : 0,
                    upload: uploadMatch
                      ? parseFloat(uploadMatch[1]!) * 1000000
                      : 0,
                    ping: pingMatch ? parseFloat(pingMatch[1]!) : 0,
                    server: { name: "Unknown", sponsor: "Unknown" },
                    timestamp: new Date().toISOString(),
                    bytes_sent: 0,
                    bytes_received: 0,
                    client: { ip: "Unknown" },
                  };
                  this.logService.log(`Parsed text output from ${command}`);
                  break;
                }
                lastError = `Could not parse output: ${stdout}`;
              }
            } catch (cmdError: unknown) {
              this.logService.log(
                `Command ${command} failed: ${cmdError instanceof Error ? cmdError.message : String(cmdError)}`,
              );
              lastError =
                cmdError instanceof Error ? cmdError.message : String(cmdError);
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
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.get("/api/plugins", async (req: Request, res: Response) => {
      try {
        const plugins = this.services.plugin.getLoadedPlugins();
        res.json({
          success: true,
          plugins: plugins.map((p: any) => ({
            name: p.name,
            description: p.description,
            version: p.version,
          })),
        });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.get("/api/system/monitor", async (req: Request, res: Response) => {
      try {
        // For now, return a placeholder response
        res.json({
          success: true,
          cpu: 0,
          memory: 0,
          drives: [],
        });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Storage Manager API endpoints
    this.app.get(
      "/api/storage/disk-info",
      async (req: Request, res: Response) => {
        try {
          const diskInfo = await this.services.storageManager.getDiskInfo();
          res.json({ success: true, diskInfo });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post(
      "/api/storage/defragment/:drive",
      async (req: Request, res: Response) => {
        try {
          const { drive } = req.params as { drive: string };
          const result =
            await this.services.storageManager.defragmentDrive(drive);
          res.json({ success: true, result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.get(
      "/api/storage/cleanup-targets",
      async (req: Request, res: Response) => {
        try {
          const targets =
            await this.services.storageManager.getCleanupTargets();
          res.json({ success: true, targets });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post(
      "/api/storage/clean-temp",
      async (req: Request, res: Response) => {
        try {
          const { targetPaths } = req.body;
          const result =
            await this.services.storageManager.cleanTempFiles(targetPaths);
          res.json({ success: true, result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post(
      "/api/storage/scan-directory",
      async (req: Request, res: Response) => {
        try {
          const { directoryPath, minSizeMB } = req.body;
          const result = await this.services.storageManager.scanDirectory(
            directoryPath,
            minSizeMB,
          );
          res.json({ success: true, result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    this.app.post(
      "/api/storage/delete-items",
      async (req: Request, res: Response) => {
        try {
          const { items } = req.body;
          const result = await this.services.storageManager.deleteItems(items);
          res.json({ success: true, result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // Settings API endpoints
    this.app.get("/api/settings", async (req: Request, res: Response) => {
      try {
        const settings = this.services.settings.getSettings();
        res.json({ success: true, settings });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.app.post("/api/settings", async (req: Request, res: Response) => {
      try {
        const { updates } = req.body;
        this.services.settings.updateSettings(updates);
        const success = await this.services.settings.saveSettingsAsync();
        res.json({ success });
      } catch (error: unknown) {
        res.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Test route
    this.app.post("/api/test", (req: Request, res: Response) => {
      console.log("Raw body:", (req as any).rawBody);
      console.log("Parsed body:", req.body);
      res.json({
        body: req.body,
        hasBody: !!req.body,
        rawBody: (req as any).rawBody,
      });
    });

    // Individual package update endpoint
    this.app.post(
      "/api/update/package/:packageName",
      async (req: Request, res: Response) => {
        try {
          const { packageName } = req.params;
          const packageManager = req.body ? req.body.packageManager : null;
          let result = false;

          if (!packageManager) {
            return res.json({
              success: false,
              error: "packageManager is required in request body",
            });
          }

          // Find update in available updates
          const updates =
            await this.services.packageManager.getAvailableUpdatesAsync();
          const update = updates.find(
            (u: any) =>
              u.packageName === packageName &&
              u.packageManager === packageManager,
          );

          if (update) {
            // Use auto update service to install this specific update
            await this.services.autoUpdate.installSelectedUpdates([update]);
            result = true;
          }

          res.json({ success: result });
        } catch (error: unknown) {
          res.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
  }

  serveFolder(folderPath: string): void {
    this.app.use(express.static(folderPath));
    this.logService.log(`Serving folder: ${folderPath}`);
  }

  async start(port = 3000, host = "0.0.0.0"): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          this.logService.log(`Web server started on http://${host}:${port}`);
          resolve();
        });
        (this.server as any).on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          this.logService.log("Web server stopped");
          resolve();
        });
      } else {
        this.logService.log("Web server stopped");
        resolve();
      }
    });
  }

  getMainHTML(): string {
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
</body>
</html>`;
  }
}
