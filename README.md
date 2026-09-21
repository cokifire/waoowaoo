# Wao（waoowaoo）

> 面向创作者的 AI 多模态创作工作台：用对话驱动图片、视频、音乐与脚本的生成、编排与交付。

Wao 是一个以「项目（Project）」为中心的内容创作系统。用户在画布上组织素材与脚本，通过内置 AI 助手
（基于 Codex 创意运行时）完成专业创作，并由统一的 Provider 网关调用多家模型供应商完成文生图、文生视频、
文生音乐等多模态生产。系统以 Temporal 做持久化执行，以 MySQL + Prisma 做数据底座，以私有 S3（MinIO）
做媒体存储，支持**自托管（self-hosted）**与**云端（cloud）**两种发行形态。

---

## ✨ 功能特性

- **多模态 AI 创作**：文生图、文生视频、文生音乐 / 配音，以及对既有素材的二次编辑与合成。
- **Canvas 创作画布**：以节点 / 文件夹投影组织项目资源，所见即项目工作区的可视化视图。
- **创意技能（Creative Skills）**：服务端穷尽定义各专业领域的 Skill 与严格输出契约，由单一主 Agent
  完成脚本、画面、音乐等专业结果，确保创作边界与机器契约稳定。
- **助手线程（Assistant Thread / Turn）**：支持对话、审批、打断（interrupt）、steer 与任务完成后的
  新轮次，全程通过 SSE 流式更新。
- **Provider 网关**：统一管理 OpenAI、OpenRouter、OpenAI 兼容、Google、Fal、ElevenLabs、Ark 等供应商；
  单一网关、Provider 隔离、**零自动降级**——用户选定的模型就是实际扣费与出图的模型。
- **持久化执行（Temporal）**：长时任务、Attempt、Provider 幂等与终态由 Temporal Workflow/Activity 保证，
  崩溃可恢复、跨系统交接不丢状态。
- **资源与资产树（Workspace Resource）**：一个项目只有一棵创作资源树，目录、文档、图片、音频、视频
  都是同一类 Resource，按版本边界冻结、按 Lineage 追溯。
- **联网研究**：主 Agent 与创意方向 Worker 共用托管 Web Search，无配置时显式返回不可用而非静默兜底。
- **国际化（i18n）**：内置中文 / 英文界面，本地化文案与错误 identity 分离。
- **自托管与云端双形态**：同一份源码经 edition 导出生成开源树；基础设施只使用 S3 兼容对象协议。

---

## 🧱 架构概览

系统的「为什么是这样」与不可违背的不变量集中记录在 `docs/architecture/` 的模块契约中（实现会变，
契约不变）。修改业务代码前，按改动范围在 `docs/architecture/README.md` 的映射表中定位对应模块并阅读
其不变量：

| 改动范围 | 模块文档 |
| --- | --- |
| 持久执行边界、Task 恢复与跨系统交接 | `modules/durable-execution.md` |
| 异步 Task 生命周期、幂等与终态 | `modules/async-task-lifecycle.md` |
| 报价、审批、扣费与订阅 | `modules/billing-approval.md` |
| Provider / 模型选择、异步轮询、出站边界 | `modules/provider-gateway.md` |
| 资源身份、版本、Lineage 与写回 | `modules/workspace-resource.md` |
| 资产 Hub 的 Scope 与媒体所有权 | `modules/asset-scope-ownership.md` |
| Canvas 节点、投影与布局 | `modules/canvas-node.md` |
| Thread / Turn、审批与交互 | `modules/assistant-run-lifecycle.md` |
| Runtime 隔离、placement 与能力桥 | `modules/codex-runtime-rollout.md` |
| 创意技能与专业领域路由 | `modules/creative-skills.md` |
| 联网搜索与计费身份 | `modules/web-search.md` |
| 音频 / 音乐 / 配音生产 | `modules/audio-production.md` |
| 产品外壳、身份与本地化 | `modules/product-shell.md` |
| 日志与可观测性 | `modules/logging-observability.md` |
| 测试准入与保留集合 | `modules/test-governance.md` |

可用 `npm run architecture:impact -- <文件或目录>` 按改动范围自动路由到相关模块。

---

## 📦 技术栈

- **Framework**: Next.js 16 + React 19
- **Database**: MySQL + Prisma ORM
- **Durable execution**: Temporal
- **Transport & cache**: Redis
- **Media storage**: Private MinIO (S3)
- **Styling**: Tailwind CSS v4
- **Auth**: NextAuth.js

---

## 🚀 快速开始

### 方式一：自托管安装（推荐生产 / 预览）

完整且权威的安装指引见 [`docs/INSTALL.md`](docs/INSTALL.md)，包含镜像校验、`.env` 配置、Worker 蓝绿
发布、本地证书信任与浏览器 HTTP/2 验证。安装依赖 Docker Engine / Docker Desktop（含 Compose 2.24.4+
且支持 `!reset` 合并标签）与 Git、POSIX shell（Windows 用户请在 WSL2 内运行）。

### 方式二：本地源码开发

前置：**Node.js 22+**、**npm 9+**，以及一套可用的基础设施（MySQL、Redis、Temporal、MinIO；可用
Docker Compose 一键拉起，或按 `.env.example` 指向本机既有实例）。

