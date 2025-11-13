const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class CacheService {
  constructor(logService) {
    this.logService = logService;
  }

  async clearSystemCache() {
    try {
      this.logService.log('Starting system cache clearing operation.');

      // Clear user-specific temporary files
      const tempPath = os.tmpdir();
      await this.deleteDirectoryContents(tempPath);

      // Clear npm cache if npm is available
      try {
        await this.runProcess('npm', ['cache', 'clean', '--force']);
        this.logService.log('NPM cache cleared.');
      } catch {
        this.logService.log('NPM cache clearing failed or npm not available.');
      }

      // Clear Windows temp files using PowerShell
      if (process.platform === 'win32') {
        try {
          const psScript = `
                        # Clear Windows temp files
                        $tempFolders = @(
                            $env:TEMP,
                            "$env:USERPROFILE\\AppData\\Local\\Temp",
                            "$env:windir\\Temp"
                        )

                        foreach ($folder in $tempFolders) {
                            if (Test-Path $folder) {
                                Get-ChildItem -Path $folder -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
                            }
                        }

                        # Clear Windows prefetch files
                        $prefetchPath = "$env:windir\\Prefetch"
                        if (Test-Path $prefetchPath) {
                            Get-ChildItem -Path $prefetchPath -Filter "*.pf" | Remove-Item -Force -ErrorAction SilentlyContinue
                        }

                        Write-Host "Windows temp files cleared"
                    `;

          await this.runProcess('powershell', ['-Command', psScript]);
          this.logService.log('Windows temp files cleared.');
        } catch {
          this.logService.log('Failed to clear Windows temp files');
        }
      }

      this.logService.log('System cache cleared successfully.');
      return true;
    } catch (error) {
      this.logService.log(`Error clearing system cache: ${error.message}`);
      return false;
    }
  }

  async clearMemory() {
    try {
      this.logService.log('Attempting to clear system memory/RAM.');

      // Force Node.js garbage collection
      if (global.gc) {
        global.gc();
        this.logService.log('Node.js garbage collection triggered.');
      }

      if (process.platform === 'win32') {
        // Use PowerShell to clear system memory
        const psScript = `
                    # Force garbage collection in PowerShell
                    [System.GC]::Collect()
                    [System.GC]::WaitForPendingFinalizers()
                    [System.GC]::Collect()

                    # Clear Windows memory cache (requires admin privileges)
                    try {
                        # Use EmptyWorkingSet equivalent via PowerShell
                        $signature = @'
[DllImport("psapi.dll")]
public static extern int EmptyWorkingSet(IntPtr hProcess);
'@

                        $type = Add-Type -MemberDefinition $signature -Name "PSAPI" -Namespace "Win32" -PassThru
                        $currentProcess = Get-Process -Id $PID
                        $type::EmptyWorkingSet($currentProcess.Handle)

                        Write-Host "Memory cleared for current process"
                    } catch {
                        Write-Host "Memory clearing requires administrator privileges or failed"
                    }
                `;

        await this.runProcess('powershell', ['-Command', psScript]);
      }

      // Force Node.js garbage collection if available
      if (global.gc) {
        global.gc();
        this.logService.log('Node.js garbage collection performed.');
      }

      this.logService.log('Memory clearing operations completed.');
      return true;
    } catch (error) {
      this.logService.log(`Error clearing memory: ${error.message}`);
      return false;
    }
  }

  async deleteDirectoryContents(directoryPath) {
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) return;

      const items = await fs.readdir(directoryPath);

      for (const item of items) {
        const itemPath = path.join(directoryPath, item);
        try {
          const itemStats = await fs.stat(itemPath);
          if (itemStats.isDirectory()) {
            await this.deleteDirectoryContents(itemPath);
            await fs.rmdir(itemPath);
          } else {
            await fs.unlink(itemPath);
          }
        } catch (error) {
          // Skip files/directories we can't delete
          this.logService.log(`Could not delete ${itemPath}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logService.log(`Error accessing directory ${directoryPath}: ${error.message}`);
    }
  }

  async runProcess(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        resolve({
          code,
          stdout,
          stderr,
        });
      });

      process.on('error', error => {
        reject(error);
      });
    });
  }
}

module.exports = CacheService;
