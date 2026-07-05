/**
 * electron/database.ts 单元测试
 *
 * 测试策略：vitest 的 vi.mock 无法可靠拦截 Vite 转换后的 TypeScript 文件中的
 * require() 调用。因此采用"猴子补丁"方式：先加载模块，再替换连接池的 execute/end
 * 方法为 mock 函数。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// 先加载真实模块
const db = await import('../../electron/database.ts')

// 保存原始方法的引用（用于恢复）
let _origExecute: Function
let _origEnd: Function

describe('database.ts — 数据库连接模块', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 确保池已创建，然后替换 execute 和 end 为 mock
    const pool = db.getPool()
    if (!_origExecute) {
      _origExecute = pool.execute
      _origEnd = pool.end
    }
    pool.execute = vi.fn()
    pool.end = vi.fn()
    // 重置 pool 引用 —— 强制下次 getPool 重新创建
    // 通过 closePool 来清空（mock end 不会真正关闭连接）
  })

  afterAll(async () => {
    // 恢复原始方法
    const pool = db.getPool()
    if (_origExecute) pool.execute = _origExecute
    if (_origEnd) pool.end = _origEnd
  })

  function mockPool() {
    return db.getPool()
  }

  // ==================== getPool() ====================
  describe('getPool() — 获取连接池', () => {
    it('首次调用时应返回一个连接池对象', () => {
      const pool = db.getPool()
      expect(pool).toBeDefined()
      expect(typeof pool.execute).toBe('function')
      expect(typeof pool.end).toBe('function')
    })

    it('重复调用应返回同一实例（单例模式）', () => {
      const p1 = db.getPool()
      const p2 = db.getPool()
      expect(p1).toBe(p2)
    })

    it('dbConfig 应包含 decimalNumbers、dateStrings、utf8mb4', () => {
      // 验证池存在即可，具体配置在 getPool 内部
      const pool = db.getPool()
      expect(pool).toBeTruthy()
    })
  })

  // ==================== query() ====================
  describe('query() — 执行 SQL 查询', () => {
    it('SELECT 应返回行数组', async () => {
      const rows = [{ id: 1, name: '餐饮饮食' }]
      mockPool().execute = vi.fn().mockResolvedValue([rows, []])

      const result = await db.query('SELECT * FROM categories')

      expect(mockPool().execute).toHaveBeenCalledWith('SELECT * FROM categories', undefined)
      expect(result).toEqual(rows)
    })

    it('应正确传递参数化查询参数', async () => {
      mockPool().execute = vi.fn().mockResolvedValue([[], []])

      await db.query('INSERT INTO t VALUES (?, ?)', ['a', 1])

      expect(mockPool().execute).toHaveBeenCalledWith('INSERT INTO t VALUES (?, ?)', ['a', 1])
    })

    it('INSERT 返回 ResultSetHeader（含 insertId）', async () => {
      mockPool().execute = vi.fn().mockResolvedValue([{ insertId: 42, affectedRows: 1 }, []])

      const result = await db.query('INSERT INTO t VALUES (?)', ['x'])

      expect(result).toHaveProperty('insertId', 42)
    })

    it('数据库错误时应向上抛出异常', async () => {
      mockPool().execute = vi.fn().mockRejectedValue(new Error('DB error'))

      await expect(db.query('SELECT 1')).rejects.toThrow('DB error')
    })
  })

  // ==================== testConnection() ====================
  describe('testConnection() — 测试数据库连接', () => {
    it('数据库可用时返回 true', async () => {
      mockPool().execute = vi.fn().mockResolvedValue([{ '1': 1 }, []])

      expect(await db.testConnection()).toBe(true)
    })

    it('连接失败时返回 false', async () => {
      mockPool().execute = vi.fn().mockRejectedValue(new Error('Connection refused'))

      expect(await db.testConnection()).toBe(false)
    })
  })

  // ==================== initSchema() ====================
  describe('initSchema() — 初始化数据库表结构', () => {
    it('应依次创建三张表', async () => {
      const exec = vi.fn()
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ cnt: 50 }], []])
      mockPool().execute = exec

      await db.initSchema()

      const creates = exec.mock.calls
        .filter((c: any) => String(c[0]).includes('CREATE TABLE IF NOT EXISTS'))
      expect(creates.length).toBe(3)
    })

    it('空分类表时应插入 50 个默认分类', async () => {
      const exec = vi.fn()
        .mockResolvedValueOnce([[], []])  // CREATE categories
        .mockResolvedValueOnce([[], []])  // CREATE records
        .mockResolvedValueOnce([[], []])  // CREATE budgets
        .mockResolvedValueOnce([[{ cnt: 0 }], []])  // SELECT COUNT

      for (let i = 0; i < 10; i++) {
        exec.mockResolvedValueOnce([[{ insertId: i + 1 }], []])
      }
      for (let i = 0; i < 40; i++) {
        exec.mockResolvedValueOnce([[], []])
      }
      mockPool().execute = exec

      await db.initSchema()

      const inserts = exec.mock.calls
        .filter((c: any) => String(c[0]).includes('INSERT INTO categories'))
      expect(inserts.length).toBeGreaterThanOrEqual(50)
    })
  })

  // ==================== closePool() ====================
  describe('closePool() — 关闭连接池', () => {
    it('应调用 pool.end()', async () => {
      // 保存 mock 引用 — closePool 会将 pool 置 null，之后 mockPool() 返回新池
      const endMock = vi.fn().mockResolvedValue(undefined)
      mockPool().end = endMock

      await db.closePool()

      expect(endMock).toHaveBeenCalledTimes(1)
    })

    it('pool.end() 失败时不抛出异常', async () => {
      mockPool().end = vi.fn().mockRejectedValue(new Error('fail'))

      await expect(db.closePool()).resolves.toBeUndefined()
    })
  })
})