```sh
# 1. 安装依赖（postinstall 会自动执行 prisma generate 与 edition:prepare）
npm ci

# 2. 配置环境
cp .env.example .env
# 至少填写 DATABASE_URL、REDIS_*、各类密钥与 API_ENCRYPTION_KEY，并设置 NEXTAUTH_URL=http://localhost:3001

# 3. 启动（自带 Docker 基础设施 + 应用 + Temporal Worker）
npm run dev
# 浏览器打开 http://localhost:3001

# 仅本地原生运行 Next（需自行保证基础设施可用）
npm run dev:next
```

> 源码开发固定使用 `http://localhost:3001`，与正式自托管 Compose 的 HTTPS 默认入口（1443）互不影响；
> 请勿将源码开发环境指向正式版 Temporal 命名空间。

### 构建

```sh
npm run build      # edition:prepare + prisma generate + next build --turbopack
npm run start      # 同时启动 Next 与 Temporal Worker
```

---

## ⚙️ 配置

核心配置来自 `.env`（从 `.env.example` 复制）。关键分组：

| 分组 | 关键变量 | 说明 |
| --- | --- | --- |
| 数据库 | `DATABASE_URL`、`MYSQL_*` | 本地开发 MySQL 映射 13306；容器模式由 Compose 覆盖。 |
| 存储 | `MINIO_*` | 私有 MinIO 桶，不暴露公网 endpoint。 |
| 认证 | `NEXTAUTH_URL`、`NEXTAUTH_SECRET` | 开发用 `http://localhost:3001`。 |
| Codex 运行时 | `CODEX_RUNTIME_DRIVER`、`CODEX_RUNTIME_HOST_ROOT` | 每个活跃项目起一个受限容器；生产须用持久主机目录。 |
| 内部密钥 | `CRON_SECRET`、`API_ENCRYPTION_KEY` | 加密保存的用户 API 凭据，升级时务必保留。 |
| Redis / Temporal | `REDIS_*`、`TEMPORAL_*` | 本地开发分别映射 16379 / 17233。 |
| 计费 / 发行 | `DEPLOYMENT_EDITION`、`PROVIDER_CREDENTIAL_MODE`、`BILLING_MODE` | 自托管默认 `self-hosted` / `user-key` / `OFF`。 |
| 日志 | `LOG_LEVEL`、`LOG_FILE_MAX_*` | 结构化 JSON 日志落在 `logs/app.log`，有界轮转。 |

完整变量与注释见 [`.env.example`](.env.example)。

---

## 📁 目录结构（概览）

```
src/
  app/                   Next.js 路由、API 与页面（含 [locale] 国际化）
  lib/
    ai-providers/        各供应商适配器（openai / openrouter / openai-compatible / google / fal ...）
    ai-registry/         模型能力、定价目录与服务端模型选择
    ai-exec/             Provider 统一执行边界
    codex-runtime/       Codex 创意运行时（每项目隔离容器）
    assistant-runtime/   助手 Thread / Turn 生命周期
    creative-skills/     专业领域 Skill 与严格输出契约
    temporal/            Durable execution（Workflow / Activity / Worker）
    workspace-resource/  创作资源树
    billing/            计费与审批
    auth/               认证与账号初始化
  features/             业务功能域（如 project-workspace 画布）
  messages/             中英文 i18n 文案
docs/
  architecture/         跨层架构契约模块
  INSTALL.md            自托管安装指南
prisma/                 Prisma schema 与迁移
scripts/                构建、部署、smoke、迁移与校验脚本
docker-compose*.yml     自托管编排
```

---

## 🧪 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发（Docker 基础设施 + 应用 + Worker）。 |
| `npm run build` / `npm run start` | 构建 / 生产启动。 |
| `npm run typecheck` | 类型检查（按 edition 分别校验）。 |
| `npm run lint` | ESLint 全量检查。 |
| `npm run test:logic` | 核心逻辑单测套件。 |
| `npm run test:critical` | 关键集成测试（Provider / Task / Temporal / 计费 / 安全）。 |
| `npm run architecture:impact -- <路径>` | 按改动文件路由到架构模块。 |
| `npm run temporal:worker:rollout` | Worker 蓝绿发布与状态查看。 |

---

## 📚 文档

- 自托管安装：[`docs/INSTALL.md`](docs/INSTALL.md)
- 架构契约索引：[`docs/architecture/README.md`](docs/architecture/README.md)
- 模块不变量：`docs/architecture/modules/*.md`

---

## 🤝 参与方式

本项目由核心团队独立维护。欢迎你通过以下方式参与：

- 🐛 提交 [Issue](https://github.com/waooAI/waoowaoo/issues) 反馈 Bug
- 💡 提交 [Issue](https://github.com/waooAI/waoowaoo/issues) 提出功能建议
- 🔧 提交 Pull Request 供参考 — 我们会认真审阅每一个 PR 的思路，但最终由团队自行实现修复，不会直接合并外部 PR

---

## 许可证

从 v0.5.0-beta.1 起，本发行版采用 [Elastic License 2.0](LICENSE)。在遵守条款的前提下，允许个人使用、企业内部商用、修改和分发；向第三方提供本软件主要功能的托管或代管服务，需要另行取得授权。旧版本保留其原许可证，第三方组件保留各自许可。这是源码可用软件，不属于 OSI 定义的开源软件。
