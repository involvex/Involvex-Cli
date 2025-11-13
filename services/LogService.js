const fs = require('fs');
const path = require('path');

class LogService {
    constructor(logDirectory = null) {
        if (logDirectory) {
            this.logFilePath = path.join(logDirectory, 'involvex.log');
        } else {
            this.logFilePath = path.join(__dirname, '..', 'logs', 'update.log');
        }

        // Ensure logs directory exists
        const logDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(message) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `${timestamp}: ${message}\n`;
            fs.appendFileSync(this.logFilePath, logEntry);
        } catch {
            // If logging to file fails, do nothing.
            // Writing to the console here would corrupt the TUI display.
        }
    }
}

module.exports = LogService;
