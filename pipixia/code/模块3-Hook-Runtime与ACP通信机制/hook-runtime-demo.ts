/**
 * Hook Runtime示例 - 展示如何注册和使用内部Hook
 * 对应：internal-hooks-CVdBfFMw.js
 */

// 模拟OpenClaw的内部Hook系统
class InternalHookSystem {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * 注册hook处理器
   * @param {string} eventKey - 事件类型或"type:action"组合
   * @param {Function} handler - 处理函数
   */
  register(eventKey, handler) {
    if (!this.handlers.has(eventKey)) {
      this.handlers.set(eventKey, []);
    }
    this.handlers.get(eventKey).push(handler);
    console.log(`[Hook] Registered handler for: ${eventKey}`);
  }

  /**
   * 注销hook处理器
   */
  unregister(eventKey, handler) {
    const handlers = this.handlers.get(eventKey);
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
    if (handlers.length === 0) this.handlers.delete(eventKey);
  }

  /**
   * 触发hook
   * 同时调用type和type:action的处理器
   */
  async trigger(event) {
    const typeHandlers = this.handlers.get(event.type) ?? [];
    const specificHandlers = this.handlers.get(`${event.type}:${event.action}`) ?? [];
    const allHandlers = [...typeHandlers, ...specificHandlers];

    console.log(`[Hook] Triggering: ${event.type}:${event.action} (${allHandlers.length} handlers)`);

    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[Hook Error] ${event.type}:${event.action}: ${err.message}`);
      }
    }
  }

  /**
   * 创建hook事件
   */
  createEvent(type, action, sessionKey, context = {}) {
    return {
      type,
      action,
      sessionKey,
      context,
      timestamp: new Date(),
      messages: []
    };
  }
}

// 示例：使用Hook系统
async function demo() {
  const hooks = new InternalHookSystem();

  // 监听所有command事件
  hooks.register('command', async (event) => {
    console.log(`[Command Log] ${event.action} - session: ${event.sessionKey}`);
  });

  // 监听特定command:new事件
  hooks.register('command:new', async (event) => {
    console.log(`[New Command] Creating new session: ${event.context.sessionId}`);
  });

  // 监听agent启动
  hooks.register('agent', async (event) => {
    console.log(`[Agent] ${event.action} - workspace: ${event.context.workspaceDir}`);
  });

  // 触发事件
  await hooks.trigger(hooks.createEvent('command', 'list', 'agent:main:123', {}));
  await hooks.trigger(hooks.createEvent('command', 'new', 'agent:main:456', { sessionId: 'abc' }));
  await hooks.trigger(hooks.createEvent('agent', 'bootstrap', 'agent:main:789', { 
    workspaceDir: '/root/.openclaw/workspace' 
  }));

  // 注销示例
  const oneTimeHandler = async (event) => {
    console.log('[One-time] Running only once');
    hooks.unregister('command', oneTimeHandler);
  };
  hooks.register('command', oneTimeHandler);
  await hooks.trigger(hooks.createEvent('command', 'test', 'agent:main:0', {}));
  await hooks.trigger(hooks.createEvent('command', 'test', 'agent:main:0', {})); // 不会触发
}

demo().catch(console.error);
