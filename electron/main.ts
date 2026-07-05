/**
 * 青柠记账 — Electron 主进程
 * 负责窗口管理、IPC 通信、数据库操作调度
 *
 * 架构说明：
 *   IPC handler 在模块顶层注册（在任何窗口创建之前），确保渲染进程调用时 handler 已就绪
 *   应用事件监听也在模块顶层注册（遵循 Electron 推荐模式，避免遗漏事件）
 *   数据库连接测试和建表在 app.whenReady() 之后按顺序执行
 */

const electron = require('electron')
const path = require('path')
const { query, testConnection, initSchema, closePool } = require('./database')

const { app, BrowserWindow, ipcMain } = electron

// ========== IPC 通信处理 ==========

/**
 * 统一封装 IPC handler 注册
 * 所有 handler 返回 { success: true, data } 或 { success: false, error: "消息" } 统一格式
 * 错误信息直接透传（由各 handler 自行抛出对用户友好的中文错误消息）
 */
function handle(channel: string, handler: (...args: any[]) => Promise<any>) {
  ipcMain.handle(channel, async (_event: any, ...args: any[]) => {
    try {
      return { success: true, data: await handler(...args) }
    } catch (err: any) {
      console.error(`[${channel}] 出错:`, err)
      return { success: false, error: err.message || '未知错误' }
    }
  })
}

// ---- 分类 CRUD ----

handle('db:getCategories', () =>
  query('SELECT id, name, icon, parent_id AS parentId, sort_order AS sortOrder, is_default AS isDefault FROM categories ORDER BY sort_order'))

handle('db:addCategory', (cat: any) =>
  query('INSERT INTO categories (name, icon, parent_id, sort_order) VALUES (?, ?, ?, 99)',
    [cat.name, cat.icon || '', cat.parentId || null])
    .then((r: any) => ({ id: r.insertId })))

handle('db:updateCategory', (cat: any) =>
  query('UPDATE categories SET name=?, icon=? WHERE id=?',
    [cat.name, cat.icon || '', cat.id])
    .then(() => ({ ok: true })))

