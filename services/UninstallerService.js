const { spawn } = require('child_process');

class UninstallerService {
  constructor(logService) {
    this.logService = logService;
  }

  async listInstalledPrograms() {
    this.logService.log('Listing installed programs from registry.');
    const programs = [];

    try {
      const psScript = `
                # Get installed programs from registry
                $uninstallKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
                )

                foreach ($keyPath in $uninstallKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $subKeys = Get-ChildItem -Path $keyPath -ErrorAction SilentlyContinue
                            foreach ($subKey in $subKeys) {
                                try {
                                    $displayName = $subKey.GetValue("DisplayName")
                                    if ($displayName) {
                                        $displayVersion = $subKey.GetValue("DisplayVersion")
                                        $publisher = $subKey.GetValue("Publisher")
                                        $uninstallString = $subKey.GetValue("UninstallString")

                                        $programInfo = $displayName
                                        if ($displayVersion) {
                                            $programInfo += " (v$displayVersion)"
                                        }
                                        if ($publisher) {
                                            $programInfo += " - $publisher"
                                        }
                                        if ($uninstallString) {
                                            $programInfo += " [Uninstallable]"
                                        }

                                        # Add registry source indicator
                                        if ($keyPath -like "*HKCU*") {
                                            $programInfo = "[User] $programInfo"
                                        } else {
                                            $programInfo = "[System] $programInfo"
                                        }

                                        Write-Output $programInfo
                                    }
                                } catch {
                                    # Skip problematic entries
                                }
                            }
                        }
                    } catch {
                        # Skip inaccessible keys
                    }
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.code === 0) {
        const lines = result.stdout.split('\n').filter(line => line.trim());
        programs.push(...lines);
      }

      this.logService.log(`Found ${programs.length} installed programs.`);
    } catch (error) {
      this.logService.log(`Exception listing installed programs: ${error.message}`);
      programs.push(`Error: ${error.message}`);
    }

    return programs;
  }

  async uninstallProgram(programName) {
    this.logService.log(`Attempting to uninstall program: ${programName}`);

    try {
      // Find the uninstall string for the program
      const findScript = `
                $programName = "${programName}"
                $uninstallKeys = @(
                    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
                    "HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
                )

                $uninstallString = $null
                foreach ($keyPath in $uninstallKeys) {
                    try {
                        if (Test-Path $keyPath) {
                            $subKeys = Get-ChildItem -Path $keyPath -ErrorAction SilentlyContinue
                            foreach ($subKey in $subKeys) {
                                try {
                                    $displayName = $subKey.GetValue("DisplayName")
                                    if ($displayName -and $displayName -like "*$programName*") {
                                        $uninstallString = $subKey.GetValue("UninstallString")
                                        if ($uninstallString) {
                                            Write-Output $uninstallString
                                            break
                                        }
                                    }
                                } catch {
                                    # Continue searching
                                }
                            }
                        }
                        if ($uninstallString) { break }
                    } catch {
                        # Continue to next key
                    }
                }
            `;

      const findResult = await this.runProcess('powershell', ['-Command', findScript]);

      if (findResult.code !== 0 || !findResult.stdout.trim()) {
        this.logService.log(`Could not find uninstall string for: ${programName}`);
        return false;
      }

      const uninstallString = findResult.stdout.trim();

      // Execute the uninstall string
      this.logService.log(`Executing uninstall command: ${uninstallString}`);

      // For MSI uninstallers, use msiexec
      let process;
      if (uninstallString.toLowerCase().includes('msiexec')) {
        process = await this.runProcess('cmd', ['/c', uninstallString]);
      } else {
        // For other uninstallers, try to execute directly
        process = await this.runProcess('cmd', ['/c', `"${uninstallString}"`]);
      }

      if (process.code === 0) {
        this.logService.log(`Successfully initiated uninstall for: ${programName}`);
        return true;
      } else {
        this.logService.log(
          `Uninstall process exited with code ${process.code} for: ${programName}`
        );
        return false;
      }
    } catch (error) {
      this.logService.log(`Exception uninstalling program ${programName}: ${error.message}`);
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

module.exports = UninstallerService;
