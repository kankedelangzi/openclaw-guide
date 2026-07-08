/**
 * Session管理系统 - 代码示例
 * 
 * 演示OpenClaw中Session的创建、管理和生命周期
 * 
 * @author 皮皮虾
 * @date 2026-04-01
 */

// ============================================
// 1. Session结构定义
// ============================================

/**
 * Session生命周期事件
 * 当Session创建、销毁等事件发生时触发
 */
interface SessionLifecycleEvent {
  sessionKey: string;
  reason: string;
  parentSessionKey?: string;
  label?: string;
  displayName?: string;
}

type SessionLifecycleListener = (event: SessionLifecycleEvent) => void;

/**
 * Session存储接口
 */
interface SessionStore {
  get(sessionKey: string): Promise<Session | undefined>;
  set(sessionKey: string, session: Session): Promise<void>;
  delete(sessionKey: string): Promise<void>;
  list(): Promise<Session[]>;
}

/**
 * Session数据结构
 */
interface Session {
  sessionKey: string;
  sessionId: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  contextFiles: string[];
  metadata?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// ============================================
// 2. Session工厂
// ============================================

function generateSessionId(): string {
  // 简化实现，实际使用UUID或类似方案
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createSessionKey(agentId: string, channel: string, peerId: string): string {
  return `agent:${agentId}:channel:${channel}:${peerId}`;
}

function createSession(params: {
  agentId: string;
  channel: string;
  peerId: string;
  parentSessionKey?: string;
  label?: string;
}): Session {
  const sessionKey = createSessionKey(params.agentId, params.channel, params.peerId);
  const now = Date.now();
  
  return {
    sessionKey,
    sessionId: generateSessionId(),
    agentId: params.agentId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    contextFiles: [],
    metadata: {
      parentSessionKey: params.parentSessionKey,
      label: params.label
    }
  };
}

// 测试Session创建
const mainSession = createSession({
  agentId: 'main',
  channel: 'telegram',
  peerId: 'user123',
  label: '与大鱼的对话'
});

console.log('创建Session:', mainSession);

// ============================================
// 3. Session生命周期管理
// ============================================

class SessionLifecycleManager {
  private listeners: Set<SessionLifecycleListener> = new Set();
  private sessions: Map<string, Session> = new Map();
  
  /**
   * 注册生命周期监听器
   * @returns 取消注册函数
   */
  onLifecycleEvent(listener: SessionLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * 触发生命周期事件
   */
  private emit(event: SessionLifecycleEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Lifecycle listener error:', e);
      }
    }
  }
  
  /**
   * 创建Session
   */
  async createSession(params: {
    agentId: string;
    channel: string;
    peerId: string;
    parentSessionKey?: string;
    label?: string;
  }): Promise<Session> {
    const session = createSession(params);
    this.sessions.set(session.sessionKey, session);
    
    this.emit({
      sessionKey: session.sessionKey,
      reason: 'created',
      parentSessionKey: params.parentSessionKey,
      label: params.label,
      displayName: params.label
    });
    
    return session;
  }
  
  /**
   * 获取Session
   */
  async getSession(sessionKey: string): Promise<Session | undefined> {
    return this.sessions.get(sessionKey);
  }
  
  /**
   * 删除Session
   */
  async deleteSession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      this.sessions.delete(sessionKey);
      this.emit({
        sessionKey,
        reason: 'deleted',
        displayName: session.metadata?.label as string
      });
    }
  }
  
  /**
   * 更新Session
   */
  async updateSession(sessionKey: string, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(sessionKey);
    if (!session) return undefined;
    
    const updated: Session = {
      ...session,
      ...updates,
      updatedAt: Date.now()
    };
    this.sessions.set(sessionKey, updated);
    
    this.emit({
      sessionKey,
      reason: 'updated'
    });
    
    return updated;
  }
  
  /**
   * 列出所有Session
   */
  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }
}

// 使用示例
const lifecycleManager = new SessionLifecycleManager();

// 监听生命周期事件
const unsubscribe = lifecycleManager.onLifecycleEvent((event) => {
  console.log('[Lifecycle Event]', event.reason, event.sessionKey);
});

// 创建Session
lifecycleManager.createSession({
  agentId: 'pipixia',
  channel: 'telegram',
  peerId: 'dayu123',
  label: '皮皮虾与大鱼的对话'
});

// 清理
// unsubscribe();

// ============================================
// 4. Session消息管理
// ============================================

class SessionMessageManager {
  private sessions: Map<string, Session> = new Map();
  
