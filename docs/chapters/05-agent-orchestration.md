# 第五章：Agent编排入门

## 5.1 Session机制

Session（会话）是OpenClaw中管理Agent状态的核心单元。每个用户与Agent的对话都运行在一个独立的Session中，Session记录了对话历史、用户偏好、当前状态，以及与这个会话绑定的所有运行时信息。

理解Session的关键是认识到它的双重性质：一方面它是"对话窗口"，承载用户的即时交互；另一方面它是"记忆容器"，保存跨次对话的持久化信息。

### 5.1.1 Session核心数据结构

每个Session在创建时会生成唯一ID，这个ID贯穿整个会话生命周期：

```typescript
interface Session {
  id: string;                    // 唯一标识符，格式: sess_xxxx
  type: 'main' | 'sub' | 'isolated';  // Session类型
  userId: string;                // 用户ID
  channel: string;              // 来源渠道: telegram/feishu/discord
  
  // 上下文管理
  context: {
    messages: Message[];         // 对话历史
    maxHistory: number;         // 最大历史条数
    truncationStrategy: 'sliding' | 'summary' | 'preserve-system';
  };
  
  // 状态
  state: Record<string, unknown>;  // 自定义状态KV
  metadata: SessionMetadata;      // 元信息
  
  // 生命周期
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;             // 过期时间（可选）
}
```

当用户发送一条消息时，OpenClaw通过`session.id`定位正确的会话上下文，加载历史消息，构建完整的推理输入。这个过程对开发者是透明的，但你需要理解它的存在，以便在需要精细控制时知道从何入手。

### 5.1.2 上下文管理与截断策略

上下文窗口是LLM的核心限制，Session通过三种截断策略来管理这个问题：

```typescript
// 策略1: 滑动窗口 - 保留最近N条消息
const slidingStrategy = {
  type: 'sliding',
  maxMessages: 20,
  preserveSystem: true,   // 系统消息永远保留
  
  truncate(messages: Message[]): Message[] {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const otherMsgs = messages.filter(m => m.role !== 'system');
    
    // 从后往前保留最近的消息
    return [...systemMsgs, ...otherMsgs.slice(-this.maxMessages)];
  }
};

// 策略2: 摘要 - 当上下文过长时生成摘要
const summaryStrategy = {
  type: 'summary',
  thresholdTokens: 60000,
  
  async truncate(messages: Message[]): Promise<Message[]> {
    const tokens = await countTokens(messages);
    
    if (tokens < this.thresholdTokens) {
      return messages;
    }
    
    // 生成摘要，保留最近消息
    const summary = await summarizeOlderMessages(messages);
    const recentMessages = getRecentMessages(messages, 10);
    
    return [summary, ...recentMessages];
  }
};

// 策略3: 系统消息优先 - 始终保留系统提示
const preserveSystemStrategy = {
  type: 'preserve-system',
  maxTokens: 128000,
  
  truncate(messages: Message[]): Message[] {
    const systemMsg = messages.find(m => m.role === 'system');
    const otherMsgs = messages.filter(m => m.role !== 'system');
    
    const selected = [systemMsg];
    let currentTokens = countTokens(systemMsg);
    
    for (const msg of otherMsgs) {
      const msgTokens = countTokens(msg);
      if (currentTokens + msgTokens <= this.maxTokens) {
        selected.push(msg);
        currentTokens += msgTokens;
      }
    }
    
    return selected;
  }
};
```

这三种策略各有适用场景：滑动窗口实现简单，适合短对话；摘要策略保留更多信息，但有延迟和成本开销；系统消息优先保证Agent身份定义始终完整，推荐作为默认策略。

### 5.1.3 Session状态隔离

不同渠道的Session完全隔离，同一用户在不同群聊中的Session也是独立的：

