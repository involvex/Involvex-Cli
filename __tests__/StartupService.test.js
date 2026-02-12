const StartupService = require("../services/StartupService");
const { spawn } = require("child_process");

// Mock child_process.spawn
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe("StartupService", () => {
  let startupService;

  beforeEach(() => {
    jest.clearAllMocks();
    startupService = new StartupService(mockLogService);
  });

  describe("listStartupPrograms", () => {
    test("should list startup programs successfully", async () => {
      const mockStdout =
        "Registry (HKLM:\\...): Program1 -> C:\\path\\to\\program1.exe\nStartup Folder: program2.lnk";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === "data") {
          stdoutCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise = startupService.listStartupPrograms();
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toContain(
        "Registry (HKLM:\\...): Program1 -> C:\\path\\to\\program1.exe",
      );
      expect(result).toContain("Startup Folder: program2.lnk");
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Listing startup programs from registry and Task Scheduler.",
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Found"),
      );
    });

    test("should handle errors gracefully", async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Process error")), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await startupService.listStartupPrograms();

      expect(result).toContain("Error: Process error");
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Exception listing startup programs"),
      );
    });

    test("should handle non-zero exit code", async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await startupService.listStartupPrograms();

      expect(result).toEqual([]);
    });
  });

  describe("disableStartupProgram", () => {
    test("should disable startup program successfully", async () => {
      const mockStdout = "SUCCESS: Disabled from registry";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === "data") {
          stdoutCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise = startupService.disableStartupProgram("Program1");
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Attempting to disable startup program"),
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Successfully disabled"),
      );
    });

    test("should return false if program not found", async () => {
      const mockStdout = "NOT_FOUND";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === "data") {
          stdoutCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise =
        startupService.disableStartupProgram("NonExistentProgram");
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Could not automatically disable"),
      );
    });

    test("should handle errors", async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Process error")), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      const result = await startupService.disableStartupProgram("Program1");

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Exception disabling startup program"),
      );
    });
  });

  describe("runProcess", () => {
    test("should run process and return result", async () => {
      const mockStdout = "output";
      const mockStderr = "error output";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
      };

      let stdoutCallback, stderrCallback;
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === "data") {
          stdoutCallback = callback;
        }
      });
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === "data") {
          stderrCallback = callback;
        }
      });

      spawn.mockReturnValue(mockProcess);

      const promise = startupService.runProcess("command", ["arg1", "arg2"]);
      stdoutCallback(Buffer.from(mockStdout));
      stderrCallback(Buffer.from(mockStderr));

      const result = await promise;

      expect(result).toEqual({
        code: 0,
        stdout: mockStdout,
        stderr: mockStderr,
      });
      expect(spawn).toHaveBeenCalledWith("command", ["arg1", "arg2"], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
    });

    test("should handle process errors", async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Spawn error")), 0);
          }
        }),
      };

      spawn.mockReturnValue(mockProcess);

      await expect(startupService.runProcess("command", [])).rejects.toThrow(
        "Spawn error",
      );
    });
  });
});
