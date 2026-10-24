<!-- 维护桌面架构的当前实现与使用边界。 -->
# 桌面架构

- 维护状态：持续维护
- 目标读者：桌面版使用者与维护者
- 事实来源：当前源码、根构建配置与测试

## 概述

独立 Windows Electron 应用通过单一项目对话完成建模，使用本地数据库和受保护的回环后台。

## 当前设计或配置

src/main 管理原生窗口；backend 管理固定本地身份、建模数据持久化；modeling 保留 routes → pipelines → records 的业务分层；rendering 提供 Java/PlantUML 与 PDF。src/preload 仅暴露命名的原生操作；src/renderer 是 React 界面，保留 app、features、entities、services、shared 边界。共享契约位于 src/shared/contracts。

目录组织参考 [Cherry Studio](https://github.com/CherryHQ/cherry-studio/tree/main/src) 与 [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate/tree/main/src) 的主进程与渲染进程分离；业务实现继续使用本仓库代码。没有保留独立网站服务或多工作区发布。

## 操作与维护

从根目录执行 npm run dev、npm run build 和 npm run package。模型与文档资源按模块相对位置复制，主进程和后台不依赖源码目录运行。

## 验证

npm run typecheck、npm run test:desktop、npm run test:modeling 与 npm run smoke。真实模型调用需单独验收。

## 相关文档

- [桌面运行与打包](../development/desktop-runtime.md)
- [建模能力](modeling-capabilities.md)
- [项目首页](../../README.md)
