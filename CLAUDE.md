# CLAUDE.md — 项目全局说明

> 每次新对话先读这个文件，能立刻了解项目全貌。

---

## 关于 Ronny（用户背景）

- 有 C 语言编程基础，理解程序逻辑、变量、函数等概念
- 对互联网技术（HTTP、API、JWT、Docker等）使用较少，但学得快
- **特别关注**：系统背后的运行逻辑、数据是怎么流动的、模块之间怎么交互
- 只要解释清楚原理，Ronny 就能理解，不需要回避技术细节
- **这不是练手项目，是要商业落地变现的** —— 所有决策要考虑实际可用性和安全性

---

## 项目目标

**多平台电商数据 SaaS** —— 帮同时经营天猫/京东/拼多多等多个店铺的商家，把所有店铺数据汇总到一个地方，配合飞书 Bot（OpenClaw）实现"在飞书直接问数据"。

### 核心卖点
- 一个看板看所有店铺的 GMV / 利润 / ROI
- 飞书里直接问："最近7天哪个店铺ROI最差？" → 秒回
- 异常自动预警（GMV骤降、ROI偏低）
- 目标客户：同时经营3+店铺、使用飞书、月GMV 50万以上的团队

---

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 后端 | FastAPI (Python) | REST API，异步，高性能 |
| 前端 | Next.js (TypeScript) | React框架，SSR，生产用standalone模式 |
| 数据库 | PostgreSQL | 主数据库 |
| 缓存 | Redis | 会话/缓存 |
| 部署 | Docker Compose | 5个容器一起跑 |
| 反向代理 | Nginx | `/api/` → 后端，`/` → 前端 |
| AI Bot | OpenClaw + MiniMax M2.5 | 飞书对话助手 |

---

## 服务器信息

- **云服务商**：阿里云香港
- **IP**：`47.86.169.146`
- **开放端口**：80（HTTP）
- **SSH**：`ssh root@47.86.169.146`
- **项目目录**：`~/ecommerce-saas`
- **启动命令**：`cd ~/ecommerce-saas/docker && docker compose -f docker-compose.prod.yml up -d`

---

## 项目文件结构

```
ecommerce-saas/
├── CLAUDE.md                          ← 你现在读的这个文件
│
├── backend/
│   ├── app/
│   │   ├── main.py                    ← FastAPI入口，CORS配置（读ALLOWED_ORIGINS环境变量）
│   │   ├── api/v1/endpoints/
│   │   │   ├── auth.py                ← 登录/注册，JWT鉴权
│   │   │   ├── stats.py               ← 首页看板数据（GMV/利润/趋势图）
│   │   │   ├── finance.py             ← 财务成本拆分
│   │   │   ├── stores.py              ← 店铺管理 CRUD
│   │   │   ├── import_data.py         ← Excel/CSV 订单数据导入
│   │   │   ├── export.py              ← 数据导出
│   │   │   └── bot.py                 ← 飞书Bot专用接口（无JWT，用Bot Token鉴权）
│   │   ├── models/
│   │   │   ├── tenant.py              ← 租户（一个公司=一个租户）
│   │   │   ├── user.py                ← 用户（属于某租户）
│   │   │   ├── store.py               ← 店铺（属于某租户）
│   │   │   └── order.py               ← 订单 + DailyStat每日统计
│   │   ├── services/ai_import.py      ← AI辅助识别Excel列名
│   │   └── core/
│   │       ├── config.py              ← 环境变量配置
│   │       └── security.py            ← JWT生成/验证
│   ├── alembic/                       ← 数据库迁移版本管理
│   ├── scripts/seed.py                ← 初始化测试数据（2个租户/5个店铺/450条统计）
│   ├── Dockerfile                     ← 后端容器镜像
│   └── requirements.txt               ← 注意：需要 bcrypt==3.2.2（passlib兼容性）
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                   ← 首页看板（GMV/ROI/趋势图）
│   │   ├── finance/page.tsx           ← 财务分析页
│   │   ├── stores/page.tsx            ← 店铺管理页
│   │   ├── import/page.tsx            ← 数据导入页
│   │   ├── login/page.tsx             ← 登录页
│   │   └── register/page.tsx          ← 注册页
│   ├── next.config.ts                 ← output: "standalone"（Docker部署必须）
│   └── Dockerfile                     ← 两阶段构建（builder + runner）
│
├── docker/
│   ├── docker-compose.prod.yml        ← 生产环境：postgres/redis/backend/frontend/nginx
│   ├── nginx.conf                     ← /api/ → backend:8000，/ → frontend:3000
│   └── .env.example                   ← 环境变量模板
│
├── data/mock/
│   ├── generate.py                    ← 生成模拟数据（必须从项目根目录运行）
│   └── mock_data.json                 ← 生成的测试数据
│
└── openclaw-config/                   ← 客户 OpenClaw 配置模板（待完善）
```

---

## OpenClaw 集成（飞书Bot）

