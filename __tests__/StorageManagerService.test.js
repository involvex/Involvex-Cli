const StorageManagerService = require("../services/StorageManagerService");

// Mock child_process exec
const { exec } = require("child_process");
jest.mock("child_process");

// Mock fs promises
const fs = require("fs").promises;
jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
    rmdir: jest.fn(),
  },
}));

// Mock os
const os = require("os");
jest.mock("os", () => ({
  homedir: jest.fn(),
  tmpdir: jest.fn(),
}));

// Mock path
const path = require("path");
jest.mock("path", () => ({
  join: jest.fn(),
  extname: jest.fn(),
}));

describe("StorageManagerService", () => {
  let storageManagerService;
  let mockLogService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock services
    mockLogService = {
      log: jest.fn(),
    };

    // Setup OS mocks
    os.homedir.mockReturnValue("C:\\Users\\testuser");
    os.tmpdir.mockReturnValue("C:\\Windows\\Temp");

    // Setup path mocks
    path.join.mockImplementation((...args) => args.join("\\"));
    path.extname.mockImplementation(file => {
      const ext = file.split(".").pop();
      return ext ? `.${ext}` : "";
    });

    // Setup exec mock
    exec.mockImplementation((command, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }

      // Mock successful execution
      if (command.includes("wmic logicaldisk get name")) {
        callback(null, "Name\r\nC:\\\r\nD:\\\r\n", "");
      } else if (command.includes("wmic logicaldisk where")) {
        callback(
          null,
          "Name,VolumeName,FreeSpace,Size,FileSystem\r\nC:,Local Disk,1000000000,2000000000,NTFS",
          "",
        );
      } else if (command.includes("defrag")) {
        callback(null, "Defragmentation completed successfully", "");
      } else if (command.includes("cleanmgr")) {
        callback(null, "", "");
      } else {
        callback(new Error("Command not mocked"), "", "");
      }
    });

    // Setup fs mocks
    fs.readdir.mockResolvedValue([
      { name: "file1.txt", isFile: () => true, isDirectory: () => false },
      { name: "folder1", isFile: () => false, isDirectory: () => true },
    ]);

    fs.stat.mockResolvedValue({
      size: 1000,
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
    });

    storageManagerService = new StorageManagerService(mockLogService);
  });

  describe("getDiskInfo", () => {
    it("should return disk information for all drives", async () => {
      const result = await storageManagerService.getDiskInfo();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("drive", "C:\\");
      expect(result[0]).toHaveProperty("label", "Local Disk");
      expect(result[0]).toHaveProperty("filesystem", "NTFS");
      expect(result[0]).toHaveProperty("totalSize", 2000000000);
      expect(result[0]).toHaveProperty("freeSpace", 1000000000);
      expect(result[0]).toHaveProperty("usedSpace", 1000000000);
      expect(result[0]).toHaveProperty("usagePercent", 50);
    });

    it("should handle drive info errors gracefully", async () => {
      exec.mockImplementationOnce((command, callback) => {
        if (command.includes("wmic logicaldisk where")) {
          callback(new Error("Drive not accessible"), "", "");
        } else {
          callback(null, "Name\r\nC:\\\r\n", "");
        }
      });

      const result = await storageManagerService.getDiskInfo();

      expect(result).toHaveLength(1); // Only successful drives returned
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get info for drive"),
      );
    });
  });

  describe("getAvailableDrives", () => {
    it("should return list of available drives", async () => {
      const result = await storageManagerService.getAvailableDrives();

      expect(result).toEqual(["C:\\", "D:\\"]);
      expect(exec).toHaveBeenCalledWith(
        "wmic logicaldisk get name",
        expect.any(Function),
      );
    });

    it("should handle exec errors", async () => {
      exec.mockImplementationOnce((command, callback) => {
        callback(new Error("WMIC failed"), "", "");
      });

      await expect(storageManagerService.getAvailableDrives()).rejects.toThrow(
        "WMIC failed",
      );
    });
  });

  describe("getDriveInfo", () => {
    it("should return detailed drive information", async () => {
      const result = await storageManagerService.getDriveInfo("C:\\");

      expect(result).toEqual({
        drive: "C:",
        label: "Local Disk",
        filesystem: "NTFS",
        totalSize: 2000000000,
        freeSpace: 1000000000,
        usedSpace: 1000000000,
        usagePercent: 50,
      });
    });

    it("should handle exec errors", async () => {
      exec.mockImplementationOnce((command, callback) => {
        if (command.includes("wmic logicaldisk where")) {
          callback(new Error("Drive not found"), "", "");
        }
      });

      await expect(storageManagerService.getDriveInfo("Z:\\")).rejects.toThrow(
        "Drive not found",
      );
    });
  });

  describe("defragmentDrive", () => {
    it("should defragment a drive successfully", async () => {
      const result = await storageManagerService.defragmentDrive("C:");

      expect(result).toEqual({
        success: true,
        message: "Defragmentation completed successfully",
      });
      expect(exec).toHaveBeenCalledWith("defrag C: /O", expect.any(Function));
    });

    it("should handle defrag errors", async () => {
      exec.mockImplementationOnce((command, callback) => {
        if (command.includes("defrag")) {
          callback(new Error("Defrag failed"), "", "");
        }
      });

      await expect(storageManagerService.defragmentDrive("C:")).rejects.toThrow(
        "Defragmentation failed",
      );
    });
  });

  describe("scanDirectory", () => {
    beforeEach(() => {
      // Mock directory scanning
      fs.readdir
        .mockResolvedValueOnce([
          {
            name: "large-file.txt",
            isFile: () => true,
            isDirectory: () => false,
          },
          {
            name: "small-file.txt",
            isFile: () => true,
            isDirectory: () => false,
          },
          {
            name: "large-folder",
            isFile: () => false,
            isDirectory: () => true,
          },
        ])
        .mockResolvedValueOnce([]); // For large-folder contents

      fs.stat
        .mockResolvedValueOnce({ size: 150 * 1024 * 1024, mtime: new Date() }) // large-file.txt
        .mockResolvedValueOnce({ size: 50 * 1024 * 1024, mtime: new Date() }) // small-file.txt
        .mockResolvedValueOnce({ size: 0, mtime: new Date() }); // large-folder (will be calculated)
    });

    it("should scan directory and return large files/folders", async () => {
      const result = await storageManagerService.scanDirectory("C:\\test", 100);

      expect(result).toHaveProperty("largeFiles");
      expect(result).toHaveProperty("largeFolders");
      expect(result).toHaveProperty("totalScanned", 3);

      if (result.largeFiles.length > 0) {
        expect(result.largeFiles[0]).toHaveProperty("path");
        expect(result.largeFiles[0]).toHaveProperty("sizeMB");
        expect(result.largeFiles[0]).toHaveProperty("modified");
      }
    });

    it("should handle scan errors", async () => {
      fs.readdir.mockRejectedValueOnce(new Error("Access denied"));

      await expect(
        storageManagerService.scanDirectory("C:\\restricted"),
      ).rejects.toThrow("Access denied");
    });
  });

  describe("calculateFolderSize", () => {
    it("should calculate folder size recursively", async () => {
      fs.readdir.mockResolvedValue([
        { name: "file1.txt", isFile: () => true, isDirectory: () => false },
        { name: "subdir", isFile: () => false, isDirectory: () => true },
      ]);

      fs.stat
        .mockResolvedValueOnce({ size: 1000 })
        .mockResolvedValueOnce({ size: 0 }); // subdir

      // Mock recursive call
      fs.readdir.mockResolvedValueOnce([
        { name: "file2.txt", isFile: () => true, isDirectory: () => false },
      ]);
      fs.stat.mockResolvedValueOnce({ size: 2000 });

      const result =
        await storageManagerService.calculateFolderSize("C:\\test");

      expect(result).toBe(3000);
    });

    it("should handle inaccessible files gracefully", async () => {
      fs.readdir.mockResolvedValue([
        {
          name: "accessible.txt",
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: "inaccessible.txt",
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);

      fs.stat
        .mockResolvedValueOnce({ size: 1000 })
        .mockRejectedValueOnce(new Error("Access denied"));

      const result =
        await storageManagerService.calculateFolderSize("C:\\test");

      expect(result).toBe(1000); // Only accessible file counted
    });
  });

  describe("getCleanupTargets", () => {
    it("should return common cleanup targets with sizes", async () => {
      fs.stat.mockResolvedValue({ size: 1000000 }); // 1MB
      fs.readdir.mockResolvedValue(["file1.txt", "file2.txt"]);

      const result = await storageManagerService.getCleanupTargets();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      result.forEach(target => {
        expect(target).toHaveProperty("path");
        expect(target).toHaveProperty("name");
        expect(target).toHaveProperty("type");
        expect(target).toHaveProperty("size");
        expect(target).toHaveProperty("sizeMB");
        expect(target).toHaveProperty("itemCount");
      });
    });

    it("should filter out empty targets", async () => {
      fs.stat.mockRejectedValue(new Error("Access denied"));

      const result = await storageManagerService.getCleanupTargets();

      expect(result).toEqual([]); // No targets should be returned if all fail
    });
  });

  describe("cleanTempFiles", () => {
    it("should clean temp files and return results", async () => {
      const targetPaths = ["C:\\Windows\\Temp"];

      // Mock size calculations
      fs.stat.mockResolvedValue({ size: 1000000 });
      fs.readdir.mockResolvedValue(["temp1.tmp", "temp2.tmp"]);

      const result = await storageManagerService.cleanTempFiles(targetPaths);

      expect(result).toHaveProperty("cleaned");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("totalSizeFreed");
      expect(result).toHaveProperty("totalSizeFreedMB");
    });

    it("should handle cleaning errors", async () => {
      const targetPaths = ["C:\\Windows\\Temp"];

      fs.stat.mockRejectedValue(new Error("Access denied"));

      const result = await storageManagerService.cleanTempFiles(targetPaths);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toHaveProperty("path", "C:\\Windows\\Temp");
      expect(result.failed[0]).toHaveProperty("error");
    });
  });

  describe("deleteItems", () => {
    it("should delete files and folders", async () => {
      const items = [
        { path: "C:\\temp\\file.txt" },
        { path: "C:\\temp\\folder" },
      ];

      fs.stat
        .mockResolvedValueOnce({
          size: 1000,
          isFile: () => true,
          isDirectory: () => false,
        })
        .mockResolvedValueOnce({
          size: 2000,
          isFile: () => false,
          isDirectory: () => true,
        });

      const result = await storageManagerService.deleteItems(items);

      expect(result.deleted).toHaveLength(2);
      expect(result.totalSizeFreed).toBe(3000);
      expect(fs.unlink).toHaveBeenCalledWith("C:\\temp\\file.txt");
      expect(fs.rm).toHaveBeenCalledWith("C:\\temp\\folder", {
        recursive: true,
        force: true,
      });
    });

    it("should handle deletion errors", async () => {
      const items = [{ path: "C:\\protected\\file.txt" }];

      fs.stat.mockRejectedValue(new Error("Access denied"));

      const result = await storageManagerService.deleteItems(items);

      expect(result.failed).toHaveLength(1);
      expect(result.deleted).toHaveLength(0);
    });
  });
});
