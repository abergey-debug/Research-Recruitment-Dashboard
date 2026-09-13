# Research Recruitment Dashboard

An Electron desktop app for managing PREVENTABLE trial recruitment: patient
lookup from a pasted Excel selection, script/consent PDF viewer, an embedded
Google Voice panel with live call controls (voicemail drop, mic mute, hang
up), an embedded OneDrive/SharePoint panel, and one-click "Email Patient"
using desktop Outlook.

## Requirements

- **Node.js** (LTS) — the setup script installs this automatically if
  it's missing, on both platforms: via `winget` on Windows, via Homebrew
  on Mac (installing Homebrew itself first if needed). Either way you'll
  be asked to approve a permission prompt (Windows) or enter your Mac
  password (Homebrew).
- **Windows**: classic desktop Microsoft Outlook, installed and signed in
  (the "Email Patient" button automates it directly — this does **not**
  work with the new Outlook for Windows app, which has no automation
  interface)
- **Mac**: Microsoft Outlook for Mac, installed and signed in

## Setup

### Windows

1. Get the code onto your computer — either:
   - **Download**: on this repo's GitHub page, click the green **Code**
     button → **Download ZIP**, then extract it, or
   - **Clone**: `git clone` this repo, if you have git and a GitHub
     account with access.
2. Double-click **`Setup.bat`** in the extracted/cloned folder. It
   installs Node.js if needed (approve the Windows permission prompt if
   one appears), runs `npm install`, and creates a **Research Recruitment
   Dashboard** shortcut on your Desktop.
3. Double-click that Desktop shortcut any time to launch the app.

### Mac

1. Get the code onto your computer — either download this repo as a ZIP
   from GitHub (green **Code** button → **Download ZIP**) and extract it,
   or `git clone` it.
2. Double-click **`Setup.command`** in the extracted/cloned folder — this
   opens Terminal automatically and runs the setup there (you'll see the
   first-launch security warning described below the first time). It
   installs Node.js if needed (via Homebrew — enter your Mac password if
   asked), runs `npm install`, and puts a **Research Recruitment
   Dashboard** app icon on your Desktop (a shortcut back into this folder
   — don't move or delete the folder afterward).
3. Double-click that Desktop icon any time to launch the app.

## First launch, either platform

- The **Google Voice** and **OneDrive** panels need you to sign in the
  first time you open them — click **Show Google Voice** at the top of
  the Patient Info panel (works even before any patient is loaded), or
  use the OneDrive panel directly. This only has to be done once per
  computer; the session is remembered after that.
- To use a patient's Excel row: select it in Excel, press **Ctrl+C**,
  then click **Paste from Excel** in the app.

## Updating

- **If you cloned with git**: run `git pull` in the project folder, then
  re-run `Setup.bat` (Windows) or double-click `Setup.command` (Mac) in
  case dependencies changed — both are safe to run again any time.
- **If you downloaded a ZIP**: download a fresh ZIP from GitHub, extract
  it over the old folder (or delete the old one first), then re-run
  `Setup.bat` / `Setup.command`.

## Project layout

- `main.js` / `preload.js` / `index.html` — the Electron app itself
- `Research Files/` — recruitment PDFs (scripts, consent forms) and email
  attachment templates, bundled with the app
- `Launch Dashboard.bat` / `.vbs` — Windows launcher (used by the Desktop
  shortcut `Setup.bat` creates)
- `Launch Dashboard.command` — Mac Terminal launcher (visible console)
- `Research Recruitment Dashboard.app` — Mac app bundle for a silent,
  no-console launch (used by the Desktop icon `setup.sh` creates)
- `scripts/start.js` — cross-platform `npm start` entry point
- `Setup.bat` / `Setup.command` — double-click setup entry points
- `setup.ps1` / `setup.sh` — the actual setup scripts they run

## Troubleshooting

- **"Email Patient" opens Outlook 2016 / classic Outlook specifically**:
  expected on Windows — desktop automation only works through classic
  Outlook's COM interface, not the new Outlook for Windows app.
- **Node.js not found**: both `Setup.bat` (via `winget`) and `setup.sh`
  (via Homebrew) try to install it automatically — approve the
  permission prompt/password request when it appears. If that fails
  (older Windows without `winget`, no internet access, or the prompt was
  declined), install it manually from [nodejs.org](https://nodejs.org),
  then run setup again.
- **"Electron failed to install correctly"** when launching the app:
  `npm install` can report success even though Electron's own
  postinstall step silently failed to download and unpack its ~100MB
  platform binary. Setup already checks for this and retries once
  automatically. Two known causes if it still fails:
  - A flaky network/firewall blocking the download from GitHub — try a
    different network or turn off any VPN.
  - **Mac only, confirmed in practice**: Homebrew's plain `node` formula
    installs the newest *Current* Node.js release rather than a stable
    LTS line, and that's too new for this project's Electron version —
    its unzip step (`extract-zip`) silently dies partway through with no
    error. `setup.sh` already installs a pinned LTS formula (`node@24`)
    to avoid this, but if you're troubleshooting manually, run:
    `brew install node@24 && export PATH="$(brew --prefix node@24)/bin:$PATH"`
    before `npm install`.
  - To force a clean retry either way, clear the cache first:
    - **Windows** (PowerShell): `Remove-Item -Recurse -Force node_modules, "$env:LOCALAPPDATA\electron\Cache"`
    - **Mac**: `rm -rf node_modules "$HOME/Library/Caches/electron"`
- **PDF viewer shows nothing**: make sure the selected file actually
  exists under `Research Files/Call Files/`.
- **Mac: "cannot be opened because it is from an unidentified developer"**
  (or "Apple could not verify..."), the first time you double-click
  `Setup.command`, `Launch Dashboard.command`, or the **Research
  Recruitment Dashboard** app: expected — nothing here is code-signed by
  an Apple Developer account. Right-click (or Control-click) the file →
  **Open** → **Open** in the dialog that appears, instead of double-
  clicking. You only need to do this once per file; after that it opens
  normally. (If you don't see an Open option, check **System Settings →
  Privacy & Security** for an "Open Anyway" button.)
