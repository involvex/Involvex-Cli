const NetworkService = require("../services/NetworkService");
const { spawn } = require("child_process");

// Mock child_process.spawn
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe("NetworkService", () => {
  let networkService;

  beforeEach(() => {
    networkService = new NetworkService(mockLogService);
    // Clear mock calls before each test
    spawn.mockClear();
    mockLogService.log.mockClear();
  });

  describe("runPingTest", () => {
    test("should return successful ping output for Windows", async () => {
      // Mock successful ping output for Windows
      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === "data")
              callback(
                "Pinging 8.8.8.8 with 32 bytes of data:\r\nReply from 8.8.8.8: bytes=32 time=10ms TTL=118\r\n",
              );
          },
        },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === "close") callback(0);
        },
      }));

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const result = await networkService.runPingTest("8.8.8.8");
      expect(result).toContain("Reply from 8.8.8.8");
      expect(spawn).toHaveBeenCalledWith(
        "ping",
        ["-n", "4", "-w", "5", "8.8.8.8"],
        expect.any(Object),
      );

      Object.defineProperty(process, "platform", { value: originalPlatform }); // Restore original platform
    });

    test("should return successful ping output for non-Windows", async () => {
      // Mock successful ping output for non-Windows
      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === "data")
              callback(
                "PING 8.8.8.8 (8.8.8.8): 56 data bytes\n64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=10.000 ms\n",
              );
          },
        },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === "close") callback(0);
        },
      }));

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" }); // Mock as Linux

      const result = await networkService.runPingTest("8.8.8.8");
      expect(result).toContain("64 bytes from 8.8.8.8");
      expect(spawn).toHaveBeenCalledWith(
        "ping",
        ["-c", "4", "-W", "5", "8.8.8.8"],
        expect.any(Object),
      );

      Object.defineProperty(process, "platform", { value: originalPlatform }); // Restore original platform
    });

    test("should return error message on ping failure", async () => {
      spawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: {
          on: (event, callback) => {
            if (event === "data") callback("Request timed out.\r\n");
          },
        },
        on: (event, callback) => {
          if (event === "close") callback(1); // Non-zero exit code for failure
        },
      }));

      const result = await networkService.runPingTest("invalid.host");
      expect(result).toContain("Ping test completed with warnings");
      expect(result).toContain("Request timed out.");
    });

    test("should return error message for invalid host input", async () => {
      const result = await networkService.runPingTest("");
      expect(result).toBe("Error: Host cannot be empty");
      expect(spawn).not.toHaveBeenCalled();
    });

    test("should log error if spawn throws an error", async () => {
      spawn.mockImplementation(() => {
        throw new Error("Spawn failed");
      });

      const result = await networkService.runPingTest("8.8.8.8");
      expect(result).toContain("Error running ping test: Spawn failed");
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Error running ping test: Spawn failed",
      );
    });
  });

  describe("runSpeedTest", () => {
    test("should return formatted speed test results on success", async () => {
      const mockSpeedtestOutput = {
        type: "result",
        timestamp: "2023-10-27T10:00:00Z",
        ping: { jitter: 1.23, latency: 15.45 },
        download: { bandwidth: 12500000, bytes: 12500000, elapsed: 1000 },
        upload: { bandwidth: 6250000, bytes: 6250000, elapsed: 1000 },
        isp: "Test ISP",
        server: {
          id: 1234,
          name: "Test Server",
          location: "New York",
          country: "US",
          host: "test.server.com",
        },
      };

      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === "data") callback(JSON.stringify(mockSpeedtestOutput));
          },
        },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === "close") callback(0);
        },
      }));

      const result = await networkService.runSpeedTest();
      expect(result).toContain("Ping: 15.45 ms (Jitter: 1.23 ms)");
      expect(result).toContain("Download: 100.00 Mbit/s");
      expect(result).toContain("Upload: 50.00 Mbit/s");
      expect(result).toContain("Server: Test Server (New York, US)");
      expect(result).toContain("ISP: Test ISP");
      expect(spawn).toHaveBeenCalledWith(
        "speedtest",
        ["--json"],
        expect.any(Object),
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Speed test completed successfully.",
      );
    });

    test("should return error message on speedtest command failure", async () => {
      spawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: {
          on: (event, callback) => {
            if (event === "data") callback("speedtest command not found");
          },
        },
        on: (event, callback) => {
          if (event === "close") callback(1);
        },
      }));

      const result = await networkService.runSpeedTest();
      expect(result).toContain(
        "Error running speed test: speedtest command not found",
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Speed test command failed with code 1: speedtest command not found",
      );
    });

    test("should return error message on invalid JSON output", async () => {
      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === "data") callback("This is not JSON output");
          },
        },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === "close") callback(0);
        },
      }));

      const result = await networkService.runSpeedTest();
      expect(result).toContain("Error running speed test: Unexpected token");
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "Exception running speed test: Unexpected token",
        ),
      );
    });

    test("should log and return error if spawn throws an error", async () => {
      spawn.mockImplementation(() => {
        throw new Error("Speedtest spawn failed");
      });

      const result = await networkService.runSpeedTest();
      expect(result).toContain(
        "Error running speed test: Speedtest spawn failed",
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Exception running speed test: Speedtest spawn failed",
      );
    });
  });
});
