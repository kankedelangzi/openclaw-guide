/**
 * ACP/Subagent通信示例 - 展示如何spawn独立Agent进程
 * 对应：acp-cli-Cul9X6v-.js 中的spawn逻辑
 */

const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

/**
 * 模拟ACP客户端创建
 * 实际OpenClaw使用 AgentSideConnection + NDJSON over stdio
 */
class AcpClientSimulator {
  constructor(sessionId, agentProcess) {
    this.sessionId = sessionId;
    this.agent = agentProcess;
  }

  /**
   * 发送命令到agent进程
   */
  sendCommand(command) {
    const jsonLine = JSON.stringify(command) + '\n';
    this.agent.stdin.write(jsonLine);
  }

  /**
   * 接收agent响应
   */
  async *receiveResponses() {
    for await (const line of this.agent.stdout) {
      yield JSON.parse(line);
    }
  }
}

/**
 * 模拟创建ACP客户端（spawn独立OpenClaw进程）
 */
async function createAcpClient(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const sessionId = randomUUID();

  // 模拟spawn逻辑
  const serverCommand = 'openclaw';
  const serverArgs = [
    'agent',           // 以agent模式运行
    '--session', sessionId,
    '--protocol', 'acp'
  ];

  console.log(`[ACP] Spawning: ${serverCommand} ${serverArgs.join(' ')}`);
  console.log(`[ACP] CWD: ${cwd}`);

  // 实际使用child_process.spawn:
  // const agent = spawn(serverCommand, serverArgs, {
  //   stdio: ['pipe', 'pipe', 'inherit'],
  //   cwd,
  //   env: spawnEnv,
  //   shell: false,
  //   windowsHide: true
  // });

  // 模拟返回
  return {
    sessionId,
    agent: { pid: Math.floor(Math.random() * 10000) }, // 模拟进程
    cwd
  };
}

/**
 * 模拟ACP Session管理器
 */
class AcpSessionManager {
  constructor() {
    this.sessions = new Map();
    this.runtimes = new Map();
  }

  /**
   * 创建新session
   */
  createSession(sessionKey, meta) {
    if (this.sessions.has(sessionKey)) {
      console.log(`[ACP Manager] Session exists: ${sessionKey}`);
      return this.sessions.get(sessionKey);
    }

    console.log(`[ACP Manager] Creating session: ${sessionKey}`);
    const session = {
      sessionKey,
      state: 'idle',
      meta,
      handle: { backendSessionId: randomUUID() },
      lastActivityAt: Date.now()
    };

    this.sessions.set(sessionKey, session);
    return session;
  }

  /**
   * 执行一个turn
   */
  async runTurn(sessionKey, input) {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`ACP_SESSION_INIT_FAILED: Session not found: ${sessionKey}`);
    }

    console.log(`[ACP Manager] Running turn for: ${sessionKey}`);
    console.log(`[ACP Manager] Input text length: ${input.text?.length || 0}`);

    session.state = 'running';
    session.lastActivityAt = Date.now();

    // 模拟turn执行
    const result = {
      events: [
        { type: 'text_delta', delta: 'Hello from subagent!' },
        { type: 'tool_call', tool: 'read', input: { path: '/test' } },
        { type: 'turn_complete' }
      ]
    };

    session.state = 'idle';
    return result;
  }

  /**
   * 关闭session
   */
  async closeSession(sessionKey) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      console.log(`[ACP Manager] Closing session: ${sessionKey}`);
      session.state = 'closed';
      this.sessions.delete(sessionKey);
    }
  }
}

/**
 * ACP错误类型
 */
const ACP_ERROR_CODES = [
  'ACP_BACKEND_MISSING',
  'ACP_BACKEND_UNAVAILABLE',
  'ACP_BACKEND_UNSUPPORTED_CONTROL',
  'ACP_DISPATCH_DISABLED',
  'ACP_INVALID_RUNTIME_OPTION',
  'ACP_SESSION_INIT_FAILED',
  'ACP_TURN_FAILED'
];

class AcpRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AcpRuntimeError';
    this.code = code;
  }
}

// 示例运行
async function demo() {
  console.log('=== ACP/Subagent 通信演示 ===\n');

  // 1. 创建客户端
  const client = await createAcpClient({ cwd: '/root/.openclaw/workspace' });
  console.log(`Created client with session: ${client.sessionId}\n`);

  // 2. 创建session管理器
  const manager = new AcpSessionManager();

  // 3. 创建session
  const sessionKey = `agent:main:${client.sessionId}`;
  manager.createSession(sessionKey, {
    backend: 'openclaw',
    agent: 'main',
    mode: 'session'
  });

  // 4. 运行turn
  try {
    const result = await manager.runTurn(sessionKey, {
      text: 'What is 2+2?'
    });

    console.log('\n[Events]');
    for (const event of result.events) {
      console.log(`  ${event.type}`, event.delta || event.tool || '');
    }
  } catch (err) {
    if (err instanceof AcpRuntimeError) {
      console.error(`[ACP Error] ${err.code}: ${err.message}`);
    } else {
      throw err;
    }
  }

  // 5. 关闭session
  await manager.closeSession(sessionKey);
}

demo().catch(console.error);
