/**
 * 数据库连接模块
 * 负责连接本地 MySQL 数据库，提供查询、建表、连接管理等功能
 *
 * 环境变量配置（可选，未设置时使用默认值）：
 *   DB_HOST     — MySQL 主机地址（默认 localhost）
 *   DB_USER     — MySQL 用户名（默认 root）
 *   DB_PASSWORD — MySQL 密码（默认 123456）
 *   DB_NAME     — 数据库名称（默认 lime_accounting）
 */

// 数据库连接配置 — 优先使用环境变量，回退到默认值（向后兼容）
const dbConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  user: process.env['DB_USER'] || 'root',
  password: process.env['DB_PASSWORD'] || '123456',
  database: process.env['DB_NAME'] || 'lime_accounting',
  charset: 'utf8mb4',
  // 关键配置：DECIMAL 返回 number 而非 string，DATE 返回 "YYYY-MM-DD" 而非 Date 对象
  // 缺失这两个配置会导致金额变成字符串拼接、日期序列化格式不可控
  decimalNumbers: true,
  dateStrings: true
}

// 全局连接池（惰性初始化，复用连接避免反复握手）
let pool: any = null

/** 获取数据库连接池（首次调用时自动创建） */
export function getPool(): any {
  if (!pool) {
    // 运行时 require 避免循环依赖；createPool 是同步操作，不会连接数据库
    pool = require('mysql2/promise').createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
  }
  return pool
}

/**
 * 执行 SQL 查询
 * 注意：返回值类型取决于 SQL 语句类型
 * - SELECT 返回行数组 RowDataPacket[]
 * - INSERT/UPDATE/DELETE 返回 ResultSetHeader 对象（含 insertId、affectedRows 等字段）
 * 调用方应根据实际 SQL 类型处理返回值，避免将 ResultSetHeader 当作数组使用
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getPool()
  const [rows] = await p.execute(sql, params)
  return rows as T[]
}

/** 测试数据库连接是否正常 */
export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool()
    await p.execute('SELECT 1')
    return true
  } catch (err) {
    console.error('数据库连接失败:', err)
    return false
  }
}

/**
 * 初始化数据库表结构（首次运行自动建表）
 * 如果表已存在则跳过；如果分类表为空则插入默认的一级+二级分类
 */
export async function initSchema(): Promise<void> {
  const p = getPool()

  // 1. 创建分类表
  await p.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL COMMENT '分类名称',
      icon VARCHAR(10) DEFAULT '' COMMENT '分类图标（emoji）',
      parent_id INT DEFAULT NULL COMMENT '父分类ID（NULL=一级分类）',
      sort_order INT DEFAULT 99 COMMENT '排序序号',
      is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认分类（1=不可删除）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消费分类表'
  `)

  // 2. 创建记账记录表
  await p.execute(`
    CREATE TABLE IF NOT EXISTS records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(10) NOT NULL COMMENT '类型：income 收入 / expense 支出',
      amount DECIMAL(10,2) NOT NULL COMMENT '金额（元）',
      category_id INT NOT NULL COMMENT '所属分类ID',
      record_date DATE NOT NULL COMMENT '记账日期',
      note VARCHAR(200) DEFAULT '' COMMENT '备注',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='记账记录表'
  `)

  // 3. 创建月度预算表（year+month 联合唯一，支持 upsert）
  await p.execute(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL COMMENT '年份',
      month INT NOT NULL COMMENT '月份（1-12）',
      amount DECIMAL(10,2) NOT NULL COMMENT '预算金额（元）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_year_month (year, month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='月度预算表'
  `)

  // 4. 如果分类表为空，插入默认分类数据
  const [rows] = await p.execute('SELECT COUNT(*) AS cnt FROM categories')
  if (rows[0].cnt === 0) {
    // 先插入一级分类，记录每个父分类的 ID
    const parents: { name: string; icon: string; sort: number }[] = [
      { name: '餐饮饮食', icon: '🍜', sort: 1 },
      { name: '交通出行', icon: '🚗', sort: 2 },
      { name: '购物消费', icon: '🛒', sort: 3 },
      { name: '住房生活', icon: '🏠', sort: 4 },
      { name: '医疗健康', icon: '💊', sort: 5 },
      { name: '教育学习', icon: '📚', sort: 6 },
      { name: '休闲娱乐', icon: '🎮', sort: 7 },
      { name: '人情往来', icon: '🎁', sort: 8 },
      { name: '金融保险', icon: '💰', sort: 9 },
      { name: '其他支出', icon: '📦', sort: 10 }
    ]

    const parentIds: number[] = []
    for (const parent of parents) {
      const [result] = await p.execute(
        'INSERT INTO categories (name, icon, parent_id, sort_order, is_default) VALUES (?, ?, NULL, ?, 1)',
        [parent.name, parent.icon, parent.sort]
      )
      parentIds.push((result as any).insertId)
    }

    // 二级分类数据：[名称, 父分类索引]
    const subs: [string, number][] = [
      // 1. 餐饮饮食
      ['早餐', 0], ['午餐', 0], ['晚餐', 0], ['零食饮料', 0], ['外卖', 0], ['聚餐请客', 0],
      // 2. 交通出行
      ['公交地铁', 1], ['出租车/网约车', 1], ['加油充电', 1], ['停车费', 1], ['火车/飞机', 1],
      // 3. 购物消费
      ['衣服鞋包', 2], ['数码产品', 2], ['家居用品', 2], ['个护美妆', 2], ['其他购物', 2],
      // 4. 住房生活
      ['房租/房贷', 3], ['水电煤气', 3], ['物业费', 3], ['维修保养', 3], ['日用品', 3],
      // 5. 医疗健康
      ['门诊就医', 4], ['药品购买', 4], ['体检保健', 4], ['牙科护理', 4],
      // 6. 教育学习
      ['书籍资料', 5], ['课程培训', 5], ['文具用品', 5], ['考试报名', 5],
      // 7. 休闲娱乐
      ['旅游度假', 6], ['电影演出', 6], ['运动健身', 6], ['游戏充值', 6], ['其他娱乐', 6],
      // 8. 人情往来
      ['红包礼物', 7], ['孝敬父母', 7], ['慈善捐款', 7], ['婚礼随礼', 7],
      // 9. 金融保险
      ['保费支出', 8], ['利息费用', 8], ['手续费', 8],
      // 10. 其他支出
      ['临时杂项', 9]
    ]

    // 批量插入二级分类
    for (const [name, parentIndex] of subs) {
      await p.execute(
        'INSERT INTO categories (name, icon, parent_id, sort_order, is_default) VALUES (?, "", ?, 99, 1)',
        [name, parentIds[parentIndex]]
      )
    }
  }
}

/** 关闭数据库连接池（应用退出前调用，释放 MySQL 连接） */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end()
    } catch (err) {
      console.error('关闭数据库连接池失败:', err)
    } finally {
      pool = null
    }
  }
}