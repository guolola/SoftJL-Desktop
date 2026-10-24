<!-- 记录公开发行版本的功能变化、兼容性与使用边界。 -->
# 更新记录

## v0.1.0

首个 Windows x64 安装包版本，定位为基于 Pi Coding Agent 的个人本地编程助手。安装包与 SHA-256 校验文件通过 [GitHub Releases](https://github.com/guolola/SoftJL-Desktop/releases) 分发，源码由同名 Git 标签保留。

### 功能

- 统一项目对话：整理需求、读取已有工程、编辑本机代码并执行 PowerShell 构建与测试。
- 按需生成八类结构化图表，支持继续编辑，以及 SVG、PNG、PDF 和 PlantUML 导出。
- 根据已保存需求和模型生成测试用例、需求规格说明书与软件设计说明书，支持 DOCX 预览、版本和下载。
- 项目、Pi 会话与工具历史本地保存，支持上下文压缩与重启续聊；模型服务由用户自行配置（BYOK）。
- 提供 MCP / Skills 管理与代码目录选择；设置代码目录后自动加载本机编码工具并继续对话。

### 集成与来源

- Pi 运行时使用 `@earendil-works/pi-*` 1.3.0，复用其会话、工具循环、文件与 PowerShell 工具、资源加载和 MCP 能力。
- 五项第三方 Pi 插件：`@juicesharp/rpiv-ask-user-question` 2.13.9、`pi-custom-compaction` 0.2.5、`pi-fff` 0.1.13、`pi-web-access` 0.44.0、`@gotgenes/pi-subagents` 25.0.1。
- 七项 Skill：两项 SoftJL 核心规范与五项参考公开 Skill 编写的 SoftJL 适配工作流；不包含参考技能的上游脚本。
- 六项第三方 MCP 连接预设：MarkItDown、DBHub、Filesystem、Context7、Playwright、GitHub；首次创建时均关闭，需自行配置运行条件。
- SoftJL 自有部分包括项目和模型契约、建模与说明书流水线、桌面交互桥接和集成管理。详细名称、上游链接与维护补丁见 [集成文档](docs/integrations/agent-integrations.md)。

### 兼容性与限制

- 当前仅提供个人 Windows x64 应用，安装包未进行代码签名；运行前可使用 Release 中的 SHA-256 文件核对下载内容。
- Desktop 统一使用项目对话，移除独立工程建模模式及其需求基线、可行性流程、覆盖矩阵、来源追踪和变更影响审核入口。
- 使用独立的 `desktop-v2` 数据目录；旧版数据库不会自动读取、迁移或删除，首次使用新目录会创建空项目库。升级前请退出应用并备份原数据。
- 文件操作与命令使用当前用户权限，代码目录不构成操作系统沙箱；不提供逐工具授权，停止任务保留已完成的文件修改。
- 模型、MCP 和网页服务可能发送调用所需上下文并产生费用；安装包不包含服务账号、模型额度或工程开发依赖。
- 图表与代码没有自动双向同步；生成测试用例不等于已执行测试，设计、文档与实现仍需检查。
