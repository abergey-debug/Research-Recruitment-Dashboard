$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot

Write-Host "== Research Recruitment Dashboard setup ==" -ForegroundColor Cyan
Write-Host ""

# ── 1. Make sure Node.js is available ──────────────────────────────
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm -and (Test-Path "$env:ProgramFiles\nodejs\npm.cmd")) {
  $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
  $npm = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $npm) {
  Write-Host "Node.js was not found on this computer." -ForegroundColor Yellow
  Write-Host "Install the LTS version from https://nodejs.org, then run this setup again."
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "Node.js found: $(node --version)" -ForegroundColor Green

# ── 2. Install dependencies ─────────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies (this can take a minute)..." -ForegroundColor Cyan
Push-Location $projectDir
& npm install
$installExit = $LASTEXITCODE
Pop-Location

if ($installExit -ne 0) {
  Write-Host "npm install failed — see the errors above." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

# ── 3. Create a desktop shortcut ────────────────────────────────────
Write-Host ""
Write-Host "Creating desktop shortcut..." -ForegroundColor Cyan

$vbs  = Join-Path $projectDir "Launch Dashboard.vbs"
$icon = Join-Path $projectDir "app-icon.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Research Recruitment Dashboard.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $vbs
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = "Research Recruitment Dashboard"
$shortcut.Save()

Write-Host "Shortcut created: $lnkPath" -ForegroundColor Green

# ── 4. Wrap up ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Double-click 'Research Recruitment Dashboard' on the desktop to launch it."
Write-Host ""
Write-Host "Notes:" -ForegroundColor Cyan
Write-Host " - The 'Email Patient' feature requires classic desktop Microsoft Outlook"
Write-Host "   to be installed and signed in (not the new Outlook for Windows app)."
Write-Host " - The first time you open the Google Voice and OneDrive panels, you'll"
Write-Host "   need to sign in — this only has to be done once per computer."
Write-Host ""
Read-Host "Press Enter to close"
