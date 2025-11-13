const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const LogService = require('../services/LogService');

describe('LogService', () => {
  let logService;
  let tempDir;
  let logFilePath;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), 'involvex-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Create LogService with temp directory
    logService = new LogService(tempDir);
    logFilePath = path.join(tempDir, 'involvex.log');
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      logService.Log('Error during cleanup of temp directory: ' + _error);
      // Ignore cleanup errors
    }
  });

  test('should create log file on first log', async () => {
    const testMessage = 'Test log message';

    // Log a message
    logService.log(testMessage);

    // Check if log file exists
    const exists = await fs.access(logFilePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  test('should write log message with timestamp', async () => {
    const testMessage = 'Test log message';

    // Log a message
    logService.log(testMessage);

    // Read the log file
    const logContent = await fs.readFile(logFilePath, 'utf8');

    // Check if message is in the log
    expect(logContent).toContain(testMessage);

    // Check if timestamp is present (basic check)
    expect(logContent).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    expect(logContent).toMatch(/\d{2}:\d{2}:\d{2}/); // Time format
  });

  test('should handle multiple log messages', async () => {
    const messages = ['First message', 'Second message', 'Third message'];

    // Log multiple messages
    messages.forEach(msg => logService.log(msg));

    // Read the log file
    const logContent = await fs.readFile(logFilePath, 'utf8');

    // Check if all messages are in the log
    messages.forEach(msg => {
      expect(logContent).toContain(msg);
    });

    // Should have multiple lines
    const lines = logContent.trim().split('\n');
    expect(lines.length).toBe(3);
  });

  test('should handle special characters in log messages', async () => {
    const specialMessage = 'Message with special chars: àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';

    logService.log(specialMessage);

    const logContent = await fs.readFile(logFilePath, 'utf8');
    expect(logContent).toContain(specialMessage);
  });

  test('should handle empty messages', async () => {
    logService.log('');
    logService.log('   ');

    const logContent = await fs.readFile(logFilePath, 'utf8');
    const lines = logContent.trim().split('\n');

    // Should still create log entries
    expect(lines.length).toBe(2);
  });
});
