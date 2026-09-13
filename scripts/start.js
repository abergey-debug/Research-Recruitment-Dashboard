// Cross-platform launcher. Some terminals (VS Code's integrated terminal on
// both macOS and Windows) set ELECTRON_RUN_AS_NODE in their environment,
// which makes `electron .` run as plain Node instead of launching the app.
// Clearing it here works the same way on every OS, unlike the old
// `ELECTRON_RUN_AS_NODE= electron .` shell syntax (bash-only, breaks on
// Windows cmd.exe/PowerShell).
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });
child.on('close', (code) => process.exit(code ?? 0));
