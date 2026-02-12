const DnsService = require("../services/DnsService");
const { spawn } = require("child_process"); // Import spawn for direct mocking

// Mock child_process.spawn
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe("DnsService", () => {
  let dnsService;
  let runNetshCommandSpy;

  beforeEach(() => {
    dnsService = new DnsService(mockLogService);
    mockLogService.log.mockClear();
    // Spy on the actual runNetshCommand method and mock its implementation
    runNetshCommandSpy = jest.spyOn(dnsService, "runNetshCommand");
    runNetshCommandSpy.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  });

  afterEach(() => {
    runNetshCommandSpy.mockRestore(); // Restore original implementation after each test
  });

  describe("setDns", () => {
    test("should successfully set primary DNS", async () => {
      const primaryDns = "1.1.1.1";
      const result = await dnsService.setDns(primaryDns);

      expect(result).toBe(true);
      expect(runNetshCommandSpy).toHaveBeenCalledWith(
        `interface ip set dns name="Ethernet" static ${primaryDns} primary`,
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        `Setting DNS to ${primaryDns}`,
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "DNS settings updated successfully",
      );
    });

    test("should successfully set primary and secondary DNS", async () => {
      const primaryDns = "1.1.1.1";
      const secondaryDns = "1.0.0.1";
      const result = await dnsService.setDns(primaryDns, secondaryDns);

      expect(result).toBe(true);
      expect(runNetshCommandSpy).toHaveBeenCalledWith(
        `interface ip set dns name="Ethernet" static ${primaryDns} primary`,
      );
      expect(runNetshCommandSpy).toHaveBeenCalledWith(
        `interface ip add dns name="Ethernet" ${secondaryDns} index=2`,
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        `Setting DNS to ${primaryDns} and ${secondaryDns}`,
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "DNS settings updated successfully",
      );
    });

    test("should return false and log error if primary DNS setting fails", async () => {
      const primaryDns = "1.1.1.1";
      runNetshCommandSpy.mockResolvedValueOnce({
        code: 1,
        stdout: "",
        stderr: "Error",
      });

      const result = await dnsService.setDns(primaryDns);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Failed to set primary DNS",
      );
      // No 'Error setting DNS' log here, as runNetshCommand did not throw an exception
    });

    test("should return false and log error if secondary DNS setting fails", async () => {
      const primaryDns = "1.1.1.1";
      const secondaryDns = "1.0.0.1";
      runNetshCommandSpy
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" }) // Primary succeeds
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "Error" }); // Secondary fails

      const result = await dnsService.setDns(primaryDns, secondaryDns);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Failed to set secondary DNS",
      );
      // No 'Error setting DNS' log here, as runNetshCommand did not throw an exception
    });

    test("should return false and log error if runNetshCommand throws an exception", async () => {
      const primaryDns = "1.1.1.1";
      runNetshCommandSpy.mockRejectedValue(new Error("Command failed"));

      const result = await dnsService.setDns(primaryDns);

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error setting DNS: Command failed"),
      );
    });
  });

  describe("resetDns", () => {
    test("should successfully reset DNS", async () => {
      const result = await dnsService.resetDns();

      expect(result).toBe(true);
      expect(runNetshCommandSpy).toHaveBeenCalledWith(
        'interface ip set dns name="Ethernet" dhcp',
      );
      expect(mockLogService.log).toHaveBeenCalledWith("Resetting DNS to DHCP");
      expect(mockLogService.log).toHaveBeenCalledWith(
        "DNS settings reset successfully",
      );
    });

    test("should return false and log error if DNS resetting fails", async () => {
      runNetshCommandSpy.mockResolvedValueOnce({
        code: 1,
        stdout: "",
        stderr: "Error",
      });

      const result = await dnsService.resetDns();

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Failed to reset DNS settings",
      );
      // No 'Error resetting DNS' log here, as runNetshCommand did not throw an exception
    });

    test("should return false and log error if runNetshCommand throws an exception", async () => {
      runNetshCommandSpy.mockRejectedValue(new Error("Command failed"));

      const result = await dnsService.resetDns();

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error resetting DNS: Command failed"),
      );
    });
  });

  // The runNetshCommand method itself is part of DnsService, so we test it directly
  describe("runNetshCommand", () => {
    // Restore the original runNetshCommand for these tests
    beforeEach(() => {
      runNetshCommandSpy.mockRestore();
    });

    test("should resolve with stdout and stderr on close", async () => {
      spawn.mockImplementation(() => ({
        stdout: {
          on: (event, callback) => {
            if (event === "data") callback("netsh stdout");
          },
        },
        stderr: {
          on: (event, callback) => {
            if (event === "data") callback("netsh stderr");
          },
        },
        on: (event, callback) => {
          if (event === "close") callback(0);
        },
      }));

      const result = await dnsService.runNetshCommand(
        "interface ip show config",
      );

      expect(result).toEqual({
        code: 0,
        stdout: "netsh stdout",
        stderr: "netsh stderr",
      });
      expect(mockLogService.log).toHaveBeenCalledWith(
        "[netsh STDOUT]: netsh stdout",
      );
      expect(mockLogService.log).toHaveBeenCalledWith(
        "[netsh STDERR]: netsh stderr",
      );
    });

    test("should reject on process error", async () => {
      spawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: (event, callback) => {
          if (event === "error") callback(new Error("Spawn error"));
        },
      }));

      await expect(
        dnsService.runNetshCommand("invalid command"),
      ).rejects.toThrow("Spawn error");
    });
  });
});
