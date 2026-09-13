$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot

try {

Write-Host "== Research Recruitment Dashboard setup ==" -ForegroundColor Cyan
Write-Host ""

# -- 1. Make sure Node.js is available --
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm -and (Test-Path "$env:ProgramFiles\nodejs\npm.cmd")) {
  $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
  $npm = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $npm) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host "Node.js was not found - installing it now via winget." -ForegroundColor Yellow
    Write-Host "Windows will likely ask you to approve a permission prompt - click Yes." -ForegroundColor Yellow
    try {
      Start-Process winget -ArgumentList @(
        'install', '--id', 'OpenJS.NodeJS.LTS', '-e',
        '--accept-package-agreements', '--accept-source-agreements', '--silent'
      ) -Verb RunAs -Wait -ErrorAction Stop
    } catch {
      Write-Host "The install prompt was declined or failed to launch." -ForegroundColor Yellow
    }

    # Installing doesn't update this already-running process's environment,
    # so re-read PATH from the registry before checking again.
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm -and (Test-Path "$env:ProgramFiles\nodejs\npm.cmd")) {
      $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
      $npm = Get-Command npm -ErrorAction SilentlyContinue
    }
  }
}

if (-not $npm) {
  Write-Host "Node.js could not be installed automatically." -ForegroundColor Yellow
  Write-Host "Install the LTS version from https://nodejs.org, then run this setup again."
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "Node.js found: $(node --version)" -ForegroundColor Green

# -- 2. Install dependencies --
Write-Host ""
Write-Host "Installing dependencies (this can take a minute)..." -ForegroundColor Cyan
Push-Location $projectDir
& npm install
$installExit = $LASTEXITCODE
Pop-Location

if ($installExit -ne 0) {
  Write-Host "npm install failed - see the errors above." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

# npm install can report success even though Electron's own postinstall step
# failed to download its platform binary (a flaky network/firewall blocking
# the download is the usual cause) - leaving a broken half-installed package
# that only fails later, when actually trying to launch the app. Catch that
# here instead, since "require('electron')" exercises the exact same lookup
# that fails at launch time.
#
# Note: don't redirect this native command's stderr (e.g. "2>$null") under
# $ErrorActionPreference = 'Stop' - PowerShell 5.1 wraps each redirected
# stderr line as a NativeCommandError, which then becomes a terminating
# error under 'Stop' and gets swallowed by the outer try/catch instead of
# being handled here. Wrapping the call itself in try/catch sidesteps that.
function Test-ElectronOk {
  try {
    & node -e "require('electron')" *>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "Verifying Electron installed correctly..." -ForegroundColor Cyan
Push-Location $projectDir
$electronOk = Test-ElectronOk
if (-not $electronOk) {
  Write-Host "Electron's binary looks broken - clearing its cache and retrying the download..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force "node_modules\electron" -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron\Cache" -ErrorAction SilentlyContinue
  & npm install electron --no-save
  $electronOk = Test-ElectronOk
}
Pop-Location

if (-not $electronOk) {
  Write-Host ""
  Write-Host "Electron still failed to install after a retry." -ForegroundColor Red
  Write-Host "This is almost always a network or firewall blocking the download from GitHub."
  Write-Host "Try a different network (or turn off any VPN) and run this setup again."
  Read-Host "Press Enter to close"
  exit 1
}
Write-Host "Electron OK." -ForegroundColor Green

# -- 3. Create a desktop shortcut --
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

# -- 4. Wrap up --
Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Double-click 'Research Recruitment Dashboard' on the desktop to launch it."
Write-Host ""
Write-Host "Notes:" -ForegroundColor Cyan
Write-Host " - The 'Email Patient' feature requires classic desktop Microsoft Outlook"
Write-Host "   to be installed and signed in (not the new Outlook for Windows app)."
Write-Host " - The first time you open the Google Voice and OneDrive panels, you'll"
Write-Host "   need to sign in - this only has to be done once per computer."
Write-Host ""
Read-Host "Press Enter to close"

} catch {
  Write-Host ""
  Write-Host "Setup hit an unexpected error:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
