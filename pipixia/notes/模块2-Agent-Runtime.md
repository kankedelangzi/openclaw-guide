# 模块2：Agent Runtime - Pi Agent Core + Session管理 + 引导文件系统

> 🦐 皮皮虾OpenClaw源码深读 | 完成时间：2026-04-01
> 目标：成为能够重写OpenClaw的大师

---

## 一、核心概念快速回顾

### 1.1 什么是Agent Runtime？

Agent Runtime是OpenClaw中**管理和执行AI Agent的核心系统**。它负责：
- Agent的创建、配置、生命周期管理
- Session（会话）的创建和管理
- 消息路由和上下文管理
- 引导文件系统（Bootstrap Files）的加载

### 1.2 关键组件

| 组件 | 职责 |
|------|------|
| **AgentScope** | Agent配置解析和路由 |
| **Session** | 会话状态管理 |
| **Bootstrap Files** | 初始化上下文文件加载 |
| **RuntimeEnv** | 运行时环境抽象 |

---

## 二、Agent配置结构（types.agents.d.ts）

```typescript
// Agent配置完整结构
type AgentConfig = {
  id: string;                    // Agent唯一标识
  default?: boolean;            // 是否为默认Agent
  name?: string;                // Agent名称
  workspace?: string;           // 工作目录
  agentDir?: string;            // Agent专属目录
  model?: AgentModelConfig;     // 模型配置
  thinkingDefault?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
  reasoningDefault?: "on" | "off" | "stream";
  fastModeDefault?: boolean;
  skills?: string[];            // 技能白名单
  memorySearch?: MemorySearchConfig;
  humanDelay?: HumanDelayConfig;
  heartbeat?: AgentDefaultsConfig["heartbeat"];
  identity?: IdentityConfig;
  groupChat?: GroupChatConfig;
  subagents?: {
    allowAgents?: string[];
    model?: AgentModelConfig;
  };
  sandbox?: AgentSandboxConfig;
  params?: Record<string, unknown>;
  tools?: AgentToolsConfig;
  runtime?: AgentRuntimeConfig; // 运行时配置
};

// 运行时配置支持两种类型
type AgentRuntimeConfig =
  | { type: "embedded" }                    // 内嵌模式（Pi Agent）
  | { type: "acp"; acp?: AgentRuntimeAcpConfig };  // ACP外部模式
```

### 1.3 Agent作用域解析（agent-scope.d.ts）

```typescript
// 关键解析函数
resolveAgentConfig(cfg, agentId)      // 获取Agent配置
resolveSessionAgentId(params)        // 从sessionKey解析agentId
resolveAgentWorkspaceDir(cfg, agentId) // 获取Agent工作目录
resolveAgentIdsByWorkspacePath(cfg, workspacePath) // 通过路径查找Agent
```

---

## 三、Session管理系统

### 3.1 Session Key结构

```typescript
// Session Key格式解析
type ParsedAgentSessionKey = {
  agentId: string;    // Agent标识
  rest: string;       // 剩余部分
};

// Session Key示例
// "agent:main:channel:direct:user123" -> { agentId: "main", rest: "channel:direct:user123" }
```

### 3.2 Session类型判断

```typescript
// 判断Session类型
isCronRunSessionKey(key)      // Cron任务执行
isCronSessionKey(key)         // Cron触发
isSubagentSessionKey(key)     // 子Agent
isAcpSessionKey(key)          // ACP会话
getSubagentDepth(key)         // 子Agent深度
```

### 3.3 Session生命周期事件

```typescript
type SessionLifecycleEvent = {
  sessionKey: string;
  reason: string;
  parentSessionKey?: string;
  label?: string;
  displayName?: string;
};

// 监听Session生命周期
onSessionLifecycleEvent(listener)    // 注册监听
emitSessionLifecycleEvent(event)     // 触发事件
```

---

## 四、引导文件系统（Bootstrap Files）

### 4.1 默认引导文件

| 文件名 | 用途 |
|--------|------|
| `AGENTS.md` | Agent定义和配置 |
| `SOUL.md` | Agent人格/灵魂 |
| `TOOLS.md` | 工具配置 |
| `IDENTITY.md` | Agent身份 |
| `USER.md` | 用户信息 |
| `HEARTBEAT.md` | 心跳任务配置 |
| `BOOTSTRAP.md` | 首次运行引导 |
| `MEMORY.md` | 长期记忆 |

### 4.2 引导文件解析

