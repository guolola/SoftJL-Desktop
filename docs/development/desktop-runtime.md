<!-- 维护桌面运行与打包的当前实现与使用边界。 -->
# 桌面运行与打包

- 维护状态：持续维护
- 目标读者：桌面版使用者与维护者
- 事实来源：[打包配置](../../electron-builder.json)、[构建命令](../../package.json)、主进程与本地后台源码、桌面测试

## 概述

安装包独立运行，直接进入项目列表。AI 使用用户配置的模型。

## 当前设计或配置

主进程启动 utilityProcess 后台。PGlite 在应用数据目录持久化；模型密钥使用 Windows safeStorage 保护。后台仅监听 127.0.0.1，使用随机能力凭据。

主进程入口 src/main/index.ts；本地后台 src/main/backend；安装配置 electron-builder.json；输出 dist 和 release。Java 与字体下载缓存位于忽略的 .runtime，构建不会把它们加入源码控制。

## 操作与维护

当前数据库版本为 `desktop-v2`，使用用户数据目录下独立的 `database-desktop-v2` 存储。首次使用该版本会创建空数据库，后续启动继续读取该目录。旧版 `database` 目录不会读取、迁移或删除。

开发使用 Node.js 24 LTS，运行 npm ci、node scripts/prepare-runtime.mjs、npm run dev。npm run package 构建 Windows x64 NSIS 安装包，包含数据库、Java、PlantUML、字体与许可文件，无需安装者另外配置数据库服务。当前未配置发行签名。

### 下载与安装

公开安装包在 [GitHub Releases](https://github.com/guolola/SoftJL-Desktop/releases/latest) 分发。文件名为 `SoftJL-Desktop-<版本>-windows-x64-setup.exe`，同页提供 `SHA256SUMS.txt` 和 GitHub 自动生成的源码归档。源码归档不能作为安装包运行；当前没有便携版或其他系统架构的安装包。

用户运行安装向导后，在设置中配置自带模型即可使用。首次使用不要求 Node.js、Java 或独立数据库服务；编码项目的 SDK、依赖和外部 MCP 按需自行配置。安装包未签名，Windows 可能显示发布者未知或 SmartScreen 提示；下载后使用 `Get-FileHash -Algorithm SHA256 <安装包>` 与同页校验文件对照。

### 版本发布

版本号由 `package.json` 与 `package-lock.json` 共同维护，标签使用 `v<版本>`。在 [更新记录](../../changelog.md) 中维护面向使用者的变化、依赖来源和兼容性；Release 说明列出本版下载项、验证结果及已知限制。

发布前运行类型检查、桌面、建模、共享契约、渲染与界面测试、Pi 历史与原生包测试，以及文档检查。然后运行 `npm run package`；将 `SOFTJL_DESKTOP_EXECUTABLE` 指向生成目录中的 `SoftJL Desktop.exe`，运行 `npm run smoke` 检查实际打包程序。此验证使用隔离数据和确定性模型，不代表真实供应商或所有第三方服务均可用。

从 `release/` 中选取当前版本安装包生成 SHA-256 校验文件，提交源码后在对应提交创建版本标签。使用 GitHub CLI 创建草稿 Release、上传该安装包与校验文件，核对版本、源码提交、文件名及摘要后发布。安装包、blockmap、运行时与日志不提交到 Git；当前未接入自动更新，不发布更新通道文件或 blockmap。

发布完成后检查 Release 资产、标签指向和 README 下载链接。后续版本须同步更新 README 中的固定版本下载项；“下载最新版本”入口始终使用 `releases/latest`。公开下载仅以 GitHub Releases 为准，不提供未经维护的镜像或网盘链接。

### 本机工作区与会话

本地账号初始昵称和用户名均为 `Admin`；已有本地账号原位更名，项目和供应商归属保留，后续自行修改的昵称仍会持久保存。

创建项目时可以通过本机文件夹选择器指定项目工作区，项目设置中可以查看、更换或取消关联；聊天页面不展示目录或目录管理入口。目录配置按项目保存并在重启后保留，后续会话编码工具使用同一目录。选择新目录不会移动或删除已有文件，运行中的编码任务需要先停止再切换目录。取消文件夹选择会保留原配置；未选择目录时仍可建模，开始编码前需先设置工作区。

工作区选择由原生窗口授予，页面不能直接提交任意路径；创建前选择的目录通过一次性选择凭据在项目创建后绑定。建模项目数据仍保存在应用数据目录。MCP 与 Skill 入口位于设置侧栏，按需配置外部服务和工作流。

快速建模会话可以直接在该目录编码：输入需求后，Pi 复用当前需求、设计、测试与说明书，使用原生文件和 PowerShell 工具执行请求。应用不加载逐工具授权插件，读取内置 Skill 不弹权限确认。业务资料仍通过建模工具读取和保存，通用问答与选择代码目录继续使用交互组件。停止按钮会取消等待和正在执行的命令，保留已完成修改。命令拥有当前用户权限，初始工作目录限制不等同于系统沙箱。

## 验证

npm run typecheck；npm run test:desktop；npm run smoke。SOFTJL_DESKTOP_EXECUTABLE 可指定 release/win-unpacked 下的程序来检查打包产物。启动检查使用隔离的用户数据目录，并检查重启保存和内置渲染，不调用真实模型。

会话编码测试覆盖真实 Pi 工具、持久会话、插件对话协议、取消、目录切换锁定、PowerShell 输出、fff 命中、子代理文件读取和第三方压缩。模型传输使用确定性测试替身；前端检查官方组件、实际输出与操作守卫。

## 相关文档

- [桌面架构](../architecture/platform-overview.md)
- [MCP 与 Skill 管理](../integrations/agent-integrations.md)
- [项目首页](../../README.md)
