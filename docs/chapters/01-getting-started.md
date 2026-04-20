# 第一章：快速入门

## 1.1 什么是 OpenClaw

OpenClaw 是一个开源的AI助手运行时框架，核心能力：

- **Skill系统**：可插拔的技能扩展机制
- **多Agent编排**：支持子Agent并行/串行、任务分发
- **多渠道接入**：Telegram/Discord/飞书/微信等
- **节点管理**：支持远程机器作为计算节点
- **持久化Session**：对话上下文长期记忆

## 1.2 核心概念

| 概念 | 解释 |
| --- | --- |
| Gateway | OpenClaw核心进程，管控所有连接和消息流 |
| Skill | 技能插件，通过SKILL.md定义元数据和执行逻辑 |
| Session | 会话上下文，每个用户独立，支持长期记忆 |
| Node | 远程计算节点，可调度任务过去执行 |
| Channel | 消息渠道（Telegram/飞书等） |

## 1.3 最小可用示例

```javascript
// 一个最简单的Skill：天气查询
export default {
  name: 'weather',
  description: '查询天气',
  async execute({ args, session }) {
    const city = args[0] || '北京'
    return await fetchWeather(city)
  }
}
```

## 1.4 下一步

- [第二章：安装配置](02-installation.md) - 在你的机器上跑起来
