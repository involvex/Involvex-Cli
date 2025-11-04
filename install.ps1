# InvolveX CLI Installer
# Downloads and installs the latest version of InvolveX CLI from GitHub releases

param(
    [switch]$Install,
    [switch]$Run,
    [switch]$Uninstall,
    [string]$InstallPath = "$env:USERPROFILE\InvolveX-CLI",
    [switch]$AddToPath,
    [switch]$CreateShortcut,
    [switch]$Interactive
)

$ErrorActionPreference = "Stop"

# Configuration
$RepoOwner = "involvex"
$RepoName = "Involvex-Cli"
$AssetNamePattern = "InvolveX-CLI-*.zip"
$ExecutableName = "InvolveX.Cli.exe"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Get-LatestRelease {
    Write-ColorOutput "Fetching latest release information..." "Yellow"

    try {
        $apiUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
        $response = Invoke-RestMethod -Uri $apiUrl -Method Get

        $asset = $response.assets | Where-Object { $_.name -like $AssetNamePattern } | Select-Object -First 1

        if (-not $asset) {
            throw "No suitable release asset found matching pattern: $AssetNamePattern"
        }

        return @{
            Version = $response.tag_name
            DownloadUrl = $asset.browser_download_url
            Size = $asset.size
        }
    }
    catch {
        throw "Failed to fetch release information: $($_.Exception.Message)"
    }
}

function Download-AndExtract {
    param([string]$DownloadUrl, [string]$ExtractPath)

    Write-ColorOutput "Downloading InvolveX CLI..." "Yellow"

    $tempFile = [System.IO.Path]::GetTempFileName() + ".zip"

    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $tempFile -UseBasicParsing

        Write-ColorOutput "Extracting files..." "Yellow"

        if (Test-Path $ExtractPath) {
            Remove-Item $ExtractPath -Recurse -Force
        }

        Expand-Archive -Path $tempFile -DestinationPath $ExtractPath -Force

        Write-ColorOutput "Installation completed successfully!" "Green"
        Write-ColorOutput "Installed to: $ExtractPath" "Cyan"
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

function Add-ToPath {
    param([string]$PathToAdd)

    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

    if ($currentPath -notlike "*$PathToAdd*") {
        $newPath = "$currentPath;$PathToAdd"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-ColorOutput "Added to PATH: $PathToAdd" "Green"
        Write-ColorOutput "Please restart your terminal for PATH changes to take effect." "Yellow"
    } else {
        Write-ColorOutput "Already in PATH: $PathToAdd" "Cyan"
    }
}

function Create-DesktopShortcut {
    param([string]$TargetPath, [string]$ShortcutName = "InvolveX CLI")

    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "$ShortcutName.lnk"

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = Split-Path $TargetPath
    $shortcut.Description = "InvolveX CLI - Windows System Administration Toolkit"
    $shortcut.Save()

    Write-ColorOutput "Desktop shortcut created: $shortcutPath" "Green"
}

function Install-InvolveX {
    try {
        # Check if running as administrator (some operations might need it)
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Write-ColorOutput "Note: Some features may require administrator privileges when running the CLI." "Yellow"
        }

        # Get latest release info
        $release = Get-LatestRelease
        Write-ColorOutput "Latest version: $($release.Version)" "Cyan"
        Write-ColorOutput "Download size: $([math]::Round($release.Size / 1MB, 2)) MB" "Cyan"

        # Download and extract
        Download-AndExtract -DownloadUrl $release.DownloadUrl -ExtractPath $InstallPath

        # Add to PATH if requested
        if ($AddToPath) {
            Add-ToPath -PathToAdd $InstallPath
        }

        # Create desktop shortcut if requested
        if ($CreateShortcut) {
            $exePath = Join-Path $InstallPath $ExecutableName
            Create-DesktopShortcut -TargetPath $exePath
        }

        # Show usage instructions
        Write-ColorOutput "`nInstallation Summary:" "Green"
        Write-ColorOutput "==================" "Green"
        Write-ColorOutput "Version: $($release.Version)" "White"
        Write-ColorOutput "Location: $InstallPath" "White"
        Write-ColorOutput "Executable: $(Join-Path $InstallPath $ExecutableName)" "White"

        if ($AddToPath) {
            Write-ColorOutput "Added to PATH: Yes" "White"
        }

        if ($CreateShortcut) {
            Write-ColorOutput "Desktop Shortcut: Yes" "White"
        }

        Write-ColorOutput "`nTo run InvolveX CLI:" "Cyan"
        if ($AddToPath) {
            Write-ColorOutput "  involvex-cli" "White"
        } else {
            Write-ColorOutput "  & '$InstallPath\$ExecutableName'" "White"
        }

        Write-ColorOutput "`nFor help and documentation, visit:" "Cyan"
        Write-ColorOutput "  https://github.com/$RepoOwner/$RepoName" "White"

        # Run the application immediately if requested
        if ($Run) {
            $exePath = Join-Path $InstallPath $ExecutableName
            if (Test-Path $exePath) {
                Write-ColorOutput "`nLaunching InvolveX CLI..." "Green"
                try {
                    & $exePath
                }
                catch {
                    Write-ColorOutput "Failed to launch application: $($_.Exception.Message)" "Red"
                }
            } else {
                Write-ColorOutput "Warning: Could not find executable at $exePath" "Yellow"
            }
        }

    }
    catch {
        Write-ColorOutput "Installation failed: $($_.Exception.Message)" "Red"
        exit 1
    }
}