```typescript
// 状态隔离示例
const sessionIsolation = {
  // Telegram私聊
  'telegram:100008220896' → Session {
    channel: 'telegram',
    userId: '100008220896',
    context: [...],
    state: { lastCommand: 'translate', language: 'en' }
  },
  
  // 同一个用户的飞书群聊
  'feishu:群里123:100008220896' → Session {
    channel: 'feishu',
    chatId: '群里123',
    userId: '100008220896',
    context: [...],
    state: { groupContext: '技术讨论' }
  }
};
```

这种隔离机制确保了：当用户在Telegram问翻译问题，然后切换到飞书群聊讨论技术方案，两个Session互不干扰，各自有独立的状态和历史。

## 5.2 子Agent机制

子Agent是OpenClaw实现Multi-Agent编排的核心能力。当你需要并行处理多个独立任务、或者需要专门的Agent处理特定领域问题时，子Agent机制让你可以在一个主Agent中"召唤"多个子Agent协同工作。

### 5.2.1 sessions_spawn核心用法

`sessions_spawn`是启动子Agent的主要方式，它创建一个新的独立Session来运行子Agent：

```typescript
// 基础用法：并行启动两个子Agent
async function parallelResearch(task: string) {
  // 启动研究Agent A（代码相关）
  const agentA = await sessions_spawn({
    task: `请研究以下代码问题，给出分析报告：${task}`,
    label: 'code-researcher',
    runtime: 'subagent',
    timeoutSeconds: 120
  });
  
  // 启动研究Agent B（文档相关）
  const agentB = await sessions_spawn({
    task: `请搜索相关文档和最佳实践：${task}`,
    label: 'doc-researcher',
    runtime: 'subagent',
    timeoutSeconds: 120
  });
  
  // 等待两个Agent都完成
  const [resultA, resultB] = await Promise.all([
    agentA.result,
    agentB.result
  ]);
  
  // 汇总结果
  return {
    codeAnalysis: resultA.message,
    documentation: resultB.message
  };
}
```

`sessions_spawn`返回的Agent对象包含`result`属性（Promise），你可以通过`Promise.all`实现并行等待。子Agent的执行是异步的，不会阻塞主Agent的响应。

### 5.2.2 并行 vs 串行：选择策略

并不是所有场景都适合并行。理解何时用并行、何时用串行，是Multi-Agent编排的关键。

```typescript
// 判断逻辑
function shouldUseParallel(subtasks: Task[]): boolean {
  // 子任务相互独立 → 并行
  if (subtasks.every(t => !t.dependsOn)) {
    return true;
  }
  
  // 任务有依赖关系 → 串行或流水线
  if (subtasks.some(t => t.dependsOn)) {
    return false;
  }
  
  // 任务数量少（<3）且耗时短 → 串行省资源
  if (subtasks.length < 3) {
    return false;
  }
  
  return true;
}

// 串行执行：任务有依赖链
async function serialPipeline(tasks: Task[]): Promise<Result[]> {
  const results: Result[] = [];
  
  for (const task of tasks) {
    // 前置任务的输出作为当前任务的输入
    const context = results.length > 0 
      ? { previousResults: results }
      : {};
    
    const result = await executeTask(task, context);
    results.push(result);
  }
  
  return results;
}

// 并行执行：任务完全独立
async function parallelExecute(tasks: Task[]): Promise<Result[]> {
  const promises = tasks.map(task => executeTask(task, {}));
  return Promise.all(promises);
}
```

并行执行的核心优势是总耗时等于最长任务的耗时，而非所有任务耗时之和。但并行也有代价：内存占用翻倍、多模型的并发API调用可能触发速率限制。

### 5.2.3 完整的多Agent协作示例

以下是OpenClaw社区中一个常见的多Agent协作模式——研究-撰写-审核流水线：

