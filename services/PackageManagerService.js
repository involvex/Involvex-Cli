const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class PackageManagerService extends EventEmitter {
  constructor(logService) {
    super();
    this.logService = logService;
  }

  async isWingetInstalled() {
    return await this.isCommandInstalled('winget');
  }

  async isNpmInstalled() {
    return await this.isCommandInstalled('npm');
  }

  async isScoopInstalled() {
    return await this.isCommandInstalled('scoop');
  }

  async isChocoInstalled() {
    return await this.isCommandInstalled('choco');
  }

  async isPipInstalled() {
    // Check for pip, pip3, or python -m pip
    const pipCommands = ['pip', 'pip3', 'python -m pip', 'python3 -m pip'];
    for (const cmd of pipCommands) {
      const parts = cmd.split(' ');
      try {
        if (parts.length > 1) {
          // For 'python -m pip', check if python is available
          const pythonResult = await this.runProcess(parts[0], ['--version'], 5000);
          if (pythonResult.code === 0) {
            const pipResult = await this.runProcess(parts[0], ['-m', 'pip', '--version'], 5000);
            if (pipResult.code === 0) return true;
          }
        } else {
          const result = await this.runProcess('where', [cmd], 5000);
          if (result.code === 0) return true;
        }
      } catch {
        // Continue to next command
      }
    }
    return false;
  }

  async updateWinget() {
    return await this.runUpdateCommand('winget', ['update', '--include-unknown']);
  }

  async updateNpm() {
    return await this.runUpdateCommand('npm', ['update', '-g']);
  }

  async updateScoop() {
    return await this.runUpdateCommand('scoop', ['update']);
  }

  async updateChoco() {
    return await this.runUpdateCommand('choco', ['upgrade', 'all', '-y']);
  }

  async updatePip() {
    // Try pip, pip3, or python -m pip
    const pipCommands = [
      { cmd: 'pip', args: ['install', '--upgrade', 'pip'] },
      { cmd: 'pip3', args: ['install', '--upgrade', 'pip'] },
      { cmd: 'python', args: ['-m', 'pip', 'install', '--upgrade', 'pip'] },
      { cmd: 'python3', args: ['-m', 'pip', 'install', '--upgrade', 'pip'] },
    ];

    for (const { cmd, args } of pipCommands) {
      try {
        // Check if this pip command is available
        let checkArgs;
        if (cmd === 'pip' || cmd === 'pip3') {
          checkArgs = ['--version'];
        } else {
          checkArgs = ['-m', 'pip', '--version'];
        }
        const result = await this.runProcess(cmd, checkArgs, 5000);
        if (result.code === 0) {
          // This command is available, update pip itself first
          await this.runUpdateCommand(cmd, args);
          // Then update all outdated packages using pip-review or manual list
          const listArgs =
            cmd === 'pip' || cmd === 'pip3'
              ? ['list', '--outdated']
              : ['-m', 'pip', 'list', '--outdated'];

          const listResult = await this.runProcess(cmd, listArgs, 30000);
          if (listResult.code === 0 && listResult.stdout) {
            const lines = listResult.stdout.split('\n');
            const packages = [];

            for (let i = 2; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line && !line.includes('Package') && !line.includes('---')) {
                const parts = line.split(/\s+/).filter(part => part.length > 0);
                if (parts.length > 0) {
                  packages.push(parts[0]);
                }
              }
            }

            if (packages.length > 0) {
              // Update packages one by one
              for (const pkg of packages) {
                const updateArgs =
                  cmd === 'pip' || cmd === 'pip3'
                    ? ['install', '--upgrade', pkg]
                    : ['-m', 'pip', 'install', '--upgrade', pkg];
                try {
                  await this.runUpdateCommand(cmd, updateArgs);
                } catch (error) {
                  this.logService.log(`Failed to update ${pkg}: ${error.message}`);
                }
              }
            }
          }
          return;
        }
      } catch (error) {
        // Continue to next command
        this.logService.log(`Trying next pip command: ${error.message}`);
      }
    }
    throw new Error('No pip installation found');
  }

  async updateSpecificProgramWithWinget(programName) {
    return await this.runUpdateCommand('winget', ['upgrade', programName]);
  }

  async updateSpecificProgramWithNpm(programName) {
    return await this.runUpdateCommand('npm', ['update', '-g', programName]);
  }

  async updateSpecificProgramWithScoop(programName) {
    return await this.runUpdateCommand('scoop', ['update', programName]);
  }

  async updateSpecificProgramWithChoco(programName) {
    return await this.runUpdateCommand('choco', ['upgrade', programName, '-y']);
  }

  async updatePowerShellModules() {
    this.logService.log('Updating PowerShell modules.');

    try {
      // Update modules using Update-Module
      await this.runProcess('powershell', ['Update-Module', '-Force', '-Confirm:$false']);

      // Also try Update-PSResource for PowerShell 7+
      try {
        await this.runProcess('pwsh', ['Update-PSResource', '-Force']);
      } catch (error) {
        this.logService.log(
          `PowerShell 7+ not available or Update-PSResource failed: ${error.message}`
        );
      }
    } catch (error) {
      this.logService.log(`Error updating PowerShell modules: ${error.message}`);
    }
  }

  async isCommandInstalled(command) {
    try {
      const result = await this.runProcess('where', [command]);
      return result.code === 0;
    } catch (error) {
      this.logService.log(`Error checking if ${command} is installed: ${error.message}`);
      return false;
    }
  }

  async runUpdateCommand(command, args) {
    try {
      const result = await this.runProcess(command, args);
      if (result.code !== 0) {
        this.logService.log(`Error updating ${command}. Exit Code: ${result.code}`);
      }
      return result;
    } catch (error) {
      this.logService.log(`Error running ${command} update: ${error.message}`);
      throw error;
    }
  }

  async runProcess(command, args, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;

      // Set timeout
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
        this.logService.log(`[${command} STDOUT]: ${stdout}`);
        this.logService.log(`[${command} STDERR]: ${stderr}`);

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

  async getAvailableUpdatesAsync() {
    const availableUpdates = [];
    const timeoutMs = 5000; // 5 second timeout per package manager

    // Check winget updates
    if (await this.isWingetInstalled()) {
      try {
        const wingetUpdates = await Promise.race([
          this.getWingetAvailableUpdatesAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Winget update check timeout')), timeoutMs)
          ),
        ]).catch(error => {
          this.logService.log(`Error getting winget updates: ${error.message}`);
          return null;
        });
        if (wingetUpdates) {
          availableUpdates.push(...wingetUpdates);
        }
      } catch (error) {
        this.logService.log(`Error getting winget updates: ${error.message}`);
      }
    }

    // Check npm updates
    if (await this.isNpmInstalled()) {
      try {
        const npmUpdates = await Promise.race([
          this.getNpmAvailableUpdatesAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('NPM update check timeout')), timeoutMs)
          ),
        ]).catch(error => {
          this.logService.log(`Error getting npm updates: ${error.message}`);
          return null;
        });
        if (npmUpdates) {
          availableUpdates.push(...npmUpdates);
        }
      } catch (error) {
        this.logService.log(`Error getting npm updates: ${error.message}`);
      }
    }

    // Check scoop updates
    if (await this.isScoopInstalled()) {
      try {
        const scoopUpdates = await Promise.race([
          this.getScoopAvailableUpdatesAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Scoop update check timeout')), timeoutMs)
          ),
        ]).catch(error => {
          this.logService.log(`Error getting scoop updates: ${error.message}`);
          return null;
        });
        if (scoopUpdates) {
          availableUpdates.push(...scoopUpdates);
        }
      } catch (error) {
        this.logService.log(`Error getting scoop updates: ${error.message}`);
      }
    }

    // Check choco updates
    if (await this.isChocoInstalled()) {
      try {
        const chocoUpdates = await Promise.race([
          this.getChocoAvailableUpdatesAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Choco update check timeout')), timeoutMs)
          ),
        ]).catch(error => {
          this.logService.log(`Error getting choco updates: ${error.message}`);
          return null;
        });
        if (chocoUpdates) {
          availableUpdates.push(...chocoUpdates);
        }
      } catch (error) {
        this.logService.log(`Error getting choco updates: ${error.message}`);
      }
    }

    // Check pip updates
    if (await this.isPipInstalled()) {
      try {
        const pipUpdates = await Promise.race([
          this.getPipAvailableUpdatesAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Pip update check timeout')), timeoutMs)
          ),
        ]).catch(error => {
          this.logService.log(`Error getting pip updates: ${error.message}`);
          return null;
        });
        if (pipUpdates) {
          availableUpdates.push(...pipUpdates);
        }
      } catch (error) {
        this.logService.log(`Error getting pip updates: ${error.message}`);
      }
    }

    return availableUpdates;
  }

  async updateWithProgressAsync(managerName, updateAction, totalSteps = 1) {
    this.emit('progress', `Starting ${managerName} update...`, 0);

    try {
      for (let i = 0; i < totalSteps; i++) {
        this.emit(
          'progress',
          `Updating ${managerName}... Step ${i + 1}/${totalSteps}`,
          (i * 100) / totalSteps
        );
        await updateAction();
      }

      this.emit('progress', `${managerName} update completed successfully!`, 100);
    } catch (error) {
      this.emit('progress', `Error updating ${managerName}: ${error.message}`, 100);
      throw error;
    }
  }

  async updateAllWithProgressAsync(managers, updateAction) {
    const totalManagers = managers.length;
    let completedManagers = 0;

    for (const manager of managers) {
      this.emit(
        'progress',
        `Starting ${manager} update...`,
        (completedManagers * 100) / totalManagers
      );

      try {
        await updateAction(manager);
        completedManagers++;
        this.emit(
          'progress',
          `${manager} update completed. (${completedManagers}/${totalManagers})`,
          (completedManagers * 100) / totalManagers
        );
      } catch (error) {
        this.emit(
          'progress',
          `Error updating ${manager}: ${error.message}`,
          (completedManagers * 100) / totalManagers
        );
        completedManagers++;
      }
    }

    this.emit('progress', 'All updates completed!', 100);
  }

  async getWingetAvailableUpdatesAsync() {
    try {
      const result = await this.runProcess('winget', ['upgrade']);
      if (result.code !== 0) {
        this.logService.log(`Winget command failed with code ${result.code}: ${result.stderr}`);
        return null;
      }

      const lines = result.stdout.split('\n').filter(line => line.trim());
      const updates = [];

      if (lines.length < 2) {
        // Need at least header and separator
        this.logService.log('Winget output too short to parse.');
        return null;
      }

      const headerLine = lines[0];
      // const separatorLine = lines[1]; // The line with '---' - not used

      // Dynamically find column start and end indices based on the header line
      const columnHeaders = ['Name', 'Id', 'Version', 'Available', 'Source'];
      const columnPositions = []; // Stores { name: 'Name', start: 0, end: 5 }

      let lastHeaderEnd = -1;
      for (const header of columnHeaders) {
        const start = headerLine.indexOf(header, lastHeaderEnd + 1);
        if (start !== -1) {
          columnPositions.push({ name: header, start: start });
          lastHeaderEnd = start + header.length; // Update lastHeaderEnd to be the end of the current header
        } else {
          this.logService.log(`Winget output header missing column: ${header}`);
          return null;
        }
      }

      // Determine end positions for each column
      for (let i = 0; i < columnPositions.length; i++) {
        if (i < columnPositions.length - 1) {
          columnPositions[i].end = columnPositions[i + 1].start;
        } else {
          columnPositions[i].end = headerLine.length; // Last column goes to end of line
        }
      }

      // Create a map for easier access
      const columnMap = {};
      columnPositions.forEach(col => {
        columnMap[col.name] = col;
      });

      // Regex to capture Name, Id, Version, Available, Source
      // This regex assumes:
      // - Name can contain spaces and is followed by one or more spaces.
      // - Id, Version, Available, Source are single tokens (no spaces within them) and are separated by one or more spaces.
      // - The order of columns is always Name, Id, Version, Available, Source.
      const dataLineRegex =
        /^\s*(?<name>.+?)\s+(?<id>\S+)\s+(?<version>\S+)\s+(?<available>\S+)\s+(?<source>\S+)\s*$/;

      // Iterate over data lines (starting from index 2, after header and separator)
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes('---') ||
          line.includes('No installed package found matching the input criteria.')
        ) {
          continue; // Skip separator and "no updates" message
        }

        const match = line.match(dataLineRegex);
        if (match && match.groups) {
          const { name, version, available } = match.groups;
          updates.push({
            packageManager: 'winget',
            packageName: name.trim(),
            currentVersion: version.trim(),
            availableVersion: available.trim(),
          });
        } else {
          this.logService.log(`Failed to parse winget output line: ${line}`);
        }
      }
      return updates;
    } catch (error) {
      this.logService.log(`Error getting winget available updates: ${error.message}`);
      return null;
    }
  }

  async getNpmAvailableUpdatesAsync() {
    try {
      const result = await this.runProcess('npm', ['outdated', '-g']);
      // npm outdated returns 1 if there are outdated packages, which is a success for our purpose
      if (result.code !== 0 && result.code !== 1) return null;

      const lines = result.stdout.split('\n');
      const updates = [];

      for (let i = 1; i < lines.length; i++) {
        // Skip header line
        const line = lines[i].trim();
        if (line) {
          const parts = line.split(/\s+/).filter(part => part.length > 0);
          if (parts.length >= 4) {
            updates.push({
              packageManager: 'npm',
              packageName: parts[0],
              currentVersion: parts[1],
              availableVersion: parts[3],
            });
          }
        }
      }

      return updates;
    } catch (error) {
      this.logService.log(`Error getting npm available updates: ${error.message}`);
      return null;
    }
  }

  async getScoopAvailableUpdatesAsync() {
    try {
      const result = await this.runProcess('scoop', ['status']);
      if (result.code !== 0) {
        throw new Error(`Scoop command failed with code ${result.code}: ${result.stderr}`);
      }

      const lines = result.stdout.split('\n');
      const updates = [];

      for (let i = 2; i < lines.length; i++) {
        // Skip header lines
        const line = lines[i].trim();
        if (line && !line.includes('Name') && !line.includes('---')) {
          const parts = line.split(/\s+/).filter(part => part.length > 0);
          if (parts.length >= 3) {
            updates.push({
              packageManager: 'scoop',
              packageName: parts[0],
              currentVersion: parts[1],
              availableVersion: parts[2],
            });
          }
        }
      }

      return updates;
    } catch (error) {
      this.logService.log(`Error getting scoop available updates: ${error.message}`);
      return null;
    }
  }

  async getChocoAvailableUpdatesAsync() {
    try {
      const result = await this.runProcess('choco', ['outdated']);
      if (result.code !== 0) {
        throw new Error(`Choco command failed with code ${result.code}: ${result.stderr}`);
      }

      const lines = result.stdout.split('\n');
      const updates = [];

      for (let i = 1; i < lines.length; i++) {
        // Skip header line
        const line = lines[i].trim();
        if (line && !line.includes('Name') && !line.includes('---') && line.includes('|')) {
          const parts = line
            .split('|')
            .map(part => part.trim())
            .filter(part => part.length > 0);
          if (parts.length >= 3) {
            updates.push({
              packageManager: 'choco',
              packageName: parts[0],
              currentVersion: parts[1],
              availableVersion: parts[2],
            });
          }
        }
      }

      return updates;
    } catch (error) {
      this.logService.log(`Error getting choco available updates: ${error.message}`);
      return null;
    }
  }

  async getPipAvailableUpdatesAsync() {
    try {
      // Try different pip commands with JSON format first
      const pipCommands = [
        { cmd: 'pip', args: ['list', '--outdated', '--format=json'] },
        { cmd: 'pip3', args: ['list', '--outdated', '--format=json'] },
        { cmd: 'python', args: ['-m', 'pip', 'list', '--outdated', '--format=json'] },
        { cmd: 'python3', args: ['-m', 'pip', 'list', '--outdated', '--format=json'] },
      ];

      for (const { cmd, args } of pipCommands) {
        try {
          let checkArgs;
          if (cmd === 'pip' || cmd === 'pip3') {
            checkArgs = ['--version'];
          } else {
            checkArgs = ['--version']; // First call for python/python3
          }
          const checkResult = await this.runProcess(cmd, checkArgs, 5000);

          if (checkResult.code === 0) {
            if (cmd === 'python' || cmd === 'python3') {
              checkArgs = ['-m', 'pip', '--version']; // Second call for python/python3
              const pipResult = await this.runProcess(cmd, checkArgs, 5000);
              if (pipResult.code !== 0) {
                continue; // Try next command
              }
            }

            // Try JSON format first
            const result = await this.runProcess(cmd, args, 10000);
            if (result.code === 0 && result.stdout) {
              try {
                const packages = JSON.parse(result.stdout);
                const updates = packages.map(pkg => ({
                  packageManager: 'pip',
                  packageName: pkg.name,
                  currentVersion: pkg.version,
                  availableVersion: pkg.latest_version || pkg.latest,
                }));
                return updates;
              } catch (jsonError) {
                // JSON parsing failed, try text format
                this.logService.log(`JSON parsing failed for ${cmd}, trying text format: ${jsonError.message}`);
              }
            }

            // Try text format as fallback
            const textArgs = args.slice(0, -1); // Remove --format=json
            const textResult = await this.runProcess(cmd, textArgs, 10000);
            if (textResult.code === 0 && textResult.stdout) {
              const lines = textResult.stdout.split('\n');
              const updates = [];

              for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && !line.includes('Package') && !line.includes('---')) {
                  const parts = line.split(/\s+/).filter(part => part.length > 0);
                  if (parts.length >= 3) {
                    updates.push({
                      packageManager: 'pip',
                      packageName: parts[0],
                      currentVersion: parts[1],
                      availableVersion: parts[2],
                    });
                  }
                }
              }
              return updates;
            }
          }
        } catch (error) {
          this.logService.log(`Trying next pip command: ${error.message}`);
        }
      }
      return null;
    } catch (error) {
      this.logService.log(`Error getting pip available updates: ${error.message}`);
      return null;
    }
  }
}

module.exports = PackageManagerService;