function Uninstall-InvolveX {
    try {
        if (Test-Path $InstallPath) {
            Write-ColorOutput "Removing InvolveX CLI from: $InstallPath" "Yellow"
            Remove-Item $InstallPath -Recurse -Force
            Write-ColorOutput "Uninstallation completed successfully!" "Green"
        } else {
            Write-ColorOutput "InvolveX CLI not found at: $InstallPath" "Yellow"
        }

        # Remove from PATH if it exists
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -like "*$InstallPath*") {
            $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $InstallPath }) -join ';'
            [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
            Write-ColorOutput "Removed from PATH: $InstallPath" "Green"
        }

        # Remove desktop shortcut
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = Join-Path $desktopPath "InvolveX CLI.lnk"
        if (Test-Path $shortcutPath) {
            Remove-Item $shortcutPath -Force
            Write-ColorOutput "Removed desktop shortcut" "Green"
        }

    }
    catch {
        Write-ColorOutput "Uninstallation failed: $($_.Exception.Message)" "Red"
        exit 1
    }
}

function Show-InteractiveMenu {
    Write-ColorOutput "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                 InvolveX CLI Installer                      ║" "Cyan"
    Write-ColorOutput "║                 Interactive Setup                           ║" "Cyan"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-ColorOutput ""

    Write-ColorOutput "Welcome to the InvolveX CLI interactive installer!" "Green"
    Write-ColorOutput "This tool will help you install or manage InvolveX CLI." "White"
    Write-ColorOutput ""

    # Main menu loop
    while ($true) {
        Write-ColorOutput "Please select an option:" "Yellow"
        Write-ColorOutput "1. Install InvolveX CLI" "White"
        Write-ColorOutput "2. Uninstall InvolveX CLI" "White"
        Write-ColorOutput "3. Check current installation" "White"
        Write-ColorOutput "4. Show help" "White"
        Write-ColorOutput "5. Exit" "White"
        Write-ColorOutput ""

        $choice = Read-Host "Enter your choice (1-5)"

        switch ($choice) {
            "1" { Start-InteractiveInstall }
            "2" { Start-InteractiveUninstall }
            "3" { Show-InstallationStatus }
            "4" { Show-InteractiveHelp }
            "5" {
                Write-ColorOutput "Goodbye!" "Green"
                return
            }
            default {
                Write-ColorOutput "Invalid choice. Please select 1-5." "Red"
                Start-Sleep -Seconds 1
            }
        }
        Write-ColorOutput ""
    }
}

