/**
 * electron/preload.ts 单元测试
 *
 * 测试策略：preload.ts 依赖 Electron 的 contextBridge/ipcRenderer 模块，
 * vitest 无法在 TypeScript 文件中可靠劫持 require('electron') 调用。
 * 因此本测试直接从源码提取 API 结构进行验证，而非动态导入模块。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('preload.ts — 预加载脚本', () => {
  // 从源码提取 invoke 调用的通道名和方法名
  function extractChannelMappings(): Record<string, string> {
    const filePath = resolve(__dirname, '../../electron/preload.ts')
    const source = readFileSync(filePath, 'utf-8')

    const mappings: Record<string, string> = {}
    const lines = source.split('\n')

    let currentMethod = ''
    for (const line of lines) {
      // 匹配方法定义: methodName: (params) =>
      const methodMatch = line.match(/^\s*(\w+):\s*\(/)
      if (methodMatch) {
        currentMethod = methodMatch[1]
      }
      // 匹配 invoke 调用: invoke('channel', ...)
      const invokeMatch = line.match(/invoke\('([^']+)'/)
      if (invokeMatch && currentMethod) {
        mappings[currentMethod] = invokeMatch[1]
      }
    }
    return mappings
  }

  // 从源码提取 contextBridge 命名空间
  function extractNamespace(): string {
    const filePath = resolve(__dirname, '../../electron/preload.ts')
    const source = readFileSync(filePath, 'utf-8')
    const match = source.match(/exposeInMainWorld\('([^']+)'/)
    return match ? match[1] : ''
  }

  // 从源码提取所有暴露的方法名
  function extractExposedMethods(): string[] {
    const filePath = resolve(__dirname, '../../electron/preload.ts')
    const source = readFileSync(filePath, 'utf-8')
    const methods: string[] = []
    const lines = source.split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s*\(/)
      if (match && match[1] !== 'api') {
        methods.push(match[1])
      }
    }
    return methods
  }

  // ==================== contextBridge 配置 ====================
  describe('contextBridge.exposeInMainWorld()', () => {
    it('应将 API 挂载到 window.api 命名空间', () => {
      expect(extractNamespace()).toBe('api')
    })

    it('应暴露恰好 10 个方法', () => {
      const expected = [
        'getCategories', 'addCategory', 'updateCategory', 'deleteCategory',
        'addRecord', 'getRecords', 'deleteRecord',
        'getBudget', 'setBudget', 'getMonthlyStats'
      ]
      const actual = extractExposedMethods()
      expected.forEach(m => expect(actual).toContain(m))
      expect(actual.length).toBe(10)
    })
  })

  // ==================== IPC 通道名称验证 ====================
  describe('IPC 通道名称 — 与主进程 main.ts 一致', () => {
    const expectedChannels: Record<string, string> = {
      getCategories: 'db:getCategories',
      addCategory: 'db:addCategory',
      updateCategory: 'db:updateCategory',
      deleteCategory: 'db:deleteCategory',
      addRecord: 'db:addRecord',
      getRecords: 'db:getRecords',
      deleteRecord: 'db:deleteRecord',
      getBudget: 'db:getBudget',
      setBudget: 'db:setBudget',
      getMonthlyStats: 'db:getMonthlyStats'
    }

    Object.entries(expectedChannels).forEach(([method, channel]) => {
      it(`${method}() → '${channel}'`, () => {
        const mappings = extractChannelMappings()
        expect(mappings[method]).toBe(channel)
      })
    })
  })

  // ==================== 安全配置验证 ====================
  describe('安全配置', () => {
    it('预加载脚本中不应包含危险的 API 暴露', () => {
      const filePath = resolve(__dirname, '../../electron/preload.ts')
      const source = readFileSync(filePath, 'utf-8')

      // 不应直接暴露 ipcRenderer 给渲染进程
      expect(source).not.toMatch(/exposeInMainWorld.*ipcRenderer/)
      // 不应启用 nodeIntegration（此配置在主进程，但预加载应配合）
      // contextBridge 正确使用（不传入 ipcRenderer 对象本身）
    })

    it('所有方法应通过 invoke 函数间接调用 ipcRenderer', () => {
      const filePath = resolve(__dirname, '../../electron/preload.ts')
      const source = readFileSync(filePath, 'utf-8')

      // 检查 invoke 函数封装了 ipcRenderer.invoke
      expect(source).toContain('ipcRenderer.invoke')
      // 不应直接调用 ipcRenderer.send 或其他方法
      expect(source).not.toContain('ipcRenderer.send(')
      expect(source).not.toContain('ipcRenderer.on(')
    })
  })

  // ==================== main.ts 通道一致性 ====================
  describe('通道名称交叉验证 — 与主进程 main.ts 对比', () => {
    it('preload.ts 中注册的所有通道在 main.ts 中都应有对应的 handler', () => {
      const mainPath = resolve(__dirname, '../../electron/main.ts')
      const mainSource = readFileSync(mainPath, 'utf-8')

      const preloadChannels = Object.values(extractChannelMappings())

      preloadChannels.forEach(channel => {
        // main.ts 中应有 handle('channel', ...) 的注册
        expect(mainSource).toContain(channel)
      })
    })
  })
})
