const UninstallerService = require('../services/UninstallerService');
const { spawn } = require('child_process');

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('UninstallerService', () => {
  let uninstallerService;

  beforeEach(() => {
    jest.clearAllMocks();
    uninstallerService = new UninstallerService(mockLogService);
  });

  describe('listInstalledPrograms', () => {
    test('should list installed programs successfully', async () => {
      const mockStdout =
        '[System] Program1 (v1.0.0) - Publisher1 [Uninstallable]\n[User] Program2 (v2.0.0) - Publisher2 [Uninstallable]';
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise = uninstallerService.listInstalledPrograms();
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toContain('[System] Program1 (v1.0.0) - Publisher1 [Uninstallable]');
      expect(result).toContain('[User] Program2 (v2.0.0) - Publisher2 [Uninstallable]');
      expect(mockLogService.log).toHaveBeenCalledWith('Listing installed programs from registry.');
      expect(mockLogService.log).toHaveBeenCalledWith(expect.stringContaining('Found'));
    });

    test('should handle errors gracefully', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process error')), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await uninstallerService.listInstalledPrograms();

      expect(result).toContain('Error: Process error');
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Exception listing installed programs')
      );
    });

    test('should handle non-zero exit code', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await uninstallerService.listInstalledPrograms();

      expect(result).toEqual([]);
    });
  });

  describe('uninstallProgram', () => {
    test('should uninstall program successfully with MSI uninstaller', async () => {
      const findStdout = 'msiexec /x {GUID}';
      const mockFindProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let findStdoutCallback;
      mockFindProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          findStdoutCallback = callback;
        }
      });

      const mockUninstallProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      spawn.mockReturnValueOnce(mockFindProcess).mockReturnValueOnce(mockUninstallProcess);

      const promise = uninstallerService.uninstallProgram('Program1');
      findStdoutCallback(Buffer.from(findStdout));

      const result = await promise;

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Attempting to uninstall program')
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully initiated uninstall')
      );
    });

    test('should uninstall program successfully with non-MSI uninstaller', async () => {
      const findStdout = 'C:\\Program Files\\Program1\\uninstall.exe';
      const mockFindProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let findStdoutCallback;
      mockFindProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          findStdoutCallback = callback;
        }
      });

      const mockUninstallProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      spawn.mockReturnValueOnce(mockFindProcess).mockReturnValueOnce(mockUninstallProcess);

      const promise = uninstallerService.uninstallProgram('Program1');
      findStdoutCallback(Buffer.from(findStdout));

      const result = await promise;

      expect(result).toBe(true);
    });

    test('should return false if uninstall string not found', async () => {
      const mockFindProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        }),
      };

      spawn.mockReturnValueOnce(mockFindProcess);

      const result = await uninstallerService.uninstallProgram('NonExistentProgram');

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Could not find uninstall string')
      );
    });

    test('should return false if uninstall process fails', async () => {
      const findStdout = 'C:\\Program Files\\Program1\\uninstall.exe';
      const mockFindProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let findStdoutCallback;
      mockFindProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          findStdoutCallback = callback;
        }
      });

      const mockUninstallProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0);
          }
        }),
      };

      spawn.mockReturnValueOnce(mockFindProcess).mockReturnValueOnce(mockUninstallProcess);

      const promise = uninstallerService.uninstallProgram('Program1');
      findStdoutCallback(Buffer.from(findStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Uninstall process exited with code')
      );
    });

    test('should handle errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process error')), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await uninstallerService.uninstallProgram('Program1');

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Exception uninstalling program')
      );
    });
  });

  describe('runProcess', () => {
    test('should run process and return result', async () => {
      const mockStdout = 'output';
      const mockStderr = 'error output';
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback, stderrCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise = uninstallerService.runProcess('command', ['arg1', 'arg2']);
      stdoutCallback(Buffer.from(mockStdout));
      stderrCallback(Buffer.from(mockStderr));

      const result = await promise;

      expect(result).toEqual({
        code: 0,
        stdout: mockStdout,
        stderr: mockStderr,
      });
      expect(spawn).toHaveBeenCalledWith('command', ['arg1', 'arg2'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
    });

    test('should handle process errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Spawn error')), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      await expect(uninstallerService.runProcess('command', [])).rejects.toThrow('Spawn error');
    });
  });
});
