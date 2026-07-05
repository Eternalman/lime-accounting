/**
 * electron-vite 构建配置
 * 主进程和预加载脚本从 TypeScript 源码编译，renderer 使用 Vite + React
 */
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // 主进程入口：编译 electron/main.ts → out/main/index.js
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main.ts') },
        external: ['electron', 'mysql2/promise', 'mysql2', 'path']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload.ts') },
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
