$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$prefix = "$root\"
$config = "deploy/nginx/conf/nginx.conf"
$candidates = @(
  (Join-Path $root ".runtime/nginx/nginx.exe"),
  (Join-Path $root ".runtime/nginx-qa/nginx-1.30.8/nginx.exe")
)
$nginx = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nginx) {
  throw "Nginx was not found. Place nginx.exe in .runtime/nginx/."
}

$directories = @(
  "logs",
  ".runtime/nginx/client_body",
  ".runtime/nginx/proxy",
  ".runtime/nginx/fastcgi",
  ".runtime/nginx/uwsgi",
  ".runtime/nginx/scgi",
  ".runtime/nginx/cache"
)
foreach ($directory in $directories) {
  New-Item -ItemType Directory -Force -Path (Join-Path $root $directory) | Out-Null
}

if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
  throw "Port 8080 is already in use."
}

& $nginx -p $prefix -c $config -t
if ($LASTEXITCODE -ne 0) { throw "Nginx configuration validation failed." }

& $nginx -p $prefix -c $config
if ($LASTEXITCODE -ne 0) { throw "Nginx failed to start." }

Write-Host "Nginx is listening on http://localhost:8080"
