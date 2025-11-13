const { spawn } = require('child_process');

class DnsService {
    constructor(logService) {
        this.logService = logService;
    }

    async setDns(primaryDns, secondaryDns = '') {
        try {
            this.logService.log(`Setting DNS to ${primaryDns}${secondaryDns ? ` and ${secondaryDns}` : ''}`);

            // Set primary DNS
            const primaryResult = await this.runNetshCommand(
                `interface ip set dns name="Ethernet" static ${primaryDns} primary`
            );

            if (primaryResult.code !== 0) {
                this.logService.log('Failed to set primary DNS');
                return false;
            }

            // Set secondary DNS if provided
            if (secondaryDns) {
                const secondaryResult = await this.runNetshCommand(
                    `interface ip add dns name="Ethernet" ${secondaryDns} index=2`
                );

                if (secondaryResult.code !== 0) {
                    this.logService.log('Failed to set secondary DNS');
                    return false;
                }
            }

            this.logService.log('DNS settings updated successfully');
            return true;
        } catch (error) {
            this.logService.log(`Error setting DNS: ${error.message}`);
            return false;
        }
    }

    async resetDns() {
        try {
            this.logService.log('Resetting DNS to DHCP');

            const result = await this.runNetshCommand('interface ip set dns name="Ethernet" dhcp');

            if (result.code === 0) {
                this.logService.log('DNS settings reset successfully');
                return true;
            } else {
                this.logService.log('Failed to reset DNS settings');
                return false;
            }
        } catch (error) {
            this.logService.log(`Error resetting DNS: ${error.message}`);
            return false;
        }
    }

    async runNetshCommand(args) {
        return new Promise((resolve, reject) => {
            const process = spawn('netsh', args.split(' '), {
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
                this.logService.log(`[netsh STDOUT]: ${stdout}`);
                this.logService.log(`[netsh STDERR]: ${stderr}`);

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

module.exports = DnsService;
