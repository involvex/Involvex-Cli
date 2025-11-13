const { spawn } = require('child_process');

class DriverService {
    constructor(logService) {
        this.logService = logService;
    }

    async detectDrivers() {
        try {
            this.logService.log('Detecting outdated drivers');

            // Use PowerShell to check for driver updates
            const psScript = `
                # Check for driver updates using Windows Update
                try {
                    $updateSession = New-Object -ComObject Microsoft.Update.Session
                    $updateSearcher = $updateSession.CreateUpdateSearcher()
                    $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Driver'")

                    $drivers = @()
                    foreach ($update in $searchResult.Updates) {
                        $drivers += "$($update.Title) - $($update.Description)"
                    }

                    if ($drivers.Count -eq 0) {
                        Write-Output "No driver updates available"
                    } else {
                        $drivers | ForEach-Object { Write-Output $_ }
                    }
                } catch {
                    Write-Output "Could not check for driver updates. Error: $($_.Exception.Message)"
                }
            `;

            const result = await this.runProcess('powershell', ['-Command', psScript]);

            if (result.code === 0) {
                const lines = result.stdout.split('\n').filter(line => line.trim());
                return lines.length > 0 ? lines : ['No driver updates found'];
            } else {
                return ['Error checking for driver updates'];
            }
        } catch (error) {
            this.logService.log(`Error detecting drivers: ${error.message}`);
            return [`Error: ${error.message}`];
        }
    }

    async updateDriver(driverName) {
        try {
            this.logService.log(`Attempting to update driver: ${driverName}`);

            // Use pnputil to update drivers (simplified)
            const result = await this.runProcess('pnputil', ['/scan-devices']);

            if (result.code === 0) {
                this.logService.log(`Driver scan initiated for: ${driverName}`);
                return true;
            } else {
                this.logService.log(`Failed to update driver: ${driverName}`);
                return false;
            }
        } catch (error) {
            this.logService.log(`Error updating driver ${driverName}: ${error.message}`);
            return false;
        }
    }

    async runProcess(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                resolve({
                    code,
                    stdout,
                    stderr
                });
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = DriverService;
