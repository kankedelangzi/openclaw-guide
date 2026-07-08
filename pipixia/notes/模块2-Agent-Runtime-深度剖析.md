# 模块2-续：Agent Runtime 深度剖析 - Pi Embedded Runner + Session管理

> 🦐 皮皮虾OpenClaw源码深读 | 完成时间：2026-04-09
> 目标：成为能够重写OpenClaw的大师

---

## 一、Pi Embedded Runner 核心架构

### 1.1 执行入口：runEmbeddedPiAgent

```typescript
// 核心函数签名
export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams
): Promise<EmbeddedPiRunResult>
```

这是Pi Agent执行的核心入口函数，负责：
1. 接收消息并解析参数
2. 初始化Session上下文
3. 调用AI模型执行推理
4. 处理工具调用循环
5. 返回执行结果

### 1.2 RunEmbeddedPiAgentParams 完整参数解析

```typescript
type RunEmbeddedPiAgentParams = {
  // ========== Session标识 ==========
  sessionId: string;           // Session唯一标识
  sessionKey?: string;         // 完整Session Key
  agentId?: string;           // Agent ID
  
  // ========== 触发源 ==========
  trigger?: EmbeddedRunTrigger;  
  // "user" | "heartbeat" | "cron" | "memory" | "overflow" | "manual"
  
  // ========== 消息上下文 ==========
  messageChannel?: string;    // 消息频道
  messageProvider?: string;    // 消息提供商
  messageTo?: string;          // 投递目标
  messageThreadId?: string | number;  // 线程ID
  
  // ========== 发送者信息 ==========
  senderId?: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderIsOwner?: boolean;    // 是否为Owner
  
  // ========== 消息内容 ==========
  prompt: string;             // 核心Prompt
  images?: ImageContent[];    // 图片内容
  
  // ========== 模型配置 ==========
  provider?: string;          // 模型提供商
  model?: string;             // 模型名称
  thinkLevel?: ThinkLevel;    // 思考级别
  reasoningLevel?: ReasoningLevel;  // 推理级别
  
  // ========== 执行控制 ==========
  timeoutMs: number;          // 超时毫秒
  abortSignal?: AbortSignal;  // 中止信号
  disableTools?: boolean;     // 禁用工具
  
  // ========== 回调函数 ==========
  onPartialReply?: (payload) => void;      // 部分回复
  onBlockReply?: (payload) => void;        // 块回复
  onToolResult?: (payload) => void;        // 工具结果
  onReasoningStream?: (payload) => void;  // 推理流
}
```

---

## 二、EmbeddedPiRunResult 执行结果结构

```typescript
type EmbeddedPiRunResult = {
  // 回复内容
  payloads?: Array<{
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    replyToId?: string;
    isError?: boolean;
  }>;
  
  // 执行元数据
  meta: EmbeddedPiRunMeta;
  
  // 消息工具使用情况
  didSendViaMessagingTool?: boolean;
  messagingToolSentTexts?: string[];
  messagingToolSentMediaUrls?: string[];
  
  // Cron任务添加
  successfulCronAdds?: number;
}

type EmbeddedPiRunMeta = {
  durationMs: number;              // 执行时长
  agentMeta?: EmbeddedPiAgentMeta; // Agent统计
  aborted?: boolean;               // 是否中止
  error?: {                        // 错误信息
    kind: "context_overflow" | "compaction_failure" | 
         "role_ordering" | "image_size" | "retry_limit";
    message: string;
  };
  stopReason?: string;              // 停止原因
  pendingToolCalls?: Array<{        // 待处理工具调用
    id: string;
    name: string;
    arguments: string;
  }>;
}
```

---

## 三、Session管理系统深度剖析

### 3.1 Session Key结构解析

```typescript
// Session Key格式
// "agent:{agentId}:channel:{channelType}:{target}"

// 示例解析
type ParsedAgentSessionKey = {
  agentId: string;    // "main", "pipixia", "subagent-xxx"
  rest: string;        // 剩余部分用于路由
}

// 实际示例
"agent:main:channel:direct:user123"
  → { agentId: "main", rest: "channel:direct:user123" }

"agent:subagent-abc:channel:telegram:group:456"
  → { agentId: "subagent-abc", rest: "channel:telegram:group:456" }
```

### 3.2 Session类型判断

```typescript
// 判断Session类型
isCronRunSessionKey(key)      // Cron任务执行中
isCronSessionKey(key)         // Cron触发
isSubagentSessionKey(key)     // 子Agent
isAcpSessionKey(key)          // ACP外部会话
getSubagentDepth(key)          // 子Agent嵌套深度
```

### 3.3 Subagent注册表管理

```typescript
// 注册子Agent运行
registerSubagentRun({
  runId: string;                    // 唯一运行ID
  childSessionKey: string;           // 子Session Key
  controllerSessionKey?: string;    // 控制者Session
  requesterSessionKey: string;       // 请求者Session
  requesterDisplayKey: string;      // 显示用Key
  task: string;                      // 任务描述
  cleanup: "delete" | "keep";        // 结束后清理策略
  label?: string;                   // 标签
  model?: string;                   // 指定模型
  workspaceDir?: string;            // 工作目录
  runTimeoutSeconds?: number;       // 超时秒数
  spawnMode?: "run" | "session";    // spawn模式
})
```

### 3.4 Session生命周期

```
Session创建
    │
    ▼
┌─────────────┐
│  pending    │ ← 新建，等待开始
└─────────────┘
    │
    ▼
┌─────────────┐
│  running    │ ← 执行中
└─────────────┘
    │
    ├──► 完成 ──► succeeded / failed / aborted
    │
    └──► 超时 ──► timeout
```

