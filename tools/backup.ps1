$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $repo 'backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupName = 'budget-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
$destination = Join-Path $backupDir $backupName
Push-Location $repo
try {
  docker compose exec -T db pg_dump -U budget -d budget -Fc -f /tmp/budget-backup.dump
  if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
  docker compose cp db:/tmp/budget-backup.dump $destination
  if ($LASTEXITCODE -ne 0) { throw 'Copying the backup failed.' }
  Write-Host "Backup saved to $destination. Keep an encrypted copy off this PC."
} finally { Pop-Location }
