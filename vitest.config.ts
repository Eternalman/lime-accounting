/**
 * Vitest 单元测试配置
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // node 环境用于后端逻辑（electron 主进程代码）
    environment: 'node',
    // 测试文件匹配模式
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    // 全局测试超时（数据库初始化测试可能较慢）
    testTimeout: 15000,
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './tests/coverage',
      include: ['electron/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx']
    }
  }
})
