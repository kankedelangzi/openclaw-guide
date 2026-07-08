// r93-plugin-examples.js
// ClawHub Plugins 核心代码示例

// ========== 1. ClawVitals 安全扫描集成 ==========
// 企业级OpenClaw安全健康检查

const { execSync } = require('child_process');

// 收集数据
function collectData() {
  const commands = [
    'openclaw security audit --json',
    'openclaw health --json',
    'openclaw --version',
    'openclaw update status --json',
    'node --version'
  ];
  
  return commands.map(cmd => {
    try {
      return { cmd, output: execSync(cmd, { encoding: 'utf8' }) };
    } catch (e) {
      return { cmd, error: e.message };
    }
  });
}

// 计分逻辑
const SEVERITY_SCORES = {
  'Critical': -25,
  'High': -10,
  'Medium': -5,
  'Low': -2,
  'Info': 0
};

function calculateScore(findings) {
  let score = 100;
  findings.forEach(f => {
    score += SEVERITY_SCORES[f.severity] || 0;
  });
  return Math.max(0, score);
}

// ========== 2. Mem0 记忆层集成 ==========
// 动态用户偏好学习

const MEM0_CONFIG = {
  embedder: 'openai/text-embedding-3-small',
  llm: 'openai/gpt-4o-mini',
  vectorStore: 'memory'
};

// 搜索记忆
function searchMemories(query, limit = 3) {
  const { execSync } = require('child_process');
  const result = execSync(
    `JSON_OUTPUT=1 node scripts/mem0-search.js "${query}" --limit=${limit}`,
    { encoding: 'utf8' }
  );
  return JSON.parse(result);
}

// 存储记忆
function addMemory(text, user = 'default') {
  const { execSync } = require('child_process');
  return execSync(
    `node scripts/mem0-add.js "${text}" --user=${user}`,
    { encoding: 'utf8' }
  );
}

// ========== 3. Feishu Bot 协作 ==========
// 飞书Bot间消息投递

const FEISHU_HOOKS = {
  // 注入群内可用Bot列表
  before_prompt_build: (context) => {
    const bots = discoverBotsInChannel(context.channelId);
    return {
      ...context,
      systemPrompt: context.systemPrompt + `\n\nAvailable bots: ${bots.join(', ')}`
    };
  },
  
  // 替换@标签
  message_sending: (message) => {
    return message.replace(/@(\w+)/g, (match, botName) => {
      const userId = resolveBotUserId(botName);
      return `<at user_id="${userId}">${botName}</at>`;
    });
  },
  
  // 过滤和检测
  inbound_claim: (message) => {
    // 过滤非@消息
    if (!message.isDirectlyMentioned) return null;
    
    // 检测原生投递状态
    if (message.deliveryStatus === 'native') {
      return {
        ...message,
        sender: message.originalSender
      };
    }
    
    return message;
  }
};

// ========== 4. episodic-claw 情景记忆 ==========
// 双路径记忆架构

const EPISODIC_CONFIG = {
  reserveTokens: 2048,
  dedupWindow: 5,
  maxBufferChars: 7200,
  maxPoolChars: 15000,
  segmentationLambda: 2.0,
  recallReInjectionCooldownTurns: 24
};

// 四个记忆工具
const EP_TOOLS = {
  // 主动回忆
  'ep-recall': async (query) => {
    return await semanticSearch(query, {
      floor: EPISODIC_CONFIG.recallSemanticFloor
    });
  },
  
  // 强制保存
  'ep-save': async (content, metadata = {}) => {
    return await storeEpisode({
      content,
      timestamp: Date.now(),
      surpriseScore: calculateSurpriseScore(content),
      ...metadata
    });
  },
  
  // 展开详情
  'ep-expand': async (episodeId) => {
    return await getFullEpisode(episodeId);
  },
  
  // 会话锚点
  'ep-anchor': async (context) => {
    const summary = await summarizeContext(context);
    return await storeEpisode({
      type: 'anchor',
      content: summary,
      timestamp: Date.now()
    });
  }
};

// ========== 5. Emperor Claw OS 控制平面 ==========
// AI workforce编排

class EmperorClawOS {
  constructor(bridge = 'javascript') {
    this.bridge = bridge;
    this.checkpointStore = new CheckpointStore();
  }
  
  // 持久化checkpoint
  async checkpoint(agentId, state) {
    return await this.checkpointStore.save({
      agentId,
      state,
      timestamp: Date.now()
    });
  }
  
  // 恢复checkpoint
  async restore(agentId) {
    return await this.checkpointStore.load(agentId);
  }
  
  // 控制指令
  async control(agentId, command) {
    const checkpoint = await this.restore(agentId);
    return await this.executeCommand(command, checkpoint);
  }
}

// ========== 6. 插件安装命令参考 ==========
const INSTALL_COMMANDS = {
  'clawvitals': 'openclaw plugins install clawhub:clawvitals',
  'mem0': 'openclaw plugins install clawhub:mem0',
  'feishu-bot-chat': 'openclaw plugins install clawhub:feishu-bot-chat',
  'episodic-claw': 'openclaw plugins install clawhub:episodic-claw',
  'emperor-claw-os': 'openclaw plugins install clawhub:emperor-claw-os'
};