  async addMessage(sessionKey: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error(`Session not found: ${sessionKey}`);
    
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now()
    };
    
    session.messages.push(newMessage);
    session.updatedAt = Date.now();
    
    return newMessage;
  }
  
  async getMessages(sessionKey: string, limit?: number): Promise<Message[]> {
    const session = this.sessions.get(sessionKey);
    if (!session) return [];
    
    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }
  
  async clearMessages(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }
  }
}

// ============================================
// 5. Session键解析工具
// ============================================

/**
 * 解析Agent Session Key
 * 格式: agent:{agentId}:{rest}
 */
function parseAgentSessionKey(sessionKey: string | undefined | null): {
  agentId: string;
  rest: string;
} | null {
  if (!sessionKey) return null;
  
  const parts = sessionKey.split(':');
  if (parts.length < 3 || parts[0] !== 'agent') return null;
  
  return {
    agentId: parts[1],
    rest: parts.slice(2).join(':')
  };
}

/**
 * 判断Session类型
 */
function getSessionType(sessionKey: string | undefined | null): 'direct' | 'group' | 'channel' | 'cron' | 'subagent' | 'unknown' {
  if (!sessionKey) return 'unknown';
  if (sessionKey.includes(':cron:')) return 'cron';
  if (sessionKey.includes(':subagent:')) return 'subagent';
  if (sessionKey.includes(':channel:group:')) return 'group';
  if (sessionKey.includes(':channel:direct:')) return 'direct';
  if (sessionKey.includes(':channel:')) return 'channel';
  return 'unknown';
}

/**
 * 从SessionKey提取Agent ID
 */
function extractAgentId(sessionKey: string | undefined | null): string | null {
  const parsed = parseAgentSessionKey(sessionKey);
  return parsed?.agentId ?? null;
}

// 测试解析
const testKeys = [
  'agent:main:channel:direct:user123',
  'agent:pipixia:cron:17c11933-7d78-41e4-82f7-4b81d9aa56d4',
  'agent:sub龙虾:subagent:1:channel:direct:user456',
  'invalid-key'
];

for (const key of testKeys) {
  console.log(`\nKey: ${key}`);
  console.log('  Parsed:', parseAgentSessionKey(key));
  console.log('  Type:', getSessionType(key));
  console.log('  AgentId:', extractAgentId(key));
}

// ============================================
// 6. Session状态持久化（简化版）
// ============================================

interface SessionSnapshot {
  sessionKey: string;
  sessionId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * 将会话快照序列化为JSON
 */
function serializeSessionSnapshot(session: Session): SessionSnapshot {
  return {
    sessionKey: session.sessionKey,
    sessionId: session.sessionId,
    agentId: session.agentId,
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
    messageCount: session.messages.length
  };
}

/**
 * 从快照恢复会话基本信息
 */
function deserializeSessionSnapshot(snapshot: SessionSnapshot): Partial<Session> {
  return {
    sessionKey: snapshot.sessionKey,
    sessionId: snapshot.sessionId,
    agentId: snapshot.agentId,
    createdAt: new Date(snapshot.createdAt).getTime(),
    updatedAt: new Date(snapshot.updatedAt).getTime(),
    messages: []  // 消息需要单独加载
  };
}

// 测试序列化
const snapshot = serializeSessionSnapshot(mainSession);
console.log('\nSession Snapshot:', JSON.stringify(snapshot, null, 2));

// ============================================
// 7. 子Agent Session创建
// ============================================

function createSubagentSessionKey(
  parentSessionKey: string,
  depth: number
): string {
  // 格式: agent:{agentId}:subagent:{depth}:{parentRest}
  const parsed = parseAgentSessionKey(parentSessionKey);
  if (!parsed) throw new Error('Invalid parent session key');
  
  return `agent:${parsed.agentId}:subagent:${depth}:${parsed.rest}`;
}

// 测试子Agent Session
const parentKey = 'agent:main:channel:direct:user123';
for (let depth = 1; depth <= 3; depth++) {
  const subagentKey = createSubagentSessionKey(parentKey, depth);
  console.log(`Depth ${depth}: ${subagentKey}`);
}

export {
  Session,
  Message,
  SessionLifecycleEvent,
  SessionLifecycleListener,
  SessionStore,
  SessionSnapshot,
  SessionLifecycleManager,
  SessionMessageManager,
  createSessionKey,
  parseAgentSessionKey,
  getSessionType,
  extractAgentId,
  createSubagentSessionKey,
  serializeSessionSnapshot,
  deserializeSessionSnapshot
};
