$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repo '.env'
if (Test-Path -LiteralPath $envFile) {
  Write-Host 'Existing .env preserved. Starting the app.'
} else {
  $dbBytes = New-Object byte[] 32
  $jwtBytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($dbBytes)
  $rng.GetBytes($jwtBytes)
  $rng.Dispose()
  $dbPassword = -join ($dbBytes | ForEach-Object { $_.ToString('x2') })
  $jwtSecret = -join ($jwtBytes | ForEach-Object { $_.ToString('x2') })
  @("POSTGRES_PASSWORD=$dbPassword", "JWT_SECRET=$jwtSecret", 'APP_ORIGIN=http://localhost:4000', 'COOKIE_SECURE=false') | Set-Content -LiteralPath $envFile
}
Push-Location $repo
try {
  docker compose up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'Docker could not start the app. Check Docker Desktop is running.' }
  Write-Host 'Open http://localhost:4000. See docs/personal-deployment.md for secure remote access.'
} finally { Pop-Location }
