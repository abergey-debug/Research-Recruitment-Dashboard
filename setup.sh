#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "== Research Recruitment Dashboard setup =="
echo

# Homebrew's node install location isn't always on PATH in every shell context.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js was not found on this computer."
  echo "Install the LTS version from https://nodejs.org (or run 'brew install node'), then run this setup again."
  exit 1
fi

echo "Node.js found: $(node --version)"
echo
echo "Installing dependencies (this can take a minute)..."
npm install

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
echo "   need to sign in — this only has to be done once per computer."
