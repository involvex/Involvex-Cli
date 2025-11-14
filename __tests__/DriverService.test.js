const DriverService = require('../services/DriverService');
const { spawn } = require('child_process');

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('DriverService', () => {
  let driverService;
  let runProcessSpy;

  beforeEach(() => {
    driverService = new DriverService(mockLogService);
    mockLogService.log.mockClear();
    runProcessSpy = jest.spyOn(driverService, 'runProcess');
    runProcessSpy.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  afterEach(() => {
    runProcessSpy.mockRestore();
  });

  describe('detectDrivers', () => {
    test('should return detected drivers on success', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: 'Driver A - Description A\nDriver B - Description B\n',
        stderr: '',
      });

      const result = await driverService.detectDrivers();

      expect(result).toEqual(['Driver A - Description A', 'Driver B - Description B']);
      expect(runProcessSpy).toHaveBeenCalledWith('powershell', expect.any(Array));
      expect(mockLogService.log).toHaveBeenCalledWith('Detecting outdated drivers');
    });

    test('should return "No driver updates found" if no updates are available', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: 'No driver updates available\n',
        stderr: '',
      });

      const result = await driverService.detectDrivers();

      expect(result).toEqual(['No driver updates available']);
      expect(runProcessSpy).toHaveBeenCalledWith('powershell', expect.any(Array));
    });

    test('should return error message if PowerShell script fails', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 1,
        stdout: 'Error output from powershell',
        stderr: 'PowerShell error',
      });

      const result = await driverService.detectDrivers();

      expect(result).toEqual(['Error checking for driver updates']);
      expect(runProcessSpy).toHaveBeenCalledWith('powershell', expect.any(Array));
    });

    test('should log and return error if runProcess throws an exception', async () => {
      runProcessSpy.mockRejectedValue(new Error('Process spawn failed'));

      const result = await driverService.detectDrivers();

      expect(result).toEqual(['Error: Process spawn failed']);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error detecting drivers: Process spawn failed')
      );
    });
  });

  describe('updateDriver', () => {
    test('should return true and log success on successful driver update initiation', async () => {
      const driverName = 'NVIDIA Graphics Driver';
      runProcessSpy.mockResolvedValueOnce({ code: 0, stdout: 'Scan initiated', stderr: '' });

      const result = await driverService.updateDriver(driverName);

      expect(result).toBe(true);
      expect(runProcessSpy).toHaveBeenCalledWith('pnputil', ['/scan-devices']);
      expect(mockLogService.log).toHaveBeenCalledWith(`Attempting to update driver: ${driverName}`);
      expect(mockLogService.log).toHaveBeenCalledWith(`Driver scan initiated for: ${driverName}`);
    });

    test('should return false and log failure if pnputil fails', async () => {
      const driverName = 'NVIDIA Graphics Driver';
      runProcessSpy.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'pnputil error' });

      const result = await driverService.updateDriver(driverName);

      expect(result).toBe(false);
      expect(runProcessSpy).toHaveBeenCalledWith('pnputil', ['/scan-devices']);
      expect(mockLogService.log).toHaveBeenCalledWith(`Failed to update driver: ${driverName}`);
    });

    test('should log and return false if runProcess throws an exception', async () => {
      const driverName = 'NVIDIA Graphics Driver';
      runProcessSpy.mockRejectedValue(new Error('Process spawn failed'));

      const result = await driverService.updateDriver(driverName);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating driver ${driverName}: Process spawn failed`)
      );
    });
  });

  describe('runProcess', () => {
    // Restore the original runProcess for these tests
    beforeEach(() => {
      runProcessSpy.mockRestore();
    });

    test('should resolve with stdout and stderr on close', async () => {
      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === 'data') callback('process stdout');
          },
        },
        stderr: {
          on: (event, callback) => {
            if (event === 'data') callback('process stderr');
          },
        },
        on: (event, callback) => {
          if (event === 'close') callback(0);
        },
      }));

      const result = await driverService.runProcess('echo', ['hello']);

      expect(result).toEqual({ code: 0, stdout: 'process stdout', stderr: 'process stderr' });
    });

    test('should reject on process error', async () => {
      spawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === 'error') callback(new Error('Spawn error'));
        },
      }));

      await expect(driverService.runProcess('invalid command', [])).rejects.toThrow('Spawn error');
    });
  });
});
