/**
 * electron-vite 构建配置
 * 主进程使用原始 JS（不编译），preload 和 renderer 正常编译
 */
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // 主进程不编译，直接由 Electron 加载 electron/main.js
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main.js') },
        external: ['electron', 'mysql2', 'path']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload.js') },
        external: ['electron']
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
