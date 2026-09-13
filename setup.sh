#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Research Recruitment Dashboard setup =="
echo

# Homebrew's node install location isn't always on PATH in every shell context.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Homebrew's plain "node" formula tracks the newest Current release, not a
# stable LTS line - and that's been observed to break this project's old
# Electron package: extract-zip silently dies partway through unpacking
# Electron's binary on a too-new Node, with no error at all. Prefer a
# pinned LTS formula instead. This only affects this script's own npm
# install - once Electron's binary is actually extracted, the Node version
# no longer matters, since Electron runs on its own bundled runtime from
# then on.
find_lts_node() {
  for formula in node@24 node@22 node@20; do
    local prefix
    prefix="$(brew --prefix "$formula" 2>/dev/null)" || continue
    if [ -x "$prefix/bin/node" ]; then
      echo "$prefix/bin"
      return 0
    fi
  done
  return 1
}

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew isn't installed - installing it first (needed to get a stable Node.js version)."
  echo "You'll be asked for your Mac password to authorize this."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

NODE_BIN=""
if command -v brew >/dev/null 2>&1; then
  NODE_BIN="$(find_lts_node || true)"
  if [ -z "$NODE_BIN" ]; then
    echo "Installing a stable Node.js LTS release via Homebrew (this can take a minute)..."
    brew install node@24 || true
    NODE_BIN="$(find_lts_node || true)"
  fi
  if [ -z "$NODE_BIN" ]; then
    # None of the pinned LTS formulas were available (e.g. Homebrew has
    # moved on to newer version numbers) - fall back to whatever "node" is,
    # better than failing outright even though it carries the original risk.
    echo "No pinned Node.js LTS formula found - falling back to Homebrew's default node package."
    brew install node || true
  fi
fi

if [ -n "$NODE_BIN" ]; then
  export PATH="$NODE_BIN:$PATH"
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
# failed to download and unpack its ~100MB platform binary - either a flaky
# network/firewall blocking the download, or (as seen in practice) a too-new
# Node version breaking extract-zip partway through with no visible error -
# leaving a broken half-installed package that only fails later, when
# actually trying to launch the app. Catch that here instead, since
# "require('electron')" exercises the exact same lookup that fails at
# launch time.
echo
echo "Verifying Electron installed correctly..."
if ! node -e "require('electron')" >/dev/null 2>&1; then
  echo "Electron's binary looks broken - clearing its cache and retrying the download..."
  rm -rf node_modules/electron "$HOME/Library/Caches/electron"
  npm install electron --no-save || true
  if ! node -e "require('electron')" >/dev/null 2>&1; then
    echo
    echo "Electron still failed to install after a retry."
    echo "This can be a network/firewall issue blocking the download from GitHub,"
    echo "or (less commonly) this Node.js version ($(node --version)) being"
    echo "incompatible with this old Electron package's install step. Try:"
    echo "  brew install node@24 && export PATH=\"\$(brew --prefix node@24)/bin:\$PATH\""
    echo "then run this setup again."
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
