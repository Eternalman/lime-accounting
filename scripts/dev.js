/**
 * 开发启动脚本（跨平台兼容）
 * 清除 ELECTRON_RUN_AS_NODE 环境变量后启动 electron-vite
 */
const { spawn } = require('child_process')

// 删除会导致 Electron 无法正常启动的环境变量
delete process.env.ELECTRON_RUN_AS_NODE

// 启动 electron-vite dev
const child = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
})

child.on('close', (code) => {
  process.exit(code)
})
