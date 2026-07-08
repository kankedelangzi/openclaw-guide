# 模块3 - Multi-Agent路由

> 皮皮虾学习笔记
> 学习时间：2026-04-01
> 目标：理解OpenClaw的多智能体隔离与路由机制

---

## 🎯 核心概念

### 什么是"一个智能体"？

一个**智能体**是一个完全独立作用域的"大脑"：

```
┌─────────────────────────────────────────┐
│           Agent (agentId)               │
│  ┌─────────────────────────────────┐    │
│  │  工作区 (workspace)              │    │
│  │  - AGENTS.md                    │    │
│  │  - SOUL.md (人格)               │    │
│  │  - USER.md                      │    │
│  │  - 本地技能                     │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  状态目录 (agentDir)             │    │
│  │  - auth-profiles.json           │    │
│  │  - 模型注册表                    │    │
│  │  - 每智能体配置                  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  会话存储                        │    │
│  │  ~/.openclaw/agents/<id>/       │    │
│  │    └── sessions/                │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**关键：认证配置文件是每智能体独立的！**

---

## 🗺️ 路径映射

| 用途 | 默认路径 | 环境变量覆盖 |
|------|----------|--------------|
| 配置 | `~/.openclaw/openclaw.json` | `OPENCLAW_CONFIG_PATH` |
| 状态目录 | `~/.openclaw` | `OPENCLAW_STATE_DIR` |
| 工作区 | `~/.openclaw/workspace` | - |
| 智能体目录 | `~/.openclaw/agents/<agentId>/agent` | `agents.list[].agentDir` |
| 会话 | `~/.openclaw/agents/<agentId>/sessions` | - |

---

## 🔀 路由规则（确定性优先级）

绑定是**确定性的**，**最具体的优先**：

```
1. peer匹配（精确私信/群组/频道id）
2. guildId（Discord）
3. teamId（Slack）
4. 渠道的accountId匹配
5. 渠道级匹配（accountId: "*"）
6. 回退到默认智能体
```

---

## 📋 配置示例

### 示例1：两个WhatsApp → 两个智能体

```json5
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent"
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent"
      }
    ]
  },
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } }
  ],
  channels: {
    whatsapp: {
      accounts: {
        personal: {},
        biz: {}
      }
    }
  }
}
```

### 示例2：同一渠道，特定用户路由到不同智能体

```json5
{
  agents: {
    list: [
      { id: "chat", model: "anthropic/claude-sonnet-4-5" },
      { id: "opus", model: "anthropic/claude-opus-4-5" }
    ]
  },
  bindings: [
    // peer绑定最优先
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    // 渠道级作为fallback
    { agentId: "chat", match: { channel: "whatsapp" } }
  ]
}
```

### 示例3：WhatsApp群组绑定家庭智能体

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        groupChat: {
          mentionPatterns: ["@family", "@familybot"]
        },
        sandbox: {
          mode: "all",
          scope: "agent"
        },
        tools: {
          allow: ["read", "exec"],
          deny: ["write", "edit", "browser"]
        }
      }
    ]
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" }
      }
    }
  ]
}
```

---

## 🏠 单智能体模式（默认）

如果什么都不配置：

```
agentId: "main"
sessionKey: "agent:main:<mainKey>"
workspace: "~/.openclaw/workspace"
agentDir: "~/.openclaw/agents/main/agent"
```

---

## 🔐 安全隔离

### 每智能体沙箱配置

```json5
{
  agents: {
    list: [
      {
        id: "personal",
        sandbox: { mode: "off" }  // 无沙箱
      },
      {
        id: "family",
        sandbox: {
          mode: "all",
          scope: "agent",
          docker: {
            setupCommand: "apt-get update && apt-get install -y git"
          }
        },
        tools: {
          allow: ["read"],
          deny: ["exec", "write", "edit"]
        }
      }
    ]
  }
}
```

### 智能体间通信

默认关闭，需显式启用：

```json5
{
  tools: {
    agentToAgent: {
      enabled: true,
      allow: ["home", "work"]
    }
  }
}
```

---

## 🔑 核心收获

1. **agentId = 完全隔离的人格**：每个智能体有自己的工作区、认证、会话

2. **绑定规则是确定性的**：peer > guild/team > accountId > 渠道 > 默认

3. **认证不共享**：`auth-profiles.json`是每智能体独立的

4. **沙箱和工具策略可每智能体配置**：实现不同安全级别

5. **多智能体 = 多个人**：适合家庭/团队共享一个Gateway服务器

---

## 📚 参考文档

- `/concepts/multi-agent` - 多智能体路由概念
- `/tools/multi-agent-sandbox-tools` - 多智能体沙箱和工具