```typescript
// multi-agent-pipeline.ts
// 三阶段Agent流水线：研究 → 撰写 → 审核

class ContentPipeline {
  constructor(private userId: string) {}
  
  async run(initialTopic: string): Promise<PublishedContent> {
    console.log(`[Pipeline] Starting for topic: ${initialTopic}`);
    
    // 阶段1：研究Agent（并行）
    const researchAgent = await sessions_spawn({
      task: `请深入研究以下主题，收集关键信息和数据：
      主题：${initialTopic}
      
      请输出：
      1. 核心观点（3-5个）
      2. 支持数据（引用来源）
      3. 常见误解
      4. 相关背景知识`,
      label: 'researcher',
      runtime: 'subagent',
      timeoutSeconds: 180
    });
    
    // 阶段2：撰写Agent（等研究完成后启动）
    const researchResult = await researchAgent.result;
    
    const writerAgent = await sessions_spawn({
      task: `基于以下研究结果，撰写一篇结构清晰的文章：
      
      研究内容：
      ${researchResult.message}
      
      要求：
      1. 标题吸引人
      2. 开头有钩子
      3. 正文分3-5个部分
      4. 结尾有Call-to-Action
      5. 字数1500-2000字`,
      label: 'writer',
      runtime: 'subagent',
      timeoutSeconds: 120
    });
    
    // 阶段3：审核Agent（等撰写完成后启动）
    const draftResult = await writerAgent.result;
    
    const reviewerAgent = await sessions_spawn({
      task: `请审核以下文章，给出修改建议：
      
      文章：
      ${draftResult.message}
      
      检查维度：
      1. 事实准确性
      2. 逻辑连贯性
      3. 语言表达
      4. SEO优化（如适用）`,
      label: 'reviewer',
      runtime: 'subagent',
      timeoutSeconds: 60
    });
    
    const reviewResult = await reviewerAgent.result;
    
    return {
      topic: initialTopic,
      research: researchResult.message,
      draft: draftResult.message,
      review: reviewResult.message,
      finalVersion: this.mergeFeedback(draftResult.message, reviewResult.message)
    };
  }
  
  private mergeFeedback(draft: string, review: string): string {
    // 简化版：直接返回草稿，实际场景可让编辑Agent整合
    return `${draft}\n\n---\n编辑审核意见：\n${review}`;
  }
}

// 使用示例
const pipeline = new ContentPipeline('100008220896');

pipeline.run('OpenClaw多模型架构最佳实践').then(result => {
  console.log('[Pipeline] Completed!');
  console.log(result.finalVersion);
});
```

这个流水线展示了子Agent协作的核心模式：研究结果作为撰写Agent的输入，撰写结果再作为审核Agent的输入。每个阶段的结果都持久化在子Agent的Session中，可以通过`sessions_history`回溯。

### 5.2.4 sessions_spawn参数详解

```typescript
interface SpawnOptions {
  task: string;                    // 子Agent的任务描述（必填）
  label: string;                    // Session标签，便于识别
  runtime: 'subagent';              // 运行时类型
  
  // 超时控制
  timeoutSeconds?: number;         // 0表示不限制
  
  // 模型选择（可选，不填则用默认模型）
  model?: string;
  
  // 思考深度（可选）
  thinking?: 'off' | 'low' | 'high';
  
  // 是否持久化（isolated的Session默认不持久化）
  mode?: 'run' | 'session';
}

// 常用配置示例
const examples = {
  // 快速短任务
  quickTask: { timeoutSeconds: 30, mode: 'run' },
  
  // 需要保留上下文的长任务
  longTask: { timeoutSeconds: 300, mode: 'session' },
  
  // 需要深度推理的复杂任务
  reasoningTask: { timeoutSeconds: 180, thinking: 'high' },
  
  // 指定模型（成本敏感场景用小模型）
  cheapTask: { timeoutSeconds: 60, model: 'qwen:7b' }
};
```

## 5.3 多模型路由

多模型路由是根据任务特征自动选择最合适模型的能力。OpenClaw的模型路由体现了"让合适的模型做合适的事"这一核心原则：用GPT-4处理复杂推理是浪费，用Qwen-7B处理代码审核是冒险。

### 5.3.1 路由策略实现

多模型路由的核心是任务分类器：

