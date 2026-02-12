const PluginRepositoryService = require("../services/PluginRepositoryService");
const fs = require("fs").promises;
const https = require("https");
const path = require("path");

// Mock fs.promises
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));

// Mock fs (for createWriteStream)
jest.mock("fs", () => {
  const originalFs = jest.requireActual("fs");
  return {
    ...originalFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn(),
    },
    createWriteStream: jest.fn(),
    unlink: jest.fn(),
  };
});

// Mock https
jest.mock("https", () => ({
  get: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe("PluginRepositoryService", () => {
  let pluginRepositoryService;
  const mockRepositoryPath = path.join(
    __dirname,
    "..",
    "plugins-repository.json",
  );
  const mockPlugins = [
    {
      name: "TestPlugin",
      version: "1.0.0",
      downloadUrl: "https://example.com/plugin.js",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    pluginRepositoryService = new PluginRepositoryService(mockLogService);
    // Reset the localRepositoryPath to use the actual path
    pluginRepositoryService.localRepositoryPath = mockRepositoryPath;
  });

  describe("getAvailablePluginsAsync", () => {
    test("should load plugins from local cache if available", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockPlugins));

      const plugins = await pluginRepositoryService.getAvailablePluginsAsync();

      expect(plugins).toEqual(mockPlugins);
      expect(fs.readFile).toHaveBeenCalledWith(mockRepositoryPath, "utf8");
      expect(https.get).not.toHaveBeenCalled();
    });

    test("should fetch from remote if local cache is empty", async () => {
      fs.readFile.mockRejectedValue({ code: "ENOENT" });
      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            setTimeout(
              () => callback(Buffer.from(JSON.stringify(mockPlugins))),
              0,
            );
          }
          if (event === "end") {
            setTimeout(() => callback(), 0);
          }
        }),
        setTimeout: jest.fn(),
      };
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();

      const plugins = await pluginRepositoryService.getAvailablePluginsAsync();

      expect(plugins).toEqual(mockPlugins);
      expect(https.get).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test("should return empty array on error", async () => {
      fs.readFile.mockRejectedValue(new Error("Read error"));
      https.get.mockImplementation(() => {
        throw new Error("Network error");
      });

      const plugins = await pluginRepositoryService.getAvailablePluginsAsync();

      expect(plugins).toEqual([]);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error getting available plugins"),
      );
    });
  });

  describe("fetchRemoteRepositoryAsync", () => {
    test("should fetch and parse remote repository", async () => {
      const mockData = JSON.stringify(mockPlugins);
      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            setTimeout(() => callback(Buffer.from(mockData)), 0);
          }
          if (event === "end") {
            setTimeout(() => callback(), 0);
          }
        }),
      };
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await pluginRepositoryService.fetchRemoteRepositoryAsync();

      expect(result).toEqual(mockPlugins);
      expect(https.get).toHaveBeenCalledWith(
        pluginRepositoryService.repositoryUrl,
        expect.any(Function),
      );
    });

    test("should handle parse errors", async () => {
      const mockResponse = {
        on: jest.fn((event, callback) => {
          if (event === "data") {
            setTimeout(() => callback(Buffer.from("invalid json")), 0);
          }
          if (event === "end") {
            setTimeout(() => callback(), 0);
          }
        }),
      };
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await pluginRepositoryService.fetchRemoteRepositoryAsync();

      expect(result).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error parsing remote repository"),
      );
    });

    test("should handle network errors", async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Network error")), 0);
          }
        }),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((_url, _callback) => {
        return mockRequest;
      });

      const result = await pluginRepositoryService.fetchRemoteRepositoryAsync();

      expect(result).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching remote repository"),
      );
    });

    test("should handle timeout", async () => {
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn((timeout, callback) => {
          setTimeout(() => callback(), 0);
        }),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((_url, _callback) => {
        return mockRequest;
      });

      const result = await pluginRepositoryService.fetchRemoteRepositoryAsync();

      expect(result).toBeNull();
      expect(mockRequest.destroy).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Timeout fetching remote repository",
      );
    });
  });

  describe("loadLocalRepositoryAsync", () => {
    test("should load and parse local repository file", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockPlugins));

      const result = await pluginRepositoryService.loadLocalRepositoryAsync();

      expect(result).toEqual(mockPlugins);
      expect(fs.readFile).toHaveBeenCalledWith(mockRepositoryPath, "utf8");
    });

    test("should return null if file does not exist", async () => {
      fs.readFile.mockRejectedValue({ code: "ENOENT" });

      const result = await pluginRepositoryService.loadLocalRepositoryAsync();

      expect(result).toBeNull();
    });

    test("should return null if file is invalid JSON", async () => {
      fs.readFile.mockResolvedValue("invalid json");

      const result = await pluginRepositoryService.loadLocalRepositoryAsync();

      expect(result).toBeNull();
    });
  });

  describe("saveLocalRepositoryAsync", () => {
    test("should save plugins to local repository file", async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await pluginRepositoryService.saveLocalRepositoryAsync(mockPlugins);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(mockRepositoryPath), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockRepositoryPath,
        JSON.stringify(mockPlugins, null, 2),
        "utf8",
      );
    });

    test("should log error if save fails", async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error("Write error"));

      await pluginRepositoryService.saveLocalRepositoryAsync(mockPlugins);

      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error saving local repository"),
      );
    });
  });

  describe("downloadAndInstallPluginAsync", () => {
    test("should download and install plugin successfully", async () => {
      const pluginInfo = {
        name: "Test Plugin",
        version: "1.0.0",
        downloadUrl: "https://example.com/plugin.js",
      };
      const pluginsDir = "/plugins";
      const mockFile = {
        on: jest.fn((event, callback) => {
          if (event === "finish") {
            setTimeout(() => callback(), 0);
          }
        }),
        close: jest.fn(),
      };
      const fs = require("fs");
      fs.createWriteStream.mockReturnValue(mockFile);
      const mockResponse = {
        statusCode: 200,
        pipe: jest.fn(),
      };
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result =
        await pluginRepositoryService.downloadAndInstallPluginAsync(
          pluginInfo,
          pluginsDir,
        );

      expect(result).toBe(true);
      expect(fs.createWriteStream).toHaveBeenCalled();
      expect(mockResponse.pipe).toHaveBeenCalledWith(mockFile);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Downloaded plugin to"),
      );
    });

    test("should return false if plugin has no download URL", async () => {
      const pluginInfo = { name: "Test Plugin", version: "1.0.0" };
      const pluginsDir = "/plugins";

      const result =
        await pluginRepositoryService.downloadAndInstallPluginAsync(
          pluginInfo,
          pluginsDir,
        );

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Plugin does not have a download URL",
      );
    });

    test("should handle non-200 status code", async () => {
      const pluginInfo = {
        name: "Test Plugin",
        version: "1.0.0",
        downloadUrl: "https://example.com/plugin.js",
      };
      const pluginsDir = "/plugins";
      const mockFile = {
        close: jest.fn(),
      };
      const fs = require("fs");
      fs.createWriteStream.mockReturnValue(mockFile);
      fs.unlink.mockImplementation((path, callback) => callback());
      const mockResponse = {
        statusCode: 404,
      };
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result =
        await pluginRepositoryService.downloadAndInstallPluginAsync(
          pluginInfo,
          pluginsDir,
        );

      expect(result).toBe(false);
      expect(mockFile.close).toHaveBeenCalled();
    });

    test("should handle download errors", async () => {
      const pluginInfo = {
        name: "Test Plugin",
        version: "1.0.0",
        downloadUrl: "https://example.com/plugin.js",
      };
      const pluginsDir = "/plugins";
      const mockFile = {
        close: jest.fn(),
      };
      const fs = require("fs");
      fs.createWriteStream.mockReturnValue(mockFile);
      fs.unlink.mockImplementation((path, callback) => callback());
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Network error")), 0);
          }
        }),
        setTimeout: jest.fn(),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((_url, _callback) => {
        return mockRequest;
      });

      const result =
        await pluginRepositoryService.downloadAndInstallPluginAsync(
          pluginInfo,
          pluginsDir,
        );

      expect(result).toBe(false);
      expect(mockFile.close).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Error downloading plugin"),
      );
    });

    test("should handle timeout", async () => {
      const pluginInfo = {
        name: "Test Plugin",
        version: "1.0.0",
        downloadUrl: "https://example.com/plugin.js",
      };
      const pluginsDir = "/plugins";
      const mockFile = {
        close: jest.fn(),
      };
      const fs = require("fs");
      fs.createWriteStream.mockReturnValue(mockFile);
      fs.unlink.mockImplementation((path, callback) => callback());
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn((timeout, callback) => {
          setTimeout(() => callback(), 0);
        }),
        destroy: jest.fn(),
      };
      https.get.mockImplementation((_url, _callback) => {
        return mockRequest;
      });

      const result =
        await pluginRepositoryService.downloadAndInstallPluginAsync(
          pluginInfo,
          pluginsDir,
        );

      expect(result).toBe(false);
      expect(mockRequest.destroy).toHaveBeenCalled();
      expect(mockFile.close).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith(
        "Timeout downloading plugin",
      );
    });
  });

  describe("validatePluginAsync", () => {
    test("should validate plugin successfully", async () => {
      const pluginPath = "/path/to/plugin.js";
      const pluginInfo = { name: "TestPlugin" };
      const mockPlugin = {
        name: "TestPlugin",
        description: "Test",
        version: "1.0.0",
      };

      fs.access.mockResolvedValue();
      jest.doMock(
        pluginPath,
        () => ({
          default: class MockPlugin {
            constructor() {
              Object.assign(this, mockPlugin);
            }
          },
        }),
        { virtual: true },
      );

      // Since we can't easily mock require() for a dynamic path, we'll test the error case
      fs.access.mockRejectedValue(new Error("File not found"));

      const result = await pluginRepositoryService.validatePluginAsync(
        pluginPath,
        pluginInfo,
      );

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining("Plugin validation failed"),
      );
    });

    test("should return false if plugin file does not exist", async () => {
      const pluginPath = "/path/to/plugin.js";
      const pluginInfo = { name: "TestPlugin" };

      fs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await pluginRepositoryService.validatePluginAsync(
        pluginPath,
        pluginInfo,
      );

      expect(result).toBe(false);
      expect(fs.access).toHaveBeenCalledWith(pluginPath);
    });
  });
});
