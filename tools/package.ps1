$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stageRoot = Join-Path $packageRoot ('test-results/package-' + [guid]::NewGuid().ToString('N'))
$releaseRoot = Join-Path $packageRoot 'release'
New-Item -ItemType Directory -Path $stageRoot, $releaseRoot -Force | Out-Null
$runtimeFiles = @(
  'manifest.json', 'popup.html', 'report.html', 'offscreen.html', 'probe.html', 'README.md',
  'scripts/background.js', 'scripts/content.js', 'scripts/core.js', 'scripts/page-panel.js', 'scripts/ui-icons.js',
  'scripts/hash-worker.js', 'scripts/offscreen.js', 'scripts/popup.js', 'scripts/compact.js', 'scripts/protection.js',
  'scripts/vendor/noble-hashes-LICENSE.txt', 'css/popup.css',
  'icons/icon16.png', 'icons/icon128.png',
  '_locales/en/messages.json', '_locales/fr/messages.json',
  'settings/en/instructions.html', 'settings/fr/instructions.html'
)
foreach ($relativePath in $runtimeFiles) {
  $targetPath = Join-Path $stageRoot $relativePath
  New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $packageRoot $relativePath) -Destination $targetPath
}
$version = (Get-Content -Raw -LiteralPath (Join-Path $packageRoot 'manifest.json') | ConvertFrom-Json).version
$archivePath = Join-Path $releaseRoot ('AutomatedChecksumVerification-' + $version + '.zip')
Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $archivePath -Force
Write-Output $archivePath