```typescript
// model-router.ts
// OpenClaw多模型路由策略实现

interface TaskProfile {
  type: 'reasoning' | 'creative' | 'code' | 'fast' | 'vision';
  complexity: 'low' | 'medium' | 'high';
  latencyRequirement: 'critical' | 'normal' | 'relaxed';
  costSensitivity: 'low' | 'medium' | 'high';
}

class ModelRouter {
  private modelConfigs = {
    // 主力模型
    default: 'minimax/MiniMax-M2.7',
    
    // 强推理模型（成本高）
    reasoning: 'anthropic/claude-3-5-sonnet',
    
    // 快速响应模型（成本低）
    fast: 'qwen:7b',
    
    // 代码专用模型
    code: 'anthropic/claude-3-5-sonnet',
    
    // 中文优化模型
    chinese: 'minimax/MiniMax-M2.7'
  };
  
  // 路由决策
  route(task: string, context?: TaskProfile): string {
    // 1. 代码任务 → 专用模型
    if (this.isCodeTask(task)) {
      return this.modelConfigs.code;
    }
    
    // 2. 强推理需求 → 高成本模型
    if (this.needsDeepReasoning(task)) {
      return this.modelConfigs.reasoning;
    }
    
    // 3. 中文处理 → 国内模型（更快更便宜）
    if (this.isChineseTask(task)) {
      return this.modelConfigs.chinese;
    }
    
    // 4. 快速/简单任务 → 小模型
    if (this.isSimpleTask(task)) {
      return this.modelConfigs.fast;
    }
    
    // 5. 默认
    return this.modelConfigs.default;
  }
  
  private isCodeTask(task: string): boolean {
    const patterns = [
      /code|编程|函数|class |debug|implement|script/i,
      /代码|调试|程序|算法|数据结构/i
    ];
    return patterns.some(p => p.test(task));
  }
  
  private needsDeepReasoning(task: string): boolean {
    const patterns = [
      /分析|比较|设计|策略|规划/i,
      /analyze|compare|design|strategy|plan/i,
      /为什么|如何解决|深层原因/i
    ];
    return patterns.some(p => p.test(task));
  }
  
  private isChineseTask(task: string): boolean {
    // 简单判断：中文字符占比超过30%
    const chineseChars = (task.match(/[\u4e00-\u9fff]/g) || []).length;
    return chineseChars / task.length > 0.3;
  }
  
  private isSimpleTask(task: string): boolean {
    const simplePatterns = [
      /翻译|总结|查询|确认|简单/,
      /translate|summary|query|confirm|simple/i
    ];
    return simplePatterns.some(p => p.test(task));
  }
}
```

### 5.3.2 降级链与容错

再好的路由策略也可能遇到模型不可用的情况。降级链确保系统始终可用：

```typescript
// failover-chain.ts
class FailoverChain {
  constructor(
    private primary: string,
    private fallbacks: string[],
    private router: ModelRouter
  ) {}
  
  async execute(task: string): Promise<string> {
    const candidates = [this.primary, ...this.fallbacks];
    let lastError: Error;
    
    for (const model of candidates) {
      try {
        console.log(`[Router] Attempting model: ${model}`);
        
        const result = await this.callModel(model, task);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[Router] Model ${model} failed: ${lastError.message}`);
        
        if (!this.shouldRetry(error)) {
          throw lastError;
        }
      }
    }
    
    throw lastError!;
  }
  
  private shouldRetry(error: Error): boolean {
    // 网络错误、限流错误可重试
    if (error.message.includes('ECONNREFUSED')) return true;
    if (error.message.includes('429')) return true;
    if (error.message.includes('rate limit')) return true;
    if (error.message.includes('503')) return true;
    
    // 超时不重试（延长等待无意义）
    if (error.message.includes('timeout')) return false;
    
    // 认证错误不重试（配置问题）
    if (error.message.includes('401') || error.message.includes('403')) return false;
    
    return false;
  }
  
  private async callModel(model: string, task: string): Promise<string> {
    // 实际调用OpenClaw的model API
    return `Result from ${model}: processed "${task.slice(0, 50)}..."`;
  }
}

