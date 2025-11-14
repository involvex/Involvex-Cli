const PackageManagerService = require('../services/PackageManagerService');
const { spawn } = require('child_process');

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock LogService
const mockLogService = {
  log: jest.fn(),
};

describe('PackageManagerService', () => {
  let packageManagerService;
  let runProcessSpy;

  beforeEach(() => {
    packageManagerService = new PackageManagerService(mockLogService);
    mockLogService.log.mockClear();
    spawn.mockClear(); // Clear spawn mock for each test

    // Spy on the internal runProcess method and mock its implementation
    runProcessSpy = jest.spyOn(packageManagerService, 'runProcess');
    runProcessSpy.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  afterEach(() => {
    runProcessSpy.mockRestore(); // Restore original implementation after each test
  });

  describe('isCommandInstalled', () => {
    test('should return true if command is installed', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: 'C:\\path\\to\\command.exe',
        stderr: '',
      });
      const result = await packageManagerService.isCommandInstalled('testcmd');
      expect(result).toBe(true);
      expect(runProcessSpy).toHaveBeenCalledWith('where', ['testcmd']);
    });

    test('should return false if command is not installed', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'INFO: Could not find files for the given pattern(s).',
      });
      const result = await packageManagerService.isCommandInstalled('testcmd');
      expect(result).toBe(false);
    });

    test('should return false and log error if runProcess throws an exception', async () => {
      runProcessSpy.mockRejectedValueOnce(new Error('Process error'));
      const result = await packageManagerService.isCommandInstalled('testcmd');
      expect(result).toBe(false);
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Error checking if testcmd is installed: Process error'
      );
    });
  });

  describe('isWingetInstalled', () => {
    test('should return true if winget is installed', async () => {
      jest.spyOn(packageManagerService, 'isCommandInstalled').mockResolvedValueOnce(true);
      expect(await packageManagerService.isWingetInstalled()).toBe(true);
      expect(packageManagerService.isCommandInstalled).toHaveBeenCalledWith('winget');
    });
  });

  describe('isNpmInstalled', () => {
    test('should return true if npm is installed', async () => {
      jest.spyOn(packageManagerService, 'isCommandInstalled').mockResolvedValueOnce(true);
      expect(await packageManagerService.isNpmInstalled()).toBe(true);
      expect(packageManagerService.isCommandInstalled).toHaveBeenCalledWith('npm');
    });
  });

  describe('isScoopInstalled', () => {
    test('should return true if scoop is installed', async () => {
      jest.spyOn(packageManagerService, 'isCommandInstalled').mockResolvedValueOnce(true);
      expect(await packageManagerService.isScoopInstalled()).toBe(true);
      expect(packageManagerService.isCommandInstalled).toHaveBeenCalledWith('scoop');
    });
  });

  describe('isChocoInstalled', () => {
    test('should return true if choco is installed', async () => {
      jest.spyOn(packageManagerService, 'isCommandInstalled').mockResolvedValueOnce(true);
      expect(await packageManagerService.isChocoInstalled()).toBe(true);
      expect(packageManagerService.isCommandInstalled).toHaveBeenCalledWith('choco');
    });
  });

  describe('isPipInstalled', () => {
    test('should return true if pip is installed via pip command', async () => {
      runProcessSpy.mockResolvedValueOnce({ code: 0, stdout: 'pip 23.0.1', stderr: '' }); // pip --version
      expect(await packageManagerService.isPipInstalled()).toBe(true);
      expect(runProcessSpy).toHaveBeenCalledWith('where', ['pip'], 5000);
    });

    test('should return true if pip is installed via python -m pip', async () => {
      runProcessSpy
        .mockResolvedValueOnce({ code: 1 }) // where pip fails
        .mockResolvedValueOnce({ code: 1 }) // where pip3 fails
        .mockResolvedValueOnce({ code: 0, stdout: 'Python 3.9.0', stderr: '' }) // python --version
        .mockResolvedValueOnce({ code: 0, stdout: 'pip 23.0.1', stderr: '' }); // python -m pip --version

      expect(await packageManagerService.isPipInstalled()).toBe(true);
      expect(runProcessSpy).toHaveBeenCalledWith('python', ['--version'], 5000);
      expect(runProcessSpy).toHaveBeenCalledWith('python', ['-m', 'pip', '--version'], 5000);
    });

    test('should return false if no pip command is found', async () => {
      runProcessSpy.mockResolvedValue({ code: 1, stdout: '', stderr: 'not found' });
      expect(await packageManagerService.isPipInstalled()).toBe(false);
    });
  });

  describe('update commands', () => {
    test('updateWinget should call runUpdateCommand with correct args', async () => {
      const runUpdateCommandSpy = jest
        .spyOn(packageManagerService, 'runUpdateCommand')
        .mockResolvedValueOnce({ code: 0 });
      await packageManagerService.updateWinget();
      expect(runUpdateCommandSpy).toHaveBeenCalledWith('winget', ['update', '--include-unknown']);
    });

    test('updateNpm should call runUpdateCommand with correct args', async () => {
      const runUpdateCommandSpy = jest
        .spyOn(packageManagerService, 'runUpdateCommand')
        .mockResolvedValueOnce({ code: 0 });
      await packageManagerService.updateNpm();
      expect(runUpdateCommandSpy).toHaveBeenCalledWith('npm', ['update', '-g']);
    });

    test('updateScoop should call runUpdateCommand with correct args', async () => {
      const runUpdateCommandSpy = jest
        .spyOn(packageManagerService, 'runUpdateCommand')
        .mockResolvedValueOnce({ code: 0 });
      await packageManagerService.updateScoop();
      expect(runUpdateCommandSpy).toHaveBeenCalledWith('scoop', ['update']);
    });

    test('updateChoco should call runUpdateCommand with correct args', async () => {
      const runUpdateCommandSpy = jest
        .spyOn(packageManagerService, 'runUpdateCommand')
        .mockResolvedValueOnce({ code: 0 });
      await packageManagerService.updateChoco();
      expect(runUpdateCommandSpy).toHaveBeenCalledWith('choco', ['upgrade', 'all', '-y']);
    });
  });

  describe('updatePip', () => {
    test('should update pip and then outdated packages', async () => {
      // Mock isPipInstalled to return true for 'pip'
      jest.spyOn(packageManagerService, 'isPipInstalled').mockResolvedValue(true);

      // Mock runProcess calls in sequence
      runProcessSpy
        .mockResolvedValueOnce({ code: 0, stdout: 'pip 23.0.1', stderr: '' }) // 1. isPipInstalled check (pip --version)
        .mockResolvedValueOnce({ code: 0, stdout: 'pip updated', stderr: '' }) // 2. update pip itself (pip install --upgrade pip)
        .mockResolvedValueOnce({
          code: 0,
          stdout: 'Package Version Latest\n-------\npackageA 1.0 2.0\npackageB 3.0 4.0',
          stderr: '',
        }) // 3. pip list --outdated
        .mockResolvedValueOnce({ code: 0, stdout: 'packageA updated', stderr: '' }) // 4. update packageA
        .mockResolvedValueOnce({ code: 0, stdout: 'packageB updated', stderr: '' }); // 5. update packageB

      await packageManagerService.updatePip();

      // Verify the calls in order
      expect(runProcessSpy).toHaveBeenCalledWith('pip', ['--version'], 5000);
      expect(runProcessSpy).toHaveBeenCalledWith('pip', ['install', '--upgrade', 'pip']);
      expect(runProcessSpy).toHaveBeenCalledWith('pip', ['list', '--outdated'], 30000);
      expect(runProcessSpy).toHaveBeenCalledWith('pip', ['install', '--upgrade', 'packageA']);
      expect(runProcessSpy).toHaveBeenCalledWith('pip', ['install', '--upgrade', 'packageB']);
      expect(mockLogService.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to update')
      );
    });

    test('should log error if updating a specific pip package fails', async () => {
      jest.spyOn(packageManagerService, 'isPipInstalled').mockResolvedValue(true);
      runProcessSpy
        .mockResolvedValueOnce({ code: 0, stdout: 'pip 23.0.1', stderr: '' }) // 1. isPipInstalled check (pip --version)
        .mockResolvedValueOnce({ code: 0, stdout: 'pip updated', stderr: '' }) // 2. pip install --upgrade pip
        .mockResolvedValueOnce({
          code: 0,
          stdout: 'Package Version Latest\n-------\npackageA 1.0 2.0',
          stderr: '',
        }) // 3. pip list --outdated
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'packageA update failed' }); // 4. pip install --upgrade packageA fails

      await packageManagerService.updatePip();

      expect(mockLogService.log).toHaveBeenCalledWith('Error updating pip. Exit Code: 1');
    });

    test('should throw error if no pip installation is found', async () => {
      jest.spyOn(packageManagerService, 'isPipInstalled').mockResolvedValue(false);
      runProcessSpy.mockResolvedValue({ code: 1 }); // All pip checks fail

      await expect(packageManagerService.updatePip()).rejects.toThrow('No pip installation found');
    });
  });

  describe('updatePowerShellModules', () => {
    test('should update PowerShell modules successfully', async () => {
      runProcessSpy
        .mockResolvedValueOnce({ code: 0 }) // Update-Module
        .mockResolvedValueOnce({ code: 0 }); // Update-PSResource

      await packageManagerService.updatePowerShellModules();

      expect(runProcessSpy).toHaveBeenCalledWith('powershell', [
        'Update-Module',
        '-Force',
        '-Confirm:$false',
      ]);
      expect(runProcessSpy).toHaveBeenCalledWith('pwsh', ['Update-PSResource', '-Force']);
      expect(mockLogService.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Error updating PowerShell modules')
      );
    });

    test('should log error if Update-Module fails', async () => {
      runProcessSpy.mockRejectedValueOnce(new Error('Update-Module process error')); // Update-Module fails

      await packageManagerService.updatePowerShellModules();

      expect(mockLogService.log).toHaveBeenCalledWith('Updating PowerShell modules.');
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Error updating PowerShell modules: Update-Module process error'
      );
    });

    test('should log error if Update-PSResource fails', async () => {
      runProcessSpy
        .mockResolvedValueOnce({ code: 0, stdout: 'Update-Module success', stderr: '' }) // Update-Module succeeds
        .mockRejectedValueOnce(new Error('Update-PSResource process error')); // Update-PSResource fails

      await packageManagerService.updatePowerShellModules();

      expect(mockLogService.log).toHaveBeenCalledWith('Updating PowerShell modules.');
      expect(mockLogService.log).toHaveBeenCalledWith(
        'PowerShell 7+ not available or Update-PSResource failed: Update-PSResource process error'
      );
    });
  });

  describe('getAvailableUpdatesAsync', () => {
    beforeEach(() => {
      jest.spyOn(packageManagerService, 'isWingetInstalled').mockResolvedValue(false);
      jest.spyOn(packageManagerService, 'isNpmInstalled').mockResolvedValue(false);
      jest.spyOn(packageManagerService, 'isScoopInstalled').mockResolvedValue(false);
      jest.spyOn(packageManagerService, 'isChocoInstalled').mockResolvedValue(false);
      jest.spyOn(packageManagerService, 'isPipInstalled').mockResolvedValue(false);

      jest.spyOn(packageManagerService, 'getWingetAvailableUpdatesAsync').mockResolvedValue([]);
      jest.spyOn(packageManagerService, 'getNpmAvailableUpdatesAsync').mockResolvedValue([]);
      jest.spyOn(packageManagerService, 'getScoopAvailableUpdatesAsync').mockResolvedValue([]);
      jest.spyOn(packageManagerService, 'getChocoAvailableUpdatesAsync').mockResolvedValue([]);
      jest.spyOn(packageManagerService, 'getPipAvailableUpdatesAsync').mockResolvedValue([]);
    });

    test('should return empty array if no package managers are installed', async () => {
      const updates = await packageManagerService.getAvailableUpdatesAsync();
      expect(updates).toEqual([]);
    });

    test('should return updates from installed package managers', async () => {
      packageManagerService.isWingetInstalled.mockResolvedValue(true);
      packageManagerService.isNpmInstalled.mockResolvedValue(true);

      packageManagerService.getWingetAvailableUpdatesAsync.mockResolvedValue([
        { packageManager: 'winget', packageName: 'App1' },
      ]);
      packageManagerService.getNpmAvailableUpdatesAsync.mockResolvedValue([
        { packageManager: 'npm', packageName: 'Lib1' },
      ]);

      const updates = await packageManagerService.getAvailableUpdatesAsync();
      expect(updates).toEqual([
        { packageManager: 'winget', packageName: 'App1' },
        { packageManager: 'npm', packageName: 'Lib1' },
      ]);
    });

    test('should log errors if getting updates for a manager fails', async () => {
      packageManagerService.isWingetInstalled.mockResolvedValue(true);
      packageManagerService.getWingetAvailableUpdatesAsync.mockRejectedValue(
        new Error('Winget error')
      );

      const updates = await packageManagerService.getAvailableUpdatesAsync();
      expect(updates).toEqual([]);
      expect(mockLogService.log).toHaveBeenCalledWith('Error getting winget updates: Winget error');
    });
  });

  describe('getWingetAvailableUpdatesAsync', () => {
    test('should parse winget output correctly', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: `Name                 Id               Version          Available        Source
------------------------------------------------------------------------------------
Microsoft Visual C++ 2015-2019 Redist Microsoft.VC++2015-2019Redist-x64 14.29.30139.0  14.30.30704.0  winget
PowerToys            Microsoft.PowerToys  0.51.1           0.53.0           winget`,
        stderr: '',
      });

      const updates = await packageManagerService.getWingetAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'winget',
          packageName: 'Microsoft Visual C++ 2015-2019 Redist',
          packageId: 'Microsoft.VC++2015-2019Redist-x64',
          currentVersion: '14.29.30139.0',
          availableVersion: '14.30.30704.0',
        },
        {
          packageManager: 'winget',
          packageName: 'PowerToys',
          packageId: 'Microsoft.PowerToys',
          currentVersion: '0.51.1',
          availableVersion: '0.53.0',
        },
      ]);
    });

    test('should return null if winget command fails', async () => {
      runProcessSpy.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'winget error' });
      const updates = await packageManagerService.getWingetAvailableUpdatesAsync();
      expect(updates).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Winget command failed with code 1: winget error'
      );
    });
  });

  describe('getNpmAvailableUpdatesAsync', () => {
    test('should parse npm outdated output correctly', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 1, // npm outdated returns 1 if there are outdated packages
        stdout: `Package        Current  Wanted  Latest  Location
commander      11.1.0   11.1.0  14.0.2  node_modules/commander
inquirer       9.3.8    9.3.8   12.1.0  node_modules/inquirer`,
        stderr: '',
      });

      const updates = await packageManagerService.getNpmAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'npm',
          packageName: 'commander',
          currentVersion: '11.1.0',
          availableVersion: '14.0.2',
        },
        {
          packageManager: 'npm',
          packageName: 'inquirer',
          currentVersion: '9.3.8',
          availableVersion: '12.1.0',
        },
      ]);
    });

    test('should return empty array if npm command fails but no updates are found', async () => {
      runProcessSpy.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'npm error' });
      const updates = await packageManagerService.getNpmAvailableUpdatesAsync();
      expect(updates).toEqual([]);
    });
  });

  describe('getScoopAvailableUpdatesAsync', () => {
    test('should parse scoop status output correctly', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: `App     Version  Available
---     -------  ---------
7zip    21.07    22.01
git     2.34.1   2.35.1`,
        stderr: '',
      });

      const updates = await packageManagerService.getScoopAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'scoop',
          packageName: '7zip',
          currentVersion: '21.07',
          availableVersion: '22.01',
        },
        {
          packageManager: 'scoop',
          packageName: 'git',
          currentVersion: '2.34.1',
          availableVersion: '2.35.1',
        },
      ]);
    });

    test('should return null if scoop command fails', async () => {
      runProcessSpy.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'scoop error' });
      const updates = await packageManagerService.getScoopAvailableUpdatesAsync();
      expect(updates).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Error getting scoop available updates: Scoop command failed with code 1: scoop error'
      );
    });
  });

  describe('getChocoAvailableUpdatesAsync', () => {
    test('should parse choco outdated output correctly', async () => {
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: `Chocolatey v1.1.0
packageA|1.0.0|2.0.0|
packageB|3.0.0|4.0.0|`,
        stderr: '',
      });

      const updates = await packageManagerService.getChocoAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'choco',
          packageName: 'packageA',
          currentVersion: '1.0.0',
          availableVersion: '2.0.0',
        },
        {
          packageManager: 'choco',
          packageName: 'packageB',
          currentVersion: '3.0.0',
          availableVersion: '4.0.0',
        },
      ]);
    });

    test('should return null if choco command fails', async () => {
      runProcessSpy.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'choco error' });
      const updates = await packageManagerService.getChocoAvailableUpdatesAsync();
      expect(updates).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        'Error getting choco available updates: Choco command failed with code 1: choco error'
      );
    });
  });

  describe('getPipAvailableUpdatesAsync', () => {
    test('should parse pip outdated output (JSON format) correctly', async () => {
      // Mock runProcess for the first successful pip command (e.g., 'pip')
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: 'pip 20.0.0',
        stderr: '',
      });
      // Mock the JSON format pip list --outdated command
      runProcessSpy.mockResolvedValueOnce({
        code: 0,
        stdout: `[{"name": "pip_packageA", "version": "1.0", "latest_version": "2.0"}, {"name": "pip_packageB", "version": "3.0", "latest_version": "4.0"}]`,
        stderr: '',
      });

      const updates = await packageManagerService.getPipAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'pip',
          packageName: 'pip_packageA',
          currentVersion: '1.0',
          availableVersion: '2.0',
        },
        {
          packageManager: 'pip',
          packageName: 'pip_packageB',
          currentVersion: '3.0',
          availableVersion: '4.0',
        },
      ]);
    });

    test('should parse pip outdated output (text format) correctly if JSON fails', async () => {
      // Mock runProcess: first call is --version check, second is JSON command that fails, third is text command
      runProcessSpy
        .mockResolvedValueOnce({
          code: 0,
          stdout: 'pip 20.0.0',
          stderr: '',
        })
        .mockResolvedValueOnce({
          code: 1,
          stdout: '',
          stderr: 'JSON format not supported',
        })
        .mockResolvedValueOnce({
          code: 0,
          stdout: `Package    Version Latest
---------- ------- ------
pip_packageA 1.0     2.0
pip_packageB 3.0     4.0`,
          stderr: '',
        });

      const updates = await packageManagerService.getPipAvailableUpdatesAsync();
      expect(updates).toEqual([
        {
          packageManager: 'pip',
          packageName: 'pip_packageA',
          currentVersion: '1.0',
          availableVersion: '2.0',
        },
        {
          packageManager: 'pip',
          packageName: 'pip_packageB',
          currentVersion: '3.0',
          availableVersion: '4.0',
        },
      ]);
    });

    test('should return null if pip command fails', async () => {
      // Mock all runProcess calls within the loop to fail
      runProcessSpy
        .mockRejectedValueOnce(new Error('pip --version failed')) // pip --version for 'pip'
        .mockRejectedValueOnce(new Error('pip3 --version failed')) // pip --version for 'pip3'
        .mockRejectedValueOnce(new Error('python --version failed')) // python --version for 'python -m pip'
        .mockRejectedValueOnce(new Error('python -m pip --version failed')) // python -m pip --version for 'python -m pip'
        .mockRejectedValueOnce(new Error('python3 --version failed')) // python --version for 'python3 -m pip'
        .mockRejectedValueOnce(new Error('python3 -m pip --version failed')); // python3 -m pip --version for 'python3 -m pip'

      const updates = await packageManagerService.getPipAvailableUpdatesAsync();
      expect(updates).toBeNull();
      expect(mockLogService.log).toHaveBeenCalledWith(
        expect.stringContaining('Trying next pip command:')
      );
      expect(mockLogService.log).toHaveBeenCalledTimes(4); // 4 attempts, each logs "Trying next pip command"
    });
  });
});
