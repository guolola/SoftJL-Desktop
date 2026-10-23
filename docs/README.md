<!-- 维护项目文档的当前实现与使用边界。 -->
# 项目文档

- 维护状态：持续维护
- 目标读者：桌面版使用者与维护者
- 事实来源：当前源码、根构建配置与测试

## 概述

这里维护独立桌面版的架构、建模和集成说明。

## 当前设计或配置

- [桌面架构](architecture/platform-overview.md)
- [建模能力](architecture/modeling-capabilities.md)
- [可信生成](architecture/trusted-generation.md)
- [快速建模 Agent](architecture/standard-project-agent.md)
- [运行与打包](development/desktop-runtime.md)
- [模型服务接入](integrations/openai-compatible-provider.md)
- [MCP 与 Skill 管理](integrations/agent-integrations.md)

## 操作与维护

以源码、配置和测试为事实源。部署网站、SEO 与集群 Worker 运维不属于此桌面仓库。

## 验证

npm run audit:docs 检查名称、标题、链接与必需章节。

## 相关文档

- [项目首页](../README.md)
- [协作规范](../AGENTS.md)
