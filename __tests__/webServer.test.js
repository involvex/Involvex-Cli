const WebServer = require('../server/webServer');
const express = require('express');

// Mock express
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn(),
  };
  const mockExpress = jest.fn(() => mockApp);
  mockExpress.json = jest.fn(() => (req, res, next) => next());
  mockExpress.static = jest.fn(() => (req, res, next) => next());
  return mockExpress;
});

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

// Mock services
const mockServices = {
  packageManager: {
    getAvailableUpdatesAsync: jest.fn(),
    updateWinget: jest.fn(),
    updateNpm: jest.fn(),
    updateScoop: jest.fn(),
    updateChoco: jest.fn(),
    updatePip: jest.fn(),
  },
  cache: {
    clearSystemCache: jest.fn(),
    clearMemory: jest.fn(),
  },
  startup: {
    listStartupPrograms: jest.fn(),
  },
  uninstaller: {
    listInstalledPrograms: jest.fn(),
  },
  dns: {
    getCurrentDns: jest.fn(),
  },
  network: {
    runPingTest: jest.fn(),
  },
  plugin: {
    getLoadedPlugins: jest.fn(),
  },
};

describe('WebServer', () => {
  let webServer;
  let mockApp;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = express();
    webServer = new WebServer(mockLogService, mockServices);
  });

  describe('constructor', () => {
    test('should create express app and setup routes', () => {
      expect(express).toHaveBeenCalled();
      expect(mockApp.use).toHaveBeenCalled();
      expect(mockApp.get).toHaveBeenCalled();
      expect(mockApp.post).toHaveBeenCalled();
    });
  });

  describe('setupRoutes', () => {
    test('should setup middleware', () => {
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // express.json()
      // Check that express.static was called with 'public'
      expect(express.static).toHaveBeenCalledWith('public');
    });

    test('should setup GET / route', () => {
      const getCalls = mockApp.get.mock.calls;
      const rootCall = getCalls.find(call => call[0] === '/');
      expect(rootCall).toBeDefined();
      expect(typeof rootCall[1]).toBe('function');
    });

    test('should setup GET /api/menu route', () => {
      const getCalls = mockApp.get.mock.calls;
      const menuCall = getCalls.find(call => call[0] === '/api/menu');
      expect(menuCall).toBeDefined();
      expect(typeof menuCall[1]).toBe('function');
    });
  });

  describe('GET /api/menu', () => {
    test('should return menu items', () => {
      const getCalls = mockApp.get.mock.calls;
      const menuCall = getCalls.find(call => call[0] === '/api/menu');
      const handler = menuCall[1];
      const mockRes = { json: jest.fn() };

      handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          'Update',
          'Cache',
          'Startup',
          'Uninstall',
          'DNS',
          'Network',
          'Driver',
          'System Restore',
          'Plugins',
          'Settings',
        ]),
      });
    });
  });

  describe('GET /api/updates', () => {
    test('should return updates successfully', async () => {
      const mockUpdates = [{ name: 'package1', version: '1.0.0' }];
      mockServices.packageManager.getAvailableUpdatesAsync.mockResolvedValue(mockUpdates);

      const getCalls = mockApp.get.mock.calls;
      const updatesCall = getCalls.find(call => call[0] === '/api/updates');
      const handler = updatesCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, updates: mockUpdates });
    });

    test('should handle errors', async () => {
      mockServices.packageManager.getAvailableUpdatesAsync.mockRejectedValue(
        new Error('Update error')
      );

      const getCalls = mockApp.get.mock.calls;
      const updatesCall = getCalls.find(call => call[0] === '/api/updates');
      const handler = updatesCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Update error' });
    });
  });

  describe('POST /api/update/:manager', () => {
    test('should update winget', async () => {
      mockServices.packageManager.updateWinget.mockResolvedValue(true);

      const postCalls = mockApp.post.mock.calls;
      const updateCall = postCalls.find(call => call[0] === '/api/update/:manager');
      const handler = updateCall[1];
      const mockReq = { params: { manager: 'winget' } };
      const mockRes = { json: jest.fn() };

      await handler(mockReq, mockRes);

      expect(mockServices.packageManager.updateWinget).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('should update npm', async () => {
      mockServices.packageManager.updateNpm.mockResolvedValue(true);

      const postCalls = mockApp.post.mock.calls;
      const updateCall = postCalls.find(call => call[0] === '/api/update/:manager');
      const handler = updateCall[1];
      const mockReq = { params: { manager: 'npm' } };
      const mockRes = { json: jest.fn() };

      await handler(mockReq, mockRes);

      expect(mockServices.packageManager.updateNpm).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('should handle errors', async () => {
      mockServices.packageManager.updateWinget.mockRejectedValue(new Error('Update error'));

      const postCalls = mockApp.post.mock.calls;
      const updateCall = postCalls.find(call => call[0] === '/api/update/:manager');
      const handler = updateCall[1];
      const mockReq = { params: { manager: 'winget' } };
      const mockRes = { json: jest.fn() };

      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Update error' });
    });
  });

  describe('POST /api/cache/clear', () => {
    test('should clear cache successfully', async () => {
      mockServices.cache.clearSystemCache.mockResolvedValue(true);

      const postCalls = mockApp.post.mock.calls;
      const cacheCall = postCalls.find(call => call[0] === '/api/cache/clear');
      const handler = cacheCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockServices.cache.clearSystemCache).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('should handle errors', async () => {
      mockServices.cache.clearSystemCache.mockRejectedValue(new Error('Cache error'));

      const postCalls = mockApp.post.mock.calls;
      const cacheCall = postCalls.find(call => call[0] === '/api/cache/clear');
      const handler = cacheCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'Cache error' });
    });
  });

  describe('POST /api/cache/memory', () => {
    test('should clear memory successfully', async () => {
      mockServices.cache.clearMemory.mockResolvedValue(true);

      const postCalls = mockApp.post.mock.calls;
      const memoryCall = postCalls.find(call => call[0] === '/api/cache/memory');
      const handler = memoryCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockServices.cache.clearMemory).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /api/startup', () => {
    test('should return startup programs', async () => {
      const mockPrograms = ['Program1', 'Program2'];
      mockServices.startup.listStartupPrograms.mockResolvedValue(mockPrograms);

      const getCalls = mockApp.get.mock.calls;
      const startupCall = getCalls.find(call => call[0] === '/api/startup');
      const handler = startupCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, programs: mockPrograms });
    });
  });

  describe('GET /api/programs', () => {
    test('should return installed programs', async () => {
      const mockPrograms = ['Program1', 'Program2'];
      mockServices.uninstaller.listInstalledPrograms.mockResolvedValue(mockPrograms);

      const getCalls = mockApp.get.mock.calls;
      const programsCall = getCalls.find(call => call[0] === '/api/programs');
      const handler = programsCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, programs: mockPrograms });
    });
  });

  describe('GET /api/dns', () => {
    test('should return DNS info', async () => {
      const mockDns = { primary: '8.8.8.8', secondary: '8.8.4.4' };
      mockServices.dns.getCurrentDns.mockResolvedValue(mockDns);

      const getCalls = mockApp.get.mock.calls;
      const dnsCall = getCalls.find(call => call[0] === '/api/dns');
      const handler = dnsCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, dns: mockDns });
    });
  });

  describe('POST /api/network/ping', () => {
    test('should run ping test', async () => {
      const mockResult = { time: '10ms', host: '8.8.8.8' };
      mockServices.network.runPingTest.mockResolvedValue(mockResult);

      const postCalls = mockApp.post.mock.calls;
      const pingCall = postCalls.find(call => call[0] === '/api/network/ping');
      const handler = pingCall[1];
      const mockReq = { body: { host: '8.8.8.8' } };
      const mockRes = { json: jest.fn() };

      await handler(mockReq, mockRes);

      expect(mockServices.network.runPingTest).toHaveBeenCalledWith('8.8.8.8');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    test('should use default host if not provided', async () => {
      mockServices.network.runPingTest.mockResolvedValue({});

      const postCalls = mockApp.post.mock.calls;
      const pingCall = postCalls.find(call => call[0] === '/api/network/ping');
      const handler = pingCall[1];
      const mockReq = { body: {} };
      const mockRes = { json: jest.fn() };

      await handler(mockReq, mockRes);

      expect(mockServices.network.runPingTest).toHaveBeenCalledWith('8.8.8.8');
    });
  });

  describe('GET /api/plugins', () => {
    test('should return loaded plugins', async () => {
      const mockPlugins = [
        { name: 'Plugin1', description: 'Desc1', version: '1.0.0' },
        { name: 'Plugin2', description: 'Desc2', version: '2.0.0' },
      ];
      mockServices.plugin.getLoadedPlugins.mockReturnValue(mockPlugins);

      const getCalls = mockApp.get.mock.calls;
      const pluginsCall = getCalls.find(call => call[0] === '/api/plugins');
      const handler = pluginsCall[1];
      const mockRes = { json: jest.fn() };

      await handler({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        plugins: mockPlugins.map(p => ({
          name: p.name,
          description: p.description,
          version: p.version,
        })),
      });
    });
  });

  describe('start', () => {
    test('should start server successfully', async () => {
      const mockServer = {
        on: jest.fn(),
        close: jest.fn(),
      };
      mockApp.listen.mockImplementation((_port, _host, callback) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      await webServer.start(3000, '0.0.0.0');

      expect(mockApp.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function));
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Web server started')
      );
    });

    test('should handle start errors', async () => {
      mockApp.listen.mockImplementation((_port, _host, _callback) => {
        const mockServer = {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Start error')), 0);
            }
          }),
        };
        return mockServer;
      });

      await expect(webServer.start(3000)).rejects.toThrow('Start error');
    });
  });

  describe('stop', () => {
    test('should stop server successfully', async () => {
      const mockServer = {
        close: jest.fn(callback => {
          setTimeout(() => callback(), 0);
        }),
      };
      webServer.server = mockServer;

      await webServer.stop();

      expect(mockServer.close).toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith('Web server stopped');
    });

    test('should handle stop when server is null', async () => {
      webServer.server = null;

      await webServer.stop();

      // When server is null, it resolves immediately and logs
      expect(mockLogService.log).toHaveBeenCalledWith('Web server stopped');
    });
  });

  describe('serveFolder', () => {
    test('should serve static folder', () => {
      const folderPath = '/path/to/folder';

      webServer.serveFolder(folderPath);

      // Check that express.static was called with the folder path
      expect(express.static).toHaveBeenCalledWith(folderPath);
      expect(mockLogService.log).toHaveBeenCalledWith(expect.stringContaining('Serving folder'));
    });
  });

  describe('getMainHTML', () => {
    test('should return HTML string', () => {
      const html = webServer.getMainHTML();

      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('InvolveX CLI - Web Interface');
    });
  });
});
