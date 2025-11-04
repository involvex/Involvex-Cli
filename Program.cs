using Terminal.Gui;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using InvolveX.Cli.Services;

using System.Runtime.Versioning;

namespace InvolveX.Cli
{
    [SupportedOSPlatform("windows")]
    class Program
    {
        static LogService _logService = new LogService(); // Instantiate LogService once

        static async Task Main(string[] args)
        {
            Application.Init();
            var top = Application.Top;

            // Define custom color scheme
            var greenOnBlack = new ColorScheme()
            {
                Normal = Application.Driver.MakeAttribute(Color.Green, Color.Black),
                Focus = Application.Driver.MakeAttribute(Color.BrightGreen, Color.Black),
                HotNormal = Application.Driver.MakeAttribute(Color.Green, Color.Black),
                HotFocus = Application.Driver.MakeAttribute(Color.BrightGreen, Color.Black),
                Disabled = Application.Driver.MakeAttribute(Color.DarkGray, Color.Black)
            };
            Application.Current.ColorScheme = greenOnBlack;
            Colors.Dialog = greenOnBlack; // Apply to dialogs as well
            Colors.Base = greenOnBlack; // Apply to base elements

            var menu = new MenuBar(new MenuBarItem[] {
                new MenuBarItem("_File", new MenuItem [] {
                    new MenuItem("_Quit", "", () => { Application.RequestStop(); })
                }),
                new MenuBarItem("_Help", new MenuItem [] {
                    new MenuItem("_About", "", () => MessageBox.Query ("About", "InvolveX CLI (C# Edition)", "Ok")),
                    new MenuItem("_Support", "", ShowSupportInfo) // New Support menu item
                }),
            });
            top.Add(menu);

            var win = new Window("InvolveX CLI")
            {
                X = 0,
                Y = 1, // Leave one row for the menu bar
                Width = Dim.Fill(),
                Height = Dim.Fill() - 1 // Leave one row for the status bar
            };
            top.Add(win);

            var statusBar = new StatusBar(new StatusItem[] {
                new StatusItem(Key.F9, "~F9~ Help", () => MessageBox.Query ("Help", "Help content goes here", "Ok")),
                new StatusItem(Key.F10, "~F10~ Quit", () => Application.RequestStop())
            });
            top.Add(statusBar);

            // Add global key handler for F10 to ensure it works from anywhere
            top.KeyDown += (e) => {
                if (e.KeyEvent.Key == Key.F10) {
                    Application.RequestStop();
                    e.Handled = true;
                }
            };

            // InvolveX ASCII art logo
            var logo = new Label()
            {
                X = Pos.Center(),
                Y = 0, // Position at the top of the window
                Text = "██╗███╗   ██╗██╗   ██╗ ██████╗ ██╗     ██╗   ██╗███████╗██╗  ██╗\n" +
                       "██║████╗  ██║██║   ██║██╔═══██╗██║     ██║   ██║██╔════╝╚██╗██╔╝\n" +
                       "██║██╔██╗ ██║██║   ██║██║   ██║██║     ██║   ██║█████╗   ╚███╔╝\n" +
                       "██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██║     ╚██╗ ██╔╝██╔══╝   ██╔██╗\n" +
                       "██║██║ ╚████║ ╚████╔╝ ╚██████╔╝███████╗ ╚████╔╝ ███████╗██╔╝ ██╗\n" +
                       "╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝\n" +
                       "                                                                          \n" +
                       "              Windows System Administration Toolkit                      \n" +
                       "                                                                          ",
                ColorScheme = greenOnBlack // Apply the custom color scheme to the logo
            };
            win.Add(logo);

            var menuItems = new List<string>
            {
                "Update",
                "Cache",
                "Startup",
                "Uninstall",
                "DNS",
                "Network",
                "Driver",
                "Exit"
            };

            var listView = new ListView(menuItems)
            {
                X = Pos.Center(), // Center the list view
                Y = Pos.Bottom(logo) + 1, // Position below the logo with some padding
                Width = Dim.Width(logo), // Match width of the logo
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = greenOnBlack // Apply the custom color scheme to the list view
            };
            win.Add(listView);

            listView.OpenSelectedItem += async (args) => // Changed to async
            {
                var selected = menuItems[args.Item];
                switch (selected)
                {
                    case "Update":
                        await ShowUpdateMenu(); // Call async method
                        break;
                    case "Cache":
                        await ShowCacheSubmenu(); // Call async method
                        break;
                    case "Startup":
                        await ShowStartupSubmenu(); // New submenu
                        break;
                    case "Uninstall":
                        await ShowUninstallSubmenu(); // New submenu
                        break;
                    case "DNS":
                        await ShowDnsSubmenu(); // New submenu
                        break;
                    case "Network":
                        await ShowNetworkSubmenu(); // New submenu
                        break;
                    case "Driver":
                        await ShowDriverSubmenu(); // New submenu
                        break;
                    case "Exit":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(); // Run the application on the main thread
            Application.Shutdown();
        }

        // --- Submenu Methods ---

        static async Task ShowUpdateMenu()
        {
            var packageManagerService = new PackageManagerService(_logService);

            // Check which package managers are available
            var availableManagers = new List<string>();
            try
            {
                var checks = await Task.WhenAll(
                    packageManagerService.IsWingetInstalled(),
                    packageManagerService.IsNpmInstalled(),
                    packageManagerService.IsScoopInstalled(),
                    packageManagerService.IsChocoInstalled()
                );

                if (checks[0]) availableManagers.Add("winget");
                if (checks[1]) availableManagers.Add("npm");
                if (checks[2]) availableManagers.Add("scoop");
                if (checks[3]) availableManagers.Add("choco");
            }
            catch (Exception ex)
            {
                MessageBox.ErrorQuery("Error", $"Error checking package managers: {ex.Message}", "Ok");
                return;
            }

            if (availableManagers.Count == 0)
            {
                MessageBox.ErrorQuery("No Package Managers", "No supported package managers found on this system.", "Ok");
                return;
            }

            // Create update options menu
            var updateOptions = new List<string>();
            updateOptions.AddRange(availableManagers);
            updateOptions.Add("PowerShell Modules");
            updateOptions.Add("Update All");
            updateOptions.Add("Back");

            var updateDialog = new Dialog("Update Package Managers", 60, 15)
            {
                ColorScheme = Colors.Dialog
            };

            var updateListView = new ListView(updateOptions)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            updateDialog.Add(updateListView);

            updateListView.OpenSelectedItem += (args) =>
            {
                var selected = updateOptions[args.Item];
                switch (selected)
                {
                    case "winget":
                        RunPackageManagerUpdateSync("winget", () => packageManagerService.UpdateWinget());
                        break;
                    case "npm":
                        RunPackageManagerUpdateSync("npm", () => packageManagerService.UpdateNpm());
                        break;
                    case "scoop":
                        RunPackageManagerUpdateSync("scoop", () => packageManagerService.UpdateScoop());
                        break;
                    case "choco":
                        RunPackageManagerUpdateSync("choco", () => packageManagerService.UpdateChoco());
                        break;
                    case "PowerShell Modules":
                        RunPackageManagerUpdateSync("PowerShell Modules", () => packageManagerService.UpdatePowerShellModules());
                        break;
                    case "Update All":
                        RunUpdateAllSync(availableManagers, packageManagerService);
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(updateDialog);
        }

        static void RunPackageManagerUpdateSync(string managerName, Func<Task> updateAction)
        {
            var progressDialog = new Dialog($"Updating {managerName}...", 50, 8)
            {
                ColorScheme = Colors.Dialog
            };

            var progressLabel = new Label($"Updating {managerName}, please wait...")
            {
                X = Pos.Center(),
                Y = 1
            };
            progressDialog.Add(progressLabel);

            // Run progress dialog synchronously
            Application.Run(progressDialog);

            // Run the update operation
            try
            {
                var task = updateAction();
                task.Wait(); // Wait for completion

                MessageBox.Query("Success", $"{managerName} update completed successfully!", "Ok");
            }
            catch (Exception ex)
            {
                MessageBox.ErrorQuery("Error", $"Failed to update {managerName}: {ex.Message}", "Ok");
            }
        }

        static void RunUpdateAllSync(List<string> availableManagers, PackageManagerService packageManagerService)
        {
            var progressDialog = new Dialog("Updating All Package Managers...", 60, 10)
            {
                ColorScheme = Colors.Dialog
            };

            var progressLabel = new Label("Updating all package managers, please wait...")
            {
                X = Pos.Center(),
                Y = 1
            };
            progressDialog.Add(progressLabel);

            var statusLabel = new Label("")
            {
                X = Pos.Center(),
                Y = 3
            };
            progressDialog.Add(statusLabel);

            // Run progress dialog synchronously
            Application.Run(progressDialog);

            var results = new List<string>();
            var errors = new List<string>();

            try
            {
                // Update each package manager
                foreach (var manager in availableManagers)
                {
                    statusLabel.Text = $"Updating {manager}...";

                    try
                    {
                        Task task;
                        switch (manager)
                        {
                            case "winget":
                                task = packageManagerService.UpdateWinget();
                                break;
                            case "npm":
                                task = packageManagerService.UpdateNpm();
                                break;
                            case "scoop":
                                task = packageManagerService.UpdateScoop();
                                break;
                            case "choco":
                                task = packageManagerService.UpdateChoco();
                                break;
                            default:
                                continue;
                        }
                        task.Wait(); // Wait for completion
                        results.Add($"{manager}: Success");
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"{manager}: Failed - {ex.Message}");
                    }
                }

                // Update PowerShell modules
                statusLabel.Text = "Updating PowerShell modules...";

                try
                {
                    var psTask = packageManagerService.UpdatePowerShellModules();
                    psTask.Wait(); // Wait for completion
                    results.Add("PowerShell Modules: Success");
                }
                catch (Exception ex)
                {
                    errors.Add($"PowerShell Modules: Failed - {ex.Message}");
                }

                var message = "Update Results:\n\n";
                if (results.Count > 0)
                {
                    message += "Successful:\n" + string.Join("\n", results) + "\n\n";
                }
                if (errors.Count > 0)
                {
                    message += "Failed:\n" + string.Join("\n", errors);
                }

                MessageBox.Query("Update Complete", message, "Ok");
            }
            catch (Exception ex)
            {
                MessageBox.ErrorQuery("Error", $"Update process failed: {ex.Message}", "Ok");
            }
        }

        static async Task RunUpdateAll(List<string> availableManagers, PackageManagerService packageManagerService)
        {
            var progressDialog = new Dialog("Updating All Package Managers...", 60, 10)
            {
                ColorScheme = Colors.Dialog
            };

            var progressLabel = new Label("Updating all package managers, please wait...")
            {
                X = Pos.Center(),
                Y = 1
            };
            progressDialog.Add(progressLabel);

            var statusLabel = new Label("")
            {
                X = Pos.Center(),
                Y = 3
            };
            progressDialog.Add(statusLabel);

            var progressDialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(progressDialog);
                progressDialogClosed.SetResult(true);
            });

            var results = new List<string>();
            var errors = new List<string>();

            try
            {
                // Update each package manager
                foreach (var manager in availableManagers)
                {
                    Application.MainLoop.Invoke(() =>
                    {
                        statusLabel.Text = $"Updating {manager}...";
                    });

                    try
                    {
                        switch (manager)
                        {
                            case "winget":
                                await packageManagerService.UpdateWinget();
                                break;
                            case "npm":
                                await packageManagerService.UpdateNpm();
                                break;
                            case "scoop":
                                await packageManagerService.UpdateScoop();
                                break;
                            case "choco":
                                await packageManagerService.UpdateChoco();
                                break;
                        }
                        results.Add($"{manager}: Success");
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"{manager}: Failed - {ex.Message}");
                    }
                }

                // Update PowerShell modules
                Application.MainLoop.Invoke(() =>
                {
                    statusLabel.Text = "Updating PowerShell modules...";
                });

                try
                {
                    await packageManagerService.UpdatePowerShellModules();
                    results.Add("PowerShell Modules: Success");
                }
                catch (Exception ex)
                {
                    errors.Add($"PowerShell Modules: Failed - {ex.Message}");
                }

                Application.MainLoop.Invoke(() =>
                {
                    var message = "Update Results:\n\n";
                    if (results.Count > 0)
                    {
                        message += "Successful:\n" + string.Join("\n", results) + "\n\n";
                    }
                    if (errors.Count > 0)
                    {
                        message += "Failed:\n" + string.Join("\n", errors);
                    }

                    MessageBox.Query("Update Complete", message, "Ok");
                    Application.RequestStop(); // Close progress dialog
                });
            }
            catch (Exception ex)
            {
                Application.MainLoop.Invoke(() =>
                {
                    MessageBox.ErrorQuery("Error", $"Update process failed: {ex.Message}", "Ok");
                    Application.RequestStop(); // Close progress dialog
                });
            }

            await progressDialogClosed.Task;
        }

