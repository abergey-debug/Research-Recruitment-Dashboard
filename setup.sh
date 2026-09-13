#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Research Recruitment Dashboard setup =="
echo

# Homebrew's node install location isn't always on PATH in every shell context.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js was not found - installing it now via Homebrew."

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew isn't installed either - installing it first."
    echo "You'll be asked for your Mac password to authorize this."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true

    if [ -x /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi

  # Guarded with "|| true" so a failure here (e.g. no internet) falls through
  # to the friendlier "could not be installed automatically" message below,
  # instead of set -e aborting the script right here with just brew's own
  # raw error output.
  if command -v brew >/dev/null 2>&1; then
    brew install node || true
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js could not be installed automatically."
  echo "Install the LTS version from https://nodejs.org, then run this setup again."
  exit 1
fi

echo "Node.js found: $(node --version)"
echo
echo "Installing dependencies (this can take a minute)..."
if ! npm install; then
  echo
  echo "npm install failed - see the errors above."
  exit 1
fi

# npm install can report success even though Electron's own postinstall step
# failed to download its ~100MB platform binary (a flaky network/firewall
# blocking the download is the usual cause) - leaving a broken half-installed
# package that only fails later, when actually trying to launch the app.
# Catch that here instead, since "require('electron')" exercises the exact
# same lookup that fails at launch time.
echo
echo "Verifying Electron installed correctly..."
if ! node -e "require('electron')" >/dev/null 2>&1; then
  echo "Electron's binary looks broken - clearing its cache and retrying the download..."
  rm -rf node_modules/electron "$HOME/Library/Caches/electron"
  npm install electron --no-save || true
  if ! node -e "require('electron')" >/dev/null 2>&1; then
    echo
    echo "Electron still failed to install after a retry."
    echo "This is almost always a network or firewall blocking the download from GitHub."
    echo "Try a different network (or turn off any VPN) and run this setup again."
    exit 1
  fi
fi
echo "Electron OK."

echo
echo "Creating a Desktop shortcut..."
ln -sf "$DIR/Research Recruitment Dashboard.app" "$HOME/Desktop/Research Recruitment Dashboard.app"

echo
echo "Setup complete."
echo "Double-click 'Research Recruitment Dashboard' on the Desktop to launch it."
echo
echo "Notes:"
echo " - The 'Email Patient' feature requires classic desktop Microsoft Outlook"
echo "   to be installed and signed in."
echo " - The first time you open the Google Voice and OneDrive panels, you'll"
echo "   need to sign in - this only has to be done once per computer."
