const CacheService = require('../services/CacheService');
const fs = require('fs').promises; // Keep the original import
const os = require('os');
const path = require('path');

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock os.tmpdir
jest.mock('os', () => ({
  tmpdir: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('CacheService', () => {
  let cacheService;
  const mockTempDir = '/mock/temp';
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    cacheService = new CacheService(mockLogService);
    os.tmpdir.mockReturnValue(mockTempDir);

    // Mock fs.promises functions directly
    fs.readdir = jest.fn();
    fs.stat = jest.fn();
    fs.unlink = jest.fn();
    fs.rmdir = jest.fn();
    fs.mkdir = jest.fn();
    fs.access = jest.fn();

    // Mock global.gc
    global.gc = jest.fn();

    // Default mock for runProcess in CacheService
    cacheService.runProcess = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('clearSystemCache', () => {
    test('should clear user-specific temporary files and npm cache on non-Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' }); // Mock as non-Windows

      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.txt', 'dir1']);
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith('Starting system cache clearing operation.');
      expect(fs.readdir).toHaveBeenCalledWith(mockTempDir);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockTempDir, 'file1.txt'));
      expect(cacheService.runProcess).toHaveBeenCalledWith('npm', ['cache', 'clean', '--force']);
      expect(cacheService.runProcess).not.toHaveBeenCalledWith('powershell', expect.any(Array)); // No PowerShell on non-Windows
      expect(mockLogService.log).toHaveBeenCalledWith('System cache cleared successfully.');
    });

    test('should clear user-specific temporary files, npm cache, and Windows temp files on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' }); // Mock as Windows

      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.txt', 'dir1']);
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(true);
      expect(cacheService.runProcess).toHaveBeenCalledWith('npm', ['cache', 'clean', '--force']);
      expect(cacheService.runProcess).toHaveBeenCalledWith('powershell', expect.any(Array)); // PowerShell on Windows
      expect(mockLogService.log).toHaveBeenCalledWith('Windows temp files cleared.');
    });

    test('should handle errors during temporary file deletion gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.txt']);
      fs.unlink.mockRejectedValue(new Error('Permission denied')); // Simulate error

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(true); // Operation still succeeds overall
      expect(mockLogService.log).toHaveBeenCalledWith(expect.stringContaining('Could not delete'));
    });

    test('should log error if npm cache clearing fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      cacheService.runProcess.mockImplementation((cmd, _args) => {
        if (cmd === 'npm') {
          return Promise.resolve({ code: 1, stdout: '', stderr: 'npm error' });
        }
        return Promise.resolve({ code: 0, stdout: '', stderr: '' });
      });

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith(
        'NPM cache clearing failed or npm not available.'
      );
    });

    test('should log error if Windows temp file clearing fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      cacheService.runProcess.mockImplementation((cmd, _args) => {
        if (cmd === 'powershell') {
          return Promise.resolve({ code: 1, stdout: '', stderr: 'powershell error' });
        }
        return Promise.resolve({ code: 0, stdout: '', stderr: '' });
      });

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(true);
      expect(mockLogService.log).toHaveBeenCalledWith('Failed to clear Windows temp files');
    });

    test('should return false and log error if overall operation fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fs.readdir.mockRejectedValue(new Error('FS read error'));

      const result = await cacheService.clearSystemCache();

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error clearing system cache: FS read error')
      );
    });
  });

  describe('clearMemory', () => {
    test('should trigger Node.js garbage collection on non-Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = await cacheService.clearMemory();

      expect(result).toBe(true);
      expect(global.gc).toHaveBeenCalledTimes(2); // Once at start, once at end
      expect(cacheService.runProcess).not.toHaveBeenCalledWith('powershell', expect.any(Array));
      expect(mockLogService.log).toHaveBeenCalledWith('Node.js garbage collection triggered.');
      expect(mockLogService.log).toHaveBeenCalledWith('Memory clearing operations completed.');
    });

    test('should trigger Node.js garbage collection and PowerShell script on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = await cacheService.clearMemory();

      expect(result).toBe(true);
      expect(global.gc).toHaveBeenCalledTimes(2);
      expect(cacheService.runProcess).toHaveBeenCalledWith('powershell', expect.any(Array));
      expect(mockLogService.log).toHaveBeenCalledWith('Node.js garbage collection triggered.');
      expect(mockLogService.log).toHaveBeenCalledWith('Memory clearing operations completed.');
    });

    test('should return false and log error if overall operation fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      cacheService.runProcess.mockRejectedValue(new Error('PowerShell error'));

      const result = await cacheService.clearMemory();

      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Error clearing memory: PowerShell error')
      );
    });
  });

  describe('deleteDirectoryContents', () => {
    test('should recursively delete files and directories', async () => {
      const testDir = '/test/dir';
      const file1 = path.join(testDir, 'file1.txt');
      const subDir = path.join(testDir, 'subDir');
      const file2 = path.join(subDir, 'file2.txt');

      fs.stat.mockImplementation(async p => {
        if (p === testDir || p === subDir) return { isDirectory: () => true };
        if (p === file1 || p === file2) return { isDirectory: () => false };
        throw new Error('Not found');
      });
      fs.readdir.mockImplementation(async p => {
        if (p === testDir) return ['file1.txt', 'subDir'];
        if (p === subDir) return ['file2.txt'];
        return [];
      });
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();

      await cacheService.deleteDirectoryContents(testDir);

      expect(fs.unlink).toHaveBeenCalledWith(file1);
      expect(fs.unlink).toHaveBeenCalledWith(file2);
      expect(fs.rmdir).toHaveBeenCalledWith(subDir);
      expect(mockLogService.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Could not delete')
      );
    });

    test('should log errors for inaccessible files/directories during deletion', async () => {
      const testDir = '/test/dir';
      const file1 = path.join(testDir, 'file1.txt');

      fs.stat.mockImplementation(async p => {
        if (p === testDir) return { isDirectory: () => true };
        if (p === file1) return { isDirectory: () => false };
        throw new Error('Not found');
      });
      fs.readdir.mockResolvedValue(['file1.txt']);
      fs.unlink.mockRejectedValue(new Error('Access denied'));

      await cacheService.deleteDirectoryContents(testDir);

      expect(fs.unlink).toHaveBeenCalledWith(file1);
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining(`Could not delete ${file1}: Access denied`)
      );
    });

    test('should handle non-existent directory gracefully', async () => {
      const testDir = '/non/existent/dir';
      fs.stat.mockRejectedValue(new Error('ENOENT'));

      await cacheService.deleteDirectoryContents(testDir);

      expect(fs.readdir).not.toHaveBeenCalled();
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining(`Error accessing directory ${testDir}: ENOENT`)
      );
    });
  });
});
