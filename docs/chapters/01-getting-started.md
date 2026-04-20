# 第一章：快速入门

## 1.1 什么是 OpenClaw

OpenClaw 是一个开源的 AI 助手运行时框架，定位介于"底层工具库"和"完整SaaS产品"之间——它提供了跑起一个AI应用所需的所有核心能力，但具体做什么、怎么做，完全由你决定。

核心能力一览：

- **Skill系统**：像搭积木一样给AI助手添加技能，每个Skill是一个独立的功能模块
- **多Agent编排**：一个主Agent可以派生出多个子Agent并行工作，任务完成后汇总结果
- **多渠道接入**：一套核心，对接Telegram、飞书、微信、Discord等十几种消息渠道
- **节点管理**：可以把任务调度到远程机器执行，不占用本地算力
- **持久化Session**：对话上下文长期保持，Agent能"记住"之前聊过什么

### 它解决什么问题

如果你尝试过直接用LLM的API构建应用，会遇到几个痛点：

1. **重复工作**——每次新项目都要重新写对话管理、上下文维护、错误处理
2. **扩展性差**——加一个新功能往往要改核心代码
3. **渠道隔离**——做一个Telegram Bot和一个飞书Bot要写两套逻辑
4. **记忆缺失**——LLM本身没有状态，每次对话都是全新的

OpenClaw 就是为了解决这些问题而生的。它的设计哲学是**"最小核心 + 标准化扩展"**——核心保持稳定，扩展通过Skill/Plugin机制完成。

### 谁在用 OpenClaw

- 个人用户：搭建自己的AI助手，定制各种Skill
- 开发团队：基于OpenClaw二次开发自己的AI产品
- 企业：作为内部AI能力的中台，接入各种办公渠道

## 1.2 核心概念

在开始动手之前，先把几个核心概念搞清楚。

### Gateway

Gateway 是 OpenClaw 的核心进程。你可以理解成它是整个系统的大脑——所有消息都经过它，所有调度都从它出发。

启动 OpenClaw，本质就是启动一个 Gateway 实例：

```bash
openclaw gateway start
```

一个Gateway可以同时接入多个Channel（消息渠道），处理来自不同来源的请求。

### Skill

Skill 是 OpenClaw 的功能扩展单位。每个 Skill 专注做一件事，比如"查天气"或"管文件"。它由一个 `SKILL.md` 文件定义，包含元数据和使用说明。

一个 Skill 的例子：

```markdown
---
name: weather
description: "查询任意城市的天气情况"
---

# Weather Skill

## 使用方法

\`\`\`
@助手 天气 北京
\`\`\`

## 支持的城市

中国主要城市均可查询，支持国际城市（需使用英文名）。
```

### Session

Session 是会话上下文。每次你和AI助手对话，都在一个Session里。Session持有：
- 当前的对话历史
- 用户的偏好和记忆
- 当前任务的状态

OpenClaw 支持 Session 持久化，重启后能恢复之前的对话。

### Channel

Channel 是消息渠道的抽象。Telegram 是一个 Channel，飞书是一个 Channel，Discord 也是一个 Channel。OpenClaw 通过 Channel Plugin 来接入不同的消息平台。

```
用户 (Telegram) ──┐
用户 (飞书) ───────┼──▶ Gateway ──▶ Skill处理 ──▶ 回复
用户 (Discord) ──┘
```

### Node

Node 是远程计算节点。如果你有多台机器，可以把一些重计算的任务调度到其他节点上执行，减轻主机器的压力。

### Hook

Hook 是在特定时机插入的钩子。比如：
- 每次发送消息前
- 每次执行工具后
- 每次用户提交问题时

你可以在这些时机插入自己的逻辑，实现监控、学习、过滤等功能。

## 1.3 技术栈要求

运行 OpenClaw 需要的软件环境：

| 软件 | 版本要求 | 说明 |
|---|---|---|
| Node.js | ≥ 18.0 | OpenClaw 基于 Node.js 运行 |
| npm / pnpm / yarn | 其一即可 | 包管理器，推荐 pnpm |
| 操作系统 | Linux/macOS/Windows | 跨平台支持 |

验证环境：

```bash
node --version   # 应输出 v18.x.x 或更高
npm --version    # 应输出 9.x.x 或更高
```