// 使用示例
const router = new FailoverChain(
  'anthropic/claude-3-5-sonnet',        // 首选
  ['openai/gpt-4o', 'minimax/MiniMax-M2.7'],  // 降级链
  new ModelRouter()
);

router.execute('请分析为什么OpenClaw的架构设计很优秀').then(result => {
  console.log('[Success]', result);
}).catch(err => {
  console.error('[All models failed]', err.message);
});
```

降级链的配置顺序很重要：优先尝试效果最好的模型，只有确认不可用才降级到备选。这个模式保证了质量优先，同时不牺牲可用性。

## 5.4 Memory系统

OpenClaw的记忆系统是让Agent具有"连续性"的关键。它分为三层：工作记忆（当前Session上下文）、情景记忆（历史事件记录）和语义记忆（向量化的知识检索）。理解这三层的关系，才能设计出真正好用的AI应用。

### 5.4.1 Workspace文件体系

Workspace是OpenClaw的持久化存储层，每个Agent都可以在Workspace中读写文件：

```typescript
// workspace-memory.ts
// Workspace文件作为跨Session记忆的示例

class WorkspaceMemory {
  // 写入记忆条目
  async remember(key: string, value: unknown): Promise<void> {
    const memoryPath = 'memory/YYYY-MM-DD.md';
    const entry = {
      timestamp: new Date().toISOString(),
      key,
      value,
      sessionId: getCurrentSessionId()
    };
    
    await write(memoryPath, JSON.stringify(entry, null, 2), { append: true });
  }
  