---

## 四、子Agent Spawn机制

### 4.1 SpawnSubagentParams

```typescript
type SpawnSubagentParams = {
  task: string;                    // 任务描述（必填）
  label?: string;                  // 可读标签
  agentId?: string;                // 指定Agent
  model?: string;                  // 指定模型
  thinking?: string;               // 思考配置
  
  runTimeoutSeconds?: number;      // 超时时间
  thread?: boolean;                 // 是否绑定线程
  
  // 关键：执行模式
  mode?: "run" | "session";        // run=一次性，session=持久会话
  cleanup?: "delete" | "keep";     // 结束后删除/保留
  
  sandbox?: "inherit" | "require"; // 沙箱模式
  expectsCompletionMessage?: boolean; // 是否期待完成消息
  
  // 附件支持
  attachments?: Array<{
    name: string;
    content: string;
    encoding?: "utf8" | "base64";
    mimeType?: string;
  }>;
}
```

### 4.2 Spawn模式对比

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| `run` | 一次性任务，执行完自动结束 | 快速任务、一次性查询 |
| `session` | 持久会话，可多轮交互 | 复杂任务、需要跟进 |

### 4.3 SpawnSubagentResult

```typescript
type SpawnSubagentResult = {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;   // 子Session Key
  runId?: string;            // 运行ID
  mode?: SpawnSubagentMode;
  note?: string;             // 附加说明
  modelApplied?: boolean;     // 模型是否应用
  error?: string;            // 错误信息
  
  // 附件信息
  attachments?: {
    count: number;
    totalBytes: number;
    files: Array<{
      name: string;
      bytes: number;
      sha256: string;
    }>;
    relDir: string;
  };
}
```

---

## 五、执行流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    runEmbeddedPiAgent                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 参数解析                                                  │
│     └─► RunEmbeddedPiAgentParams                              │
│                                                              │
│  2. Session初始化                                             │
│     └─► 加载引导文件、构建上下文                               │
│                                                              │
│  3. 模型调用                                                  │
│     └─► runEmbeddedPiAgent() ──► AI推理                       │
│                                                              │
│  4. 工具循环                                                  │
│     ┌───────────────────────────────┐                        │
│     │  while (hasToolCalls):        │                        │
│     │    executeTool()              │                        │
│     │    addResultToContext()       │                        │
│     │    continueInference()        │                        │
│     └───────────────────────────────┘                        │
│                                                              │
│  5. 结果处理                                                  │
│     └─► EmbeddedPiRunResult                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、EmbeddedSandboxInfo 沙箱配置

```typescript
type EmbeddedSandboxInfo = {
  enabled: boolean;
  workspaceDir?: string;
  containerWorkspaceDir?: string;
  
  // 工作目录权限
  workspaceAccess?: "none" | "ro" | "rw";  // 无/只读/读写
  
  // Agent专属挂载
  agentWorkspaceMount?: string;
  
  // 浏览器桥接
  browserBridgeUrl?: string;
  browserNoVncUrl?: string;
  hostBrowserAllowed?: boolean;
  
  // 提升权限
  elevated?: {
    allowed: boolean;
    defaultLevel: "on" | "off" | "ask" | "full";
  };
}
```

---

## 七、触发源（Trigger）类型

```typescript
type EmbeddedRunTrigger = 
  | "cron"       // 定时任务触发
  | "heartbeat"  // 心跳任务触发
  | "manual"     // 手动触发
  | "memory"     // 记忆触发
  | "overflow"   // 上下文溢出触发
  | "user";      // 用户消息触发

// 使用场景
switch (trigger) {
  case "cron":
    // 定时任务：执行例行检查
    break;
  case "heartbeat":
    // 心跳：执行周期性任务
    break;
  case "user":
    // 用户消息：正常对话
    break;
  case "memory":
    // 记忆触发：执行记忆相关任务
    break;
}
```

---

## 八、关键设计模式

### 8.1 参数化设计
- 所有执行参数通过`RunEmbeddedPiAgentParams`统一传递
- 可选参数使用`?`标记，支持渐进式配置

### 8.2 回调驱动
- 使用`onPartialReply`、`onBlockReply`等回调处理流式输出
- 支持`onReasoningStream`获取推理过程

### 8.3 AbortSignal中止
- 支持标准`AbortSignal`进行优雅中止
- 用于超时取消、用户取消等场景

### 8.4 元数据驱动
- 所有执行结果包含详细元数据
- 支持错误分类、usage统计、停止原因

---

## 九、核心收获

1. **Pi Embedded Runner是核心执行引擎**
   - `runEmbeddedPiAgent()`是Agent执行的单入口
   - 统一处理Session、模型调用、工具循环

2. **Session管理是隔离性的关键**
   - Session Key格式：`agent:{id}:channel:{type}:{target}`
   - Subagent注册表管理多级Session关系

3. **触发源决定行为模式**
   - `user`：正常对话
   - `cron/heartbeat`：自动任务
   - `memory`：记忆触发

4. **结果结构包含完整执行信息**
   - `payloads`：回复内容
   - `meta`：执行统计
   - `error.kind`：错误分类

5. **工具调用循环是核心机制**
   - Agent可调用工具
   - 结果反馈给模型继续推理
   - 直到完成或超时

---

## 十、下一步预告

- 继续深入Session状态管理
- 研究Compaction（上下文压缩）机制
- 探索Multi-Agent路由的具体实现

---

🦐 **皮皮虾 - 追求深度，拒绝浅薄**