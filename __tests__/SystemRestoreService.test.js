const SystemRestoreService = require("../services/SystemRestoreService");
const { spawn } = require("child_process");

// Mock child_process.spawn
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe("SystemRestoreService", () => {
  let systemRestoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    systemRestoreService = new SystemRestoreService(mockLogService);
  });

  describe("createRestorePoint", () => {
    test("should create restore point successfully", async () => {
      const mockStdout = "SUCCESS";
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
        systemRestoreService.createRestorePoint("Test Restore Point");
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Creating system restore point"),
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("created successfully"),
      );
    });

    test("should return false if restore point already exists", async () => {
      const mockStdout = "Restore point already exists";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 0);
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
        systemRestoreService.createRestorePoint("Test Restore Point");
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create restore point"),
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

      const result =
        await systemRestoreService.createRestorePoint("Test Restore Point");

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error creating restore point"),
      );
    });
  });

  describe("listRestorePoints", () => {
    test("should list restore points successfully", async () => {
      const mockStdout =
        "Sequence: 1 - Test Restore Point - 2024-01-01 12:00:00\nSequence: 2 - Another Point - 2024-01-02 12:00:00";
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

      const promise = systemRestoreService.listRestorePoints();
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toContain("Sequence: 1");
      expect(result).toContain("Sequence: 2");
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Listing system restore points",
      );
    });

    test("should handle no restore points", async () => {
      const mockStdout = "No restore points found";
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

      const promise = systemRestoreService.listRestorePoints();
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toContain("No restore points found");
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

      const result = await systemRestoreService.listRestorePoints();

      expect(result).toContain("Error: Process error");
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error listing restore points"),
      );
    });
  });

  describe("deleteRestorePoint", () => {
    test("should return false if restore point not found", async () => {
      const mockStdout = "NOT_FOUND";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 0);
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

      const promise = systemRestoreService.deleteRestorePoint(1);
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Restore point not found",
      );
    });

    test("should return false if deletion not supported", async () => {
      const mockStdout = "DELETE_NOT_SUPPORTED";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 0);
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

      const promise = systemRestoreService.deleteRestorePoint(1);
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Individual restore point deletion not supported",
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

      const result = await systemRestoreService.deleteRestorePoint(1);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting restore point"),
      );
    });
  });

  describe("deleteOldRestorePoints", () => {
    test("should return true if no old restore points to delete", async () => {
      const mockStdout = "No old restore points to delete";
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

      const promise = systemRestoreService.deleteOldRestorePoints(5);
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "No old restore points to delete",
      );
    });

    test("should return false if deletion not supported", async () => {
      const mockStdout = "DELETE_OLD_NOT_SUPPORTED";
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(1), 0);
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

      const promise = systemRestoreService.deleteOldRestorePoints(5);
      stdoutCallback(Buffer.from(mockStdout));

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("not supported"),
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

      const result = await systemRestoreService.deleteOldRestorePoints(5);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting old restore points"),
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

      const promise = systemRestoreService.runProcess("command", [
        "arg1",
        "arg2",
      ]);
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

      await expect(
        systemRestoreService.runProcess("command", []),
      ).rejects.toThrow("Spawn error");
    });
  });
});