        static async Task ShowCacheSubmenu()
        {
            var cacheService = new CacheService(_logService);

            var cacheSubmenuItems = new List<string>
            {
                "Clear Cache",
                "Back"
            };

            var cacheSubmenu = new Dialog("Cache Options", 60, 10)
            {
                ColorScheme = Colors.Dialog
            };

            var cacheListView = new ListView(cacheSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog // Apply custom color scheme to submenu list view
            };
            cacheSubmenu.Add(cacheListView);

            cacheListView.OpenSelectedItem += (args) =>
            {
                var selected = cacheSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Clear Cache":
                        var confirm = MessageBox.Query("Confirm", "Are you sure you want to clear system caches?", "Yes", "No");
                        if (confirm == 0) // "Yes" selected
                        {
                            var progressDialog = new Dialog("Clearing Caches...", 40, 8) { ColorScheme = Colors.Dialog };
                            var spinner = new Label("Clearing caches...") { X = Pos.Center(), Y = 1 };
                            progressDialog.Add(spinner);

                            Application.Run(progressDialog);

                            var task = cacheService.ClearSystemCache();
                            task.Wait(); // Wait for completion

                            MessageBox.Query("Success", "Caches cleared successfully!", "Ok");
                        }
                        break;
                    case "Back":
                        Application.RequestStop(); // Close the dialog
                        break;
                }
            };

