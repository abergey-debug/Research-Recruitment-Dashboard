# Research Recruitment Dashboard

An Electron desktop app for managing PREVENTABLE trial recruitment: patient
lookup from a pasted Excel selection, script/consent PDF viewer, an embedded
Google Voice panel with live call controls (voicemail drop, mic mute, hang
up), an embedded OneDrive/SharePoint panel, and one-click "Email Patient"
using desktop Outlook.

## Requirements

- **Node.js** (LTS) — the Windows setup script installs this automatically
  if it's missing (via `winget`, with a permission prompt you'll need to
  approve); on Mac you'll need to install it yourself first, from
  [nodejs.org](https://nodejs.org) or `brew install node`.
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

1. Install [Node.js](https://nodejs.org) if it isn't already (or
   `brew install node`) — the Mac setup script doesn't install it for you.
2. Get the code onto your computer — either download this repo as a ZIP
   from GitHub (green **Code** button → **Download ZIP**) and extract it,
   or `git clone` it.
3. Open Terminal in the project folder and run `./setup.sh`. It runs
   `npm install` and puts a **Research Recruitment Dashboard** app icon
   on your Desktop (a shortcut back into this folder — don't move or
   delete the folder afterward).
4. Double-click that Desktop icon any time to launch the app.

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
  re-run `Setup.bat` (Windows) or `./setup.sh` (Mac) in case dependencies
  changed — both are safe to run again any time.
- **If you downloaded a ZIP**: download a fresh ZIP from GitHub, extract
  it over the old folder (or delete the old one first), then re-run
  `Setup.bat` / `./setup.sh`.

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
- `setup.ps1` / `setup.sh` — first-time setup scripts

## Troubleshooting

- **"Email Patient" opens Outlook 2016 / classic Outlook specifically**:
  expected on Windows — desktop automation only works through classic
  Outlook's COM interface, not the new Outlook for Windows app.
- **Node.js not found** when running `Setup.bat`: it tries to install
  Node.js automatically via `winget` — approve the Windows permission
  prompt when it appears. If that fails (older Windows without `winget`,
  or the prompt was declined), install it manually from
  [nodejs.org](https://nodejs.org), then run `Setup.bat` again. On Mac,
  `setup.sh` always requires Node.js to already be installed.
- **PDF viewer shows nothing**: make sure the selected file actually
  exists under `Research Files/Call Files/`.
