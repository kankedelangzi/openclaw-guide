/**
 * 模块2代码示例：Agent Runtime核心概念演示
 * 
 * 本文件展示Agent Runtime的核心概念和类型结构
 * 基于OpenClaw源码分析
 */

// ============================================================
// 1. Session Key解析
// ============================================================

// Session Key格式: "agent:{agentId}:channel:{channelType}:{target}"
type ParsedAgentSessionKey = {
  agentId: string;    // "main", "pipixia", "subagent-xxx"
  rest: string;       // 剩余部分用于路由
};

// 解析Session Key的工具函数
function parseAgentSessionKey(sessionKey: string): ParsedAgentSessionKey {
  const parts = sessionKey.split(':');
  if (parts[0] !== 'agent') {
    throw new Error('Invalid session key format');
  }
  return {
    agentId: parts[1],
    rest: parts.slice(2).join(':')
  };
}

// 示例
const sessionKey1 = "agent:main:channel:direct:user123";
const parsed1 = parseAgentSessionKey(sessionKey1);
console.log(parsed1);
// { agentId: "main", rest: "channel:direct:user123" }

const sessionKey2 = "agent:subagent-abc:channel:telegram:group:456";
const parsed2 = parseAgentSessionKey(sessionKey2);
console.log(parsed2);
// { agentId: "subagent-abc", rest: "channel:telegram:group:456" }


// ============================================================
// 2. Session类型判断
// ============================================================

function isSubagentSessionKey(key: string): boolean {
  return key.includes('subagent') || key.split(':')[1]?.startsWith('subagent');
}

