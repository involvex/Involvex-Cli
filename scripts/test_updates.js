const PackageManagerService = require("./services/PackageManagerService");
const LogService = require("./services/LogService");

async function testUpdates() {
  const logService = new LogService();
  const packageManagerService = new PackageManagerService(logService);

  console.log("Testing package manager availability...");

  const winget = await packageManagerService.isWingetInstalled();
  const npm = await packageManagerService.isNpmInstalled();
  const scoop = await packageManagerService.isScoopInstalled();
  const choco = await packageManagerService.isChocoInstalled();
  const pip = await packageManagerService.isPipInstalled();

  console.log(`Winget installed: ${winget}`);
  console.log(`NPM installed: ${npm}`);
  console.log(`Scoop installed: ${scoop}`);
  console.log(`Chocolatey installed: ${choco}`);
  console.log(`Pip installed: ${pip}`);

  console.log("\nTesting update checks...");

  try {
    const updates = await packageManagerService.getAvailableUpdatesAsync();
    console.log(`Found ${updates.length} updates:`);
    updates.forEach(update => {
      console.log(
        `${update.packageManager}: ${update.packageName} (${update.currentVersion} → ${update.availableVersion})`,
      );
    });
  } catch (error) {
    console.error("Error getting updates:", error.message);
  }
}

testUpdates().catch(console.error);