```typescript
type WorkspaceBootstrapFile = {
  name: WorkspaceBootstrapFileName;
  path: string;
  content?: string;
  missing: boolean;      // 文件是否不存在
};

// 加载引导文件
loadWorkspaceBootstrapFiles(dir)     // 加载工作目录引导文件
filterBootstrapFilesForSession(files, sessionKey) // 按session过滤
loadExtraBootstrapFiles(dir, patterns) // 加载额外文件
```

### 4.3 Bootstrap上下文构建

```typescript
// 构建Bootstrap上下文
buildBootstrapContextFiles(files, {
  warn?: (message: string) => void,
  maxChars?: number,           // 单文件最大字符数
  totalMaxChars?: number        // 总最大字符数
}): EmbeddedContextFile[]

// 关键常量
DEFAULT_BOOTSTRAP_MAX_CHARS = 20000
DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS = 150000
```

---

## 五、Runtime环境抽象

### 5.1 RuntimeEnv定义

```typescript
type RuntimeEnv = {
  log: (...args: unknown[]) => void;    // 日志输出
  error: (...args: unknown[]) => void;  // 错误输出
  exit: (code: number) => void;         // 退出进程
};

type OutputRuntimeEnv = RuntimeEnv & {
  writeStdout: (value: string) => void;
  writeJson: (value: unknown, space?: number) => void;
};
```

### 5.2 默认Runtime

```typescript
const defaultRuntime: OutputRuntimeEnv;
// 创建不自动退出的Runtime
createNonExitingRuntime(): OutputRuntimeEnv;
```

---

## 六、Agent路由绑定（AgentBinding）

### 6.1 路由类型

```typescript
// 普通路由
type AgentRouteBinding = {
  type?: "route";  // 默认类型
  agentId: string;
  match: AgentBindingMatch;
};

// ACP路由
type AgentAcpBinding = {
  type: "acp";
  agentId: string;
  match: AgentBindingMatch;
  acp?: {
    mode?: "persistent" | "oneshot";
    label?: string;
    cwd?: string;
    backend?: string;
  };
};

// 匹配条件
type AgentBindingMatch = {
  channel: string;           // 频道
  accountId?: string;        // 账号
  peer?: { kind: ChatType; id: string; };
  guildId?: string;          // 服务器ID
  teamId?: string;           // 团队ID
  roles?: string[];          // Discord角色
};
```

---

## 七、核心流程图

```
用户消息
    │
    ▼
Channel接收 ─────────────────────────────────────┐
    │                                             │
    ▼                                             │
解析SessionKey ──► resolveSessionAgentId()       │
    │                                             │
    ▼                                             │
查找Agent配置 ──► resolveAgentConfig()            │
    │                                             │
    ▼                                             │
加载引导文件 ──► loadWorkspaceBootstrapFiles()    │
    │                                             │
    ▼                                             │
构建上下文 ────► buildBootstrapContextFiles()      │
    │                                             │
    ▼                                             │
执行Agent ────► Pi Agent Core / ACP Runtime       │
    │                                             │
    ▼                                             │
返回结果 ◄────────────────────────────────────────┘
```

---

## 八、关键设计思想

### 8.1 配置驱动
- 所有Agent行为通过配置对象（OpenClawConfig）驱动
- 支持多Agent并行，每Agent独立配置

### 8.2 Session隔离
- 每个会话有唯一SessionKey
- 支持Session级别Override（model、thinking level等）

### 8.3 引导文件分层
- 系统级引导：AGENTS.md、SOUL.md等
- 用户级引导：USER.md、MEMORY.md
- 支持Extra Bootstrap模式加载额外文件

### 8.4 灵活的Runtime后端
- embedded：内置Pi Agent
- acp：外部ACP harness（如Codex、Claude）

---

## 九、学习检验

### ✅ 能否正确解释以下概念？

1. **AgentConfig vs AgentRuntimeConfig**
   - AgentConfig：Agent的行为配置（模型、技能、工具等）
   - AgentRuntimeConfig：Agent的执行后端（embedded或acp）

2. **SessionKey的解析流程**
   - parseAgentSessionKey() 解析agentId和rest
   - resolveSessionAgentId() 绑定到具体Agent

3. **Bootstrap文件的加载顺序**
   - 工作目录 → 过滤session无关文件 → 构建上下文

---

## 十、下一步预告

- 模块3：Multi-Agent路由
  - 路由匹配算法
  - 角色-based路由
  - 动态Agent选择

---

## 📁 产出文件

- 笔记：`/workspace/pipixia/notes/模块2-Agent-Runtime.md`
- 代码：`/workspace/pipixia/code/模块2-Agent-Runtime/`

🦐 **皮皮虾 - 追求深度，拒绝浅薄**