handle('db:deleteCategory', async (id: number) => {
  // 安全检查1：是否有记录关联此分类
  const cnt = await query('SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [id])
  if (cnt[0].cnt > 0) {
    throw new Error('该分类下有' + cnt[0].cnt + '条记账记录，请先删除相关记录或将其移至其他分类')
  }
  // 安全检查2：检查子分类是否有关联记录（逐一检查，给出具体分类名）
  const children = await query('SELECT id, name FROM categories WHERE parent_id=?', [id])
  for (const child of children as any[]) {
    const childCnt = await query('SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [child.id])
    if (childCnt[0].cnt > 0) {
      throw new Error('子分类"' + child.name + '"下有' + childCnt[0].cnt + '条记录，请先处理')
    }
  }
  // 安全检查通过，执行删除（仅允许删除非默认分类）
  return query('DELETE FROM categories WHERE id=? AND is_default=0', [id]).then(() => ({ ok: true }))
})

// ---- 记账记录 CRUD ----

handle('db:addRecord', (record: any) =>
  query('INSERT INTO records (type, amount, category_id, record_date, note) VALUES (?, ?, ?, ?, ?)',
    [record.type, record.amount, record.categoryId, record.recordDate, record.note || ''])
    .then((r: any) => ({ id: r.insertId })))

handle('db:getRecords', (filters: any) => {
  // WHERE 1=1 为后续动态拼接 AND 条件提供统一语法前缀
  let sql = 'SELECT r.*, c.name AS category_name, c.icon AS category_icon, p.name AS parent_name, p.icon AS parent_icon FROM records r JOIN categories c ON r.category_id=c.id LEFT JOIN categories p ON c.parent_id=p.id WHERE 1=1'
  const params: any[] = []
  if (filters.startDate) { sql += ' AND r.record_date >= ?'; params.push(filters.startDate) }
  if (filters.endDate)   { sql += ' AND r.record_date <= ?'; params.push(filters.endDate) }
  if (filters.type)      { sql += ' AND r.type = ?'; params.push(filters.type) }
  // 使用 != null 而非真值检查，正确处理 categoryId=0 的边缘情况
  if (filters.categoryId != null) { sql += ' AND r.category_id = ?'; params.push(filters.categoryId) }
  sql += ' ORDER BY r.record_date DESC, r.id DESC'
  return query(sql, params)
})

handle('db:deleteRecord', (id: number) =>
  query('DELETE FROM records WHERE id=?', [id]).then(() => ({ ok: true })))

// ---- 月度预算 ----

handle('db:getBudget', (year: number, month: number) =>
  query('SELECT * FROM budgets WHERE year=? AND month=?', [year, month])
    .then((rows: any) => rows[0] || null))

// ON DUPLICATE KEY UPDATE 实现"存在则更新、不存在则插入"的 upsert 语义
// 依赖 budgets 表的 UNIQUE KEY uk_year_month (year, month)
handle('db:setBudget', (budget: any) =>
  query('INSERT INTO budgets (year, month, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount=?, updated_at=CURRENT_TIMESTAMP',
    [budget.year, budget.month, budget.amount, budget.amount])
    .then(() => ({ ok: true })))

// ---- 月度统计 ----
// 使用范围查询（r.record_date >= start AND r.record_date < end）
// 而非 YEAR()/MONTH() 函数包裹，确保 MySQL 能利用 record_date 索引
handle('db:getMonthlyStats', (year: number, month: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  // 计算下个月第一天作为结束日期（处理跨年：12月 → 次年1月）
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  return query(
    `SELECT c.parent_id AS parentId, p.name AS parentName, p.icon AS parentIcon,
            r.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
            r.type, SUM(r.amount) AS total
     FROM records r
     JOIN categories c ON r.category_id = c.id
     LEFT JOIN categories p ON c.parent_id = p.id
     WHERE r.record_date >= ? AND r.record_date < ?
     GROUP BY r.type, r.category_id
     ORDER BY total DESC`,
    [startDate, endDate]
  )
})

// ========== 窗口管理 ==========

// 模块级变量，createWindow() 和 activate 事件均可访问
let mainWindow: any = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    minWidth: 900, minHeight: 600,
    title: '青柠记账',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,   // 开启上下文隔离（安全）
      nodeIntegration: false     // 关闭 Node 集成（安全）
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 正式发布时注释掉下面这行；调试需要时可取消注释
  // mainWindow.webContents.openDevTools()
}

// ========== 应用生命周期事件（模块顶层注册，确保不遗漏）==========

// 所有窗口关闭时：macOS 保持应用运行（符合平台惯例），Windows/Linux 退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS Dock 图标点击重新激活时，若无窗口则创建
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 应用退出前关闭数据库连接池，释放 MySQL 连接
app.on('before-quit', async (event: any) => {
  event.preventDefault()  // 暂缓退出，等待连接池关闭完成
  try {
    await closePool()
  } catch (err) {
    console.error('关闭数据库连接池时出错:', err)
  }
  app.exit(0)  // 连接释放后强制退出
})

// ========== 启动流程 ==========

app.whenReady().then(async () => {
  // 步骤1：测试数据库连接
  const connected = await testConnection()
  if (!connected) {
    // 连接失败时弹出系统对话框告知用户，不静默进入不可用状态
    electron.dialog.showErrorBox(
      '数据库连接失败',
      '无法连接到 MySQL 数据库。\n\n' +
      '请检查以下事项：\n' +
      '  1. MySQL 服务是否已启动\n' +
      '  2. 数据库 lime_accounting 是否已创建\n' +
      '  3. 用户名和密码是否正确（默认 root / 123456）\n\n' +
      '修复后请重新启动应用。'
    )
    app.quit()
    return
  }
  console.log('✅ 数据库连接成功')

  // 步骤2：初始化数据库表结构（首次运行自动建表 + 插入默认分类）
  try {
    await initSchema()
    console.log('✅ 数据库表结构就绪')
  } catch (err: any) {
    console.error('数据库初始化失败:', err)
    electron.dialog.showErrorBox(
      '数据库初始化失败',
      '无法创建数据库表结构。\n\n错误信息：' + (err.message || '未知错误') +
      '\n\n请检查 MySQL 服务状态后重新启动应用。'
    )
    app.quit()
    return
  }

  // 步骤3：创建主窗口
  createWindow()
})