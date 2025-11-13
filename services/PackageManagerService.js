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
                this.logService.log(`PowerShell 7+ not available or Update-PSResource failed: ${error.message}`);
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
                this.logService.log(`[${command} STDOUT]: ${stdout}`);
                this.logService.log(`[${command} STDERR]: ${stderr}`);

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

    async getAvailableUpdatesAsync() {
        const availableUpdates = [];

        // Check winget updates
        if (await this.isWingetInstalled()) {
            try {
                const wingetUpdates = await this.getWingetAvailableUpdatesAsync();
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
                const npmUpdates = await this.getNpmAvailableUpdatesAsync();
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
                const scoopUpdates = await this.getScoopAvailableUpdatesAsync();
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
                const chocoUpdates = await this.getChocoAvailableUpdatesAsync();
                if (chocoUpdates) {
                    availableUpdates.push(...chocoUpdates);
                }
            } catch (error) {
                this.logService.log(`Error getting choco updates: ${error.message}`);
            }
        }

        return availableUpdates;
    }

    async updateWithProgressAsync(managerName, updateAction, totalSteps = 1) {
        this.emit('progress', `Starting ${managerName} update...`, 0);

        try {
            for (let i = 0; i < totalSteps; i++) {
                this.emit('progress', `Updating ${managerName}... Step ${i + 1}/${totalSteps}`, (i * 100) / totalSteps);
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
            this.emit('progress', `Starting ${manager} update...`, (completedManagers * 100) / totalManagers);

            try {
                await updateAction(manager);
                completedManagers++;
                this.emit('progress', `${manager} update completed. (${completedManagers}/${totalManagers})`, (completedManagers * 100) / totalManagers);
            } catch (error) {
                this.emit('progress', `Error updating ${manager}: ${error.message}`, (completedManagers * 100) / totalManagers);
                completedManagers++;
            }
        }

        this.emit('progress', 'All updates completed!', 100);
    }

    async getWingetAvailableUpdatesAsync() {
        try {
            const result = await this.runProcess('winget', ['upgrade']);
            if (result.code !== 0) return null;

            const lines = result.stdout.split('\n');
            const updates = [];

            for (let i = 2; i < lines.length; i++) { // Skip header lines
                const line = lines[i].trim();
                if (line && !line.includes('Name') && !line.includes('---')) {
                    const parts = line.split(/\s+/).filter(part => part.length > 0);
                    if (parts.length >= 2) {
                        updates.push({
                            packageManager: 'winget',
                            packageName: parts[0],
                            currentVersion: parts.length > 2 ? parts[1] : 'Unknown',
                            availableVersion: parts.length > 3 ? parts[2] : 'Unknown'
                        });
                    }
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
            if (result.code !== 0) return null;

            const lines = result.stdout.split('\n');
            const updates = [];

            for (let i = 1; i < lines.length; i++) { // Skip header line
                const line = lines[i].trim();
                if (line) {
                    const parts = line.split(/\s+/).filter(part => part.length > 0);
                    if (parts.length >= 4) {
                        updates.push({
                            packageManager: 'npm',
                            packageName: parts[0],
                            currentVersion: parts[1],
                            availableVersion: parts[3]
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
            if (result.code !== 0) return null;

            const lines = result.stdout.split('\n');
            const updates = [];

            for (let i = 2; i < lines.length; i++) { // Skip header lines
                const line = lines[i].trim();
                if (line && !line.includes('Name') && !line.includes('---')) {
                    const parts = line.split(/\s+/).filter(part => part.length > 0);
                    if (parts.length >= 3) {
                        updates.push({
                            packageManager: 'scoop',
                            packageName: parts[0],
                            currentVersion: parts[1],
                            availableVersion: parts[2]
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
            if (result.code !== 0) return null;

            const lines = result.stdout.split('\n');
            const updates = [];

            for (let i = 1; i < lines.length; i++) { // Skip header line
                const line = lines[i].trim();
                if (line && !line.includes('Name') && !line.includes('---')) {
                    const parts = line.split(/\s+/).filter(part => part.length > 0);
                    if (parts.length >= 3) {
                        updates.push({
                            packageManager: 'choco',
                            packageName: parts[0],
                            currentVersion: parts[1],
                            availableVersion: parts[2]
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
}

module.exports = PackageManagerService;