            Application.Run(cacheSubmenu);
        }

        static async Task ShowStartupSubmenu()
        {
            var startupService = new StartupService(_logService);

            var startupSubmenuItems = new List<string>
            {
                "List Startup Programs",
                "Disable Startup Program",
                "Back"
            };

            var startupSubmenu = new Dialog("Startup Options", 60, 12)
            {
                ColorScheme = Colors.Dialog
            };

            var startupListView = new ListView(startupSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            startupSubmenu.Add(startupListView);

            startupListView.OpenSelectedItem += (args) =>
            {
                var selected = startupSubmenuItems[args.Item];
                switch (selected)
                {
                    case "List Startup Programs":
                        // Show progress dialog for listing startup programs
                        var startupProgressDialog = new Dialog("Loading Startup Programs...", 50, 8)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        var startupProgressLabel = new Label("Scanning startup programs, please wait...")
                        {
                            X = Pos.Center(),
                            Y = 1
                        };
                        startupProgressDialog.Add(startupProgressLabel);

                        var cancelStartupButton = new Button("Cancel")
                        {
                            X = Pos.Center(),
                            Y = 3
                        };

                        CancellationTokenSource? startupCts = new CancellationTokenSource();
                        bool startupCompleted = false;

                        cancelStartupButton.Clicked += () =>
                        {
                            startupCts?.Cancel();
                            Application.RequestStop();
                        };

                        startupProgressDialog.AddButton(cancelStartupButton);

                        // Run startup program listing asynchronously with timeout
                        var startupTask = Task.Run(async () =>
                        {
                            try
                            {
                                var programs = await startupService.ListStartupPrograms();
                                startupCompleted = true;

                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.Query("Startup Programs", string.Join(Environment.NewLine, programs), "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                            catch (Exception ex)
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", $"Failed to list startup programs: {ex.Message}", "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                        }, startupCts.Token);

                        // Add timeout
                        var startupTimeoutTask = Task.Delay(30000, startupCts.Token); // 30 second timeout
                        var startupCompletedTask = Task.WhenAny(startupTask, startupTimeoutTask).Result;

                        if (startupCompletedTask == startupTimeoutTask && !startupCompleted)
                        {
                            startupCts?.Cancel();
                            MessageBox.ErrorQuery("Timeout", "Listing startup programs timed out after 30 seconds.", "Ok");
                        }
                        else
                        {
                            Application.Run(startupProgressDialog);
                        }

                        startupCts?.Dispose();
                        break;
                    case "Disable Startup Program":
                        var programNameInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 3,
                            Width = 30
                        };

                        var disableDialog = new Dialog("Disable Startup Program", 50, 10)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        disableDialog.Add(new Label("Enter program name to disable:") { X = Pos.Center(), Y = 1 });
                        disableDialog.Add(programNameInput);

                        var disableButton = new Button("Disable")
                        {
                            X = Pos.Center() - 10,
                            Y = 5,
                            IsDefault = true
                        };

                        var cancelButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 2,
                            Y = 5
                        };

                        disableButton.Clicked += () =>
                        {
                            var programName = programNameInput.Text.ToString();
                            if (!string.IsNullOrEmpty(programName))
                            {
                                var successTask = startupService.DisableStartupProgram(programName);
                                successTask.Wait(); // Wait for completion
                                if (successTask.Result)
                                {
                                    MessageBox.Query("Success", $"Successfully disabled startup program: {programName}", "Ok");
                                }
                                else
                                {
                                    MessageBox.ErrorQuery("Error", $"Failed to disable startup program: {programName}", "Ok");
                                }
                                Application.RequestStop(); // Close input dialog
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Program name cannot be empty", "Ok");
                            }
                        };

                        cancelButton.Clicked += () => Application.RequestStop();

                        disableDialog.AddButton(disableButton);
                        disableDialog.AddButton(cancelButton);

                        Application.Run(disableDialog);
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(startupSubmenu);
        }

        static async Task ShowUninstallSubmenu()
        {
            var uninstallerService = new UninstallerService(_logService);

            var uninstallSubmenuItems = new List<string>
            {
                "List Installed Programs",
                "Uninstall Program",
                "Back"
            };

            var uninstallSubmenu = new Dialog("Uninstall Options", 60, 12)
            {
                ColorScheme = Colors.Dialog
            };

            var uninstallListView = new ListView(uninstallSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            uninstallSubmenu.Add(uninstallListView);

            uninstallListView.OpenSelectedItem += (args) =>
            {
                var selected = uninstallSubmenuItems[args.Item];
                switch (selected)
                {
                    case "List Installed Programs":
                        // Show progress dialog for listing installed programs
                        var uninstallProgressDialog = new Dialog("Loading Installed Programs...", 50, 8)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        var uninstallProgressLabel = new Label("Scanning installed programs, please wait...")
                        {
                            X = Pos.Center(),
                            Y = 1
                        };
                        uninstallProgressDialog.Add(uninstallProgressLabel);

                        var cancelUninstallListButton = new Button("Cancel")
                        {
                            X = Pos.Center(),
                            Y = 3
                        };

                        CancellationTokenSource? uninstallCts = new CancellationTokenSource();
                        bool uninstallCompleted = false;

                        cancelUninstallListButton.Clicked += () =>
                        {
                            uninstallCts?.Cancel();
                            Application.RequestStop();
                        };

                        uninstallProgressDialog.AddButton(cancelUninstallListButton);

                        // Run installed programs listing asynchronously with timeout
                        var uninstallTask = Task.Run(async () =>
                        {
                            try
                            {
                                var programs = await uninstallerService.ListInstalledPrograms();
                                uninstallCompleted = true;

                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.Query("Installed Programs", string.Join(Environment.NewLine, programs), "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                            catch (Exception ex)
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", $"Failed to list installed programs: {ex.Message}", "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                        }, uninstallCts.Token);

                        // Add timeout
                        var uninstallTimeoutTask = Task.Delay(30000, uninstallCts.Token); // 30 second timeout
                        var uninstallCompletedTask = Task.WhenAny(uninstallTask, uninstallTimeoutTask).Result;

                        if (uninstallCompletedTask == uninstallTimeoutTask && !uninstallCompleted)
                        {
                            uninstallCts?.Cancel();
                            MessageBox.ErrorQuery("Timeout", "Listing installed programs timed out after 30 seconds.", "Ok");
                        }
                        else
                        {
                            Application.Run(uninstallProgressDialog);
                        }

                        uninstallCts?.Dispose();
                        break;
                    case "Uninstall Program":
                        var uninstallProgramInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 3,
                            Width = 30
                        };

                        var uninstallDialog = new Dialog("Uninstall Program", 50, 10)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        uninstallDialog.Add(new Label("Enter program name to uninstall:") { X = Pos.Center(), Y = 1 });
                        uninstallDialog.Add(uninstallProgramInput);

                        var uninstallButton = new Button("Uninstall")
                        {
                            X = Pos.Center() - 12,
                            Y = 5,
                            IsDefault = true
                        };

                        var cancelUninstallButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 2,
                            Y = 5
                        };

                        uninstallButton.Clicked += () =>
                        {
                            var programName = uninstallProgramInput.Text.ToString();
                            if (!string.IsNullOrEmpty(programName))
                            {
                                var confirm = MessageBox.Query("Confirm Uninstall",
                                    $"Are you sure you want to uninstall '{programName}'?", "Yes", "No");
                                if (confirm == 0) // "Yes" selected
                                {
                                    var successTask = uninstallerService.UninstallProgram(programName);
                                    successTask.Wait(); // Wait for completion
                                    if (successTask.Result)
                                    {
                                        MessageBox.Query("Success", $"Successfully initiated uninstall for: {programName}", "Ok");
                                    }
                                    else
                                    {
                                        MessageBox.ErrorQuery("Error", $"Failed to uninstall: {programName}", "Ok");
                                    }
                                    Application.RequestStop(); // Close input dialog
                                }
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Program name cannot be empty", "Ok");
                            }
                        };

                        cancelUninstallButton.Clicked += () => Application.RequestStop();

                        uninstallDialog.AddButton(uninstallButton);
                        uninstallDialog.AddButton(cancelUninstallButton);

                        Application.Run(uninstallDialog);
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(uninstallSubmenu);
        }

        static async Task ShowDnsSubmenu()
        {
            var dnsService = new DnsService(_logService);

            var dnsSubmenuItems = new List<string>
            {
                "Set DNS",
                "Reset DNS",
                "Back"
            };

            var dnsSubmenu = new Dialog("DNS Options", 60, 12)
            {
                ColorScheme = Colors.Dialog
            };

            var dnsListView = new ListView(dnsSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            dnsSubmenu.Add(dnsListView);

            dnsListView.OpenSelectedItem += (args) =>
            {
                var selected = dnsSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Set DNS":
                        var primaryDnsInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 2,
                            Width = 20
                        };

                        var secondaryDnsInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 4,
                            Width = 20
                        };

                        var dnsDialog = new Dialog("Set DNS Servers", 60, 12)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        dnsDialog.Add(new Label("Primary DNS:") { X = Pos.Center() - 15, Y = 1 });
                        dnsDialog.Add(primaryDnsInput);
                        dnsDialog.Add(new Label("Secondary DNS:") { X = Pos.Center() - 17, Y = 3 });
                        dnsDialog.Add(secondaryDnsInput);

                        var setDnsButton = new Button("Set DNS")
                        {
                            X = Pos.Center() - 10,
                            Y = 6,
                            IsDefault = true
                        };

                        var cancelDnsButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 4,
                            Y = 6
                        };

                        setDnsButton.Clicked += () =>
                        {
                            var primaryDns = primaryDnsInput.Text.ToString();
                            var secondaryDns = secondaryDnsInput.Text.ToString();

                            if (!string.IsNullOrEmpty(primaryDns))
                            {
                                var confirm = MessageBox.Query("Confirm DNS Change",
                                    $"Set DNS to: {primaryDns}" +
                                    (!string.IsNullOrEmpty(secondaryDns) ? $" and {secondaryDns}" : "") +
                                    "?", "Yes", "No");

                                if (confirm == 0) // "Yes" selected
                                {
                                    var successTask = dnsService.SetDns(primaryDns, secondaryDns);
                                    successTask.Wait(); // Wait for completion
                                    if (successTask.Result)
                                    {
                                        MessageBox.Query("Success", "DNS settings updated successfully!", "Ok");
                                    }
                                    else
                                    {
                                        MessageBox.ErrorQuery("Error", "Failed to update DNS settings.", "Ok");
                                    }
                                    Application.RequestStop(); // Close input dialog
                                }
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Primary DNS cannot be empty", "Ok");
                            }
                        };

                        cancelDnsButton.Clicked += () => Application.RequestStop();

                        dnsDialog.AddButton(setDnsButton);
                        dnsDialog.AddButton(cancelDnsButton);

                        Application.Run(dnsDialog);
                        break;
                    case "Reset DNS":
                        var confirm = MessageBox.Query("Confirm", "Are you sure you want to reset DNS settings?", "Yes", "No");
                        if (confirm == 0) // "Yes" selected
                        {
                            var progressDialog = new Dialog("Resetting DNS...", 40, 8) { ColorScheme = Colors.Dialog };
                            var spinner = new Label("Resetting DNS settings...") { X = Pos.Center(), Y = 1 };
                            progressDialog.Add(spinner);

                            Application.Run(progressDialog);

                            var successTask = dnsService.ResetDns();
                            successTask.Wait(); // Wait for completion
                            if (successTask.Result)
                            {
                                MessageBox.Query("Success", "DNS settings reset successfully!", "Ok");
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Failed to reset DNS settings.", "Ok");
                            }
                        }
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(dnsSubmenu);
        }

        static async Task ShowNetworkSubmenu()
        {
            var networkService = new NetworkService(_logService);

            var networkSubmenuItems = new List<string>
            {
                "Run Ping Test",
                "Run Speed Test",
                "Back"
            };

            var networkSubmenu = new Dialog("Network Options", 60, 12)
            {
                ColorScheme = Colors.Dialog
            };

            var networkListView = new ListView(networkSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            networkSubmenu.Add(networkListView);

            networkListView.OpenSelectedItem += (args) =>
            {
                var selected = networkSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Run Ping Test":
                        var hostInput = new TextField("8.8.8.8") // Default to Google DNS
                        {
                            X = Pos.Center(),
                            Y = 3,
                            Width = 30
                        };

                        var pingDialog = new Dialog("Run Ping Test", 50, 12)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        pingDialog.Add(new Label("Enter host to ping:") { X = Pos.Center(), Y = 1 });
                        pingDialog.Add(hostInput);
                        pingDialog.Add(new Label("Press Ctrl+C to cancel ping") { X = Pos.Center(), Y = 5 });

                        var pingButton = new Button("Ping")
                        {
                            X = Pos.Center() - 8,
                            Y = 7,
                            IsDefault = true
                        };

                        var cancelPingButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 4,
                            Y = 7
                        };

                        CancellationTokenSource? cts = null;

                        pingButton.Clicked += async () =>
                        {
                            var host = hostInput.Text.ToString();
                            if (!string.IsNullOrEmpty(host))
                            {
                                // Disable buttons during ping
                                pingButton.Enabled = false;
                                cancelPingButton.Enabled = false;

                                cts = new CancellationTokenSource();

                                try
                                {
                                    var task = networkService.RunPingTest(host, cts.Token);
                                    var result = await task;
                                    MessageBox.Query("Ping Test Result", result, "Ok");
                                }
                                catch (Exception ex)
                                {
                                    MessageBox.ErrorQuery("Error", $"Ping failed: {ex.Message}", "Ok");
                                }
                                finally
                                {
                                    // Re-enable buttons
                                    pingButton.Enabled = true;
                                    cancelPingButton.Enabled = true;
                                    cts?.Dispose();
                                    cts = null;
                                }
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Host cannot be empty", "Ok");
                            }
                        };

                        cancelPingButton.Clicked += () =>
                        {
                            cts?.Cancel();
                            Application.RequestStop();
                        };

                        // Handle Ctrl+C for cancellation
                        pingDialog.KeyDown += (e) =>
                        {
                            if (e.KeyEvent.Key == (Key.C | Key.CtrlMask))
                            {
                                cts?.Cancel();
                                e.Handled = true;
                            }
                        };

                        pingDialog.AddButton(pingButton);
                        pingDialog.AddButton(cancelPingButton);

                        Application.Run(pingDialog);
                        cts?.Dispose();
                        break;
                    case "Run Speed Test":
                        // Show progress dialog for speed test
                        var speedTestDialog = new Dialog("Running Speed Test...", 50, 8)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        var progressLabel = new Label("Initializing speed test, please wait...")
                        {
                            X = Pos.Center(),
                            Y = 1
                        };
                        speedTestDialog.Add(progressLabel);

                        var cancelSpeedTestButton = new Button("Cancel")
                        {
                            X = Pos.Center(),
                            Y = 3
                        };

                        CancellationTokenSource? speedTestCts = new CancellationTokenSource();
                        bool speedTestCompleted = false;
                        string? speedTestResult = null;
                        Exception? speedTestException = null;

                        cancelSpeedTestButton.Clicked += () =>
                        {
                            speedTestCts?.Cancel();
                        };

                        speedTestDialog.AddButton(cancelSpeedTestButton);

                        // Run speed test asynchronously
                        var speedTestTask = Task.Run(async () =>
                        {
                            try
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    progressLabel.Text = "Finding best server...";
                                });

                                var result = await networkService.RunSpeedTest();
                                speedTestResult = result;
                                speedTestCompleted = true;
                            }
                            catch (Exception ex)
                            {
                                speedTestException = ex;
                            }
                        }, speedTestCts.Token);

                        // Show dialog and wait for completion or cancellation
                        Application.Run(speedTestDialog);

                        // Check if user cancelled
                        if (speedTestCts.IsCancellationRequested)
                        {
                            speedTestCts?.Cancel();
                            MessageBox.Query("Cancelled", "Speed test was cancelled.", "Ok");
                        }
                        else
                        {
                            // Wait for the task with a reasonable timeout
                            var completed = speedTestTask.Wait(65000); // 65 second timeout

                            if (!completed)
                            {
                                speedTestCts?.Cancel();
                                MessageBox.ErrorQuery("Timeout", "Speed test timed out after 60 seconds.", "Ok");
                            }
                            else if (speedTestException != null)
                            {
                                MessageBox.ErrorQuery("Speed Test Error", $"Speed test failed: {speedTestException.Message}", "Ok");
                            }
                            else if (speedTestCompleted && speedTestResult != null)
                            {
                                MessageBox.Query("Speed Test Result", speedTestResult, "Ok");
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Speed test completed but no result was returned.", "Ok");
                            }
                        }

                        speedTestCts?.Dispose();
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(networkSubmenu);
        }

        static async Task ShowDriverSubmenu()
        {
            var driverService = new DriverService(_logService);

            var driverSubmenuItems = new List<string>
            {
                "Check for Driver Updates",
                "Update Driver",
                "Back"
            };

            var driverSubmenu = new Dialog("Driver Options", 60, 12)
            {
                ColorScheme = Colors.Dialog
            };

            var driverListView = new ListView(driverSubmenuItems)
            {
                X = 0,
                Y = 0,
                Width = Dim.Fill(),
                Height = Dim.Fill(),
                CanFocus = true,
                ColorScheme = Colors.Dialog
            };
            driverSubmenu.Add(driverListView);

            driverListView.OpenSelectedItem += (args) =>
            {
                var selected = driverSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Check for Driver Updates":
                        // Show progress dialog for checking driver updates
                        var driverProgressDialog = new Dialog("Checking for Driver Updates...", 50, 8)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        var driverProgressLabel = new Label("Scanning for driver updates, please wait...")
                        {
                            X = Pos.Center(),
                            Y = 1
                        };
                        driverProgressDialog.Add(driverProgressLabel);

                        var cancelDriverCheckButton = new Button("Cancel")
                        {
                            X = Pos.Center(),
                            Y = 3
                        };

                        CancellationTokenSource? driverCts = new CancellationTokenSource();
                        bool driverCheckCompleted = false;

                        cancelDriverCheckButton.Clicked += () =>
                        {
                            driverCts?.Cancel();
                            Application.RequestStop();
                        };

                        driverProgressDialog.AddButton(cancelDriverCheckButton);

                        // Run driver check asynchronously with timeout
                        var driverCheckTask = Task.Run(async () =>
                        {
                            try
                            {
                                var drivers = await driverService.DetectDrivers();
                                driverCheckCompleted = true;

                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.Query("Driver Updates", string.Join(Environment.NewLine, drivers), "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                            catch (Exception ex)
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", $"Failed to check for driver updates: {ex.Message}", "Ok");
                                    Application.RequestStop(); // Close progress dialog
                                });
                            }
                        }, driverCts.Token);

                        // Add timeout
                        var driverTimeoutTask = Task.Delay(30000, driverCts.Token); // 30 second timeout
                        var driverCompletedTask = Task.WhenAny(driverCheckTask, driverTimeoutTask).Result;

                        if (driverCompletedTask == driverTimeoutTask && !driverCheckCompleted)
                        {
                            driverCts?.Cancel();
                            MessageBox.ErrorQuery("Timeout", "Driver check timed out after 30 seconds.", "Ok");
                        }
                        else
                        {
                            Application.Run(driverProgressDialog);
                        }

                        driverCts?.Dispose();
                        break;
                    case "Update Driver":
                        var driverNameInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 3,
                            Width = 30
                        };

                        var driverDialog = new Dialog("Update Driver", 50, 10)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        driverDialog.Add(new Label("Enter driver name to update:") { X = Pos.Center(), Y = 1 });
                        driverDialog.Add(driverNameInput);

                        var updateDriverButton = new Button("Update")
                        {
                            X = Pos.Center() - 10,
                            Y = 5,
                            IsDefault = true
                        };

                        var cancelDriverButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 2,
                            Y = 5
                        };

                        updateDriverButton.Clicked += () =>
                        {
                            var driverName = driverNameInput.Text.ToString();
                            if (!string.IsNullOrEmpty(driverName))
                            {
                                var confirm = MessageBox.Query("Confirm Driver Update",
                                    $"Are you sure you want to update driver '{driverName}'?", "Yes", "No");
                                if (confirm == 0) // "Yes" selected
                                {
                                    var successTask = driverService.UpdateDriver(driverName);
                                    successTask.Wait(); // Wait for completion
                                    if (successTask.Result)
                                    {
                                        MessageBox.Query("Success", $"Driver update initiated for: {driverName}", "Ok");
                                    }
                                    else
                                    {
                                        MessageBox.ErrorQuery("Error", $"Failed to update driver: {driverName}", "Ok");
                                    }
                                    Application.RequestStop(); // Close input dialog
                                }
                            }
                            else
                            {
                                MessageBox.ErrorQuery("Error", "Driver name cannot be empty", "Ok");
                            }
                        };

                        cancelDriverButton.Clicked += () => Application.RequestStop();

                        driverDialog.AddButton(updateDriverButton);
                        driverDialog.AddButton(cancelDriverButton);

                        Application.Run(driverDialog);
                        break;
                    case "Back":
                        Application.RequestStop();
                        break;
                }
            };

