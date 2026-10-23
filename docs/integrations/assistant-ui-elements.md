<!-- 说明 assistant-ui Elements 的直接使用边界、完整组件选型与维护方式。 -->
# Assistant UI Elements 组件选型

- 维护状态：持续维护
- 目标读者：桌面前端与 Pi 集成维护者
- 事实来源：官方 Elements 151 项目录、各项文档与 API、官方 registry 源码、项目实际工具结果契约

## 概述

对官方目录的 151 项逐项检查用途、输入、交互结果和本项目数据来源。选中的组件直接导入官方 registry 源码；不以截图为依据仿写。目录包含基础组件、完整交互和生成式 UI 示例，不能把每项都作为独立业务功能塞入同一会话。

## 当前设计或配置

新增 ElicitationForm、TaskCard、WebSearch、Sources，以及 Sources 所需的 CollapsibleRoot 和 href 工具。继续使用现有官方 OptionList、ApprovalCard、CodeDiff、TerminalBlock、QuestionFlow 和加载/工具组件。新增源码及来源校验记录位于 [assistant-ui 目录](../../src/renderer/src/shared/assistant-ui/pi-elements-source.json)。

WebSearch 保留官方结构与样式，移除上游固定的“Read 3 sources”演示文案，改用真实来源数；同域名的多条结果使用不同键值。

ElicitationForm 增加可选多行字段，以 textarea 承接 Pi editor，保留预填与回答中的换行。

Pi select 原样返回选项文字；input 返回文字；confirm 返回布尔值；关闭或超时按原生取消语义返回。权限判断和问卷流程由第三方插件处理，React 只承担协议展示。QuestionFlow 继续处理带稳定模型类型标识的业务范围确认。

ReviewableDiff 的逐 hunk 决策不能映射为权限插件的整次工具授权，因此不接入会产生虚假部分授权的按钮。原生 edit 的参数以 CodeDiff 预览；不宣称具备逐块应用或回滚。

### 全部 151 项的选择

“直接使用”是本次新增的正式依赖源码；“沿用”继续接入已有官方组件；“不新增/不选”说明本次没有增加该项，不代表产品其他页面完全没有同类组件。