### 架构
```
客户飞书消息 → OpenClaw（本地AI Agent）→ curl → bot.py接口 → 数据库 → 返回数据 → 飞书回复
```

### OpenClaw 配置文件位置（本机）
```
~/.openclaw/workspace/
├── SOUL.md    ← Bot行为准则 + 电商接口触发关键词规则
├── TOOLS.md   ← 4个curl命令 + 关键词→接口映射表（⚠️ 目前指向localhost:8000）
├── IDENTITY.md ← Bot名字/人设（每人不同，不要改）
└── USER.md    ← 用户姓名/时区
```

### bot.py 的4个接口
```
GET /api/v1/bot/overview?tenant_id=X&days=7&token=xxx   ← 经营总览
GET /api/v1/bot/stores?tenant_id=X&days=7&token=xxx     ← 各店铺排行
GET /api/v1/bot/finance?tenant_id=X&days=30&token=xxx   ← 财务成本拆分
GET /api/v1/bot/alert?tenant_id=X&token=xxx             ← 异常预警
```

### 给客户的配置步骤
1. 修改 `TOOLS.md`：`localhost:8000` → `http://47.86.169.146`，`tenant_id=1` → 客户的ID
2. 修改 `SOUL.md`：同上替换URL和tenant_id，"Ronny的" → 客户公司名
3. `IDENTITY.md` 和 `USER.md` 保留客户自己的配置

---

## 数据库设计（多租户）

```
Tenant（公司）
  └── User（员工账号）
  └── Store（店铺）
        └── DailyStat（每日经营数据：GMV/利润/订单/广告费/ROI）
```

测试数据：
- `tenant_id=1`：优品电商有限公司（天猫/京东/拼多多，3家店）
- `tenant_id=2`：乐购网络科技（拼多多/独立站，2家店）

---

## 当前进度

| 模块 | 状态 | 备注 |
|---|---|---|
| 后端全部API | ✅ 完成 | 6个endpoint文件 |
| 前端6个页面 | ✅ 完成 | 含UI美化（hover/渐变/响应式）|
| Docker生产部署 | ✅ 完成 | 5容器正常运行 |
| 数据库+测试数据 | ✅ 完成 | 450条DailyStat已入库 |
| API URL修复 | ✅ 完成 | 全部改为相对路径/api/v1 |
| OpenClaw飞书对接 | ✅ 本机已通 | 客户那边飞书也已通 |
| 服务器前端rebuild | 🔄 进行中 | 修复登录网络错误 |
| 客户接入配置 | 📝 待完成 | 等服务器起来后测试 |
| Bot Token安全 | ❌ 待修复 | 当前所有客户共用同一token（隐患）|
| 平台API自动同步 | 🔮 未来规划 | 淘宝/JD/PDD开放平台对接 |

---

## 已知问题和坑

### 1. bcrypt 版本兼容
```
requirements.txt 必须包含：
  passlib[bcrypt]==1.7.4
  bcrypt==3.2.2        ← 不能用4.x，否则密码报错
```

### 2. NEXT_PUBLIC_ 环境变量
Next.js 的 `NEXT_PUBLIC_` 变量在**编译时**烧进去，运行时改环境变量无效。
解决方案：已全部改为相对路径 `/api/v1`，nginx 自动路由，不再依赖环境变量。

### 3. generate.py 运行目录
必须从**项目根目录**运行，不能从 `data/mock/` 里运行：
```bash
cd ~/ecommerce-saas && python3 data/mock/generate.py   ✅
cd data/mock && python3 generate.py                    ❌ 找不到文件
```

### 4. Bot Token 安全隐患（待修复）
当前所有租户共用 `"bot-ecommerce-saas-2024"`，知道别人 tenant_id 就能看别人数据。
正确做法：每个租户有独立 token，数据库里绑定 token↔tenant_id。

---

## 常用命令

```bash
# 服务器操作
ssh root@47.86.169.146
cd ~/ecommerce-saas/docker
docker compose -f docker-compose.prod.yml ps          # 查看容器状态
docker compose -f docker-compose.prod.yml logs -f     # 实时日志
docker compose -f docker-compose.prod.yml up -d --build frontend  # 重新构建前端

# 本地开发
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev

# 数据库操作（在服务器上）
docker exec -it saas_backend alembic upgrade head     # 执行迁移
docker exec -it saas_backend python scripts/seed.py   # 初始化数据

# 测试Bot接口（服务器起来后）
curl -s "http://47.86.169.146/api/v1/bot/overview?tenant_id=1&days=7&token=bot-ecommerce-saas-2024"
```

---

## 商业规划

- **现阶段**：服务种子客户（手动上传Excel），验证付费意愿
- **3个月后**：接入淘宝开放平台API，自动同步数据
- **定价参考**：免费版（1店铺）/ 标准版¥299/月（5店铺+飞书Bot）/ 专业版¥599/月
- **核心差异化**：飞书Bot直接问数据，多平台汇总，中小商家买得起用得上
