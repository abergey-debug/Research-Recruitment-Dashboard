#!/bin/bash
# Research Recruitment Dashboard Launcher
cd "$(dirname "$0")"

# Find the keg-only Node.js LTS formula setup.sh installs (not on PATH by default).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
for formula in node@24 node@22 node@20; do
  for opt in /opt/homebrew/opt /usr/local/opt; do
    if [ -x "$opt/$formula/bin/npm" ]; then
      export PATH="$opt/$formula/bin:$PATH"
      break 2
    fi
  done
done

ELECTRON_RUN_AS_NODE= npm start
