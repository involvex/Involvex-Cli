/* eslint-disable no-unused-vars */
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class StorageManagerService {
  constructor(logService) {
    this.logService = logService;
  }

  /**
   * Get disk information for all drives
   */
  async getDiskInfo() {
    try {
      const drives = await this.getAvailableDrives();
      const diskInfo = [];

      for (const drive of drives) {
        try {
          const info = await this.getDriveInfo(drive);
          diskInfo.push(info);
        } catch (_error) {
          this.logService.log(`Failed to get info for drive ${drive}: ${_error.message}`);
        }
      }

      return diskInfo;
    } catch (_error) {
      this.logService.log(`Failed to get disk info: ${_error.message}`);
      throw _error;
    }
  }

  /**
   * Get available drives on Windows
   */
  async getAvailableDrives() {
    return new Promise((resolve, reject) => {
      exec('wmic logicaldisk get name', (_error, stdout) => {
        if (_error) {
          reject(_error);
          return;
        }
        // Use _error to avoid unused variable warning
        _error;

        const drives = stdout
          .split('\n')
          .slice(1) // Skip header
          .map(line => line.trim())
          .filter(line => line && line !== '')
          .map(line => line + '\\');

        resolve(drives);
      });
    });
  }

  /**
   * Get detailed drive information
   */
  async getDriveInfo(drivePath) {
    return new Promise((resolve, reject) => {
      exec(
        `wmic logicaldisk where "name='${drivePath.replace('\\', '')}'" get name,volumename,freespace,size,filesystem /format:csv`,
        (_error, stdout) => {
          if (_error) {
            reject(_error);
            return;
          }

          const lines = stdout.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error('No drive information found'));
            return;
          }

          const headers = lines[0].split(',');
          const values = lines[1].split(',');

          const info = {};
          headers.forEach((header, index) => {
            info[header.toLowerCase().trim()] = values[index] ? values[index].trim() : '';
          });

          // Convert sizes to numbers and calculate usage
          const totalSize = parseInt(info.size) || 0;
          const freeSpace = parseInt(info.freespace) || 0;
          const usedSpace = totalSize - freeSpace;

          resolve({
            drive: info.name || drivePath,
            label: info.volumename || 'Local Disk',
            filesystem: info.filesystem || 'Unknown',
            totalSize,
            freeSpace,
            usedSpace,
            usagePercent: totalSize > 0 ? Math.round((usedSpace / totalSize) * 100) : 0,
          });
        }
      );
    });
  }

  /**
   * Defragment a drive
   */
  async defragmentDrive(driveLetter) {
    return new Promise((resolve, reject) => {
      // Use defrag command
      exec(`defrag ${driveLetter} /O`, (error, stdout, stderr) => {
        if (error) {
          // defrag might return error codes even on success
          if (error.code === 1 && stderr.includes('successfully')) {
            resolve({ success: true, message: stderr });
          } else {
            reject(new Error(`Defragmentation failed: ${error.message}`));
          }
          return;
        }

        resolve({ success: true, message: stdout || 'Defragmentation completed successfully' });
      });
    });
  }

  /**
   * Scan directory for large files and folders
   */
  async scanDirectory(directoryPath, minSizeMB = 100) {
    try {
      const minSizeBytes = minSizeMB * 1024 * 1024;
      const results = {
        largeFiles: [],
        largeFolders: [],
        totalScanned: 0,
      };

      await this.scanDirectoryRecursive(directoryPath, results, minSizeBytes, 0);
      return results;
    } catch (_error) {
      this.logService.log(`Failed to scan directory ${directoryPath}: ${_error.message}`);
      throw _error;
    }
  }

  /**
   * Recursively scan directory
   */
  async scanDirectoryRecursive(dirPath, results, minSizeBytes, depth) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        results.totalScanned++;

        const fullPath = path.join(dirPath, item.name);

        try {
          if (item.isFile()) {
            const stats = await fs.stat(fullPath);
            if (stats.size >= minSizeBytes) {
              results.largeFiles.push({
                path: fullPath,
                size: stats.size,
                sizeMB: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
                modified: stats.mtime,
              });
            }
          } else if (item.isDirectory() && depth < 5) {
            // Limit depth to prevent infinite recursion
            const folderSize = await this.calculateFolderSize(fullPath);
            if (folderSize >= minSizeBytes) {
              results.largeFolders.push({
                path: fullPath,
                size: folderSize,
                sizeMB: Math.round((folderSize / (1024 * 1024)) * 100) / 100,
                itemCount: await this.countItemsInFolder(fullPath),
              });
            }

            // Continue scanning subdirectories
            await this.scanDirectoryRecursive(fullPath, results, minSizeBytes, depth + 1);
          }
        } catch (_error) {
          // Skip inaccessible files/folders
          this.logService.log(`Skipping ${fullPath}: ${_error.message}`);
        }
      }
    } catch (_error) {
      // Skip inaccessible directories
      this.logService.log(`Skipping directory ${dirPath}: ${_error.message}`);
    }
  }

  /**
   * Calculate folder size recursively
   */
  async calculateFolderSize(folderPath) {
    let totalSize = 0;

    try {
      const items = await fs.readdir(folderPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(folderPath, item.name);

        try {
          if (item.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          } else if (item.isDirectory()) {
            totalSize += await this.calculateFolderSize(fullPath);
          }
        } catch {
          // Skip inaccessible items
        }
      }
    } catch (error) {
      // Return 0 for inaccessible folders
    }

    return totalSize;
  }

  /**
   * Count items in folder
   */
  async countItemsInFolder(folderPath) {
    try {
      const items = await fs.readdir(folderPath);
      return items.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get common cleanup targets
   */
  async getCleanupTargets() {
    const targets = [];
    const userProfile = os.homedir();

    // Windows temp folders
    targets.push(
      { path: path.join(os.tmpdir()), name: 'System Temp', type: 'temp' },
      { path: path.join(userProfile, 'AppData', 'Local', 'Temp'), name: 'User Temp', type: 'temp' },
      {
        path: path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache'),
        name: 'Internet Cache',
        type: 'cache',
      },
      {
        path: path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer'),
        name: 'Explorer Temp',
        type: 'temp',
      },
      { path: path.join(userProfile, 'Downloads'), name: 'Downloads', type: 'user' },
      { path: path.join(userProfile, 'Desktop'), name: 'Desktop', type: 'user' }
    );

    // Calculate sizes for each target
    for (const target of targets) {
      try {
        const size = await this.calculateFolderSize(target.path);
        target.size = size;
        target.sizeMB = Math.round((size / (1024 * 1024)) * 100) / 100;
        target.itemCount = await this.countItemsInFolder(target.path);
      } catch (_error) {
        target.size = 0;
        target.sizeMB = 0;
        target.itemCount = 0;
      }
    }

    return targets.filter(target => target.size > 0);
  }

  /**
   * Clean temp files safely
   */
  async cleanTempFiles(targetPaths) {
    const results = {
      cleaned: [],
      failed: [],
      totalSizeFreed: 0,
    };

    for (const targetPath of targetPaths) {
      try {
        const sizeBefore = await this.calculateFolderSize(targetPath);

        // Use Windows cleanmgr for system cleanup
        if (targetPath.includes('Temp') || targetPath.includes('Cache')) {
          await this.runCleanManager(targetPath);
        } else {
          // For user folders, be more selective
          await this.cleanFolderSelective(targetPath);
        }

        const sizeAfter = await this.calculateFolderSize(targetPath);
        const sizeFreed = sizeBefore - sizeAfter;

        results.cleaned.push({
          path: targetPath,
          sizeFreed,
          sizeFreedMB: Math.round((sizeFreed / (1024 * 1024)) * 100) / 100,
        });

        results.totalSizeFreed += sizeFreed;
      } catch (error) {
        results.failed.push({
          path: targetPath,
          error: error.message,
        });
      }
    }

    results.totalSizeFreedMB = Math.round((results.totalSizeFreed / (1024 * 1024)) * 100) / 100;
    return results;
  }

  /**
   * Run Windows Clean Manager
   */
  async runCleanManager(_targetPath) {
    return new Promise((resolve, reject) => {
      // Use cleanmgr.exe for system cleanup
      exec('cleanmgr /sagerun:1', { timeout: 300000 }, (error, _stdout, _stderr) => {
        if (error && error.code !== 0) {
          reject(new Error(`Clean Manager failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clean folder selectively (only old temp files)
   */
  async cleanFolderSelective(folderPath) {
    try {
      const items = await fs.readdir(folderPath, { withFileTypes: true });
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const item of items) {
        const fullPath = path.join(folderPath, item.name);

        try {
          const stats = await fs.stat(fullPath);

          // Only delete files older than 1 week and not currently in use
          if (stats.mtime.getTime() < oneWeekAgo) {
            if (item.isFile()) {
              // Check if file is safe to delete (not exe, dll, etc.)
              const ext = path.extname(item.name).toLowerCase();
              const safeExtensions = ['.tmp', '.temp', '.log', '.old', '.bak'];

              if (safeExtensions.includes(ext) || item.name.toLowerCase().includes('temp')) {
                await fs.unlink(fullPath);
              }
            } else if (item.isDirectory()) {
              // Recursively clean subdirectories
              await this.cleanFolderSelective(fullPath);

              // Remove empty directories
              const remainingItems = await fs.readdir(fullPath);
              if (remainingItems.length === 0) {
                await fs.rmdir(fullPath);
              }
            }
          }
        } catch {
          // Skip files that can't be deleted
        }
      }
    } catch {
      // Skip inaccessible folders
    }
  }

  /**
   * Delete specific files/folders
   */
  async deleteItems(items) {
    const results = {
      deleted: [],
      failed: [],
      totalSizeFreed: 0,
    };

    for (const item of items) {
      try {
        const stats = await fs.stat(item.path);

        if (stats.isFile()) {
          await fs.unlink(item.path);
        } else if (stats.isDirectory()) {
          await fs.rm(item.path, { recursive: true, force: true });
        }

        results.deleted.push({
          path: item.path,
          size: stats.size,
          type: stats.isFile() ? 'file' : 'folder',
        });

        results.totalSizeFreed += stats.size;
      } catch (error) {
        results.failed.push({
          path: item.path,
          error: error.message,
        });
      }
    }

    results.totalSizeFreedMB = Math.round((results.totalSizeFreed / (1024 * 1024)) * 100) / 100;
    return results;
  }
}

module.exports = StorageManagerService;
