# 模块3 - 续：Hook Runtime与ACP/Subagent通信机制

> 皮皮虾学习笔记
> 学习时间：2026-04-13
> 目标：掌握OpenClaw的Hook运行时系统和ACP/Subagent通信机制
> 累计产出：177笔记+214代码+2插件

---

## 🎯 核心概念

### 什么是Hook Runtime？

Hook Runtime是OpenClaw的**事件驱动扩展机制**——允许在特定系统事件发生时插入自定义逻辑。不同于Tool的"按需调用"，Hook是**事件触发型**的被动拦截。

```
消息流入 → Hook拦截点 → [preprocessing/received/transcribed] → Agent处理 → Hook拦截点 → [sent] → 消息流出
```

### 什么是ACP？

ACP（Agent Communication Protocol）是OpenClaw的**进程间通信协议**——用于Gateway与子Agent进程之间的通信。核心用`child_process.spawn`创建独立OpenClaw进程，通过NDJSON over stdio通信。

---

## 🪝 Hook Runtime核心架构

### 2.1 内部Hook系统（Internal Hooks）

**核心文件：** `internal-hooks-CVdBfFMw.js`

```typescript
// 全局单例 - 存储所有hook处理器
const handlers = resolveGlobalSingleton(
  Symbol.for("openclaw.internalHookHandlers"),
  () => new Map()
);

// 注册hook处理器（支持通配符和精确匹配）
registerInternalHook('command', async (event) => {
  console.log('Command:', event.action);
});

// 精确匹配特定action
registerInternalHook('command:new', async (event) => {
  await saveSessionToMemory(event);
});

// 触发hook（同时调用type和type:action的处理器）
async function triggerInternalHook(event) {
  const typeHandlers = handlers.get(event.type) ?? [];
  const specificHandlers = handlers.get(`${event.type}:${event.action}`) ?? [];
  const allHandlers = [...typeHandlers, ...specificHandlers];
  for (const handler of allHandlers) {
    try {
      await handler(event);
    } catch (err) {
      log.error(`Hook error [${event.type}:${event.action}]: ${err.message}`);
    }
  }
}
```

**关键设计：** 
- 错误隔离 - 单个handler失败不影响其他handler
- 双重注册 - 可监听所有`command`事件或特定`command:new` action
- 事件对象结构：`{ type, action, sessionKey, context, timestamp, messages }`

### 2.2 消息Hook映射器（Message Hook Mappers）

**核心文件：** `hook-runtime-C0FQ8mwc.js`

将不同渠道的消息格式标准化为canonical hook context：

```typescript
// 从多种可能的body字段中提取content
const content = overrides?.content ?? (
  ctx.BodyForCommands ??
  ctx.RawBody ??
  ctx.Body ??
  ""
);

// 渠道特定的conversationId推导（Telegram线程、Discord频道等）
function deriveConversationId(canonical) {
  if (canonical.channelId === "discord") {
    // Discord需要特殊处理
    if (!canonical.isGroup && senderUserId) 
      return `user:${senderUserId}`;
  }
  if (canonical.channelId === "telegram" && baseConversationId) {
    const threadId = String(canonical.threadId).trim();
    if (threadId) return `${baseConversationId}:topic:${threadId}`;
  }
  return baseConversationId;
}

// 映射到不同 context 类型
toPluginInboundClaimContext()    // 插件认领
toPluginMessageReceivedEvent()  // 消息接收
toPluginMessageSentEvent()      // 消息发送
toInternalMessageReceivedContext()    // 内部-接收
toInternalMessageTranscribedContext() // 内部-转录
toInternalMessagePreprocessedContext() // 内部-预处理
```

### 2.3 事件类型分类

```typescript
// Agent生命周期
agent:bootstrap  // Agent启动，workspace初始化

// Gateway生命周期  
gateway:startup  // Gateway启动

// 消息生命周期
message:received      // 消息被接收
message:sent          // 消息被发送
message:transcribed   // 语音被转录
message:preprocessed  // 消息被预处理

// Session生命周期
session:patch  // Session被更新
```

### 2.4 Hook策略与配置

**核心文件：** `hooks-policy-CYn5nUtw.js`

