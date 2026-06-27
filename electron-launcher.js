// VS Code sets ELECTRON_RUN_AS_NODE=1 in its terminal, which disables all Electron APIs.
// This script deletes it before spawning the real Electron process.
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const electronPath = require('electron') // returns binary path in plain Node.js
const proc = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env })
proc.on('exit', (code) => process.exit(code ?? 0))
