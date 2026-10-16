# WortNetz

结构化德语词汇追踪与网状知识库。第一阶段聚焦查词与词元归集链路：输入任意德语变体词，调用 DWDS 归集到规范 Lemma，并记录每个用户的遇见次数。

## 技术栈

- Next.js 16 App Router + React 19 + Tailwind CSS v4
- Supabase Auth（邮箱密码）
- Prisma ORM 7 + Supabase PostgreSQL
- DWDS 公开 API：词元、词性、频率、IPA
- FreeDictionaryAPI.com：英文释义与词形变化（English Wiktionary，CC BY-SA 4.0）
- OdeNet 1.4：德语定义、同义词、反义词、上下位词和词义关系（CC BY-SA 4.0）
- wordfeather：A1–C2 词汇分级（CC BY-NC 4.0，社区整理数据）

## 数据源职责

- DWDS：`frequency`、`wb/snippet`、`ipa`
- FreeDictionaryAPI.com：`/api/v1/entries/de/<word>`
- OdeNet：离线导入 `deWordNet.xml`，不依赖运行时 API
- 外部响应缓存在 `dwds_cache` 表中，避免重复请求
- 小写输入如果是较弱的动词形式，会尝试首字母大写后的名词词条，例如 `lampe → Lampe`

## 导入 OdeNet

下载 OdeNet v1.4 的 `deWordNet.xml`，然后执行：

```bash
ODENET_XML_PATH=/path/to/deWordNet.xml npm run db:import:odenet
```

默认路径为 `data/odenet/odenet-1.4/deWordNet.xml`。导入脚本会重建 WordNet
表，并把现有词元按“词元 + 词性”关联到 OdeNet Synset。

## 导入词表分级

wordfeather 的 A1–C2 分级数据可以直接从 GitHub 拉取：

```bash
npm run db:import:wordfeather
```

脚本会重建 `vocabulary_levels`，并把现有词元按“词元 + 词性”关联到
`lexeme_vocabulary_levels`。该数据为社区整理的 CC BY-NC 4.0 数据，不是
Goethe-Institut 官方发布。

## 线上配置

在 Supabase Dashboard 中准备：

1. `Project Settings -> API`：获取 `NEXT_PUBLIC_SUPABASE_URL` 和 publishable/anon key。
2. `Connect -> ORMs -> Prisma`：复制 Prisma 使用的 `DATABASE_URL`（pooler，6543）和 `DIRECT_URL`（直连，5432）。

复制环境变量模板：

```bash
cp .env.example .env.local
```

生成 Server Action 加密密钥：

```bash
openssl rand -base64 32
```

## 安装与迁移

```bash
npm install
npm run db:migrate
```

`db:migrate` 会通过 `DIRECT_URL` 执行 `prisma/migrations`，创建：

- `profiles`
- `lexemes`
- `encounters`
- `user_lexemes`
- `dwds_cache`

同时会创建 Supabase Auth 用户触发器与 RLS 策略。

本地开发时如果还没有线上连接串，可以先只运行 `npm run db:generate` 生成 Prisma Client，但应用查询数据库前必须填好 `DATABASE_URL` 和 `DIRECT_URL`。

## 启动

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

如果当前环境的 Turbopack 因端口绑定限制报 `Operation not permitted`，可使用：

```bash
npm run dev:webpack
```

## 数据模型变更

修改 `prisma/schema.prisma` 后：

```bash
npm run db:migrate:dev
npm run db:generate
```

生产环境只使用：

```bash
npm run db:migrate
```

## 鉴权与安全

- 页面鉴权由 Next 16 `proxy.ts` + Supabase Auth 完成。
- 每次 Server Action 都会重新校验用户。
- Prisma 使用数据库 owner 角色，因此 RLS 是防直接 PostgREST 访问的兜底层；应用查询仍需始终按 `userId` 过滤。
- 不要把 `DATABASE_URL`、`DIRECT_URL` 或密钥提交到 Git。

## MCP

Codex 已配置三个远程 MCP：

- `Prisma-Remote`：`https://mcp.prisma.io/mcp`
- `supabase`：带当前 project ref 的 Supabase 官方 MCP
- `stitch`：Google Stitch 设计生成 MCP，`https://stitch.googleapis.com/mcp`（API Key 认证）

重启 Codex 后可用 `/mcp` 查看状态。首次使用时按提示完成 OAuth 登录。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

如果当前环境的 Turbopack 因端口绑定限制导致 `npm run build` 报 `Operation not permitted`，可改用：

```bash
npm run build:webpack
```

## 部署到 Vercel

1. 在 Vercel 导入仓库。
2. 配置 `.env.example` 中的所有环境变量。
3. `npm run build` 会自动执行 `prisma generate`，然后构建 Next.js。

> Prisma 连接池建议：Vercel 运行时使用 `DATABASE_URL`（Supavisor 6543），Prisma CLI 迁移使用 `DIRECT_URL`（5432）。