```typescript
// 解析允许的Agent ID列表
function resolveAllowedAgentIds(raw) {
  const allowed = new Set();
  let hasWildcard = false;
  for (const entry of raw) {
    if (entry.trim() === "*") {
      hasWildcard = true;
      break;
    }
    allowed.add(normalizeAgentId(entry.trim()));
  }
  if (hasWildcard) return; // wildcard = 允许所有
  return allowed;
}
```

### 2.5 Hook状态报告

**核心文件：** `hooks-status-3Q2Z_AtC.js`

```typescript
// 构建hook状态对象
buildHookStatus(entry, config, eligibility) => {
  name: entry.hook.name,
  hookKey,  // metadata.hookKey ?? hook.name
  enabledByConfig: Boolean,
  requirementsSatisfied: Boolean,
  loadable: enabledByConfig && requirementsSatisfied,
  blockedReason: String,
  requirements: [],  // 环境依赖
  missing: [],      // 缺失的依赖
  install: []        // 安装选项
}
```

---

## 📡 ACP/Subagent通信机制

### 3.1 ACP整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Gateway Process                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │           AcpSessionManager                       │   │
│  │  - runTurn() - 协调turn生命周期                  │   │
│  │  - ensureRuntimeHandle() - 管理运行时句柄         │   │
│  │  - reconcileSessionIdentifiers() - 身份协调       │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                  NDJSON over stdio                      │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │        Subagent Process (OpenClaw)              │   │
│  │  - AgentSideConnection                          │   │
│  │  - runTurn() - 执行AI推理                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 ACP Client创建（Subagent进程spawn）

**核心文件：** `acp-cli-Cul9X6v-.js`

```typescript
// 使用Node.js child_process创建独立OpenClaw进程
const { spawn } = require('node:child_process');

async function createAcpClient(opts = {}) {
  const spawnEnv = resolveAcpClientSpawnEnv(process.env, { stripKeys });
  const spawnInvocation = resolveAcpClientSpawnInvocation({
    serverCommand,
    serverArgs: effectiveArgs
  });

  // spawn独立进程
  const agent = spawn(
    spawnInvocation.command,
    spawnInvocation.args,
    {
      stdio: ["pipe", "pipe", "inherit"],  // stdin/stdout为pipe，stderr继承
      cwd,
      env: spawnEnv,
      shell: spawnInvocation.shell,
      windowsHide: spawnInvocation.windowsHide
    }
  );

  // 建立NDJSON流通信
  const client = new ClientSideConnection(
    () => ({ /* callbacks */ }),
    ndJsonStream(Writable.toWeb(agent.stdin), Readable.toWeb(agent.stdout))
  );

  await client.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true }
  });

  // 创建新session
  const sessionId = (await client.newSession({ cwd, mcpServers: [] })).sessionId;

  return { client, agent, sessionId };
}
```

**关键设计：**
- 进程隔离 - 每个subagent是独立进程，有独立内存空间
- NDJSON协议 - 每行一个JSON对象，适合流式处理
- Capability协商 - 客户端声明支持的能力（fs/terminal等）

### 3.3 ACP Session管理

**核心文件：** `manager-BFi-xqLj.js`

```typescript
class AcpSessionManager {
  // 执行一个turn
  async runTurn(input) {
    const sessionKey = canonicalizeAcpSessionKey({ cfg, sessionKey: input.sessionKey });

    await this.withSessionActor(sessionKey, async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        // 1. 确保有可用的runtime handle
        const ensured = await this.ensureRuntimeHandle({ cfg, sessionKey, meta: resolvedMeta });
        
        // 2. 应用runtime控制（权限、timeout等）
        await this.applyRuntimeControls({ sessionKey, runtime, handle, meta });

        // 3. 启动turn循环
        const turnPromise = (async () => {
          for await (const event of runtime.runTurn({
            handle, text: input.text, attachments: input.attachments,
            mode: input.mode, requestId: input.requestId, signal: combinedSignal
          })) {
            if (event.type === "error") streamError = ...
            else if (event.type === "text_delta" || event.type === "tool_call") 
              sawTurnOutput = true;
            if (input.onEvent) await input.onEvent(event);
          }
        })();

        // 4. 超时控制
        await this.awaitTurnWithTimeout({ sessionKey, turnPromise, timeoutMs, ... });
      }
    });
  }

  // 身份协调 - 定期同步session identity
  async reconcileRuntimeSessionIdentifiers(params) {
    const runtimeStatus = await params.runtime.getStatus({ handle: params.handle });
    const nextIdentity = mergeSessionIdentity({
      current: currentIdentity,
      incoming: createIdentityFromStatus({ status: runtimeStatus })
    });
    // 更新handle和meta
  }
}
```

