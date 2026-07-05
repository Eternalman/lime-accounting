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
| Vitest | 单元测试框架 |

## 🚀 本地运行

### 环境要求

- Node.js 18+
- MySQL 8.0

### 配置数据库连接

项目已提供 `.env` 默认配置文件，适用于本地 MySQL（`root / 123456`）。

如果你的 MySQL 密码不同，编辑项目根目录的 `.env` 文件即可：

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=lime_accounting
```

> 参考模板：`.env.example`

### 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（在 MySQL 客户端中执行）
CREATE DATABASE IF NOT EXISTS lime_accounting
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

# 3. 启动开发模式（首次运行会自动建表并插入默认分类数据）
npm run dev
```

### 打包发布

```bash
# Windows 安装包
npm run pack:win

# macOS 安装包
npm run pack:mac
```

## 🧪 质量保障

项目内置了一套自动化的质量门禁系统，确保每次代码提交都经过充分检查。

### 质量门禁流程

```
git-save（提交存档）
    │
    ▼
gitcommit-agent（提交守卫）
    │
    ├── 🧪 tester agent ──── 执行全部单元测试
    │
    └── 🔍 quality-engineer ── 安全 + 注释 + 规范 + 健壮 四维检查
    │
    ▼
  全部通过？─── YES ──→ git commit + git push
    │
    NO ──→ 🚫 报告失败原因，拒绝提交
```

### 通过标准

| 检查项 | 通过条件 |
|--------|----------|
| 单元测试 | 全部用例通过，零失败 |
| 质量检查 | 评分 ≥ 60 且无严重问题 |

### 运行命令

```bash
# 运行单元测试
npx vitest run

# 带 UI 界面的测试模式
npx vitest --ui
```

## 📁 项目结构

```
├── electron/             # Electron 主进程
│   ├── main.ts           # 主进程入口 + IPC 通信 + 输入校验
│   ├── preload.ts        # 预加载脚本（安全桥接）
│   └── database.ts       # 数据库连接池 + 建表 + 查询
├── src/                  # React 前端
│   ├── App.tsx           # 根组件（含 ErrorBoundary）
│   ├── main.tsx          # 渲染入口
│   ├── pages/            # 页面组件
│   │   ├── RecordForm.tsx      # 记账页面
│   │   ├── RecordList.tsx      # 记录查询
│   │   ├── Statistics.tsx      # 数据统计
│   │   ├── Budget.tsx          # 预算管理
│   │   └── CategoryManage.tsx  # 分类管理
│   ├── hooks/            # 公共 Hook
│   │   └── useMonthOptions.ts  # 月份选择器
│   ├── utils/            # 工具函数
│   │   └── format.ts          # 金额格式化
│   ├── styles/           # 样式文件
│   └── types.ts          # 全局类型定义 + window.api 声明
├── tests/                # 单元测试
│   └── electron/
│       ├── database.test.ts    # 数据库模块测试
│       ├── main.test.ts        # 主进程测试
│       └── preload.test.ts     # 预加载脚本测试
├── .claude/              # Claude Code 配置
│   ├── agents/           # 自定义 Agent
│   │   ├── tester.md           # 单元测试专家
│   │   ├── quality-engineer.md # 代码质量工程师
│   │   └── gitcommit-agent.md  # Git 提交守卫
│   ├── skills/           # 自定义技能
│   │   ├── git-save/           # Git 存档
│   │   ├── unit-test/          # 单元测试
│   │   ├── security-audit/     # 安全审计
│   │   └── comments-check/     # 注释检查
│   └── artifacts/        # 质量检查标记文件（临时）
├── scripts/              # 辅助脚本
├── vitest.config.ts      # 测试配置
├── CLAUDE.md             # 项目产品文档
└── package.json
```

## 📄 许可

MIT License

---

> 🤖 本项目由 [Claude Code](https://claude.com/claude-code) 辅助开发
