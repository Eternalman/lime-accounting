/**
 * 数据库连接模块
 * 负责连接本地 MySQL 数据库，提供查询方法
 */
const mysql = require('mysql2/promise')

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'lime_accounting',
  charset: 'utf8mb4'
}

// 全局连接池（复用连接，避免反复握手）
let pool: any = null

/** 获取数据库连接池 */
export function getPool(): any {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
  }
  return pool
}

/** 执行 SQL 查询 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

/** 测试数据库连接是否正常 */
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool()
    await pool.execute('SELECT 1')
    return true
  } catch (err) {
    console.error('数据库连接失败:', err)
    return false
  }
}