  // 检索记忆
  async recall(query: string): Promise<MemoryEntry[]> {
    // 读取最近N天的记忆文件
    const recentFiles = await glob('memory/2026-*.md');
    const results: MemoryEntry[] = [];
    
    for (const file of recentFiles) {
      const content = await read(file);
      const entries = JSON.parse(content);
      
      // 简单关键词匹配（实际场景用向量检索）
      if (content.includes(query)) {
        results.push(...entries);
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  // 更新偏好
  async updatePreference(userId: string, prefs: UserPrefs): Promise<void> {
    const prefFile = `preferences/${userId}.json`;
    const existing = await read(prefFile).catch(() => '{}');
    const merged = { ...JSON.parse(existing), ...prefs };
    
    await write(prefFile, JSON.stringify(merged, null, 2));
  }
}
```

Workspace的典型文件结构：

```
workspace/
├── memory/                    # 情景记忆
│   ├── 2026-04-01.md
│   ├── 2026-04-02.md
│   └── 2026-04-27.md
├── preferences/               # 用户偏好
│   └── 100008220896.json
├── skills/                   # 本地Skill
│   └── my-translator/
├── agents/                   # Agent配置
│   └── translator-agent.yaml
└── cache/                    # 缓存
    └── embedding-cache.json
```

### 5.4.2 语义记忆与向量检索

当记忆量变大后，关键词检索就不够用了。向量检索通过语义相似度找记忆：

```typescript
// semantic-memory.ts
// 简化的向量记忆实现

class SemanticMemory {
  constructor(
    private embeddingEndpoint: string,
    private vectorDb: VectorDB
  ) {}
  
  // 添加记忆
  async add(userId: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    // 生成向量
    const embedding = await this.getEmbedding(text);
    
    await this.vectorDb.insert({
      id: generateId(),
      userId,
      text,
      embedding,
      metadata,
      createdAt: new Date()
    });
  }
  
  // 语义检索
  async search(userId: string, query: string, limit = 5): Promise<SearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query);
    
    const results = await this.vectorDb.search(queryEmbedding, {
      filter: { userId },
      limit,
      similarityThreshold: 0.7
    });
    
    return results.map(r => ({
      text: r.text,
      score: r.similarity,
      metadata: r.metadata
    }));
  }
  
  private async getEmbedding(text: string): Promise<number[]> {
    // 调用嵌入API（OpenAI/Cohere/本地模型）
    const response = await fetch(this.embeddingEndpoint, {
      method: 'POST',
      body: JSON.stringify({ input: text }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    return data.embedding;
  }
}

// 使用RRR原则重排结果
function rerankWithRRR(
  candidates: SearchResult[],
  query: string,
  context: { recencyBonus?: boolean; resonanceBonus?: boolean }
): SearchResult[] {
  const now = Date.now();
  
  return candidates
    .map(c => {
      let score = c.score;
      
      // Recency：最近的结果加分
      if (context.recencyBonus && c.metadata?.createdAt) {
        const ageHours = (now - new Date(c.metadata.createdAt).getTime()) / 3600000;
        score += Math.max(0, 1 - ageHours / 168) * 0.2;  // 7天内有效
      }
      
      // Resonance：多次被引用过的记忆加分
      if (context.resonanceBonus && c.metadata?.accessCount) {
        score += Math.log(c.metadata.accessCount + 1) * 0.1;
      }
      
      return { ...c, rerankedScore: score };
    })
    .sort((a, b) => b.rerankedScore - a.rerankedScore);
}
```

RRR（Recency/Relevance/Resonance）重排原则在实践中非常有效：Relevance保证检索质量，Recency让最新记忆优先，Resonance让高频引用记忆获得额外权重。这个组合比纯向量检索更符合人类记忆规律。

## 5.5 第一个Agent应用：翻译助手

现在我们把前面学到的概念整合起来，构建一个完整的翻译助手Agent。这个Agent使用子Agent并行翻译多个段落，并利用Session持久化用户偏好。

### 5.5.1 翻译助手完整实现

```typescript
// translator-agent.ts
// 多模型翻译助手 - 完整实现

interface TranslationTask {
  text: string;
  targetLang: string;
  sourceLang?: string;
  style?: 'formal' | 'casual' | 'technical';
}

interface TranslationResult {
  original: string;
  translated: string;
  targetLang: string;
  style: string;
  wordCount: { original: number; translated: number };
  model: string;
  durationMs: number;
}

class TranslatorAgent {
  private router = new ModelRouter();
  
  async translate(task: TranslationTask): Promise<TranslationResult> {
    const start = Date.now();
    
    // 根据目标语言选择模型
    // 中文相关用国内模型，英文用通用模型
    const model = this.selectModel(task.targetLang);
    
    const systemPrompt = this.buildSystemPrompt(task.style || 'formal');
    const userPrompt = this.buildUserPrompt(task);
    
    const response = await this.callLLM(model, systemPrompt, userPrompt);
    
    return {
      original: task.text,
      translated: response,
      targetLang: task.targetLang,
      style: task.style || 'formal',
      wordCount: {
        original: this.countWords(task.text),
        translated: this.countWords(response)
      },
      model,
      durationMs: Date.now() - start
    };
  }
  
  // 并行翻译多个文本块
  async translateBatch(
    texts: string[],
    targetLang: string,
    style?: string
  ): Promise<TranslationResult[]> {
    console.log(`[Translator] Parallel translation of ${texts.length} chunks`);
    
    // 使用子Agent并行翻译
    const agentPromises = texts.map((text, i) =>
      sessions_spawn({
        task: `翻译以下文本到${targetLang}（风格：${style || 'formal'}）：
        
        原文：
        ${text}
        
        直接输出翻译结果，不要解释。`,
        label: `translator-chunk-${i}`,
        runtime: 'subagent',
        timeoutSeconds: 60
      }).result
    );
    
    const results = await Promise.all(agentPromises);
    
    return results.map((r, i) => ({
      original: texts[i],
      translated: r.message,
      targetLang,
      style: style || 'formal',
      wordCount: {
        original: this.countWords(texts[i]),
        translated: this.countWords(r.message)
      },
      model: 'subagent',
      durationMs: 0
    }));
  }
  
  // 长文本自动分块翻译
  async translateLongText(
    text: string,
    targetLang: string,
    options: { chunkSize?: number; overlap?: number } = {}
  ): Promise<TranslationResult> {
    const { chunkSize = 1000, overlap = 100 } = options;
    
    // 1. 估算总长度
    const words = this.countWords(text);
    console.log(`[Translator] Text is ${words} words, chunking...`);
    
    if (words <= chunkSize) {
      return this.translate({ text, targetLang });
    }
    
    // 2. 分块
    const chunks = this.splitIntoChunks(text, chunkSize, overlap);
    console.log(`[Translator] Split into ${chunks.length} chunks`);
    
    // 3. 并行翻译
    const results = await this.translateBatch(chunks, targetLang);
    
    // 4. 合并结果
    const translatedText = results.map(r => r.translated).join('\n\n');
    
    return {
      original: text,
      translated: translatedText,
      targetLang,
      style: 'chunked',
      wordCount: {
        original: words,
        translated: this.countWords(translatedText)
      },
      model: 'multi-agent-parallel',
      durationMs: 0
    };
  }
  
  private selectModel(targetLang: string): string {
    // 中文相关互译 → 国内模型（更快）
    if (/中文|汉语|Chinese|中文/.test(targetLang)) {
      return 'minimax/MiniMax-M2.7';
    }
    
    // 日文 → 亚洲优化模型
    if (/日本語|Japanese/.test(targetLang)) {
      return 'minimax/MiniMax-M2.7';
    }
    
    // 其他语言 → 通用模型
    return 'minimax/MiniMax-M2.7';
  }
  
  private buildSystemPrompt(style: string): string {
    const styleInstructions = {
      formal: '使用正式、专业的语言风格',
      casual: '使用轻松、口语化的表达',
      technical: '使用专业术语，保持准确性'
    };
    
    return `你是一个专业的翻译助手。${styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.formal}
    
    翻译要求：
    1. 意思准确，不遗漏重要信息
    2. 语言流畅，符合目标语言习惯
    3. 保持原文的格式和语气
    4. 对专有名词保持原文或提供解释`;
  }
  
  private buildUserPrompt(task: TranslationTask): string {
    let prompt = '';
    
    if (task.sourceLang) {
      prompt += `源语言：${task.sourceLang}\n`;
    }
    
    prompt += `目标语言：${task.targetLang}\n\n`;
    prompt += `原文：\n${task.text}`;
    
    return prompt;
  }
  
  private async callLLM(model: string, system: string, user: string): Promise<string> {
    // 这里应该调用OpenClaw的model API
    // 简化实现
    console.log(`[Translator] Calling ${model}...`);
    await sleep(100); // 模拟延迟
    
    return `[Translated by ${model}]: ${user.split('\n\n').pop()}`;
  }
  
  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }
  
  private splitIntoChunks(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += size - overlap) {
      chunks.push(words.slice(i, i + size).join(' '));
      if (i + size >= words.length) break;
    }
    
    return chunks;
  }
}

// 使用示例
async function main() {
  const translator = new TranslatorAgent();
  
  // 单段翻译
  const single = await translator.translate({
    text: 'OpenClaw is a powerful AI agent runtime that supports multi-model orchestration.',
    targetLang: '中文',
    style: 'formal'
  });
  
  console.log('Single translation:');
  console.log(single.translated);
  console.log(`Model: ${single.model}, Duration: ${single.durationMs}ms\n`);
  
  // 长文本分块翻译
  const longText = 'OpenClaw provides several key capabilities... '.repeat(200);
  
  console.log('Long text translation (auto-chunked):');
  const longResult = await translator.translateLongText(
    longText,
    '中文',
    { chunkSize: 500 }
  );
  
  console.log(`Chunks: ${longResult.translated.split('\n\n').length}`);
  console.log(`Word count: ${longResult.wordCount.original} → ${longResult.wordCount.translated}`);
}

main();
```

### 5.5.2 用户偏好持久化

翻译助手的一个重要改进是根据用户历史偏好自动调整：

```typescript
// translator-with-prefs.ts
// 带偏好学习的翻译助手

interface UserPreferences {
  defaultTargetLang: string;
  preferredStyle: 'formal' | 'casual' | 'technical';
  forbiddenWords: string[];          // 禁止使用的词
  alwaysTranslate: boolean;          // 是否总是翻译
  lastUsed: string;                  // 最后使用时间
}

class TranslatorWithPrefs extends TranslatorAgent {
  private prefPath = 'preferences/translator.json';
  
  async getPrefs(userId: string): Promise<UserPreferences> {
    try {
      const data = await read(`${this.prefPath}/${userId}.json`);
      return JSON.parse(data);
    } catch {
      // 返回默认偏好
      return {
        defaultTargetLang: '中文',
        preferredStyle: 'formal',
        forbiddenWords: [],
        alwaysTranslate: false,
        lastUsed: new Date().toISOString()
      };
    }
  }
  
  async savePrefs(userId: string, prefs: UserPreferences): Promise<void> {
    await write(`${this.prefPath}/${userId}.json`, JSON.stringify(prefs, null, 2));
  }
  
  async translateWithPrefs(
    userId: string,
    task: TranslationTask
  ): Promise<TranslationResult> {
    const prefs = await this.getPrefs(userId);
    
    // 合并用户偏好
    const mergedTask: TranslationTask = {
      text: task.text,
      targetLang: task.targetLang || prefs.defaultTargetLang,
      sourceLang: task.sourceLang,
      style: task.style || prefs.preferredStyle
    };
    
    // 执行翻译
    const result = await this.translate(mergedTask);
    
    // 检查禁忌词
    for (const word of prefs.forbiddenWords) {
      if (result.translated.includes(word)) {
        result.translated = result.translated.replace(
          word,
          `[已过滤敏感词]`
        );
      }
    }
    
    // 更新偏好
    prefs.lastUsed = new Date().toISOString();
    await this.savePrefs(userId, prefs);
    
    return result;
  }
}

// Skill封装：SKILL.md
/*
---
name: translator-assistant
description: "多模型翻译助手 - 支持批量翻译、长文本分块、偏好学习"
metadata:
  openclaw: {}
  author: "pipixia"
  version: "1.0.0"
  tags: ["productivity", "translation", "multi-model"]
---

# Translator Assistant

## 功能
1. 单段翻译（指定语言和风格）
2. 批量并行翻译
3. 长文本自动分块
4. 用户偏好持久化

## 使用示例

```typescript
const translator = new TranslatorWithPrefs();

const result = await translator.translateWithPrefs('100008220896', {
  text: 'Hello, world!',
  targetLang: '中文'
});
```

## 配置
无需额外配置，使用默认模型路由。
*/
```

这个翻译助手展示了Session机制、子Agent并行、多模型路由和记忆系统的综合应用。理解了这个例子，你对OpenClaw Agent编排的理解就已经入门了。

## 本章小结

本章介绍了OpenClaw Agent编排的四大核心能力：

1. **Session机制**：通过唯一ID管理对话上下文，支持多种截断策略，保证不同渠道、不同用户的会话隔离。

2. **子Agent机制**：`sessions_spawn`让你并行或串行地启动多个子Agent，适用场景包括：任务分解、多路搜索、流水线处理。关键是根据任务依赖关系选择并行或串行。

3. **多模型路由**：根据任务特征（代码/推理/简单/中文）自动选择最合适的模型，配合降级链实现质量与成本的平衡。

4. **记忆系统**：Workspace文件层做持久化，向量检索层做语义搜索，RRR重排保证检索结果更符合人类记忆规律。

下一章我们将深入Agent编排进阶，学习Multi-Agent Orchestrator的设计和Workflow自动化编排的实现。
