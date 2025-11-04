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
                Application.MainLoop.Invoke(() =>
                {
                    MessageBox.ErrorQuery("Error", $"Error checking package managers: {ex.Message}", "Ok");
                });
                return;
            }

            if (availableManagers.Count == 0)
            {
                Application.MainLoop.Invoke(() =>
                {
                    MessageBox.ErrorQuery("No Package Managers", "No supported package managers found on this system.", "Ok");
                });
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(updateDialog);
                dialogClosed.SetResult(true);
            });

            updateListView.OpenSelectedItem += async (args) =>
            {
                var selected = updateOptions[args.Item];
                switch (selected)
                {
                    case "winget":
                        await RunPackageManagerUpdate("winget", () => packageManagerService.UpdateWinget());
                        break;
                    case "npm":
                        await RunPackageManagerUpdate("npm", () => packageManagerService.UpdateNpm());
                        break;
                    case "scoop":
                        await RunPackageManagerUpdate("scoop", () => packageManagerService.UpdateScoop());
                        break;
                    case "choco":
                        await RunPackageManagerUpdate("choco", () => packageManagerService.UpdateChoco());
                        break;
                    case "PowerShell Modules":
                        await RunPackageManagerUpdate("PowerShell Modules", () => packageManagerService.UpdatePowerShellModules());
                        break;
                    case "Update All":
                        await RunUpdateAll(availableManagers, packageManagerService);
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };

            await dialogClosed.Task;
        }

        static async Task RunPackageManagerUpdate(string managerName, Func<Task> updateAction)
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

            var progressDialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(progressDialog);
                progressDialogClosed.SetResult(true);
            });

            try
            {
                await updateAction();
                Application.MainLoop.Invoke(() =>
                {
                    MessageBox.Query("Success", $"{managerName} update completed successfully!", "Ok");
                    Application.RequestStop(); // Close progress dialog
                });
            }
            catch (Exception ex)
            {
                Application.MainLoop.Invoke(() =>
                {
                    MessageBox.ErrorQuery("Error", $"Failed to update {managerName}: {ex.Message}", "Ok");
                    Application.RequestStop(); // Close progress dialog
                });
            }

            await progressDialogClosed.Task;
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

            cacheListView.OpenSelectedItem += async (args) => // Changed to async
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

                            var dialogClosed = new TaskCompletionSource<bool>();
                            _ = Task.Run(() =>
                            {
                                Application.Run(progressDialog);
                                dialogClosed.SetResult(true);
                            });

                            await cacheService.ClearSystemCache();

                            Application.MainLoop.Invoke(() =>
                            {
                                MessageBox.Query("Success", "Caches cleared successfully!", "Ok");
                                Application.RequestStop(); // Close progress dialog
                            });
                            await dialogClosed.Task;
                        }
                        break;
                    case "Back":
                        Application.RequestStop(); // Close the dialog
                        break;
                }
            };

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(cacheSubmenu);
                dialogClosed.SetResult(true);
            });

            await dialogClosed.Task;
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(startupSubmenu);
                dialogClosed.SetResult(true);
            });

            startupListView.OpenSelectedItem += async (args) =>
            {
                var selected = startupSubmenuItems[args.Item];
                switch (selected)
                {
                    case "List Startup Programs":
                        var programs = await startupService.ListStartupPrograms();
                        Application.MainLoop.Invoke(() =>
                        {
                            MessageBox.Query("Startup Programs", string.Join(Environment.NewLine, programs), "Ok");
                        });
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

                        disableButton.Clicked += async () =>
                        {
                            var programName = programNameInput.Text.ToString();
                            if (!string.IsNullOrEmpty(programName))
                            {
                                var success = await startupService.DisableStartupProgram(programName);
                                Application.MainLoop.Invoke(() =>
                                {
                                    if (success)
                                    {
                                        MessageBox.Query("Success", $"Successfully disabled startup program: {programName}", "Ok");
                                    }
                                    else
                                    {
                                        MessageBox.ErrorQuery("Error", $"Failed to disable startup program: {programName}", "Ok");
                                    }
                                    Application.RequestStop(); // Close input dialog
                                });
                            }
                            else
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", "Program name cannot be empty", "Ok");
                                });
                            }
                        };

                        cancelButton.Clicked += () => Application.RequestStop();

                        disableDialog.AddButton(disableButton);
                        disableDialog.AddButton(cancelButton);

                        var dialogClosed = new TaskCompletionSource<bool>();
                        _ = Task.Run(() =>
                        {
                            Application.Run(disableDialog);
                            dialogClosed.SetResult(true);
                        });

                        await dialogClosed.Task;
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };
            await dialogClosed.Task;
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(uninstallSubmenu);
                dialogClosed.SetResult(true);
            });

            uninstallListView.OpenSelectedItem += async (args) =>
            {
                var selected = uninstallSubmenuItems[args.Item];
                switch (selected)
                {
                    case "List Installed Programs":
                        var programs = await uninstallerService.ListInstalledPrograms();
                        Application.MainLoop.Invoke(() =>
                        {
                            MessageBox.Query("Installed Programs", string.Join(Environment.NewLine, programs), "Ok");
                        });
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

                        uninstallButton.Clicked += async () =>
                        {
                            var programName = uninstallProgramInput.Text.ToString();
                            if (!string.IsNullOrEmpty(programName))
                            {
                                var confirm = MessageBox.Query("Confirm Uninstall",
                                    $"Are you sure you want to uninstall '{programName}'?", "Yes", "No");
                                if (confirm == 0) // "Yes" selected
                                {
                                    var success = await uninstallerService.UninstallProgram(programName);
                                    Application.MainLoop.Invoke(() =>
                                    {
                                        if (success)
                                        {
                                            MessageBox.Query("Success", $"Successfully initiated uninstall for: {programName}", "Ok");
                                        }
                                        else
                                        {
                                            MessageBox.ErrorQuery("Error", $"Failed to uninstall: {programName}", "Ok");
                                        }
                                        Application.RequestStop(); // Close input dialog
                                    });
                                }
                            }
                            else
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", "Program name cannot be empty", "Ok");
                                });
                            }
                        };

                        cancelUninstallButton.Clicked += () => Application.RequestStop();

                        uninstallDialog.AddButton(uninstallButton);
                        uninstallDialog.AddButton(cancelUninstallButton);

                        var uninstallDialogClosed = new TaskCompletionSource<bool>();
                        _ = Task.Run(() =>
                        {
                            Application.Run(uninstallDialog);
                            uninstallDialogClosed.SetResult(true);
                        });

                        await uninstallDialogClosed.Task;
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };
            await dialogClosed.Task;
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(dnsSubmenu);
                dialogClosed.SetResult(true);
            });

            dnsListView.OpenSelectedItem += async (args) =>
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

                        setDnsButton.Clicked += async () =>
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
                                    var success = await dnsService.SetDns(primaryDns, secondaryDns);
                                    Application.MainLoop.Invoke(() =>
                                    {
                                        if (success)
                                        {
                                            MessageBox.Query("Success", "DNS settings updated successfully!", "Ok");
                                        }
                                        else
                                        {
                                            MessageBox.ErrorQuery("Error", "Failed to update DNS settings.", "Ok");
                                        }
                                        Application.RequestStop(); // Close input dialog
                                    });
                                }
                            }
                            else
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", "Primary DNS cannot be empty", "Ok");
                                });
                            }
                        };

                        cancelDnsButton.Clicked += () => Application.RequestStop();

                        dnsDialog.AddButton(setDnsButton);
                        dnsDialog.AddButton(cancelDnsButton);

                        var dnsDialogClosed = new TaskCompletionSource<bool>();
                        _ = Task.Run(() =>
                        {
                            Application.Run(dnsDialog);
                            dnsDialogClosed.SetResult(true);
                        });

                        await dnsDialogClosed.Task;
                        break;
                    case "Reset DNS":
                        var confirm = MessageBox.Query("Confirm", "Are you sure you want to reset DNS settings?", "Yes", "No");
                        if (confirm == 0) // "Yes" selected
                        {
                            var progressDialog = new Dialog("Resetting DNS...", 40, 8) { ColorScheme = Colors.Dialog };
                            var spinner = new Label("Resetting DNS settings...") { X = Pos.Center(), Y = 1 };
                            progressDialog.Add(spinner);

                            var progressDialogClosed = new TaskCompletionSource<bool>();
                            _ = Task.Run(() =>
                            {
                                Application.Run(progressDialog);
                                progressDialogClosed.SetResult(true);
                            });

                            var success = await dnsService.ResetDns();
                            Application.MainLoop.Invoke(() =>
                            {
                                if (success)
                                {
                                    MessageBox.Query("Success", "DNS settings reset successfully!", "Ok");
                                }
                                else
                                {
                                    MessageBox.ErrorQuery("Error", "Failed to reset DNS settings.", "Ok");
                                }
                                Application.RequestStop(); // Close progress dialog
                            });
                            await progressDialogClosed.Task;
                        }
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };
            await dialogClosed.Task;
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(networkSubmenu);
                dialogClosed.SetResult(true);
            });

            networkListView.OpenSelectedItem += async (args) =>
            {
                var selected = networkSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Run Ping Test":
                        var hostInput = new TextField("")
                        {
                            X = Pos.Center(),
                            Y = 3,
                            Width = 30
                        };

                        var pingDialog = new Dialog("Run Ping Test", 50, 10)
                        {
                            ColorScheme = Colors.Dialog
                        };

                        pingDialog.Add(new Label("Enter host to ping:") { X = Pos.Center(), Y = 1 });
                        pingDialog.Add(hostInput);

                        var pingButton = new Button("Ping")
                        {
                            X = Pos.Center() - 8,
                            Y = 5,
                            IsDefault = true
                        };

                        var cancelPingButton = new Button("Cancel")
                        {
                            X = Pos.Center() + 4,
                            Y = 5
                        };

                        pingButton.Clicked += async () =>
                        {
                            var host = hostInput.Text.ToString();
                            if (!string.IsNullOrEmpty(host))
                            {
                                var result = await networkService.RunPingTest(host);
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.Query("Ping Test Result", result, "Ok");
                                    Application.RequestStop(); // Close input dialog
                                });
                            }
                            else
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", "Host cannot be empty", "Ok");
                                });
                            }
                        };

                        cancelPingButton.Clicked += () => Application.RequestStop();

                        pingDialog.AddButton(pingButton);
                        pingDialog.AddButton(cancelPingButton);

                        var pingDialogClosed = new TaskCompletionSource<bool>();
                        _ = Task.Run(() =>
                        {
                            Application.Run(pingDialog);
                            pingDialogClosed.SetResult(true);
                        });

                        await pingDialogClosed.Task;
                        break;
                    case "Run Speed Test":
                        var result = await networkService.RunSpeedTest();
                        Application.MainLoop.Invoke(() =>
                        {
                            MessageBox.Query("Speed Test Result", result, "Ok");
                        });
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };
            await dialogClosed.Task;
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

            var dialogClosed = new TaskCompletionSource<bool>();
            _ = Task.Run(() =>
            {
                Application.Run(driverSubmenu);
                dialogClosed.SetResult(true);
            });

            driverListView.OpenSelectedItem += async (args) =>
            {
                var selected = driverSubmenuItems[args.Item];
                switch (selected)
                {
                    case "Check for Driver Updates":
                        var drivers = await driverService.DetectDrivers();
                        Application.MainLoop.Invoke(() =>
                        {
                            MessageBox.Query("Driver Updates", string.Join(Environment.NewLine, drivers), "Ok");
                        });
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

                        updateDriverButton.Clicked += async () =>
                        {
                            var driverName = driverNameInput.Text.ToString();
                            if (!string.IsNullOrEmpty(driverName))
                            {
                                var confirm = MessageBox.Query("Confirm Driver Update",
                                    $"Are you sure you want to update driver '{driverName}'?", "Yes", "No");
                                if (confirm == 0) // "Yes" selected
                                {
                                    var success = await driverService.UpdateDriver(driverName);
                                    Application.MainLoop.Invoke(() =>
                                    {
                                        if (success)
                                        {
                                            MessageBox.Query("Success", $"Driver update initiated for: {driverName}", "Ok");
                                        }
                                        else
                                        {
                                            MessageBox.ErrorQuery("Error", $"Failed to update driver: {driverName}", "Ok");
                                        }
                                        Application.RequestStop(); // Close input dialog
                                    });
                                }
                            }
                            else
                            {
                                Application.MainLoop.Invoke(() =>
                                {
                                    MessageBox.ErrorQuery("Error", "Driver name cannot be empty", "Ok");
                                });
                            }
                        };

                        cancelDriverButton.Clicked += () => Application.RequestStop();

                        driverDialog.AddButton(updateDriverButton);
                        driverDialog.AddButton(cancelDriverButton);

                        var driverDialogClosed = new TaskCompletionSource<bool>();
                        _ = Task.Run(() =>
                        {
                            Application.Run(driverDialog);
                            driverDialogClosed.SetResult(true);
                        });

                        await driverDialogClosed.Task;
                        break;
                    case "Back":
                        Application.MainLoop.Invoke(() => Application.RequestStop());
                        break;
                }
            };
            await dialogClosed.Task;
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
