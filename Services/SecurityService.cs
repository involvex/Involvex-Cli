using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Net.Http;

namespace InvolveX.Cli.Services
{
    public class SecurityService
    {
        private readonly LogService _logService;
        private readonly ConfigService _configService;
        private readonly HttpClient _httpClient;

        public SecurityService(LogService logService, ConfigService configService)
        {
            _logService = logService;
            _configService = configService;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
        }

        public async Task<bool> VerifyFileHash(string filePath, string expectedHash, string algorithm = "SHA256")
        {
            if (!File.Exists(filePath))
            {
                _logService.Log($"File not found for hash verification: {filePath}");
                return false;
            }

            if (string.IsNullOrEmpty(expectedHash))
            {
                _logService.Log("Expected hash is empty or null");
                return false;
            }

            try
            {
                string actualHash;
                using (var stream = File.OpenRead(filePath))
                {
                    actualHash = await ComputeHashAsync(stream, algorithm);
                }

                bool isValid = string.Equals(actualHash, expectedHash, StringComparison.OrdinalIgnoreCase);
                _logService.Log($"Hash verification for {Path.GetFileName(filePath)}: {(isValid ? "PASSED" : "FAILED")}");

                if (!isValid)
                {
                    _logService.Log($"Expected: {expectedHash}");
                    _logService.Log($"Actual: {actualHash}");
                }

                return isValid;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error verifying file hash: {ex.Message}");
                return false;
            }
        }

        public async Task<string> ComputeFileHash(string filePath, string algorithm = "SHA256")
        {
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException("File not found", filePath);
            }

            using (var stream = File.OpenRead(filePath))
            {
                return await ComputeHashAsync(stream, algorithm);
            }
        }

        private async Task<string> ComputeHashAsync(Stream stream, string algorithm)
        {
            using (var hashAlgorithm = CreateHashAlgorithm(algorithm))
            {
                var hashBytes = await Task.Run(() => hashAlgorithm.ComputeHash(stream));
                return BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
            }
        }

        private HashAlgorithm CreateHashAlgorithm(string algorithm)
        {
            return algorithm.ToUpperInvariant() switch
            {
                "SHA256" => SHA256.Create(),
                "SHA384" => SHA384.Create(),
                "SHA512" => SHA512.Create(),
                "MD5" => MD5.Create(),
                _ => throw new ArgumentException($"Unsupported hash algorithm: {algorithm}")
            };
        }

        public async Task<bool> DownloadAndVerifyFile(string url, string destinationPath, string expectedHash, string algorithm = "SHA256")
        {
            try
            {
                _logService.Log($"Downloading file from {url}");

                using (var response = await _httpClient.GetAsync(url))
                {
                    response.EnsureSuccessStatusCode();

                    using (var contentStream = await response.Content.ReadAsStreamAsync())
                    using (var fileStream = File.Create(destinationPath))
                    {
                        await contentStream.CopyToAsync(fileStream);
                    }
                }

                _logService.Log($"Download completed. Verifying hash...");

                if (_configService.ShouldVerifyHashes())
                {
                    return await VerifyFileHash(destinationPath, expectedHash, algorithm);
                }
                else
                {
                    _logService.Log("Hash verification skipped (disabled in config)");
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logService.Log($"Error downloading/verifying file: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> CheckCertificateValid(string url)
        {
            if (!_configService.GetConfig().Security.CheckCertificates)
            {
                _logService.Log("Certificate checking disabled in config");
                return true;
            }

            try
            {
                using (var response = await _httpClient.GetAsync(url))
                {
                    // If we get here without exception, the certificate is valid
                    _logService.Log($"Certificate validation successful for {url}");
                    return true;
                }
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("certificate"))
            {
                _logService.Log($"Certificate validation failed for {url}: {ex.Message}");
                return false;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error checking certificate for {url}: {ex.Message}");
                return false;
            }
        }

        public bool IsTrustedPublisher(string publisher)
        {
            var trustedPublishers = _configService.GetConfig().Security.TrustedPublishers;
            return trustedPublishers.Contains(publisher, StringComparer.OrdinalIgnoreCase);
        }

        public void AddTrustedPublisher(string publisher)
        {
            if (!string.IsNullOrWhiteSpace(publisher))
            {
                var config = _configService.GetConfig();
                if (!config.Security.TrustedPublishers.Contains(publisher, StringComparer.OrdinalIgnoreCase))
                {
                    config.Security.TrustedPublishers.Add(publisher);
                    _logService.Log($"Added trusted publisher: {publisher}");
                }
            }
        }

        public void RemoveTrustedPublisher(string publisher)
        {
            var config = _configService.GetConfig();
            config.Security.TrustedPublishers.RemoveAll(p =>
                p.Equals(publisher, StringComparison.OrdinalIgnoreCase));
            _logService.Log($"Removed trusted publisher: {publisher}");
        }

        public async Task<bool> PerformSecurityScan(string path)
        {
            _logService.Log($"Performing security scan on: {path}");

            try
            {
                bool isSecure = true;
                var config = _configService.GetConfig();

                if (Directory.Exists(path))
                {
                    var files = Directory.GetFiles(path, "*", SearchOption.AllDirectories);
                    foreach (var file in files)
                    {
                        if (config.Security.KnownHashes.TryGetValue(file, out var expectedHash))
                        {
                            if (!await VerifyFileHash(file, expectedHash))
                            {
                                isSecure = false;
                                _logService.Log($"SECURITY ALERT: File hash mismatch: {file}");
                            }
                        }
                    }
                }
                else if (File.Exists(path))
                {
                    if (config.Security.KnownHashes.TryGetValue(path, out var expectedHash))
                    {
                        if (!await VerifyFileHash(path, expectedHash))
                        {
                            isSecure = false;
                            _logService.Log($"SECURITY ALERT: File hash mismatch: {path}");
                        }
                    }
                }

                _logService.Log($"Security scan completed. Result: {(isSecure ? "SECURE" : "ISSUES FOUND")}");
                return isSecure;
            }
            catch (Exception ex)
            {
                _logService.Log($"Error during security scan: {ex.Message}");
                return false;
            }
        }

        public void AddKnownHash(string filePath, string hash, string algorithm = "SHA256")
        {
            var config = _configService.GetConfig();
            var key = $"{algorithm}:{filePath}";
            config.Security.KnownHashes[key] = hash;
            _logService.Log($"Added known hash for {filePath}");
        }

        public bool IsSandboxModeEnabled()
        {
            return _configService.GetConfig().Security.SandboxMode;
        }

        public void SetSandboxMode(bool enabled)
        {
            var config = _configService.GetConfig();
            config.Security.SandboxMode = enabled;
            _logService.Log($"Sandbox mode {(enabled ? "enabled" : "disabled")}");
        }
    }
}