function getSubagentDepth(key: string): number {
  if (!isSubagentSessionKey(key)) return 0;
  const match = key.match(/subagent-(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function isCronRunSessionKey(key: string): boolean {
  return key.includes('cron-run') || key.includes('cron_session');
}


// ============================================================
// 3. 触发源类型
// ============================================================

type EmbeddedRunTrigger = 
  | "cron"       // 定时任务触发
  | "heartbeat"  // 心跳任务触发
  | "manual"     // 手动触发
  | "memory"     // 记忆触发
  | "overflow"   // 上下文溢出触发
  | "user";      // 用户消息触发

// 根据触发源决定行为
function handleTrigger(trigger: EmbeddedRunTrigger): string {
  switch (trigger) {
    case "cron":
      return "执行定时检查任务";
    case "heartbeat":
      return "执行周期性心跳任务";
    case "user":
      return "处理用户对话";
    case "memory":
      return "执行记忆相关任务";
    case "overflow":
      return "执行上下文压缩任务";
    default:
      return "未知触发源";
  }
}


// ============================================================
// 4. RunEmbeddedPiAgentParams 核心参数
// ============================================================

interface ImageContent {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type: string;
    data?: string;
    url?: string;
  };
}

type ThinkLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
type ReasoningLevel = "on" | "off" | "stream";
type ToolResultFormat = "text" | "image" | "tool_use";

interface RunEmbeddedPiAgentParams {
  // Session标识
  sessionId: string;
  sessionKey?: string;
  agentId?: string;
  
  // 触发源
  trigger?: EmbeddedRunTrigger;
  
  // 消息上下文
  messageChannel?: string;
  messageProvider?: string;
  messageTo?: string;
  messageThreadId?: string | number;
  
  // 发送者信息
  senderId?: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderIsOwner?: boolean;
  
  // 消息内容
  prompt: string;
  images?: ImageContent[];
  
  // 模型配置
  provider?: string;
  model?: string;
  thinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  
  // 执行控制
  timeoutMs: number;
  abortSignal?: AbortSignal;
  disableTools?: boolean;
  
  // 回调函数
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void;
  onToolResult?: (payload: unknown) => void;
  onReasoningStream?: (payload: { text?: string }) => void;
}


// ============================================================
// 5. EmbeddedPiRunResult 执行结果
// ============================================================

interface EmbeddedPiAgentMeta {
  sessionId: string;
  provider: string;
  model: string;
  compactionCount?: number;
  promptTokens?: number;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

interface EmbeddedPiRunMeta {
  durationMs: number;
  agentMeta?: EmbeddedPiAgentMeta;
  aborted?: boolean;
  error?: {
    kind: "context_overflow" | "compaction_failure" | "role_ordering" | "image_size" | "retry_limit";
    message: string;
  };
  stopReason?: string;
  pendingToolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

interface EmbeddedPiRunResult {
  payloads?: Array<{
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    replyToId?: string;
    isError?: boolean;
  }>;
  meta: EmbeddedPiRunMeta;
  didSendViaMessagingTool?: boolean;
  messagingToolSentTexts?: string[];
  successfulCronAdds?: number;
}


// ============================================================
// 6. Subagent Spawn机制
// ============================================================

type SpawnSubagentMode = "run" | "session";
type SpawnSubagentSandboxMode = "inherit" | "require";

interface SpawnSubagentParams {
  task: string;
  label?: string;
  agentId?: string;
  model?: string;
  thinking?: string;
  runTimeoutSeconds?: number;
  thread?: boolean;
  mode?: SpawnSubagentMode;
  cleanup?: "delete" | "keep";
  sandbox?: SpawnSubagentSandboxMode;
  expectsCompletionMessage?: boolean;
  attachments?: Array<{
    name: string;
    content: string;
    encoding?: "utf8" | "base64";
    mimeType?: string;
  }>;
}

interface SpawnSubagentResult {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;
  runId?: string;
  mode?: SpawnSubagentMode;
  note?: string;
  modelApplied?: boolean;
  error?: string;
}

// 模拟spawnSubagentDirect函数
async function spawnSubagentDirect(
  params: SpawnSubagentParams,
  ctx: { agentSessionKey?: string; agentChannel?: string; }
): Promise<SpawnSubagentResult> {
  // 实际实现会调用sessions_spawn
  console.log('Spawning subagent:', params.task);
  console.log('Mode:', params.mode);
  console.log('Cleanup:', params.cleanup);
  
  return {
    status: 'accepted',
    childSessionKey: `agent:subagent-${Date.now()}:channel:direct:task`,
    runId: `run-${Date.now()}`,
    mode: params.mode || 'run',
    note: params.mode === 'session' 
      ? 'thread-bound session stays active after this task'
      : 'Auto-announce is push-based'
  };
}


// ============================================================
// 7. EmbeddedSandboxInfo 沙箱配置
// ============================================================

interface EmbeddedSandboxInfo {
  enabled: boolean;
  workspaceDir?: string;
  containerWorkspaceDir?: string;
  workspaceAccess?: "none" | "ro" | "rw";
  agentWorkspaceMount?: string;
  browserBridgeUrl?: string;
  browserNoVncUrl?: string;
  hostBrowserAllowed?: boolean;
  elevated?: {
    allowed: boolean;
    defaultLevel: "on" | "off" | "ask" | "full";
  };
}

// 创建沙箱配置
function createSandboxConfig(workspaceDir: string): EmbeddedSandboxInfo {
  return {
    enabled: true,
    workspaceDir,
    containerWorkspaceDir: `/container/workspace/${workspaceDir}`,
    workspaceAccess: "rw",
    elevated: {
      allowed: false,
      defaultLevel: "off"
    }
  };
}


// ============================================================
// 8. 工具调用循环演示
// ============================================================

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ToolResult {
  tool_call_id: string;
  output: string;
}

// 模拟工具调用循环
async function executeToolCallLoop(
  initialPrompt: string,
  tools: Array<{ name: string; description: string }>,
  maxIterations: number = 10
): Promise<{ result: string; iterations: number }> {
  let context = initialPrompt;
  let iterations = 0;
  
  while (iterations < maxIterations) {
    // 模拟AI决定是否调用工具
    const shouldCallTool = iterations < 2; // 简化模拟
    
    if (!shouldCallTool) {
      return { result: context, iterations };
    }
    
    // 模拟工具调用
    const toolCall: ToolCall = {
      id: `call_${iterations}`,
      name: tools[iterations % tools.length].name,
      arguments: JSON.stringify({ input: context })
    };
    
    // 模拟工具执行
    const toolResult: ToolResult = {
      tool_call_id: toolCall.id,
      output: `[Result from ${toolCall.name}]`
    };
    
    // 将工具结果加入上下文
    context += `\n\n[Tool: ${toolCall.name}]\n${toolResult.output}`;
    iterations++;
  }
  
  return { result: context, iterations };
}


// ============================================================
// 9. 使用示例
// ============================================================

async function main() {
  // 1. Session Key解析
  console.log('=== Session Key解析 ===');
  const parsed = parseAgentSessionKey("agent:main:channel:telegram:group:123");
  console.log('Parsed:', parsed);
  
  // 2. 触发源处理
  console.log('\n=== 触发源处理 ===');
  console.log('Cron:', handleTrigger('cron'));
  console.log('User:', handleTrigger('user'));
  
  // 3. Subagent Spawn
  console.log('\n=== Subagent Spawn ===');
  const spawnResult = await spawnSubagentDirect(
    {
      task: "分析这个代码库的结构",
      mode: "run",
      cleanup: "delete",
      agentId: "pipixia"
    },
    { agentSessionKey: "agent:main:channel:direct:user" }
  );
  console.log('Spawn result:', spawnResult);
  
  // 4. 工具调用循环
  console.log('\n=== 工具调用循环 ===');
  const tools = [
    { name: "read_file", description: "读取文件内容" },
    { name: "exec", description: "执行命令" }
  ];
  const loopResult = await executeToolCallLoop("请分析当前目录结构", tools);
  console.log('Final iterations:', loopResult.iterations);
  
  // 5. 沙箱配置
  console.log('\n=== 沙箱配置 ===');
  const sandbox = createSandboxConfig("/workspace/project");
  console.log('Sandbox config:', sandbox);
}

main().catch(console.error);
