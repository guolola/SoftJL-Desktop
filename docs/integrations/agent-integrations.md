<!-- 说明桌面版 MCP 与 Skill 管理、运行边界及验证方式。 -->
# Pi 扩展、MCP 与 Skill 管理

- 维护状态：持续维护
- 目标读者：桌面版使用者与维护者
- 事实来源：[锁定依赖](../../package.json)、[Pi 包装配](../../src/main/backend/conversation/pi-packages.ts)、[集成目录](../../src/main/backend/integrations/integration-catalog.ts)、[集成存储](../../src/main/backend/integrations/integration-store.ts)与[会话装配](../../src/main/backend/integrations/agent-integration-runtime.ts)

## 概述

桌面设置提供 MCP 服务与 Skills 技能两个管理页面。MCP 提供外部资料和操作能力，Skill 提供按需读取的方法与工作流。配置供下一轮项目对话使用。

## 当前设计或配置

### 来源与实现边界

SoftJL Desktop 基于 [Pi Coding Agent](https://github.com/earendil-works/pi) SDK 实现桌面 Coding Agent。`@earendil-works/pi-coding-agent`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-ai`、`@earendil-works/pi-mcp` 当前均锁定为 1.3.0。Pi 的 Agent 循环、会话历史、原生工具、资源加载和 MCP 扩展属于上游能力。

SoftJL 自有代码负责项目对话与持久化、模型契约与业务工具、结构化建模和文档流水线，以及 Electron 目录选择、交互桥接、配置管理、凭证保存和会话快照。问卷、压缩策略、fff、网页访问与子代理分别使用下表第三方插件。React 聊天界面还复用 assistant-ui Elements；PlantUML、数据库、字体、图标等组件保留各自的许可证，见 [NOTICE](../../NOTICE)。

本项目的侧重点是让需求、结构化设计、测试用例、说明书与本机编码共用项目上下文。通用工具和扩展能力不作为独有优势；模型与代码没有自动双向同步，也没有编码正确性、速度或成本优于其他产品的保证。面向使用者的工作流对比见 [项目首页](../../README.md#与通用-coding-agent-的侧重点)。

### Pi 扩展

桌面会话显式加载以下锁定依赖，包安装随应用发布完成，不在用户请求中运行包管理器。建模工具负责业务契约，Pi 负责会话与工具循环，第三方扩展负责通用能力。

| 能力 | 实现 | 边界 |
| --- | --- | --- |
| 用户询问 | [@juicesharp/rpiv-ask-user-question](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question) 2.13.9 | 第三方插件；业务、编码和模型范围共用上游 RPC 问卷；选项、自由回答和取消沿用插件协议 |
| 压缩策略 | [pi-custom-compaction](https://github.com/nicobailon/pi-custom-compaction) 0.2.5 | 第三方摘要策略；Pi 保留历史、压缩边界和记录 |
| 文件搜索 | [pi-fff](https://github.com/ShpetimA/pi-fff) 0.1.13 | 第三方插件；原生索引、模糊路径、增强 read/grep 与专用搜索工具 |
| 网页访问 | [pi-web-access](https://github.com/nicobailon/pi-web-access) 0.44.0 | 第三方插件；上游搜索、网页读取和结构化来源 |
| 子代理 | [@gotgenes/pi-subagents](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents) 25.0.1 | 第三方插件；原生子会话、任务结果与引导 |
| 文件与终端 | Pi 1.3.0 原生工具 | write/edit/ls/find/powershell；read/grep 由 fff 增强 |
| 模型范围校验 | 建模工具与 Pi 问卷结果 | 明确请求直接执行；需要询问时从插件实际回答记录范围，校验目标图表并阻止擅自替换不支持的模型 |

无代码目录时加载通用询问、压缩和网页扩展。选择目录后启用本地工具、fff 与子代理。应用不加载逐工具授权插件，内置 Skill 读取、文件操作和命令不会因该插件逐次弹出确认。fff 默认索引所属 Git 根目录；所选目录不是操作系统沙箱。`pi-fff` 的旧命名空间 peer 通过 npm overrides 统一为当前 Pi 1.3 SDK，扩展导入由 Pi 原生 loader 解析，不安装 Pi 0.x 运行时。

不固定安排业务澄清或模型选择步骤。LLM 仅在缺失信息或歧义会影响结果时调用 `ask_user_question`，信息充分时直接执行。问卷只显示一层 QuestionFlow，回答后在当前任务继续；取消后不继续执行本轮工具。实际业务回答随 Pi 工具历史保存，并进入后续独立图表生成的上下文。

### MCP 预设

六项 MCP 预设全部指向第三方服务，首次创建时均不启用，避免在未配置资料范围或账号时启动连接。SoftJL 提供连接管理与装配，本地建模业务工具通过 Pi 扩展注册，不是独立的 SoftJL MCP Server。

| 服务 | 用途 | 运行前提 |
| --- | --- | --- |
| [MarkItDown / Microsoft](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp) | 将任务书和文档转为可分析文本 | Python 与 markitdown-mcp |
| [DBHub / Bytebase](https://github.com/bytebase/dbhub) | 读取数据库结构和依赖 | Node.js 22.19+、只读数据库账号与连接串 |
| [Filesystem / MCP servers](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) | 读取、检索所选目录资料 | Node.js 与允许访问的绝对目录 |
| [Context7 / Upstash](https://github.com/upstash/context7) | 查询框架和库文档 | 网络连接；可选 API Key |
| [Playwright / Microsoft](https://github.com/microsoft/playwright-mcp) | 操作网页、收集实际验收依据 | Node.js、可用浏览器与待测网页 |
| [GitHub](https://github.com/github/github-mcp-server) | 读取仓库、Issue 和 PR | 网络连接与个人令牌 |

本地预设按需启动外部程序；npx 在首次执行时可能下载对应包，不随应用捆绑这些服务或浏览器。服务入口与上游资料链接在管理页显示。Filesystem 预设仅暴露读取、目录和检索工具；GitHub 预设发送只读模式请求头。自定义服务遵循用户配置。

### Skills 清单

新建配置提供七项 Skill。两项核心 Skill 由 SoftJL 维护并保持启用，不能在设置中覆盖、删除或停用；五项适配工作流默认启用，可编辑或停用。页面显示参考的公开 Skill 来源。适配内容使用本项目工具和保存契约，不包含上游脚本，不将公开可查看的专有文档技能作为开源代码分发。

| Skill 标识 | 用途 | 来源与维护方式 |
| --- | --- | --- |
| `uml-graduation-modeling` | 八类图表的业务语义、范围与模型规范 | [SoftJL 核心技能](../../src/main/modeling/runs/pipelines/standard/resources/skills/uml-graduation-modeling/SKILL.md)；规范依据见技能参考目录 |
| `graduation-deliverables` | 测试用例、需求规格与软件设计说明书 | [SoftJL 核心技能](../../src/main/modeling/runs/pipelines/standard/resources/skills/graduation-deliverables/SKILL.md) |
| `requirements-discovery` | 需求澄清与验收条件 | SoftJL 适配；参考 [GitHub Copilot PRD](https://github.com/github/awesome-copilot/tree/main/skills/prd) |
| `document-collaboration` | 说明书协作与检查 | SoftJL 适配；参考 [Anthropic doc-coauthoring](https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring) |
| `codebase-architecture` | 已有工程架构分析 | SoftJL 适配；参考 [GitHub Copilot architecture-blueprint-generator](https://github.com/github/awesome-copilot/tree/main/skills/architecture-blueprint-generator) |
| `database-impact` | 数据库变更影响分析 | SoftJL 适配；参考 [GitHub Copilot sql-object-impact-analysis](https://github.com/github/awesome-copilot/tree/main/skills/sql-object-impact-analysis) |
| `web-acceptance` | 网页流程验收 | SoftJL 适配；参考 [Anthropic webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) |

依赖 MCP 的 Skill 不会自动启用对应服务。技能加载沿用 Pi 的按需读取机制，只显式加载应用核心技能和管理页启用的文本技能，不自动导入主机其他 Agent 的技能目录。

## 操作与维护

代码目录可在创建项目和项目设置的“项目工作区”中选择、更换或取消关联。未设置目录时，助手在本机编码前调用 `select_code_directory`，聊天页显示“选择文件夹并继续”。原生选择器保存目录后，宿主保留本轮任务和原始用户消息，重新加载所选目录的工具与扩展并自动继续生成。取消选择器可在当前提示重试，停止任务会使待选目录请求失效。普通问答不要求选择目录，没有待处理交互时不展示目录横幅。

Pi 默认策略仅在缺失时写入工作目录的 `.pi/`：`compaction-policy.json` 和 `subagents.json`。`settings.json` 保留已有偏好与其他扩展，补齐随应用安装的网页和 fff 包路径；准备工作区时移除已卸载授权插件的注册项与专用配置，避免子会话加载失效包路径。格式不符合当前 Pi 契约时明确失败。不迁移旧自研审批数据。修改配置时使用各包当前文档。默认子代理并发 3、每个子代理最多 12 轮；代理工具调用应显式传当前模型，避免上游 Explore 的默认模型与桌面配置不同。前台执行使用 `run_in_background:false`；如同轮后台并发，主代理必须用 `get_subagent_result(wait:true)` 收齐结果。宿主在本轮结束时关闭扩展，不承诺跨轮后台存活。

`patches/` 保留三个小型维护补丁：fff 会话关闭等待索引初始化后再销毁；原生 FFI 使用 ASAR 解包路径；Pi 压缩与分支摘要的文件清单仅记录工具成功结果，排除被拒绝、失败或未完成的调用，避免把操作意图写成已完成事实。`postinstall` 通过 patch-package 应用，版本不匹配时安装失败；升级前确认上游是否已修复，再移除或更新补丁。Electron 打包显式解包原生 fff、ffi-rs 及语法解析依赖。

Pi 的全局目录指向应用数据目录内 `pi-agent`。网页服务的凭据及搜索后端沿用 web-access 的原生配置；安装不代表付费服务已开通。更换模型后若上游压缩配置仍指向旧模型，更新 `compaction-policy.json`；不能解析时插件按自身逻辑回退 Pi 压缩并显示通知。

前端直接使用 [官方 Elements](https://www.assistant-ui.com/elements)。TUI 自定义窗口、终端补全及斜杠命令菜单没有自动映射到网页；本次桥接 select/input/confirm/editor 和通知。

从设置侧栏打开 MCP 服务，选择预设并配置启动程序、参数或 Streamable HTTP 地址。环境变量与请求头使用字符串 JSON 对象；参数使用字符串 JSON 数组。DBHub 的连接串填写在 SOFTJL_DATABASE_URL 环境变量中；Filesystem 参数末尾填写允许访问的目录。

新建服务和首次创建的预设默认直接向模型提供工具，管理页无需选择工具调用方式。已有配置继续使用其保存的调用方式；仅这些连接需要时加载对应的 Pi 扩展。

保存后测试连接，成功时显示发现的工具和检查时间，再按需要启用。测试失败显示原因；缺少目录、数据库变量或 GitHub 令牌时不能启用。测试结果只表示当次握手和工具发现成功，不表示服务持续在线。

从 Skills 技能页面查看核心规范、编辑或停用适配工作流，也可通过名称、触发说明和 Markdown 正文添加自定义技能。当前编辑器管理文本技能，不安装任意脚本依赖或整仓库插件。依赖外部工具的技能仍需单独配置对应 MCP。

凭证配置在用户数据目录加密保存。管理接口只返回已保存的凭证键名，留空保留已存值，明确提交空对象清空。配置变更生成新的会话快照；运行中的对话保留原配置和 Skill 修订。不会读取用户主机的 Pi 配置或 OAuth 凭证。当前 HTTP 管理入口使用显式请求头鉴权，不提供 OAuth 登录流程。

Skill 修订按内容隔离保存，修订内的技能目录名与 `SKILL.md` 中的名称一致，交给 Pi 原生加载器发现和按需读取。

MCP、Code Mode 与 Tool Search 复用 Pi 原生扩展。每次工具调用保留平台的持久化和等待回答守卫；Code Mode 不能自行访问宿主文件或网络。会话结束发送原生关闭事件并释放传输连接。模型与说明书仍通过现有业务工具保存。

## 验证

运行 `npm run test:pi-packaging` 验证真实 Electron ASAR 中的 DLL 加载和文件搜索。实际安装包测试覆盖五包加载、原生文件修改与 PowerShell 执行、rpiv 选项回传、fff 原生索引命中、子代理文件读取，以及第三方压缩产生 `fromHook` 记录。这些常规测试使用确定性模型传输；真实联调另由 `scripts/verify-pi-live.mjs` 执行。

运行 npm run test:desktop 验证预设、加密与重启持久化、核心技能保护、修订隔离和三种 MCP 调用方式。运行管理页与设置对话框的 renderer 测试，检查输入、凭证保留、连接结果和导航；运行 npm run typecheck 完成类型检查。文档变更运行 npm run audit:docs。

实际外部服务需要在目标电脑配置运行环境并测试，自动化测试使用本地 MCP 测试服务，不使用真实账号或数据库。

在会话中发送 `/compact-now` 可触发原生手动压缩，后续文字作为保留重点。桌面宿主等待 SDK 压缩完成后再结束本轮；摘要仍由已加载的第三方 `session_before_compact` 策略生成。手动压缩不修改正式上下文预算。

### 真实模型与搜索联调

先在桌面应用中配置可用供应商，关闭原应用以保证数据库副本一致。使用满足项目 engines 的 Node，在 PowerShell 设置 `$env:SOFTJL_LIVE_VERIFY='1'`，再运行 `npm run verify:pi-live`。多个供应商时通过 `SOFTJL_LIVE_PROVIDER_NAME` 选择；`SOFTJL_LIVE_MODEL` 可指定该配置允许的模型。该命令会发生真实供应商请求和计费，不在普通测试中自动运行。

脚本复制加密数据库、凭据密文及 Electron 加密元数据，在隔离临时项目中运行真实 IPC、HTTP、模型、插件及问答界面。只控制文件夹选择器返回临时目录，不伪造模型或搜索响应；结束后删除加密数据副本，结果与截图保留在忽略的 `.cache/`。`SOFTJL_LIVE_DATA_DIR` 可指定应用数据来源；搜索代理可用 `SOFTJL_LIVE_PROXY` 指定，未指定时沿用 HTTP(S) 代理环境变量。

检查包括真实搜索及网页正文、文件写入无需插件授权、子代理文件读取、问答取消后不重放、第三方压缩记录及重启续聊。隔离进程将上下文预算设为 32,000，以有限真实请求触发压缩；不伪造 token 用量，也不修改用户正式应用的上下文预算。压缩断言检查 `fromHook=true` 与持久摘要。依赖补丁回归运行 `npm run test:pi-history`。

## 相关文档

- [子代理插件](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents)
- [网页访问插件](https://github.com/nicobailon/pi-web-access)

- [桌面架构](../architecture/platform-overview.md)
- [建模能力](../architecture/modeling-capabilities.md)
- [桌面运行与打包](../development/desktop-runtime.md)
