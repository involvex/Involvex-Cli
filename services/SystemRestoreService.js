const { spawn } = require('child_process');

class SystemRestoreService {
  constructor(logService) {
    this.logService = logService;
  }

  async createRestorePoint(description) {
    try {
      this.logService.log(`Creating system restore point: ${description}`);

      const psScript = `
                # Create a system restore point
                try {
                    $description = "${description}"
                    $restorePoint = Get-ComputerRestorePoint | Where-Object { $_.Description -eq $description }

                    if ($restorePoint) {
                        Write-Output "Restore point already exists"
                        exit 1
                    }

                    Checkpoint-Computer -Description $description -RestorePointType "MODIFY_SETTINGS"
                    Write-Output "SUCCESS"
                } catch {
                    Write-Output "ERROR: $($_.Exception.Message)"
                    exit 1
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.stdout.includes('SUCCESS')) {
        this.logService.log('System restore point created successfully');
        return true;
      } else {
        this.logService.log(`Failed to create restore point: ${result.stdout}`);
        return false;
      }
    } catch (error) {
      this.logService.log(`Error creating restore point: ${error.message}`);
      return false;
    }
  }

  async listRestorePoints() {
    try {
      this.logService.log('Listing system restore points');

      const psScript = `
                try {
                    $restorePoints = Get-ComputerRestorePoint | Sort-Object -Property CreationTime -Descending
                    if ($restorePoints.Count -eq 0) {
                        Write-Output "No restore points found"
                    } else {
                        foreach ($point in $restorePoints) {
                            Write-Output "Sequence: $($point.SequenceNumber) - $($point.Description) - $($point.CreationTime)"
                        }
                    }
                } catch {
                    Write-Output "Error listing restore points: $($_.Exception.Message)"
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);
      return result.stdout.trim();
    } catch (error) {
      this.logService.log(`Error listing restore points: ${error.message}`);
      return `Error: ${error.message}`;
    }
  }

  async deleteRestorePoint(sequenceNumber) {
    try {
      this.logService.log(`Deleting restore point with sequence: ${sequenceNumber}`);

      const psScript = `
                try {
                    $sequence = ${sequenceNumber}
                    $restorePoint = Get-ComputerRestorePoint | Where-Object { $_.SequenceNumber -eq $sequence }

                    if (-not $restorePoint) {
                        Write-Output "NOT_FOUND"
                        exit 1
                    }

                    # Note: PowerShell doesn't have a direct way to delete individual restore points
                    # This would require using vssadmin or similar tools
                    Write-Output "DELETE_NOT_SUPPORTED"
                    exit 1
                } catch {
                    Write-Output "ERROR: $($_.Exception.Message)"
                    exit 1
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.stdout.includes('NOT_FOUND')) {
        this.logService.log('Restore point not found');
        return false;
      } else if (result.stdout.includes('DELETE_NOT_SUPPORTED')) {
        this.logService.log('Individual restore point deletion not supported');
        return false;
      } else {
        this.logService.log('Restore point deleted successfully');
        return true;
      }
    } catch (error) {
      this.logService.log(`Error deleting restore point: ${error.message}`);
      return false;
    }
  }

  async deleteOldRestorePoints(keepCount) {
    try {
      this.logService.log(`Deleting old restore points, keeping ${keepCount} most recent`);

      const psScript = `
                try {
                    $keepCount = ${keepCount}
                    $restorePoints = Get-ComputerRestorePoint | Sort-Object -Property CreationTime -Descending

                    if ($restorePoints.Count -le $keepCount) {
                        Write-Output "No old restore points to delete"
                        exit 0
                    }

                    # Note: This is a simplified implementation
                    # In practice, you'd need to use vssadmin or similar tools to delete old restore points
                    Write-Output "DELETE_OLD_NOT_SUPPORTED"
                    exit 1
                } catch {
                    Write-Output "ERROR: $($_.Exception.Message)"
                    exit 1
                }
            `;

      const result = await this.runProcess('powershell', ['-Command', psScript]);

      if (result.stdout.includes('No old restore points')) {
        this.logService.log('No old restore points to delete');
        return true;
      } else if (result.stdout.includes('DELETE_OLD_NOT_SUPPORTED')) {
        this.logService.log('Deleting old restore points not supported in this implementation');
        return false;
      } else {
        this.logService.log('Old restore points deleted successfully');
        return true;
      }
    } catch (error) {
      this.logService.log(`Error deleting old restore points: ${error.message}`);
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

module.exports = SystemRestoreService;