### 推荐：pnpm

pnpm 是更高效的包管理器，OpenClaw 官方推荐使用：

```bash
npm install -g pnpm
```

## 1.4 最小可用示例

这一节展示一个最小的 OpenClaw 实例——创建一个 Skill，让 AI 助手回复"你好"。

### 步骤一：安装 OpenClaw

```bash
pnpm add -g openclaw
```

### 步骤二：初始化工作目录

```bash
openclaw init my-assistant
cd my-assistant
```

这会创建一个标准的工作目录结构：

```
my-assistant/
├── workspace/        # 工作目录，Skill在这里找文件
│   ├── SOUL.md       # AI助手的性格设定
│   ├── AGENTS.md     # Agent行为规范
│   └── TOOLS.md      # 工具使用说明
├── skills/           # 本地Skill目录
├── memory/           # 记忆存储
├── config.yaml       # 配置文件
└── data/            # 数据目录
```

### 步骤三：启动 Gateway

```bash
openclaw gateway start
```

正常启动后，你会看到类似输出：

```
[Gateway] Starting OpenClaw Gateway...
[Gateway] Loaded 3 channels: telegram, feishu, discord
[Gateway] Loaded 12 skills
[Gateway] Gateway ready on port 18789
```

### 步骤四：配置一个 Channel（以 Telegram 为例）

编辑 `config.yaml`：

```yaml
channels:
  telegram:
    enabled: true
    bot_token: "YOUR_BOT_TOKEN_HERE"
```

Bot Token 需要去 Telegram 找 @BotFather 申请，这里不展开。

### 步骤五：创建一个最简单的 Skill

在 `skills/` 目录下创建 `hello/sKILL.md`：

```markdown
---
name: hello
description: "让AI助手说你好"
---

# Hello Skill

## 功能

当用户说"你好"或"hello"时，回复友好的问候。

## 触发词

- 你好
- hello
- 嗨

## 响应示例

输入：你好
输出：你好！有什么我可以帮你的吗？
```

重启 Gateway 后，这个 Skill 就生效了。

## 1.5 OpenClaw 能做什么

给你几个实际场景的例子，感受一下 OpenClaw 的能力边界。

### 场景一：多渠道AI助手

一个 OpenClaw 实例，同时接入：
- Telegram：用户随时通过手机发消息
- 飞书：办公场景，收到消息自动推送到群
- Discord：社区交流，有Bot自动回答常见问题

一套核心，三套界面，用户无感知。

### 场景二：多Agent协作

用户提出一个复杂任务，比如"帮我分析这篇论文的核心观点"：

1. 主Agent接收任务，拆解为子任务
2. 子Agent1：下载论文并提取文本
3. 子Agent2：对文本进行摘要
4. 子Agent3：提取关键观点
5. 主Agent汇总结果，返回给用户

整个过程用户只需要下一条消息，OpenClaw 自动完成并行调度和结果聚合。

### 场景三：Skill自动学习

self-improving-agent 是一个著名的 OpenClaw Skill，它可以：

- 捕获每次命令执行的错误，记录到 ERRORS.md
- 捕获用户的纠正，记录到 LEARNINGS.md
- 定期回顾，提取有价值的学习写入规范文件
- 让AI助手"越用越聪明"

### 场景四：远程任务执行

你的代码在本地，但某个任务需要 GPU 算力：

```yaml
nodes:
  gpu-server:
    address: "gpu-server.example.com"
    port: 9222
```

然后在对话中：

```
用户：帮我跑这个模型
OpenClaw：将任务调度到 gpu-server 执行
        完成后返回结果给用户
```

## 1.6 下一步

第一章到这里结束。你现在应该：

- 理解 OpenClaw 是什么、解决什么问题
- 搞清楚核心概念：Gateway、Skill、Session、Channel、Node、Hook
- 能在本地跑起一个最小实例

下一章我们将深入**安装配置**，把开发环境彻底搭起来，包括：
- 各种安装方式的对比和选择
- 目录结构详解
- 配置文件每个字段的含义
- 第一个可用的 Channel 配置（以 Telegram 为例）

准备好了吗？出发 → [第二章：安装配置](chapters/02-installation.md)
