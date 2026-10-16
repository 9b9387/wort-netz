# WortNetz

结构化德语词汇追踪与网状知识库。第一阶段聚焦查词与词元归集链路：输入任意德语变体词，调用 DWDS 归集到规范 Lemma，并记录每个用户的遇见次数。

## 技术栈

- Next.js 16 App Router + React 19 + Tailwind CSS v4
- Supabase Auth（邮箱密码）
- Prisma ORM 7 + Supabase PostgreSQL
- DWDS 公开 API：词元、词性、频率、IPA
- FreeDictionaryAPI.com：英文释义与词形变化（English Wiktionary，CC BY-SA 4.0）
- OdeNet 1.4：德语定义、同义词、反义词、上下位词和词义关系（CC BY-SA 4.0）
- OpenThesaurus：德语同义词补充关系
- Tatoeba：德语例句与社区中文译文（CC BY 2.0 FR）
- wordfeather：A1–C2 词汇分级（CC BY-NC 4.0，社区整理数据）
- 浏览器内置 Translator API：Chrome/Edge 端上德语→中文翻译（无需服务端，不支持时只看德语原文）
- 用户自带的 OpenAI 兼容 LLM：AI 助手（词条上下文讲解、语法解释和问答）

## 数据源职责

- DWDS：`frequency`、`wb/snippet`、`ipa`
- FreeDictionaryAPI.com：`/api/v1/entries/de/<word>`
- OdeNet：离线导入 `deWordNet.xml`，不依赖运行时 API
- OpenThesaurus：`/synonyme/search?q=<word>&format=application/json`
- Tatoeba：`/api_v0/search?from=deu&query=<lemma>`，只保留命中该词或其词形、4–14 词的句子，优先带社区中文译文的句子
- 外部响应缓存在 `dwds_cache` 表中，避免重复请求
- Tatoeba 例句缓存在 `tatoeba_cache` 表中（按规范化 lemma 存储，TTL 30 天）
- WordNet 释义/例句/关系词与用户无关，用 Next `use cache`（`cacheLife("days")` + `cacheTag("wordnet")`）跨请求复用；重新导入 OdeNet 后需重启 dev 服务或重新部署才能看到新数据
- 登录态校验使用 `supabase.auth.getClaims()`（本地校验 JWT + 缓存 JWKS，避免每次请求都访问 Auth 服务），并用 `React.cache` 让页面、导航和 AI 面板共享同一次校验结果
- 小写输入如果是较弱的动词形式，会尝试首字母大写后的名词词条，例如 `lampe → Lampe`

## 复习模块

`/review` 用句子卡做 Leitner 间隔重复：卡片把目标词放进一个德语例句里高亮
展示，朗读顺序固定为「先读单词，再读句子」，翻面后自评「忘记 / 记得」。

- 排程：箱位 1–5 对应 `1 / 3 / 7 / 16 / 35` 天；`记得` 进一箱，`忘记` 退回
  第 1 箱并当轮重现；第 5 箱再答对则标记为「已掌握」并退出队列。
- 队列：词本里除「暂时不学 / 已掌握」外的词都参与，默认每次 20 张、每日新词
  上限 20，两个值可在复习概览页调整。
- 例句来源：Tatoeba（优先带中文译文）→ OdeNet 例句 → 用用户在 `/settings/ai`
  配置的 LLM 现场生成并缓存到 `ai_review_sentences`。都没有时跳过该卡，并在
  本轮小结里说明；例句数据源不可达时降级为「单词 + 释义」卡。
- `review_logs` 记录每次作答，用于单词页「最近复习」和概览里的今日已复习、
  连续学习天数；「今天」按用户本地时区划分（offset 记在 `profiles`
  与每条日志上）。

## 词性与义项

同一个拼写可能是多个词条。DWDS 对 `wollen` 同时返回形容词（羊毛）和动词
（想要）两条 snippet，早先的实现固定取第一条，于是查 `willst` 会得到一个
「形容词 wollen」的词条，释义、变格表和 WordNet 关联全都跟着错。

- 归集时会用查询词形本身猜词性：大写开头按名词、`willst`/`ging` 这类由
  不规则动词表判定为动词、`-st/-t/-en/...` 结尾按弱动词信号处理，然后优先
  选 Wortart 匹配的那条 snippet；没有信号时才沿用 DWDS 顺序。
- 英文词典的全部义项（含词性与 tags）写入 `lexemes.senses_json`。展示顺序为
  「与词条词性一致的义项 → 不含 relational/archaic 等罕用标签的义项 →
  Wiktionary 原始顺序」，单词页和复习卡都按这个顺序罗列**全部**义项，
  不丢弃任何一条。
- Wiktionary 用 "As a copulative verb:" 这类分组标题时，会用它的 `subsenses`
  展开成真正的释义，标题本身不会作为义项出现。英文义项列表只取 Wiktionary：
  OdeNet 的英文 `descriptionEn` 存在 ILI 错配，OdeNet 的内容只在德语释义块里
  展示（这是它原生的部分）。
- WordNet 关联在已知词性时不再退回「只看 lemma」的模糊匹配，避免把名词
  synset 挂到动词词条上。
- 存量词条可用回填脚本按当初查询的词形重新归集：

```bash
npm run db:backfill:lexemes -- --dry-run   # 只报告差异
npm run db:backfill:lexemes                # 只处理多词性同形词
npm run db:backfill:lexemes -- --all       # 全部词条
```

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
3. 生成 LLM API Key 加密密钥，并填入 `LLM_CONFIG_ENCRYPTION_KEY`。

复制环境变量模板：

```bash
cp .env.example .env.local
```

生成 Server Action 加密密钥：

```bash
openssl rand -base64 32
```

LLM 配置是“按用户”的：每个用户在 `/settings/ai` 中填写自己的 OpenAI 兼容
`Base URL`、`API Key` 和模型。API Key 只发送到服务端并以 AES-256-GCM 加密后
存入 `user_llm_configs`；未配置时，AI 助手和单词 AI 讲解入口不会显示。

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
- `user_llm_configs`
- `ai_threads`
- `ai_messages`
- `lexeme_relations`
- `tatoeba_cache`
- `review_logs`
- `ai_review_sentences`

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
2. 在 Project → Settings → Environment Variables 里配置环境变量。构建阶段和运行阶段都会读取它们，所以下面这些在 Production / Preview / Development 都要填：

   | 变量 | 用途 |
   | --- | --- |
   | `DATABASE_URL` | 运行时的连接池串（Supavisor 6543，带 `?pgbouncer=true`）。`next build` 收集路由信息时也会加载 Prisma Client，缺了会报 `DATABASE_URL is not configured` |
   | `DIRECT_URL` | 迁移/内省用的直连串（5432），主要给 Prisma CLI 用 |
   | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 认证 |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 让 Server Action 引用在各实例间保持一致 |
   | `LLM_CONFIG_ENCRYPTION_KEY` | 加密用户自带的 LLM 配置 |

   其余可选变量见 `.env.example`。
3. `npm run build` 会自动执行 `prisma generate`，然后构建 Next.js。

> `prisma generate` 本身不需要数据库连接串：`prisma.config.ts` 里 `datasource` 是可选的，缺少 `DIRECT_URL` 时会回退到 `DATABASE_URL`。但 `next build` 仍需要 `DATABASE_URL`。