function Start-InteractiveInstall {
    Write-ColorOutput "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                    Install InvolveX CLI                     ║" "Cyan"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-ColorOutput ""

    # Get installation path
    $defaultPath = "$env:USERPROFILE\InvolveX-CLI"
    Write-ColorOutput "Installation Path:" "Yellow"
    Write-ColorOutput "Default: $defaultPath" "White"
    $customPath = Read-Host "Enter custom path (or press Enter for default)"
    $installPath = if ($customPath) { $customPath } else { $defaultPath }

    # Confirm path creation
    if (-not (Test-Path (Split-Path $installPath))) {
        Write-ColorOutput "Warning: Parent directory doesn't exist. Create it? (Y/N)" "Yellow"
        $createDir = Read-Host
        if ($createDir -ne "Y" -and $createDir -ne "y") {
            Write-ColorOutput "Installation cancelled." "Red"
            return
        }
    }

    # Installation options
    Write-ColorOutput "`nInstallation Options:" "Yellow"

    $addToPath = Get-UserConfirmation "Add InvolveX CLI to PATH environment variable?" "This allows running 'involvex-cli' from any command prompt"
    $createShortcut = Get-UserConfirmation "Create desktop shortcut?" "Creates a shortcut on your desktop for easy access"
    $runAfterInstall = Get-UserConfirmation "Run InvolveX CLI after installation?" "Starts the application immediately after installation completes"

    # Show summary
    Write-ColorOutput "`nInstallation Summary:" "Green"
    Write-ColorOutput "==================" "Green"
    Write-ColorOutput "Install Path: $installPath" "White"
    Write-ColorOutput "Add to PATH: $(if ($addToPath) { "Yes" } else { "No" })" "White"
    Write-ColorOutput "Create Shortcut: $(if ($createShortcut) { "Yes" } else { "No" })" "White"
    Write-ColorOutput "Run After Install: $(if ($runAfterInstall) { "Yes" } else { "No" })" "White"
    Write-ColorOutput ""

    if (-not (Get-UserConfirmation "Proceed with installation?" "This will download and install InvolveX CLI")) {
        Write-ColorOutput "Installation cancelled." "Red"
        return
    }

    # Perform installation with selected options
    try {
        # Temporarily set script parameters for Install-InvolveX function
        $script:AddToPath = $addToPath
        $script:CreateShortcut = $createShortcut
        $script:Run = $runAfterInstall
        $script:InstallPath = $installPath

        Install-InvolveX
    }
    catch {
        Write-ColorOutput "Installation failed: $($_.Exception.Message)" "Red"
    }
    finally {
        # Clean up script variables
        Remove-Variable -Name AddToPath -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name CreateShortcut -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name Run -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name InstallPath -Scope Script -ErrorAction SilentlyContinue
    }
}

function Start-InteractiveUninstall {
    Write-ColorOutput "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                   Uninstall InvolveX CLI                    ║" "Cyan"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-ColorOutput ""

    # Check if installed
    $defaultPath = "$env:USERPROFILE\InvolveX-CLI"
    if (-not (Test-Path $defaultPath)) {
        Write-ColorOutput "InvolveX CLI is not installed in the default location ($defaultPath)." "Yellow"
        $customPath = Read-Host "Enter custom installation path (or press Enter to cancel)"
        if (-not $customPath -or -not (Test-Path $customPath)) {
            Write-ColorOutput "Uninstallation cancelled." "Red"
            return
        }
        $script:InstallPath = $customPath
    }

    Write-ColorOutput "This will remove InvolveX CLI and all associated files." "Yellow"
    Write-ColorOutput "The following will be removed:" "White"
    Write-ColorOutput "- Installation directory" "White"
    Write-ColorOutput "- PATH environment variable entry (if present)" "White"
    Write-ColorOutput "- Desktop shortcut (if present)" "White"
    Write-ColorOutput ""

    if (-not (Get-UserConfirmation "Are you sure you want to uninstall InvolveX CLI?" "This action cannot be undone")) {
        Write-ColorOutput "Uninstallation cancelled." "Red"
        return
    }

    try {
        Uninstall-InvolveX
    }
    catch {
        Write-ColorOutput "Uninstallation failed: $($_.Exception.Message)" "Red"
    }
    finally {
        Remove-Variable -Name InstallPath -Scope Script -ErrorAction SilentlyContinue
    }
}

function Show-InstallationStatus {
    Write-ColorOutput "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                Installation Status                          ║" "Cyan"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-ColorOutput ""

    $defaultPath = "$env:USERPROFILE\InvolveX-CLI"
    $exePath = Join-Path $defaultPath $ExecutableName

    Write-ColorOutput "Checking installation status..." "Yellow"
    Write-ColorOutput ""

    # Check installation directory
    if (Test-Path $defaultPath) {
        Write-ColorOutput "✓ Installation directory found: $defaultPath" "Green"

        # Check executable
        if (Test-Path $exePath) {
            Write-ColorOutput "✓ Executable found: $exePath" "Green"

            # Try to get version (this is a simple check)
            try {
                $version = Get-Command $exePath -ErrorAction Stop | Select-Object -ExpandProperty Version -ErrorAction SilentlyContinue
                if ($version) {
                    Write-ColorOutput "✓ Version: $version" "Green"
                }
            }
            catch {
                Write-ColorOutput "⚠ Could not determine version" "Yellow"
            }
        } else {
            Write-ColorOutput "✗ Executable not found: $exePath" "Red"
        }
    } else {
        Write-ColorOutput "✗ Installation directory not found: $defaultPath" "Red"
        Write-ColorOutput "InvolveX CLI does not appear to be installed." "Yellow"
    }

    # Check PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -like "*$defaultPath*") {
        Write-ColorOutput "✓ Added to PATH: Yes" "Green"
    } else {
        Write-ColorOutput "⚠ Not in PATH (use 'involvex-cli' command)" "Yellow"
    }

    # Check desktop shortcut
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "InvolveX CLI.lnk"
    if (Test-Path $shortcutPath) {
        Write-ColorOutput "✓ Desktop shortcut found: $shortcutPath" "Green"
    } else {
        Write-ColorOutput "⚠ Desktop shortcut not found" "Yellow"
    }

    Write-ColorOutput ""
    Write-ColorOutput "Press any key to continue..." "Cyan"
    $null = Read-Host
}

