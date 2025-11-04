# InvolveX CLI Installer
# Downloads and installs the latest version of InvolveX CLI from GitHub releases

param(
    [switch]$Install,
    [switch]$Run,
    [switch]$Uninstall,
    [string]$InstallPath = "$env:USERPROFILE\InvolveX-CLI",
    [switch]$AddToPath,
    [switch]$CreateShortcut
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

function Show-Help {
    Write-ColorOutput "InvolveX CLI Installer" "Green"
    Write-ColorOutput "====================" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "Usage:" "Cyan"
    Write-ColorOutput "  .\install.ps1 -Install [-InstallPath <path>] [-AddToPath] [-CreateShortcut] [-Run]" "White"
    Write-ColorOutput "  .\install.ps1 -Uninstall [-InstallPath <path>]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Parameters:" "Cyan"
    Write-ColorOutput "  -Install          Install the latest version of InvolveX CLI" "White"
    Write-ColorOutput "  -Run              Run the application immediately after installation" "White"
    Write-ColorOutput "  -Uninstall        Uninstall InvolveX CLI" "White"
    Write-ColorOutput "  -InstallPath      Installation directory (default: %USERPROFILE%\InvolveX-CLI)" "White"
    Write-ColorOutput "  -AddToPath        Add installation directory to user PATH" "White"
    Write-ColorOutput "  -CreateShortcut   Create desktop shortcut" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Cyan"
    Write-ColorOutput "  .\install.ps1 -Install" "White"
    Write-ColorOutput "  .\install.ps1 -Install -Run" "White"
    Write-ColorOutput "  .\install.ps1 -Install -AddToPath -CreateShortcut -Run" "White"
    Write-ColorOutput "  .\install.ps1 -Install -InstallPath 'C:\Tools\InvolveX'" "White"
    Write-ColorOutput "  .\install.ps1 -Uninstall" "White"
}

# Main execution
if ($Install) {
    Install-InvolveX
} elseif ($Uninstall) {
    Uninstall-InvolveX
} else {
    Show-Help
}
