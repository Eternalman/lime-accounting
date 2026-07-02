/**
 * Electron 主进程入口
 * 所有 electron API 在 app.whenReady() 之后才使用
 */
import type { BrowserWindow as BW } from 'electron'

const electron = require('electron')
const path = require('path')
const { query, testConnection } = require('./database')

// 在 app ready 之后才注册
electron.app.whenReady().then(async () => {
  const { app: a, BrowserWindow: bwCtor, ipcMain: ipc } = electron

  // 先测试数据库连接
  const connected = await (require('./database').testConnection())
  if (!connected) {
    console.error('⚠️ 数据库连接失败，请确保 MySQL 服务正在运行')
  }

  // 创建主窗口
  const mainWindow = new bwCtor({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '青柠记账',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 加载页面
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // ========== IPC 注册（在 app ready 之后）==========
  function handle(channel: string, handler: (...args: any[]) => Promise<any>) {
    ipc.handle(channel, async (_event: any, ...args: any[]) => {
      try {
        return { success: true, data: await handler(...args) }
      } catch (err: any) {
        console.error(`[${channel}] 出错:`, err)
        return { success: false, error: err.message || '未知错误' }
      }
    })
  }

  // 分类
  handle('db:getCategories', () =>
    query('SELECT id, name, icon, parent_id AS parentId, sort_order AS sortOrder, is_default AS isDefault FROM categories ORDER BY sort_order'))

  handle('db:addCategory', (cat: any) =>
    query('INSERT INTO categories (name, icon, parent_id, sort_order) VALUES (?, ?, ?, 99)', [cat.name, cat.icon || '', cat.parentId || null])
      .then((r: any) => ({ id: r.insertId })))

  handle('db:updateCategory', (cat: any) =>
    query('UPDATE categories SET name=?, icon=? WHERE id=?', [cat.name, cat.icon || '', cat.id])
      .then(() => ({ ok: true })))

  handle('db:deleteCategory', (id: number) =>
    query('DELETE FROM categories WHERE id=? AND is_default=0', [id])
      .then(() => ({ ok: true })))

  // 记录
  handle('db:addRecord', (record: any) =>
    query('INSERT INTO records (type, amount, category_id, record_date, note) VALUES (?, ?, ?, ?, ?)',
      [record.type, record.amount, record.categoryId, record.recordDate, record.note || ''])
      .then((r: any) => ({ id: r.insertId })))

  handle('db:getRecords', (filters: any) => {
    let sql = 'SELECT r.*, c.name AS category_name, c.icon AS category_icon, p.name AS parent_name, p.icon AS parent_icon FROM records r JOIN categories c ON r.category_id=c.id LEFT JOIN categories p ON c.parent_id=p.id WHERE 1=1'
    const params: any[] = []
    if (filters.startDate) { sql += ' AND r.record_date >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { sql += ' AND r.record_date <= ?'; params.push(filters.endDate) }
    if (filters.type) { sql += ' AND r.type = ?'; params.push(filters.type) }
    if (filters.categoryId) { sql += ' AND r.category_id = ?'; params.push(filters.categoryId) }
    sql += ' ORDER BY r.record_date DESC, r.id DESC'
    return query(sql, params)
  })

  handle('db:deleteRecord', (id: number) =>
    query('DELETE FROM records WHERE id=?', [id]).then(() => ({ ok: true })))

  // 预算
  handle('db:getBudget', (year: number, month: number) =>
    query('SELECT * FROM budgets WHERE year=? AND month=?', [year, month])
      .then((rows: any) => rows[0] || null))

  handle('db:setBudget', (budget: any) =>
    query('INSERT INTO budgets (year, month, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount=?, updated_at=CURRENT_TIMESTAMP',
      [budget.year, budget.month, budget.amount, budget.amount])
      .then(() => ({ ok: true })))

  // 统计
  handle('db:getMonthlyStats', (year: number, month: number) =>
    query(`SELECT c.parent_id AS parentId, p.name AS parentName, p.icon AS parentIcon,
                  r.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon,
                  r.type, SUM(r.amount) AS total
           FROM records r
           JOIN categories c ON r.category_id = c.id
           LEFT JOIN categories p ON c.parent_id = p.id
           WHERE YEAR(r.record_date)=? AND MONTH(r.record_date)=?
           GROUP BY r.type, r.category_id
           ORDER BY total DESC`, [year, month]))

  // 窗口关闭处理
  electron.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      electron.app.quit()
    }
  })

  electron.app.on('activate', () => {
    if (bwCtor.getAllWindows().length === 0) {
      createWindow()
    }
  })

  function createWindow() {
    const win = new bwCtor({
      width: 1200, height: 800, minWidth: 900, minHeight: 600,
      title: '青柠记账',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
  }
})