### 3.4 ACP Dispatch协调器

**核心文件：** `dispatch-acp.runtime-BgoLNt3T.js`

```typescript
// 创建reply投影器（处理流式输出的各种边界情况）
function createAcpReplyProjector(params) {
  // 处理流式输出的各种边界情况
  const liveIdleFlushMs = Math.max(streaming.coalescing.idleMs, ACP_LIVE_IDLE_FLUSH_FLOOR_MS);
  // ...
}

// 创建delivery协调器（管理最终输出路由）
function createAcpDispatchDeliveryCoordinator(params) {
  // 处理TTS、block回复、最终回复的递送
}

// 尝试分发ACP回复
async function tryDispatchAcpReply(params) {
  const acpManager = getAcpSessionManager();
  const acpResolution = acpManager.resolveSession({ sessionKey, ... });
  
  if (acpResolution.kind === "none") return null;

  await acpManager.runTurn({
    sessionKey,
    text: resolveAcpPromptText(params.ctx),
    attachments: await resolveAcpAttachments(params.ctx),
    mode: acpResolution.meta.mode,
    onEvent: async (event) => {
      // 处理text_delta、tool_call等事件
      if (event.type === "text_delta") {
        params.delivery.appendText(event.delta);
      }
    }
  });
}
```

### 3.5 ACP错误处理

```typescript
const ACP_ERROR_CODES = [
  "ACP_BACKEND_MISSING",
  "ACP_BACKEND_UNAVAILABLE", 
  "ACP_BACKEND_UNSUPPORTED_CONTROL",
  "ACP_DISPATCH_DISABLED",
  "ACP_INVALID_RUNTIME_OPTION",
  "ACP_SESSION_INIT_FAILED",
  "ACP_TURN_FAILED"
];

// 错误边界包装
async function withAcpRuntimeErrorBoundary(params) {
  try {
    return await params.run();
  } catch (error) {
    throw toAcpRuntimeError({
      error,
      fallbackCode: params.fallbackCode,
      fallbackMessage: params.fallbackMessage
    });
  }
}
```

### 3.6 ACP Session状态机

```
none → stale → ready → running → idle → (close)
                          ↓
                        error → (retry)
```

---

## 🔑 核心收获

1. **Hook是事件驱动，Tool是按需调用** - Hook在消息生命周期关键点被动触发，Tool由Agent主动选择

2. **Internal Hooks使用全局单例Map** - `registerInternalHook(eventKey, handler)`支持`type`和`type:action`双重注册模式

3. **消息Hook Mappers统一多渠道格式** - Telegram线程、Discord频道等不同渠道有不同ID格式，hook-runtime统一映射为canonical context

4. **ACP是进程间NDJSON通信协议** - 使用`child_process.spawn`创建独立OpenClaw进程，通过stdio NDJSON流交换命令和响应

5. **AcpSessionManager管理Session生命周期** - runTurn处理turn循环、身份协调、超时控制、错误重试

6. **ACP支持幂等重试** - `shouldRetryTurnWithFreshHandle()`在特定错误条件下自动重试，最多2次

7. **Hook Policy控制Agent访问权限** - `resolveAllowedAgentIds()`解析白名单/黑名单，支持通配符`*`

---

## 📚 参考文件

- `internal-hooks-CVdBfFMw.js` - 内部hook系统核心
- `hook-runtime-C0FQ8mwc.js` - 消息hook映射器
- `hooks-policy-CYn5nUtw.js` - hook策略
- `hooks-status-3Q2Z_AtC.js` - hook状态报告
- `acp-cli-Cul9X6v-.js` - ACP客户端/spawn逻辑
- `manager-BFi-xqLj.js` - AcpSessionManager核心
- `dispatch-acp.runtime-BgoLNt3T.js` - ACP回复分发
