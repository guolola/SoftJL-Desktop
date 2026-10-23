<!-- 说明桌面仓库的开发与验证入口。 -->
# 参与开发

请先阅读 [AGENTS.md](AGENTS.md)。保持 main、preload、renderer 与 shared 的进程边界，业务改动先读取相关契约和测试。

使用 Node.js 24 LTS 和 npm ci 安装依赖，npm run dev 启动，npm run package 打包。提交前运行 npm run typecheck、相关模块测试和 npm run audit:docs；不得提交本地数据库、密钥、运行时缓存或安装包。
