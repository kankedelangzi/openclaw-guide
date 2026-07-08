/**
 * 模块2：Agent Runtime - 代码示例
 * 
 * 演示OpenClaw中Agent配置和Session管理的核心用法
 * 
 * @author 皮皮虾
 * @date 2026-04-01
 */

// ============================================
// 示例1：Agent配置结构
// ============================================

/**
 * 模拟AgentConfig的完整结构
 * 实际类型定义在 openclaw/dist/plugin-sdk/src/config/types.agents.d.ts
 */
interface AgentModelConfig {
  primary?: string;
  fallbacks?: string[];
}

interface AgentConfig {
  id: string;
  default?: boolean;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: AgentModelConfig;
  thinkingDefault?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
  reasoningDefault?: "on" | "off" | "stream";
  fastModeDefault?: boolean;
  skills?: string[];
  tools?: string[];
  runtime?: { type: "embedded" } | { type: "acp"; acp?: { agent?: string; mode?: "persistent" | "oneshot" } };
}

// 示例：配置一个名为"皮皮虾"的Agent
const pipixiaAgent: AgentConfig = {
  id: "pipixia",
  default: false,
  name: "皮皮虾",
  workspace: "/workspace/pipixia",
  agentDir: "/workspace/pipixia/.openclaw",
  model: {
    primary: "minimax/MiniMax-M2",
    fallbacks: ["anthropic/claude-3-5-sonnet"]
  },
  thinkingDefault: "medium",
  reasoningDefault: "stream",
  skills: ["github", "summarize", "weather"],
  runtime: { type: "embedded" }
};

// ============================================
// 示例2：SessionKey解析
// ============================================

/**
 * 解析Agent-scoped SessionKey
 * 实际实现在 openclaw/dist/plugin-sdk/src/sessions/session-key-utils.d.ts
 */
interface ParsedAgentSessionKey {
  agentId: string;
  rest: string;
}

function parseAgentSessionKey(sessionKey: string): ParsedAgentSessionKey | null {
  if (!sessionKey) return null;
  
  // SessionKey格式: agent:{agentId}:{rest}
  // 示例: "agent:main:channel:direct:user123"
  const parts = sessionKey.split(':');
  if (parts.length < 2 || parts[0] !== 'agent') return null;
  
  return {
    agentId: parts[1],
    rest: parts.slice(2).join(':')
  };
}

// 测试解析
const parsed = parseAgentSessionKey("agent:pipixia:channel:direct:user456");
console.log('Parsed SessionKey:', parsed);
// 输出: { agentId: "pipixia", rest: "channel:direct:user456" }

// ============================================
// 示例3：Session类型判断
// ============================================

function isCronSessionKey(sessionKey: string | undefined | null): boolean {
  return sessionKey?.includes('cron:') ?? false;
}

function isSubagentSessionKey(sessionKey: string | undefined | null): boolean {
  return sessionKey?.includes('subagent:') ?? false;
}

function getSubagentDepth(sessionKey: string | undefined | null): number {
  if (!sessionKey) return 0;
  const match = sessionKey.match(/subagent:(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// 测试
console.log('isCronSessionKey:', isCronSessionKey("agent:main:cron:123"));
console.log('isSubagentSessionKey:', isSubagentSessionKey("agent:main:subagent:1:456"));
console.log('getSubagentDepth:', getSubagentDepth("agent:main:subagent:3:789"));
// 输出: true, true, 3

// ============================================
// 示例4：Bootstrap文件加载模拟
// ============================================

interface WorkspaceBootstrapFile {
  name: string;
  path: string;
  content?: string;
  missing: boolean;
}

// 默认引导文件名
const DEFAULT_BOOTSTRAP_FILES = [
  'AGENTS.md',
  'SOUL.md', 
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
  'memory.md'
] as const;

function loadWorkspaceBootstrapFiles(dir: string): WorkspaceBootstrapFile[] {
  // 模拟：实际会读取文件系统
  return DEFAULT_BOOTSTRAP_FILES.map(name => ({
    name,
    path: `${dir}/${name}`,
    content: undefined,  // 实际会读取文件内容
    missing: true       // 模拟文件不存在
  }));
}

function filterBootstrapFilesForSession(
  files: WorkspaceBootstrapFile[], 
  sessionKey?: string
): WorkspaceBootstrapFile[] {
  // 按session过滤 - 这里简化处理
  // 实际会根据sessionKey中的channel、peer等信息过滤
  return files.filter(f => !f.missing);
}

// 测试
const files = loadWorkspaceBootstrapFiles('/workspace/pipixia');
const loaded = filterBootstrapFilesForSession(files);
console.log('Loaded files:', loaded.length);

// ============================================
// 示例5：Agent配置解析
// ============================================

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: AgentModelConfig;
      thinkingDefault?: string;
    };
    list?: AgentConfig[];
  };
}

