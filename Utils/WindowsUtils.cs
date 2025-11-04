using System.Security.Principal;
using System.Threading.Tasks;
using System.Runtime.Versioning;

namespace InvolveX.Cli.Utils
{
    [SupportedOSPlatform("windows")]
    public static class WindowsUtils
    {
        /// <summary>
        /// Checks if the current user is an administrator.
        /// </summary>
        public static bool IsUserAnAdmin()
        {
            using (var identity = WindowsIdentity.GetCurrent())
            {
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }
    }
}