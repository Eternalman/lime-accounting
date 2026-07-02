# 🍋 青柠记账

个人桌面记账工具，轻松记录和管理日常花销。

## ✨ 功能

- **📝 收支记录** — 记录每一笔支出和收入，支持金额、日期、分类、备注
- **📂 二级分类** — 10 个一级大类 + 40+ 个二级小类，覆盖全部消费场景
- **🔧 自定义分类** — 支持用户自行添加、修改、删除分类
- **📋 历史查询** — 按日期、类型等维度筛选过往记录
- **📊 数据统计** — 月度收支汇总，分类占比分析
- **💰 预算管理** — 设置月度预算，超支自动提醒

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| Electron 31 | 桌面应用框架 |
| React 19 + TypeScript | 前端界面 |
| Ant Design 6 | UI 组件库 |
| MySQL 8.0 | 本地数据库 |
| electron-vite | 构建工具 |

## 🚀 本地运行

### 环境要求

- Node.js 18+
- MySQL 8.0（用户名 `root`，密码 `123456`）

### 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（在 MySQL 客户端中执行）
CREATE DATABASE IF NOT EXISTS lime_accounting
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

# 3. 启动开发模式
npm run dev
```

### 打包发布

```bash
# Windows 安装包
npm run pack:win

# macOS 安装包
npm run pack:mac
```

## 📁 项目结构

```
├── electron/          # Electron 主进程
│   ├── main.js        # 主进程入口 + IPC 通信
│   └── preload.js     # 预加载脚本（安全桥接）
├── src/               # React 前端
│   ├── App.tsx        # 根组件
│   ├── pages/         # 页面组件
│   │   ├── RecordForm.tsx      # 记账页面
│   │   ├── RecordList.tsx      # 记录查询
│   │   ├── Statistics.tsx      # 数据统计
│   │   ├── Budget.tsx          # 预算管理
│   │   └── CategoryManage.tsx  # 分类管理
│   ├── styles/        # 样式文件
│   └── types.ts       # 类型定义
├── scripts/           # 辅助脚本
├── CLAUDE.md          # 项目产品文档
└── package.json
```

## 📄 许可

MIT License

---

🤖 由 [Claude Code](https://claude.ai/code) 辅助开发