function Show-InteractiveHelp {
    Write-ColorOutput "╔══════════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║                        Help                                ║" "Cyan"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════════╝" "Cyan"
    Write-ColorOutput ""

    Write-ColorOutput "InvolveX CLI is a Windows System Administration Toolkit" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "Features:" "Yellow"
    Write-ColorOutput "• Package manager updates (winget, npm, scoop, choco)" "White"
    Write-ColorOutput "• System cache management" "White"
    Write-ColorOutput "• Startup program management" "White"
    Write-ColorOutput "• Program uninstallation" "White"
    Write-ColorOutput "• DNS configuration" "White"
    Write-ColorOutput "• Network diagnostics (ping, speed test)" "White"
    Write-ColorOutput "• Driver management" "White"
    Write-ColorOutput "• System restore points" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Installation Options:" "Yellow"
    Write-ColorOutput "• Add to PATH: Allows running from any command prompt" "White"
    Write-ColorOutput "• Desktop Shortcut: Quick access from desktop" "White"
    Write-ColorOutput "• Run After Install: Launch immediately after installation" "White"
    Write-ColorOutput ""
    Write-ColorOutput "For more information, visit:" "Cyan"
    Write-ColorOutput "https://github.com/$RepoOwner/$RepoName" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Press any key to continue..." "Cyan"
    $null = Read-Host
}

function Get-UserConfirmation {
    param(
        [string]$Prompt,
        [string]$Description = ""
    )

    if ($Description) {
        Write-ColorOutput "$Prompt" "White"
        Write-ColorOutput "($Description)" "Gray"
    } else {
        Write-ColorOutput "$Prompt (Y/N)" "White"
    }

    while ($true) {
        $response = Read-Host
        switch ($response.ToLower()) {
            "y" { return $true }
            "yes" { return $true }
            "n" { return $false }
            "no" { return $false }
            default {
                Write-ColorOutput "Please enter Y or N." "Red"
            }
        }
    }
}

function Show-Help {
    Write-ColorOutput "InvolveX CLI Installer" "Green"
    Write-ColorOutput "====================" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "Usage:" "Cyan"
    Write-ColorOutput "  .\install.ps1 -Install [-InstallPath <path>] [-AddToPath] [-CreateShortcut] [-Run]" "White"
    Write-ColorOutput "  .\install.ps1 -Uninstall [-InstallPath <path>]" "White"
    Write-ColorOutput "  .\install.ps1 -Interactive" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Parameters:" "Cyan"
    Write-ColorOutput "  -Install          Install the latest version of InvolveX CLI" "White"
    Write-ColorOutput "  -Run              Run the application immediately after installation" "White"
    Write-ColorOutput "  -Uninstall        Uninstall InvolveX CLI" "White"
    Write-ColorOutput "  -Interactive      Run installer in interactive mode" "White"
    Write-ColorOutput "  -InstallPath      Installation directory (default: %USERPROFILE%\InvolveX-CLI)" "White"
    Write-ColorOutput "  -AddToPath        Add installation directory to user PATH" "White"
    Write-ColorOutput "  -CreateShortcut   Create desktop shortcut" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Cyan"
    Write-ColorOutput "  .\install.ps1 -Install" "White"
    Write-ColorOutput "  .\install.ps1 -Install -Run" "White"
    Write-ColorOutput "  .\install.ps1 -Install -AddToPath -CreateShortcut -Run" "White"
    Write-ColorOutput "  .\install.ps1 -Install -InstallPath 'C:\Tools\InvolveX'" "White"
    Write-ColorOutput "  .\install.ps1 -Interactive" "White"
    Write-ColorOutput "  .\install.ps1 -Uninstall" "White"
}

# Main execution
if ($Interactive) {
    Show-InteractiveMenu
} elseif ($Install) {
    Install-InvolveX
} elseif ($Uninstall) {
    Uninstall-InvolveX
} else {
    Show-Help
}
