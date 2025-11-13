const { spawn } = require('child_process');

class StartupService {
  constructor(logService) {
    this.logService = logService;
  }

  async listStartupPrograms() {
    this.logService.log('Listing startup programs from registry and Task Scheduler.');
    const startupPrograms = [];

    try {
      // Check registry Run keys using PowerShell
      const psScript = `
                # Get registry startup programs
                $runKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce"
                )

                foreach ($keyPath in $runKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $properties = Get-ItemProperty -Path $keyPath -ErrorAction SilentlyContinue
                            if ($properties) {
                                $properties.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
                                    Write-Output "Registry ($keyPath): $($_.Name) -> $($_.Value)"
                                }
                            }
                        }
                    } catch {
                        # Skip inaccessible keys
                    }
                }

                # Get startup folder contents
                $startupFolder = [Environment]::GetFolderPath('Startup')
                if (Test-Path $startupFolder) {
                    Get-ChildItem -Path $startupFolder | ForEach-Object {
                        Write-Output "Startup Folder: $($_.Name)"
                    }
                }

                # Get Task Scheduler startup tasks
                try {
                    $tasks = Get-ScheduledTask | Where-Object { $_.TaskPath -like '\\Microsoft\\Windows\\*' -and $_.State -ne 'Disabled' }
                    foreach ($task in $tasks) {
                        Write-Output "Task Scheduler: $($task.TaskName)"
                    }
                } catch {
                    Write-Output "Task Scheduler: Could not retrieve tasks"
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.code === 0) {
        const lines = result.stdout.split('\n').filter(line => line.trim());
        startupPrograms.push(...lines);
      }

      this.logService.log(`Found ${startupPrograms.length} startup programs.`);
    } catch (error) {
      this.logService.log(`Exception listing startup programs: ${error.message}`);
      startupPrograms.push(`Error: ${error.message}`);
    }

    return startupPrograms;
  }

  async disableStartupProgram(programName) {
    this.logService.log(`Attempting to disable startup program: ${programName}`);

    try {
      // Try to disable from registry first
      const psScript = `
                $programName = "${programName}"
                $found = $false

                $runKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce"
                )

                foreach ($keyPath in $runKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $value = Get-ItemProperty -Path $keyPath -Name $programName -ErrorAction SilentlyContinue
                            if ($value) {
                                Remove-ItemProperty -Path $keyPath -Name $programName -ErrorAction SilentlyContinue
                                Write-Output "SUCCESS: Disabled from registry"
                                $found = $true
                                break
                            }
                        }
                    } catch {
                        # Continue to next key
                    }
                }

                if (-not $found) {
                    # Try to disable scheduled task
                    try {
                        $task = Get-ScheduledTask -TaskName $programName -ErrorAction SilentlyContinue
                        if ($task) {
                            Disable-ScheduledTask -TaskName $programName -ErrorAction SilentlyContinue
                            Write-Output "SUCCESS: Disabled scheduled task"
                            $found = $true
                        }
                    } catch {
                        # Task not found or couldn't be disabled
                    }
                }

                if (-not $found) {
                    Write-Output "NOT_FOUND"
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.code === 0 && result.stdout.includes('SUCCESS')) {
        this.logService.log(`Successfully disabled startup program: ${programName}`);
        return true;
      } else {
        this.logService.log(
          `Could not automatically disable: ${programName}. Manual intervention may be required.`
        );
        return false;
      }
    } catch (error) {
      this.logService.log(`Exception disabling startup program ${programName}: ${error.message}`);
      return false;
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

module.exports = StartupService;