            Application.Run(driverSubmenu);
        }

        // Method to show funding information
        static void ShowSupportInfo()
        {
            try
            {
                var fundingFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "FUNDING.yml");

                var deserializer = new DeserializerBuilder()
                    .WithNamingConvention(UnderscoredNamingConvention.Instance)
                    .Build();

                var fundingInfo = deserializer.Deserialize<FundingConfig>(File.ReadAllText(fundingFilePath));

                var message = "Support InvolveX CLI:" + Environment.NewLine + Environment.NewLine;
                if (fundingInfo.Github != null && fundingInfo.Github.Count > 0)
                {
                    message += $"GitHub: {string.Join(", ", fundingInfo.Github)}{Environment.NewLine}";
                }
                if (fundingInfo.BuyMeACoffee != null)
                {
                    message += $"Buy Me a Coffee: {fundingInfo.BuyMeACoffee}{Environment.NewLine}";
                }
                if (fundingInfo.Custom != null && fundingInfo.Custom.Count > 0)
                {
                    message += $"Custom: {string.Join(", ", fundingInfo.Custom)}{Environment.NewLine}";
                }

                MessageBox.Query("Support InvolveX CLI", message, "Ok");
            }
            catch (Exception ex)
            {
                MessageBox.ErrorQuery("Error", $"Could not load funding information: {ex.Message}", "Ok");
            }
        }
    }

    // Helper class to deserialize FUNDING.yml
    public class FundingConfig
    {
        public List<string>? Github { get; set; }
        public string? BuyMeACoffee { get; set; }
        public List<string>? Custom { get; set; }
    }
}