function resolveAgentConfig(config: OpenClawConfig, agentId: string): AgentConfig | undefined {
  return config.agents?.list?.find(agent => agent.id === agentId);
}

function resolveDefaultAgentId(config: OpenClawConfig): string {
  const defaultAgent = config.agents?.list?.find(agent => agent.default);
  return defaultAgent?.id ?? 'main';
}

function resolveAgentWorkspaceDir(config: OpenClawConfig, agentId: string): string {
  const agent = resolveAgentConfig(config, agentId);
  return agent?.workspace ?? `/root/.openclaw/workspace`;
}

// 完整配置示例
const openClawConfig: OpenClawConfig = {
  agents: {
    defaults: {
      model: { primary: 'minimax/MiniMax-M2' },
      thinkingDefault: 'medium'
    },
    list: [
      {
        id: 'main',
        default: true,
        workspace: '/root/.openclaw/workspace'
      },
      pipixiaAgent,
      {
        id: 'sub-agent',
        name: '子龙虾',
        workspace: '/workspace/learning',
        runtime: { type: 'acp', acp: { agent: 'codex', mode: 'persistent' } }
      }
    ]
  }
};

// 测试解析
console.log('Default Agent:', resolveDefaultAgentId(openClawConfig));
console.log('皮皮虾配置:', resolveAgentConfig(openClawConfig, 'pipixia'));
console.log('皮皮虾工作目录:', resolveAgentWorkspaceDir(openClawConfig, 'pipixia'));

// ============================================
// 示例6：Runtime环境抽象
// ============================================

type RuntimeEnv = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
};

type OutputRuntimeEnv = RuntimeEnv & {
  writeStdout: (value: string) => void;
  writeJson: (value: unknown, space?: number) => void;
};

const defaultRuntime: OutputRuntimeEnv = {
  log: (...args) => console.log('[LOG]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  exit: (code) => {
    console.log(`[EXIT] Process exiting with code ${code}`);
    process.exit(code);
  },
  writeStdout: (value) => process.stdout.write(value),
  writeJson: (value, space) => console.log(JSON.stringify(value, null, space))
};

// 使用示例
defaultRuntime.log('Agent started');
defaultRuntime.writeJson({ status: 'ok', agentId: 'pipixia' });

// ============================================
// 示例7：Agent绑定匹配
// ============================================

type ChatType = "direct" | "group" | "channel" | "unknown";

interface AgentBindingMatch {
  channel: string;
  accountId?: string;
  peer?: { kind: ChatType; id: string };
  guildId?: string;
  teamId?: string;
  roles?: string[];
}

interface AgentRouteBinding {
  type?: "route";
  agentId: string;
  match: AgentBindingMatch;
}

function matchAgentBinding(
  binding: AgentRouteBinding,
  channel: string,
  accountId?: string,
  peer?: { kind: ChatType; id: string }
): boolean {
  if (binding.match.channel !== channel) return false;
  if (binding.match.accountId && binding.match.accountId !== accountId) return false;
  if (binding.match.peer && binding.match.peer.kind !== peer?.kind) return false;
  return true;
}

// 测试
const binding: AgentRouteBinding = {
  type: 'route',
  agentId: 'pipixia',
  match: {
    channel: 'telegram',
    accountId: '12345'
  }
};

console.log('Match result:', matchAgentBinding(binding, 'telegram', '12345'));
// 输出: true

// ============================================
// 导出所有示例
// ============================================

export {
  // 类型
  AgentConfig,
  AgentModelConfig,
  ParsedAgentSessionKey,
  WorkspaceBootstrapFile,
  OpenClawConfig,
  RuntimeEnv,
  OutputRuntimeEnv,
  AgentBindingMatch,
  AgentRouteBinding,
  ChatType,
  // 函数
  parseAgentSessionKey,
  isCronSessionKey,
  isSubagentSessionKey,
  getSubagentDepth,
  loadWorkspaceBootstrapFiles,
  filterBootstrapFilesForSession,
  resolveAgentConfig,
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
  matchAgentBinding
};