| 序号 | 官方组件 | 本次选择 | 决策依据 |
| --- | --- | --- | --- |
| 1 | [loading-state](https://www.assistant-ui.com/elements/loading-state) | 沿用 | 等待模型响应和压缩期间的现有加载状态。 |
| 2 | [thinking-indicator](https://www.assistant-ui.com/elements/thinking-indicator) | 不新增 | 思考区已有原版 reasoning，避免两个思考指示器。 |
| 3 | [streaming-text](https://www.assistant-ui.com/elements/streaming-text) | 不新增 | 现有消息流由 assistant-ui runtime 驱动，不另建流式状态。 |
| 4 | [typing-indicator](https://www.assistant-ui.com/elements/typing-indicator) | 不新增 | 与现有加载提示重复。 |
| 5 | [reasoning-effort](https://www.assistant-ui.com/elements/reasoning-effort) | 不新增 | 思考档位沿用当前模型能力与选择器契约。 |
| 6 | [guardrail-notice](https://www.assistant-ui.com/elements/guardrail-notice) | 不新增 | 没有独立的 guardrail verdict 数据；权限结果由插件提供。 |
| 7 | [message-pair](https://www.assistant-ui.com/elements/message-pair) | 不新增 | 保留现有 Thread 的消息结构。 |
| 8 | [message-branches](https://www.assistant-ui.com/elements/message-branches) | 不新增 | 当前没有历史分支切换入口，不能生成虚假分支。 |
| 9 | [message-actions](https://www.assistant-ui.com/elements/message-actions) | 不新增 | 现有消息复制、编辑和重生成入口已接入真实服务。 |
| 10 | [error-state](https://www.assistant-ui.com/elements/error-state) | 不新增 | 沿用现有会话错误与重试入口。 |
| 11 | [message-queue](https://www.assistant-ui.com/elements/message-queue) | 不新增 | 当前每项目单轮执行，没有用户可管理的排队消息契约。 |
| 12 | [edit-message](https://www.assistant-ui.com/elements/edit-message) | 不新增 | 现有编辑入口已绑定持久会话检查点。 |
| 13 | [feedback-dialog](https://www.assistant-ui.com/elements/feedback-dialog) | 不新增 | 没有评价反馈保存端点。 |
| 14 | [stopped-run](https://www.assistant-ui.com/elements/stopped-run) | 不新增 | 现有停止状态已与运行记录绑定。 |
| 15 | [day-separator](https://www.assistant-ui.com/elements/day-separator) | 不新增 | 会话时间分隔不是插件接入所需。 |
| 16 | [speaker-identity](https://www.assistant-ui.com/elements/speaker-identity) | 不新增 | 保留现有用户和助手身份显示。 |
| 17 | [regenerate-menu](https://www.assistant-ui.com/elements/regenerate-menu) | 不新增 | 现有重生成走服务端检查点，不增加另一入口。 |
| 18 | [confidence-marker](https://www.assistant-ui.com/elements/confidence-marker) | 不新增 | 插件不提供可校准的可信度。 |
| 19 | [tool-call](https://www.assistant-ui.com/elements/tool-call) | 沿用 | fff 及普通工具的折叠参数、输出和失败状态。 |
| 20 | [run-activity](https://www.assistant-ui.com/elements/run-activity) | 不新增 | 工具事件已有当前对话展示，避免重复活动流。 |
| 21 | [tool-timeline](https://www.assistant-ui.com/elements/tool-timeline) | 不新增 | 当前任务卡和工具调用已覆盖时序，不增加第二份历史。 |
| 22 | [terminal-block](https://www.assistant-ui.com/elements/terminal-block) | 沿用 | 显示原生 PowerShell 的实际命令与输出。 |
| 23 | [code-diff](https://www.assistant-ui.com/elements/code-diff) | 沿用 | 显示原生编辑参数中的修改片段；只预览，不伪装部分授权。 |
| 24 | [reviewable-diff](https://www.assistant-ui.com/elements/reviewable-diff) | 不选 | 提供逐 hunk 保留、丢弃与应用；权限插件授权整次工具，缺少部分应用契约。 |
| 25 | [file-tree](https://www.assistant-ui.com/elements/file-tree) | 不新增 | fff 返回排序命中而非完整目录树，不能把命中拼成虚假文件树。 |
| 26 | [elicitation-form](https://www.assistant-ui.com/elements/elicitation-form) | 直接使用 | Pi input/editor 协议的文字回答与拒绝操作。 |
| 27 | [mcp-server-panel](https://www.assistant-ui.com/elements/mcp-server-panel) | 不新增 | 设置页已有真实 MCP 测试和启停管理。 |
| 28 | [tool-error](https://www.assistant-ui.com/elements/tool-error) | 不新增 | 沿用 ToolCall 错误展示与原始输出。 |
| 29 | [permission-grant](https://www.assistant-ui.com/elements/permission-grant) | 不选 | 固定授权字段不能完整承载插件的多种原始选项；使用 OptionList。 |
| 30 | [computer-use](https://www.assistant-ui.com/elements/computer-use) | 不新增 | 没有本次插件提供的截图与坐标操作事件。 |
| 31 | [code-runner](https://www.assistant-ui.com/elements/code-runner) | 不选 | 没有沙箱运行契约；实际命令使用 TerminalBlock。 |
| 32 | [web-search](https://www.assistant-ui.com/elements/web-search) | 直接使用 | 展示 web-access 的真实查询、搜索状态与结果标题。 |
| 33 | [inline-citation](https://www.assistant-ui.com/elements/inline-citation) | 不新增 | 当前回答文本未生成稳定的引用编号映射；来源使用 Sources。 |
| 34 | [link-preview](https://www.assistant-ui.com/elements/link-preview) | 不新增 | 搜索已有真实来源标题与摘要，不追加预览抓取。 |
| 35 | [image-generation](https://www.assistant-ui.com/elements/image-generation) | 不新增 | 本次没有图像生成工具。 |
| 36 | [image-gallery](https://www.assistant-ui.com/elements/image-gallery) | 不新增 | 本次没有图片搜索或图库结果。 |
| 37 | [retrieval-chunks](https://www.assistant-ui.com/elements/retrieval-chunks) | 不选 | fff 没有统一相关度评分契约，不编造检索分数。 |
| 38 | [document-reference](https://www.assistant-ui.com/elements/document-reference) | 不新增 | 本次搜索源使用 URL，未新增文档页码定位。 |
| 39 | [memory-chips](https://www.assistant-ui.com/elements/memory-chips) | 不新增 | 长期业务事实仍由已有 memory 保存，不把压缩摘要当作用户事实。 |
| 40 | [research-report](https://www.assistant-ui.com/elements/research-report) | 不新增 | 搜索工具未输出章节式报告结构。 |
| 41 | [map-answer](https://www.assistant-ui.com/elements/map-answer) | 不新增 | 没有地理位置问答数据。 |
| 42 | [geo-map](https://www.assistant-ui.com/elements/geo-map) | 不新增 | 没有地图坐标与地图服务。 |
| 43 | [data-table](https://www.assistant-ui.com/elements/data-table) | 不新增 | 工具输出并非稳定列结构，保留真实原文。 |
| 44 | [number-ticker](https://www.assistant-ui.com/elements/number-ticker) | 不新增 | 没有需要独立动画展示的插件计量。 |
| 45 | [chart](https://www.assistant-ui.com/elements/chart) | 不新增 | 插件没有图表序列，不生成示例数据。 |
| 46 | [media-player](https://www.assistant-ui.com/elements/media-player) | 不新增 | 没有媒体播放结果。 |
| 47 | [web-preview](https://www.assistant-ui.com/elements/web-preview) | 不新增 | 网页内容检索不等于可执行网站预览。 |
| 48 | [diagram](https://www.assistant-ui.com/elements/diagram) | 不新增 | 业务模型已有专用渲染与编辑器，保留类型契约。 |
| 49 | [flow-graph](https://www.assistant-ui.com/elements/flow-graph) | 不新增 | 子代理没有可编辑流程图契约。 |
| 50 | [activity-graph](https://www.assistant-ui.com/elements/activity-graph) | 不新增 | 工具活动不需要另建图布局。 |
| 51 | [math-block](https://www.assistant-ui.com/elements/math-block) | 不新增 | 数学公式沿用现有 Markdown 渲染。 |
| 52 | [spec-sheet](https://www.assistant-ui.com/elements/spec-sheet) | 不新增 | 需求与设计说明书保留现有编辑器及导出。 |
| 53 | [comparison-card](https://www.assistant-ui.com/elements/comparison-card) | 不新增 | 插件未输出通用产品比较结构。 |
| 54 | [timeline](https://www.assistant-ui.com/elements/timeline) | 不新增 | 没有独立时间线业务数据。 |
| 55 | [job-progress](https://www.assistant-ui.com/elements/job-progress) | 不选 | 不把工具运行时长当作可靠完成百分比。 |
| 56 | [score-breakdown](https://www.assistant-ui.com/elements/score-breakdown) | 不新增 | 没有可解释的评分项目。 |
| 57 | [agent-plan](https://www.assistant-ui.com/elements/agent-plan) | 不新增 | 子代理任务不是用户已批准的计划，不生成计划阶段。 |
| 58 | [subagent-list](https://www.assistant-ui.com/elements/subagent-list) | 不选 | 组件进度结构与插件状态不完全对应；采用状态更直接的 TaskCard。 |
| 59 | [task-card](https://www.assistant-ui.com/elements/task-card) | 直接使用 | 显示真实子代理状态、任务和结果，不填造进度。 |
| 60 | [agent-status](https://www.assistant-ui.com/elements/agent-status) | 不新增 | 与子代理任务卡状态重复。 |
| 61 | [approval-card](https://www.assistant-ui.com/elements/approval-card) | 沿用 | Pi confirm 的整次确认或取消；多选授权走 OptionList。 |
| 62 | [option-list](https://www.assistant-ui.com/elements/option-list) | 沿用 | Pi select 原样展示并返回插件选项，包括本次、会话级和拒绝选项。 |
| 63 | [question-flow](https://www.assistant-ui.com/elements/question-flow) | 沿用 | 业务模型范围的结构化选择；通用询问交给 rpiv。 |
| 64 | [recommendation-card](https://www.assistant-ui.com/elements/recommendation-card) | 不新增 | 不再用自研资料补齐推荐拦截原生编码。 |
| 65 | [artifact-card](https://www.assistant-ui.com/elements/artifact-card) | 不新增 | 模型、说明书等产物仍走现有业务组件。 |
| 66 | [todo-list](https://www.assistant-ui.com/elements/todo-list) | 不新增 | 插件接入不另建一份待办状态。 |
| 67 | [agent-card](https://www.assistant-ui.com/elements/agent-card) | 不新增 | 本次没有用户编辑代理配置的图形入口。 |
| 68 | [agent-handoff](https://www.assistant-ui.com/elements/agent-handoff) | 不新增 | 父会话仍负责答复，没有更换对话所有者。 |
| 69 | [background-inbox](https://www.assistant-ui.com/elements/background-inbox) | 不选 | 本轮接入前台子代理及同轮结果等待，不承诺跨会话后台收件箱。 |
| 70 | [checkpoint-history](https://www.assistant-ui.com/elements/checkpoint-history) | 不新增 | Pi 历史保留在原有树，不新增可点击回滚承诺。 |
| 71 | [schedule-card](https://www.assistant-ui.com/elements/schedule-card) | 不新增 | 不增加定时任务或调度服务。 |
| 72 | [trace-waterfall](https://www.assistant-ui.com/elements/trace-waterfall) | 不新增 | 未采集完整嵌套 span 数据。 |
| 73 | [cost-meter](https://www.assistant-ui.com/elements/cost-meter) | 不新增 | 现有用量显示保持真实边界，不把子调用未核算费用合并估算。 |
| 74 | [quota-banner](https://www.assistant-ui.com/elements/quota-banner) | 不新增 | 不存在插件独立配额来源。 |
| 75 | [composer](https://www.assistant-ui.com/elements/composer) | 不新增 | 使用现有 assistant-ui 输入区。 |
| 76 | [composer-slash-commands](https://www.assistant-ui.com/elements/composer-slash-commands) | 不新增 | 没有实现 TUI 命令菜单到桌面的完整协议。 |
| 77 | [composer-mentions](https://www.assistant-ui.com/elements/composer-mentions) | 不新增 | fff 的终端补全不会自动变成网页 @ 文件菜单。 |
| 78 | [composer-attachments](https://www.assistant-ui.com/elements/composer-attachments) | 不新增 | 保留现有附件输入与解析。 |
| 79 | [composer-model-picker](https://www.assistant-ui.com/elements/composer-model-picker) | 不新增 | 保留已连接供应商配置的选择器。 |
| 80 | [composer-voice](https://www.assistant-ui.com/elements/composer-voice) | 不新增 | 没有语音输入服务。 |
| 81 | [composer-context](https://www.assistant-ui.com/elements/composer-context) | 不新增 | 保留现有引用和附件上下文。 |
| 82 | [draft-restore](https://www.assistant-ui.com/elements/draft-restore) | 不新增 | 草稿恢复与本次插件无关。 |
| 83 | [context-breakdown](https://www.assistant-ui.com/elements/context-breakdown) | 不选 | 没有可可靠划分到各类的上下文 token 明细。 |
| 84 | [prompt-library](https://www.assistant-ui.com/elements/prompt-library) | 不新增 | 当前 Skills 管理已覆盖方法配置。 |
| 85 | [command-palette](https://www.assistant-ui.com/elements/command-palette) | 不新增 | 没有可执行的完整插件命令映射。 |
| 86 | [voice-conversation](https://www.assistant-ui.com/elements/voice-conversation) | 不新增 | 没有实时音频服务。 |
| 87 | [read-aloud](https://www.assistant-ui.com/elements/read-aloud) | 不新增 | 没有朗读音频输出。 |
| 88 | [chat-panel](https://www.assistant-ui.com/elements/chat-panel) | 不新增 | 现有会话布局已承载新工具。 |
| 89 | [empty-state](https://www.assistant-ui.com/elements/empty-state) | 不新增 | 不替换已有项目空状态。 |
| 90 | [scroll-anchor](https://www.assistant-ui.com/elements/scroll-anchor) | 不新增 | 沿用现有消息滚动行为。 |
| 91 | [canvas-split](https://www.assistant-ui.com/elements/canvas-split) | 不新增 | 当前模型工作区已有布局，插件无需另一画布。 |
| 92 | [connection-state](https://www.assistant-ui.com/elements/connection-state) | 不新增 | 现有连接错误直接控制交互禁用。 |
| 93 | [shared-conversation](https://www.assistant-ui.com/elements/shared-conversation) | 不新增 | 没有共享会话链接服务。 |
| 94 | [conversation-search](https://www.assistant-ui.com/elements/conversation-search) | 不新增 | 没有本次新增的全文对话检索接口。 |
| 95 | [thread-search](https://www.assistant-ui.com/elements/thread-search) | 不新增 | 不把 fff 文件索引当作对话搜索。 |
| 96 | [launcher-bubble](https://www.assistant-ui.com/elements/launcher-bubble) | 不新增 | 桌面主页面已有固定对话入口。 |
| 97 | [settings-panel](https://www.assistant-ui.com/elements/settings-panel) | 不新增 | 沿用当前设置路由，插件配置采用上游格式。 |
| 98 | [onboarding](https://www.assistant-ui.com/elements/onboarding) | 不新增 | 没有需要额外引导页的新账号流程。 |
| 99 | [mobile-composer](https://www.assistant-ui.com/elements/mobile-composer) | 不新增 | 目标是 Windows Electron 桌面。 |
| 100 | [thread](https://www.assistant-ui.com/elements/thread) | 不新增 | 已使用 assistant-ui 会话基础设施，不另建线程。 |
| 101 | [assistant-modal](https://www.assistant-ui.com/elements/assistant-modal) | 不新增 | 主工作区需要常驻对话，不增加模态聊天。 |
| 102 | [assistant-sidebar](https://www.assistant-ui.com/elements/assistant-sidebar) | 不新增 | 保留当前会话和业务产物布局。 |
| 103 | [thread-list](https://www.assistant-ui.com/elements/thread-list) | 不新增 | 项目列表已经决定会话归属。 |
| 104 | [thread-list-sidebar](https://www.assistant-ui.com/elements/thread-list-sidebar) | 不新增 | 不增加第二套项目会话侧栏。 |
| 105 | [orb](https://www.assistant-ui.com/elements/orb) | 不新增 | 装饰动画不能代替实际运行状态。 |
| 106 | [reasoning](https://www.assistant-ui.com/elements/reasoning) | 不新增 | 沿用现有原版推理展示。 |
| 107 | [message-timing](https://www.assistant-ui.com/elements/message-timing) | 不新增 | 已有真实首字延迟与输出速率记录。 |
| 108 | [conversation-map](https://www.assistant-ui.com/elements/conversation-map) | 不新增 | 不增加完整对话地图与导航状态。 |
| 109 | [context-display](https://www.assistant-ui.com/elements/context-display) | 不新增 | 沿用现有模型容量、占用与压缩状态。 |
| 110 | [mcp-config](https://www.assistant-ui.com/elements/mcp-config) | 不新增 | 当前设置已有持久化 MCP 配置和连接测试。 |
| 111 | [attachment](https://www.assistant-ui.com/elements/attachment) | 不新增 | 保留原有附件组件。 |
| 112 | [follow-up-suggestions](https://www.assistant-ui.com/elements/follow-up-suggestions) | 不新增 | 已有真实后续建议生成流程。 |
| 113 | [tool-fallback](https://www.assistant-ui.com/elements/tool-fallback) | 不新增 | 通用工具已有 fallback，保留原文。 |
| 114 | [tool-group](https://www.assistant-ui.com/elements/tool-group) | 不新增 | 既有工具分组仍用，子代理和网页结果单独展开。 |
| 115 | [quote](https://www.assistant-ui.com/elements/quote) | 不新增 | 已有引用上下文契约。 |
| 116 | [sources](https://www.assistant-ui.com/elements/sources) | 直接使用 | 显示经过 http/https 校验的真实来源链接和摘要。 |
| 117 | [image](https://www.assistant-ui.com/elements/image) | 不新增 | 现有图片附件渲染无需替换。 |
| 118 | [file](https://www.assistant-ui.com/elements/file) | 不新增 | fff 搜索结果不是已下载附件，不伪装文件产物。 |
| 119 | [model-selector](https://www.assistant-ui.com/elements/model-selector) | 不新增 | 已有模型选择能力和可用性约束。 |
| 120 | [composer-trigger-popover](https://www.assistant-ui.com/elements/composer-trigger-popover) | 不新增 | 未新增输入区触发菜单。 |
| 121 | [directive-text](https://www.assistant-ui.com/elements/directive-text) | 不新增 | 不增加新的指令文本解析通道。 |
| 122 | [markdown-text](https://www.assistant-ui.com/elements/markdown-text) | 不新增 | 原有 Markdown 渲染已启用。 |
| 123 | [syntax-highlighter](https://www.assistant-ui.com/elements/syntax-highlighter) | 不新增 | 保留现有代码高亮，避免增加另一引擎。 |
| 124 | [shiki-highlighter](https://www.assistant-ui.com/elements/shiki-highlighter) | 不新增 | 现有 Shiki 已处理代码片段。 |
| 125 | [mermaid-diagram](https://www.assistant-ui.com/elements/mermaid-diagram) | 不新增 | 业务模型仍使用项目原有模型和渲染协议。 |
| 126 | [generative-ui](https://www.assistant-ui.com/elements/generative-ui) | 不选 | 插件返回确定的数据契约，不需要运行模型生成的 UI 规范。 |
| 127 | [tooltip-icon-button](https://www.assistant-ui.com/elements/tooltip-icon-button) | 不新增 | 沿用现有可访问按钮原语。 |
| 128 | [logos](https://www.assistant-ui.com/elements/logos) | 不新增 | 没有新品牌选择界面。 |
| 129 | [heat-graph](https://www.assistant-ui.com/elements/heat-graph) | 不新增 | 无热力图指标数据。 |
| 130 | [generative-stays](https://www.assistant-ui.com/elements/generative-stays) | 不选 | 住宿卡需要房源、价格与预订操作，项目不提供。 |
| 131 | [generative-booking](https://www.assistant-ui.com/elements/generative-booking) | 不选 | 餐位预订表单与项目业务无关。 |
| 132 | [generative-order-status](https://www.assistant-ui.com/elements/generative-order-status) | 不选 | 订单配送时间线不对应工具生命周期。 |
| 133 | [generative-flight-tracker](https://www.assistant-ui.com/elements/generative-flight-tracker) | 不选 | 航班路线和航行进度与子代理状态不同。 |
| 134 | [generative-portfolio](https://www.assistant-ui.com/elements/generative-portfolio) | 不选 | 持仓与投资图表没有数据来源。 |
| 135 | [generative-create-event](https://www.assistant-ui.com/elements/generative-create-event) | 不选 | 没有日历写入工具。 |
| 136 | [generative-view-event](https://www.assistant-ui.com/elements/generative-view-event) | 不选 | 没有日历事件读取契约。 |
| 137 | [generative-weather-current](https://www.assistant-ui.com/elements/generative-weather-current) | 不选 | 没有天气服务。 |
| 138 | [generative-ride-status](https://www.assistant-ui.com/elements/generative-ride-status) | 不选 | 没有司机、车辆与接驾状态。 |
| 139 | [generative-draft-email](https://www.assistant-ui.com/elements/generative-draft-email) | 不选 | 没有邮件草稿和发送服务。 |
| 140 | [generative-cart](https://www.assistant-ui.com/elements/generative-cart) | 不选 | 没有商品、购物车或支付。 |
| 141 | [generative-playlist](https://www.assistant-ui.com/elements/generative-playlist) | 不选 | 没有音乐资源与播放服务。 |
| 142 | [generative-channel-message](https://www.assistant-ui.com/elements/generative-channel-message) | 不选 | 没有外部聊天频道消息来源。 |
| 143 | [generative-receipt](https://www.assistant-ui.com/elements/generative-receipt) | 不选 | 工具执行结果不是交易收据。 |
| 144 | [generative-chart-area](https://www.assistant-ui.com/elements/generative-chart-area) | 不选 | 没有按日用户指标；不能使用演示数据。 |
| 145 | [generative-player-card](https://www.assistant-ui.com/elements/generative-player-card) | 不选 | 没有球员统计数据。 |
| 146 | [generative-event-session](https://www.assistant-ui.com/elements/generative-event-session) | 不选 | 没有会议议程与讲者数据。 |
| 147 | [generative-notify-confirm](https://www.assistant-ui.com/elements/generative-notify-confirm) | 不选 | 确认已用直接导入的 ApprovalCard，不再加入生成式 UI 依赖。 |
| 148 | [generative-chart-line](https://www.assistant-ui.com/elements/generative-chart-line) | 不选 | 没有连续时序测量来源。 |
| 149 | [generative-create-task](https://www.assistant-ui.com/elements/generative-create-task) | 不选 | 子代理由上游工具管理，不再自建任务服务。 |
| 150 | [generative-software-purchase](https://www.assistant-ui.com/elements/generative-software-purchase) | 不选 | 没有订阅购买与席位计费。 |
| 151 | [generative-chart-bars](https://www.assistant-ui.com/elements/generative-chart-bars) | 不选 | 没有渠道统计指标。 |

## 操作与维护

升级时从 [官方 registry](https://r.assistant-ui.com/registry.json) 和各组件 JSON 读取源码与依赖。只做工程路径、必要语言及可访问性适配，记录变更后的校验值；保留上游许可证。不得添加演示定时器、虚假进度或预填演示结果到实际对话。

新增卡片前先检查真实工具数据，再决定字段映射；无法结构化的结果保留原文。搜索链接只接受 http/https。用户取消、连接失败、权限变化和旧轮次提示均须保留服务端校验与前端操作守卫。

## 验证

组件行为测试覆盖原始选项回传、提交失败后重试、文字回答、取消、失效轮次和权限/连接守卫；插件结果测试覆盖搜索来源和子代理真实状态。完整目录固定列出 151 个不同 slug；新增来源清单含上游内容和安装文件 SHA-256。

## 相关文档

- [Pi 与外部集成](agent-integrations.md)
- [快速建模会话](../architecture/standard-project-agent.md)
- [官方 Elements](https://www.assistant-ui.com/elements)
- [ReviewableDiff API](https://www.assistant-ui.com/elements/reviewable-diff)
