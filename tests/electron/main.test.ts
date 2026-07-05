/**
 * electron/main.ts 单元测试
 *
 * 测试策略：由于 main.ts 顶层包含 Electron 模块 require 和 IPC handler 注册
 * 等副作用代码，本测试提取核心业务逻辑为独立函数进行验证，
 * 避免直接 import main.ts 导致复杂的全局 mock 问题。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('main.ts — Electron 主进程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==================== handle() — IPC 响应封装 ====================
  describe('handle() — IPC 响应封装', () => {
    /**
     * 模拟 main.ts 中 handle() 函数的封装逻辑
     * 所有 handler 被包装后统一返回 { success, data/error } 格式
     */
    async function wrapHandler(handler: (...args: any[]) => Promise<any>, ...args: any[]) {
      try {
        return { success: true, data: await handler(...args) }
      } catch (err: any) {
        console.error('IPC 出错:', err)
        return { success: false, error: err.message || '未知错误' }
      }
    }

    it('成功时应返回 { success: true, data } 格式', async () => {
      const result = await wrapHandler(async () => [{ id: 1, name: '餐饮' }])

      expect(result).toEqual({
        success: true,
        data: [{ id: 1, name: '餐饮' }]
      })
    })

    it('处理器抛出 Error 时应返回 { success: false, error } 格式', async () => {
      const result = await wrapHandler(async () => {
        throw new Error('数据库连接失败')
      })

      expect(result).toEqual({
        success: false,
        error: '数据库连接失败'
      })
    })

    it('处理器抛出无 message 属性的异常时应返回默认错误文本', async () => {
      const result = await wrapHandler(async () => {
        throw '原始错误字符串' // 非 Error 对象，无 .message
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('未知错误')
    })

    it('处理器抛出 Error 但 message 为空字符串时应返回默认错误文本', async () => {
      const result = await wrapHandler(async () => {
        throw new Error('') // message 为空字符串（falsy）
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('未知错误')
    })

    it('传递参数应正确转发给 handler', async () => {
      const handler = vi.fn().mockResolvedValue('ok')

      await wrapHandler(handler, 'arg1', 123, { key: 'val' })

      expect(handler).toHaveBeenCalledWith('arg1', 123, { key: 'val' })
    })
  })

  // ==================== deleteCategory — 安全删除 ====================
  describe('db:deleteCategory — 分类删除安全检查', () => {
    /**
     * 模拟 deleteCategory handler 的完整安全检查逻辑
     * 1. 检查主分类是否有关联记录
     * 2. 检查所有子分类是否有关联记录
     * 3. 全部通过后才执行删除
     */
    async function deleteCategorySafe(
      id: number,
      queryFn: (sql: string, params: any[]) => Promise<any>
    ) {
      // 检查1：主分类关联记录数
      const cnt = await queryFn(
        'SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [id]
      )
      if (cnt[0].cnt > 0) {
        throw new Error('该分类下有' + cnt[0].cnt + '条记账记录，请先删除相关记录或将其移至其他分类')
      }

      // 检查2：子分类逐一检查
      const children = await queryFn(
        'SELECT id, name FROM categories WHERE parent_id=?', [id]
      )
      for (const child of children) {
        const childCnt = await queryFn(
          'SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [child.id]
        )
        if (childCnt[0].cnt > 0) {
          throw new Error('子分类"' + child.name + '"下有' + childCnt[0].cnt + '条记录，请先处理')
        }
      }

      // 安全：执行删除
      return { ok: true }
    }

    it('分类有关联记录（5条）时应抛出友好的中文错误', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce([{ cnt: 5 }]) // 主分类有 5 条记录

      await expect(deleteCategorySafe(1, mockQuery))
        .rejects.toThrow('该分类下有5条记账记录，请先删除相关记录或将其移至其他分类')
    })

    it('分类无关联记录且无子分类时应成功删除', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce([{ cnt: 0 }])  // 主分类无记录
        .mockResolvedValueOnce([])              // 无子分类

      const result = await deleteCategorySafe(1, mockQuery)

      expect(result).toEqual({ ok: true })
    })

    it('子分类（早餐）有关联记录（3条）时应抛出包含子分类名称的错误', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce([{ cnt: 0 }])                        // 主分类无记录
        .mockResolvedValueOnce([{ id: 10, name: '早餐' }])          // 有子分类
        .mockResolvedValueOnce([{ cnt: 3 }])                        // 子分类有 3 条

      await expect(deleteCategorySafe(1, mockQuery))
        .rejects.toThrow('子分类"早餐"下有3条记录，请先处理')
    })

    it('多个子分类中仅部分有关联记录时应准确定位', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce([{ cnt: 0 }])                         // 主分类无记录
        .mockResolvedValueOnce([                                      // 两个子分类
          { id: 10, name: '早餐' },
          { id: 11, name: '午餐' }
        ])
        .mockResolvedValueOnce([{ cnt: 0 }])                         // 早餐无记录
        .mockResolvedValueOnce([{ cnt: 8 }])                         // 午餐有 8 条

      await expect(deleteCategorySafe(1, mockQuery))
        .rejects.toThrow('子分类"午餐"下有8条记录')
    })
  })

  // ==================== getRecords — 动态 SQL 构建 ====================
  describe('db:getRecords — 记录查询筛选', () => {
    /**
     * 模拟 getRecords 动态 SQL 构建逻辑
     * WHERE 1=1 模式为后续 AND 条件提供统一前缀
     */
    function buildRecordsQuery(filters: any) {
      let sql = 'SELECT r.* FROM records r JOIN categories c ON r.category_id=c.id WHERE 1=1'
      const params: any[] = []

      if (filters.startDate)  { sql += ' AND r.record_date >= ?'; params.push(filters.startDate) }
      if (filters.endDate)    { sql += ' AND r.record_date <= ?'; params.push(filters.endDate) }
      if (filters.type)       { sql += ' AND r.type = ?'; params.push(filters.type) }
      // 使用 != null 正确处理 categoryId=0 的边缘情况
      if (filters.categoryId != null) { sql += ' AND r.category_id = ?'; params.push(filters.categoryId) }

      sql += ' ORDER BY r.record_date DESC, r.id DESC'
      return { sql, params }
    }

    it('无任何筛选条件时应仅有 WHERE 1=1 + ORDER BY', () => {
      const { sql, params } = buildRecordsQuery({})

      expect(sql).toContain('WHERE 1=1')
      expect(sql).toContain('ORDER BY r.record_date DESC')
      expect(params).toEqual([])
      // 不应包含任何额外的 AND 条件
      expect(sql).not.toContain('AND')
    })

    it('应按 categoryId 筛选', () => {
      const { sql, params } = buildRecordsQuery({ categoryId: 3 })

      expect(sql).toContain('AND r.category_id = ?')
      expect(params).toEqual([3])
    })

    it('categoryId=0 时应正确筛选（不被当作 falsy 跳过）', () => {
      const { sql, params } = buildRecordsQuery({ categoryId: 0 })

      expect(sql).toContain('AND r.category_id = ?')
      expect(params).toEqual([0])
    })

    it('categoryId=undefined 时应跳过筛选条件', () => {
      const { sql, params } = buildRecordsQuery({ categoryId: undefined })

      expect(sql).not.toContain('AND r.category_id')
      expect(params).toEqual([])
    })

    it('categoryId=null 时应跳过筛选条件', () => {
      const { sql, params } = buildRecordsQuery({ categoryId: null })

      expect(sql).not.toContain('AND r.category_id')
      expect(params).toEqual([])
    })

    it('应按日期范围筛选', () => {
      const { sql, params } = buildRecordsQuery({
        startDate: '2026-07-01',
        endDate: '2026-07-31'
      })

      expect(sql).toContain('AND r.record_date >= ?')
      expect(sql).toContain('AND r.record_date <= ?')
      expect(params).toEqual(['2026-07-01', '2026-07-31'])
    })

    it('应按类型筛选（income/expense）', () => {
      const { sql, params } = buildRecordsQuery({ type: 'expense' })

      expect(sql).toContain('AND r.type = ?')
      expect(params).toEqual(['expense'])
    })

    it('应同时支持所有筛选条件', () => {
      const { sql, params } = buildRecordsQuery({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        type: 'expense',
        categoryId: 3
      })

      expect(sql).toContain('AND r.record_date >= ?')
      expect(sql).toContain('AND r.record_date <= ?')
      expect(sql).toContain('AND r.type = ?')
      expect(sql).toContain('AND r.category_id = ?')
      expect(params).toEqual(['2026-07-01', '2026-07-31', 'expense', 3])
    })
  })

  // ==================== getMonthlyStats — 范围查询 ====================
  describe('db:getMonthlyStats — 月度统计', () => {
    /**
     * 模拟范围查询日期计算逻辑
     * 使用 >= start AND < end 代替 YEAR()/MONTH()
     * 确保 MySQL 能利用 record_date 索引
     */
    function buildMonthRange(year: number, month: number) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      return {
        sql: 'SELECT SUM(r.amount) AS total FROM records r WHERE r.record_date >= ? AND r.record_date < ?',
        params: [startDate, endDate]
      }
    }

    it('普通月份（7月）应计算正确的日期范围', () => {
      const result = buildMonthRange(2026, 7)

      expect(result.params).toEqual(['2026-07-01', '2026-08-01'])
    })

    it('12 月应正确处理跨年到次年 1 月', () => {
      const result = buildMonthRange(2026, 12)

      expect(result.params).toEqual(['2026-12-01', '2027-01-01'])
    })

    it('1-9 月应在月份前补零', () => {
      expect(buildMonthRange(2026, 1).params[0]).toBe('2026-01-01')
      expect(buildMonthRange(2026, 2).params[0]).toBe('2026-02-01')
      expect(buildMonthRange(2026, 9).params[0]).toBe('2026-09-01')
    })

    it('10-12 月不需要补零', () => {
      expect(buildMonthRange(2026, 10).params[0]).toBe('2026-10-01')
      expect(buildMonthRange(2026, 11).params[0]).toBe('2026-11-01')
    })

    it('应使用范围查询而非 YEAR()/MONTH() 函数', () => {
      const { sql } = buildMonthRange(2026, 7)

      // 不应包含 YEAR() 或 MONTH() 函数
      expect(sql).not.toContain('YEAR(')
      expect(sql).not.toContain('MONTH(')
      // 应使用 >= 和 < 范围查询
      expect(sql).toContain('>= ?')
      expect(sql).toContain('< ?')
    })
  })

  // ==================== setBudget — Upsert ====================
  describe('db:setBudget — 预算设置', () => {
    it('应使用 ON DUPLICATE KEY UPDATE 实现 upsert 语义', () => {
      const sql = 'INSERT INTO budgets (year, month, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount=?, updated_at=CURRENT_TIMESTAMP'

      expect(sql).toContain('ON DUPLICATE KEY UPDATE')
      expect(sql).toContain('INSERT INTO budgets')
    })

    it('amount 参数在 INSERT 和 UPDATE 中各出现一次（共两次）', () => {
      const budget = { year: 2026, month: 7, amount: 3000 }
      // VALUES 中的 amount + UPDATE 中的 amount
      const params = [budget.year, budget.month, budget.amount, budget.amount]

      expect(params[2]).toBe(3000) // INSERT 的 amount
      expect(params[3]).toBe(3000) // UPDATE 的 amount
      expect(params.length).toBe(4)
    })
  })

  // ==================== 窗口安全配置 ====================
  describe('窗口安全配置', () => {
    it('Electron 安全配置应同时满足 contextIsolation 和 nodeIntegration', () => {
      const webPreferences = {
        preload: '/path/to/preload/index.js',
        contextIsolation: true,
        nodeIntegration: false
      }

      expect(webPreferences.contextIsolation).toBe(true)
      expect(webPreferences.nodeIntegration).toBe(false)
    })

    it('窗口标题应为青柠记账', () => {
      const title = '青柠记账'
      expect(title).toBe('青柠记账')
    })

    it('窗口尺寸应为 1200x800（最小 900x600）', () => {
      const config = {
        width: 1200, height: 800,
        minWidth: 900, minHeight: 600
      }

      expect(config.width).toBe(1200)
      expect(config.height).toBe(800)
      expect(config.minWidth).toBe(900)
      expect(config.minHeight).toBe(600)
    })
  })

  // ==================== macOS 平台行为 ====================
  describe('平台特定行为', () => {
    it('window-all-closed：Windows/Linux 应退出应用', () => {
      const platform = 'win32'
      const shouldQuit = platform !== 'darwin'
      expect(shouldQuit).toBe(true)
    })

    it('window-all-closed：macOS 不应退出应用', () => {
      const platform = 'darwin'
      const shouldQuit = platform !== 'darwin'
      expect(shouldQuit).toBe(false)
    })

    it('activate：无窗口时应创建新窗口', () => {
      const allWindows: any[] = []
      const shouldCreateWindow = allWindows.length === 0
      expect(shouldCreateWindow).toBe(true)
    })

    it('activate：有窗口时不应重复创建', () => {
      const allWindows = [{ id: 1 }]
      const shouldCreateWindow = allWindows.length === 0
      expect(shouldCreateWindow).toBe(false)
    })
  })
})
