/**
 * 青柠记账 — Electron 主进程
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const mysql = require('mysql2/promise')

// ========== 数据库 ==========
const dbConfig = { host: 'localhost', user: 'root', password: '123456', database: 'lime_accounting', charset: 'utf8mb4', decimalNumbers: true, dateStrings: true }
let pool = null
function getPool() { if (!pool) pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0 }); return pool }
async function query(sql, params) { const [rows] = await getPool().execute(sql, params); return rows }

// ========== IPC 注册 ==========
function handle(channel, handler) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { success: true, data: await handler(...args) } }
    catch (err) { return { success: false, error: err.message } }
  })
}

// 分类
handle('db:getCategories', () =>
  query('SELECT id, name, icon, parent_id AS parentId, sort_order AS sortOrder, is_default AS isDefault FROM categories ORDER BY sort_order'))
handle('db:addCategory', (cat) =>
  query('INSERT INTO categories (name, icon, parent_id, sort_order) VALUES (?, ?, ?, 99)', [cat.name, cat.icon||'', cat.parentId||null]).then(r => ({ id: r.insertId })))
handle('db:updateCategory', (cat) =>
  query('UPDATE categories SET name=?, icon=? WHERE id=?', [cat.name, cat.icon||'', cat.id]).then(() => ({ ok: true })))
handle('db:deleteCategory', async (id) => {
  // 先检查是否有记录使用此分类
  const count = await query('SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [id])
  if (count[0].cnt > 0) {
    throw new Error('该分类下有' + count[0].cnt + '条记账记录，请先删除相关记录或将其移至其他分类')
  }
  // 同时检查子分类
  const children = await query('SELECT id, name FROM categories WHERE parent_id=?', [id])
  for (const child of children) {
    const cnt = await query('SELECT COUNT(*) AS cnt FROM records WHERE category_id=?', [child.id])
    if (cnt[0].cnt > 0) {
      throw new Error('子分类"' + child.name + '"下有' + cnt[0].cnt + '条记录，请先处理')
    }
  }
  return query('DELETE FROM categories WHERE id=? AND is_default=0', [id]).then(() => ({ ok: true }))
})

// 记录
handle('db:addRecord', (r) =>
  query('INSERT INTO records (type, amount, category_id, record_date, note) VALUES (?, ?, ?, ?, ?)', [r.type, r.amount, r.categoryId, r.recordDate, r.note||'']).then(res => ({ id: res.insertId })))
handle('db:getRecords', (f) => {
  let sql = 'SELECT r.*, c.name AS category_name, c.icon AS category_icon, p.name AS parent_name, p.icon AS parent_icon FROM records r JOIN categories c ON r.category_id=c.id LEFT JOIN categories p ON c.parent_id=p.id WHERE 1=1'
  const pp = []
  if (f.startDate) { sql += ' AND r.record_date >= ?'; pp.push(f.startDate) }
  if (f.endDate) { sql += ' AND r.record_date <= ?'; pp.push(f.endDate) }
  if (f.type) { sql += ' AND r.type = ?'; pp.push(f.type) }
  if (f.categoryId) { sql += ' AND r.category_id = ?'; pp.push(f.categoryId) }
  sql += ' ORDER BY r.record_date DESC, r.id DESC'
  return query(sql, pp)
})
handle('db:deleteRecord', (id) =>
  query('DELETE FROM records WHERE id=?', [id]).then(() => ({ ok: true })))

// 预算
handle('db:getBudget', (y, m) =>
  query('SELECT * FROM budgets WHERE year=? AND month=?', [y, m]).then(rows => rows[0] || null))
handle('db:setBudget', (b) =>
  query('INSERT INTO budgets (year, month, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount=?, updated_at=CURRENT_TIMESTAMP', [b.year, b.month, b.amount, b.amount]).then(() => ({ ok: true })))

// 统计
handle('db:getMonthlyStats', (y, m) =>
  query('SELECT c.parent_id AS parentId, p.name AS parentName, p.icon AS parentIcon, r.category_id AS categoryId, c.name AS categoryName, c.icon AS categoryIcon, r.type, SUM(r.amount) AS total FROM records r JOIN categories c ON r.category_id=c.id LEFT JOIN categories p ON c.parent_id=p.id WHERE YEAR(r.record_date)=? AND MONTH(r.record_date)=? GROUP BY r.type, r.category_id ORDER BY total DESC', [y, m]))

// ========== 窗口 ==========
let mainWindow = null
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    title: '青柠记账',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  // 正式使用时注释掉下面这行。如需调试，取消注释即可
  // mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
  const ok = await getPool().execute('SELECT 1').then(() => true).catch(() => false)
  console.log(ok ? '✅ 数据库连接成功' : '❌ 数据库连接失败，请检查MySQL')
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
