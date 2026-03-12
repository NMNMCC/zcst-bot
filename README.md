# ZCST Fee Bot

宿舍电费/冷热水余额监控与充值机器人，使用 TypeScript 全面重写。

## 技术栈

- **Telegram Bot**: [grammY](https://grammy.dev/) - 现代 Telegram Bot 框架，原生支持 Cloudflare Workers
- **运行时框架**: EffectTS - 函数式编程框架，提供类型安全的服务组合
- **数据库**: Drizzle ORM + Cloudflare D1 - 类型安全的 SQLite 数据库
- **浏览器自动化**: Cloudflare Browser Rendering API (Puppeteer)

## 架构设计

```
src/
├── bot/                    # Telegram Bot 处理器
│   └── index.ts            # 命令处理、会话管理、对话流
├── db/                     # 数据库层
│   ├── schema.ts           # Drizzle ORM 表定义
│   └── index.ts            # 数据库初始化
├── services/               # 业务服务层
│   ├── browser.ts          # CF Browser Rendering 封装
│   ├── config.ts           # 配置管理
│   ├── database.ts         # 数据库操作
│   ├── fee-fetcher.ts      # 17wanxiao 余额获取
│   ├── logger.ts           # 日志服务
│   ├── recharge-session.ts # 充值会话管理
│   ├── service-locator.ts  # 服务定位器
│   └── sso.ts              # SSO 统一认证
├── types/                  # 类型定义
│   ├── errors.ts           # 错误类型
│   └── index.ts            # 公共类型
└── index.ts                # Worker 入口
```

## 核心功能

### 1. 多用户支持
- 每位用户独立配置查询链接、预警阈值、刷新间隔
- 数据完全隔离，存储在 Cloudflare D1 数据库

### 2. 余额查询
- `/balance` - 查询缓存余额
- `/update` - 刷新最新余额

### 3. 交互式充值
- `/charge` - 多步骤充值流程
- 类型选择 → 档位选择 → 支付方式 → 支付链接生成

### 4. SSO 登录
- 自动通过学校统一认证获取查询链接
- 支持仅获取链接不保存

### 5. 定时预警
- 基于用户设置的阈值自动检测
- 低于阈值时推送 Telegram 通知

## 部署

### 1. 安装依赖

```bash
yarn install
```

### 2. 配置 wrangler

编辑 `wrangler.jsonc`，设置 D1 数据库和 KV 命名空间：

```json
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "zcst-bot-db",
    "database_id": "your-database-id"
  }],
  "browser": {
    "binding": "BROWSER"
  },
  "kv_namespaces": [{
    "binding": "KV",
    "id": "your-kv-id"
  }]
}
```

### 3. 设置密钥

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```

### 4. 生成数据库迁移

```bash
yarn db:generate
yarn db:migrate
```

### 5. 部署

```bash
yarn deploy
```

### 6. 设置 Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER>.<SUBDOMAIN>.workers.dev/"
```

## 开发

```bash
yarn dev
```

## 命令列表

| 命令 | 功能 |
|------|------|
| `/start` | 开始使用 / 首次引导设置 |
| `/settings` | 交互式设置 |
| `/balance` | 查询当前余额 |
| `/update` | 立即刷新余额 |
| `/charge` | 开始充值流程 |
| `/link` | 获取查询链接 |
| `/cancel` | 取消当前操作 |

## License

GNU Affero General Public License v3.0