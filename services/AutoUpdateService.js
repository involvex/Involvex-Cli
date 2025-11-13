const { spawn } = require('child_process');

class AutoUpdateService {
  constructor(logService, settingsService) {
    this.logService = logService;
    this.settingsService = settingsService;
    this.packageName = '@involvex/involvex-cli';
    this.lastCheckTime = null;
  }

  async isInstalledGlobally() {
    try {
      // Check if the package is installed globally by checking npm list
      const result = await this.runProcess('npm', ['list', '-g', '--depth=0', this.packageName]);
      return result.code === 0 && result.stdout.includes(this.packageName);
    } catch (error) {
      this.logService.log(`Error checking global installation: ${error.message}`);
      return false;
    }
  }

  async checkForUpdates() {
    try {
      const https = require('https');
      return new Promise((resolve, reject) => {
        const url = `https://registry.npmjs.org/${this.packageName}/latest`;
        https
          .get(url, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try {
                const latestInfo = JSON.parse(data);
                resolve({
                  hasUpdate: true,
                  latestVersion: latestInfo.version,
                  description: latestInfo.description || 'New version available',
                });
              } catch (error) {
                reject(error);
              }
            });
          })
          .on('error', reject);
      });
    } catch (error) {
      this.logService.log(`Failed to check for updates: ${error.message}`);
      return { hasUpdate: false };
    }
  }

  async installUpdate() {
    try {
      this.logService.log('Installing CLI update...');
      const result = await this.runProcess('npm', ['install', '-g', `${this.packageName}@latest`]);
      if (result.code === 0) {
        this.logService.log('CLI updated successfully!');
        return true;
      } else {
        this.logService.log(`Update failed with exit code: ${result.code}`);
        return false;
      }
    } catch (error) {
      this.logService.log(`Error installing update: ${error.message}`);
      return false;
    }
  }

  async runProcess(command, args, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          try {
            process.kill();
          } catch {
            // Ignore kill errors
          }
          reject(new Error(`Process timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({
          code,
          stdout,
          stderr,
        });
      });

      process.on('error', error => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });
    });
  }

  async shouldCheckForUpdate() {
    const settings = this.settingsService.getSettings();
    if (!settings.autoUpdate?.enabled) {
      return false;
    }

    const checkIntervalHours = settings.autoUpdate?.checkIntervalHours || 24;
    const intervalMs = checkIntervalHours * 60 * 60 * 1000;

    if (!this.lastCheckTime) {
      return true;
    }

    return Date.now() - this.lastCheckTime >= intervalMs;
  }

  async performAutoUpdate() {
    if (!(await this.shouldCheckForUpdate())) {
      return false;
    }

    const isGlobal = await this.isInstalledGlobally();
    if (!isGlobal) {
      this.logService.log('CLI is not installed globally. Skipping auto-update.');
      return false;
    }

    try {
      const updateInfo = await this.checkForUpdates();
      this.lastCheckTime = Date.now();

      if (updateInfo.hasUpdate) {
        const settings = this.settingsService.getSettings();
        if (settings.autoUpdate?.autoInstall) {
          this.logService.log(`Auto-updating CLI to version ${updateInfo.latestVersion}...`);
          return await this.installUpdate();
        } else {
          this.logService.log(
            `Update available: ${updateInfo.latestVersion}. Auto-install is disabled.`
          );
        }
      }
    } catch (error) {
      this.logService.log(`Auto-update check failed: ${error.message}`);
    }

    return false;
  }
}

module.exports = AutoUpdateService;
