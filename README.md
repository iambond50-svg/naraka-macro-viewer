# 永劫无间宏查看器

Cloudflare Workers + D1 版本

## 部署步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 创建D1数据库
```bash
npx wrangler d1 create naraka-macros
```

执行后会得到 `database_id`，更新 `wrangler.toml` 中的 `database_id`。

### 3. 初始化数据库
```bash
npx wrangler d1 execute naraka-macros --file=./schema.sql
npx wrangler d1 execute naraka-macros --file=./data.sql
```

### 4. 本地开发
```bash
npm run dev
```

### 5. 部署
```bash
npm run deploy
```

## 项目结构

```
├── src/index.js      # Workers API
├── public/           # 前端静态文件
│   ├── index.html
│   ├── app.js
│   └── style.css
├── schema.sql        # 数据库结构
├── data.sql          # 宏数据
├── wrangler.toml     # Cloudflare配置
└── package.json
```

## API接口

- `GET /api/macros` - 获取宏列表（支持分页、搜索、分类筛选）
- `GET /api/categories` - 获取分类列表
- `GET /api/macro/:id` - 获取单个宏详情
- `GET /api/stats` - 获取统计信息

## 功能

- 宏浏览和搜索
- ATK Hub同步（生成注入代码）
