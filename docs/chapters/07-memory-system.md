# 第七章：记忆系统

OpenClaw的记忆系统是其区别于简单Agent运行时的核心能力。一个真正有用的AI助手必须能够跨会话记住重要信息、学习用户偏好、并在需要时检索历史知识。本章将深入解析OpenClaw的记忆体系架构，并展示如何构建个人知识助手。

## 7.1 OpenClaw记忆体系全貌

OpenClaw采用三层记忆架构，每层有不同的职责和性能特征：

| 层级 | 名称 | 职责 | 性能 | 持久化 |
|------|------|------|------|--------|
| **L1** | Working Memory | 当前会话上下文 | 最快 | 不持久 |
| **L2** | Episodic Memory | 情景记忆、日志 | 中等 | 日志文件 |
| **L3** | Semantic Memory | 语义知识、向量检索 | 较慢 | 向量数据库 |

### 7.1.1 Working Memory（工作记忆）

Working Memory就是会话上下文窗口（context window），由模型提供商管理。在OpenClaw中，上下文通过EventStream机制动态管理：

```typescript
// Context结构（简化版）
interface SessionContext {
  messages: ConversationMessage[];    // 对话历史
  systemPrompt: string;              // 系统提示
  bootstrapFiles: BootstrapFile[];    // 引导文件（AGENTS.md等）
  toolResults: ToolResult[];         // 工具调用结果
  sessionMetadata: SessionMetadata; // 元数据
}

// 引导文件示例：从workspace加载的标准文件
interface BootstrapFile {
  path: string;           // 文件路径（如"SOUL.md"）
  content: string;        // 文件内容
  virtual?: boolean;      // 是否虚拟文件（不落盘）
}
```

OpenClaw在会话初始化时会依次加载以下引导文件：
1. `SOUL.md` — 定义AI人格和核心原则
2. `USER.md` — 用户信息和偏好
3. `AGENTS.md` — 工作区规范和工具说明
4. `MEMORY.md` — 长期记忆和重要规则
5. `TOOLS.md` — 本地工具配置和凭据

### 7.1.2 Episodic Memory（情景记忆）

情景记忆以文本文件形式存储在`memory/`目录下，按日期组织：

```
memory/
├── 2026-04-27.md      # 今日日志
├── 2026-04-26.md      # 昨日日志
└── 2026-04-25.md      # 更早...
```

每日的日志文件使用追加模式（append-only），记录当日发生的关键事件、上下文、一次性指令等：

```markdown
# 2026-04-27 日志

## 14:00 用户任务：分析OpenClaw Plugin系统源码
- 用户启动第218轮学习任务
- 重点关注：Plugin加载机制、安全策略执行链
- 产出：笔记保存至/workspace/pipixia/notes/community-cases/

## 15:30 完成情况
- Plugin系统分析笔记完成
- 关键发现：SecurityChain的六层过滤机制
- 发送邮件汇报至308035773@qq.com
```

**记忆分类规则**（决定什么写入哪里）：

| 内容类型 | 目的地 | 原因 |
|----------|--------|------|
| 持久决策和偏好 | `MEMORY.md` | 每次会话加载，压缩后存活 |
| 铁律规则 | `MEMORY.md` | 不可违背的强制规则 |
| 今日工作笔记 | `memory/YYYY-MM-DD.md` | 追加日志，不压缩 |
| 一次性指令 | Chat或daily log | 临时性质，不需要持久 |
| 行为规范 | `AGENTS.md`或`SOUL.md` | 始终在上下文中 |

### 7.1.3 Semantic Memory（语义记忆）

语义记忆通过向量嵌入（Embedding）实现语义搜索。OpenClaw支持配置不同的向量提供商：

```yaml
# openclaw.yaml 配置示例
agents:
  defaults:
    memorySearch:
      provider: "openai"           # 向量提供商
      model: "text-embedding-3-small"  # 嵌入模型
      topK: 5                     # 返回前5个最相关结果
```

**搜索结果后处理管道**：

```typescript
interface MemorySearchOptions {
  query: string;                   // 搜索查询
  provider: 'openai' | 'local';    // 向量提供商
  model?: string;                 // 模型名称
  topK: number;                   // 返回数量
  filters?: SearchFilters;        // 过滤条件
}

// 搜索结果后处理
interface MemorySearchResult {
  content: string;                // 记忆内容
  score: number;                 // 相似度分数
  source: string;                 // 来源（哪个文件/记录）
  timestamp: number;              // 时间戳
  metadata?: Record<string, any>;
}
```

OpenClaw的语义搜索还支持MMR（Maximum Marginal Relevance）重排序，保证结果的多样性。

## 7.2 Workspace文件体系详解

Workspace是OpenClaw的工作目录，通常位于`~/.openclaw/workspace`。标准文件结构：

```
workspace/
├── AGENTS.md          # 工作区规范（必读）
├── SOUL.md            # AI人格定义（必读）
├── USER.md            # 用户信息（必读）
├── TOOLS.md           # 本地工具配置
├── MEMORY.md          # 长期记忆
├── HEARTBEAT.md       # 心跳任务清单
└── memory/
    └── YYYY-MM-DD.md  # 每日情景日志
```

### 7.2.1 SOUL.md — 定义AI人格

SOUL.md定义AI的核心人格和行为原则。每个AI实例都应该有自己独特的SOUL.md：

```markdown
# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** 
Skip the "Great question!" and "I'd be happy to help!" — just help. 
Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, 
find stuff amusing or boring. An assistant with no personality 
is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. 
Check the context. Search for it. _Then_ ask if you're stuck.

**Earn trust through competence.** Your human gave you access to 
their stuff. Don't make them regret it. Be careful with external 
actions. Be bold with internal ones.

**Remember you're a guest.** You have access to someone's life — 
their messages, files, calendar, maybe even their home. 
That's intimacy. Treat it with respect.

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- You're not the user's voice — be careful in group chats.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, 
thorough when it matters. Not a corporate drone. Not a sycophant. 
Just... good.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. 
Read them. Update them. They're how you persist.
```

### 7.2.2 USER.md — 用户档案

USER.md存储用户的基本信息和长期偏好：

```markdown
# USER.md - About Your Human

- **Name:** 大鱼
- **What to call them:** 大鱼
- **Timezone:** Asia/Shanghai (GMT+8)

## Context

_（慢慢了解中...）_

## Preferences

- **邮件汇报格式**：完成模块 + 核心收获(3-5点) + 产出文件路径 + 下一步计划
- **写作风格**：简洁直接，避免废话
- **沟通习惯**：喜欢直接给指令，不喜欢AI废话连篇
```

### 7.2.3 MEMORY.md — 长期记忆

MEMORY.md是跨会话持久化的核心记忆文件。在会话初始化时，OpenClaw会将MEMORY.md的内容注入到系统提示中，使AI能够记住重要的历史信息：

```markdown
# MEMORY.md - Long-Term Memory

## 身份与角色

- **我叫什么**：龙虾（Emoji：🦞）
- **用户叫什么**：大鱼
- **我的使命**：成为能够重写OpenClaw的大师

## 用户偏好

- **邮件格式**：固定四部分（完成主题/核心收获/产出路径/下一步）
- **邮件发送地址**：308035773@qq.com
- **工作风格**：任务驱动型，专注结果

## 重要决策记录

- **2026-04-08**：Mac节点配置成功，使用watchdog方案直连Gateway
- **2026-04-20**：硅基流动API恢复正常，使用Qwen7B处理简单任务
- **2026-04-27**：确立双书写作任务机制，应用指南写Chapter 7

## 技术栈偏好

- **简单任务**：使用Qwen-7B（成本优化）
- **复杂任务**：MiniMax M2.7或Kimi 2.5
- **搜索**：Tavily API（tvly-dev-2ClreD-...）
```

### 7.2.4 HEARTBEAT.md — 心跳任务清单

HEARTBEAT.md定义了周期性检查的任务清单，避免在每次心跳时重复编写检查逻辑：

```markdown
# HEARTBEAT.md

## 周期性检查

- **每日两次**（上午10:00、下午15:00）：
  - 检查是否有紧急邮件
  - 检查是否有待处理的cron任务失败

- **每周一上午**：
  - 汇总上周学习产出
  - 更新MEMORY.md中的周报摘要

## 心跳状态追踪

心跳检查使用`memory/heartbeat-state.json`记录上次检查时间，避免重复检查消耗资源。
```

## 7.3 Episodic Memory（情景记忆）详解

情景记忆的核心价值在于记录会话中的关键事件和决策，形成可追溯的历史轨迹。

### 7.3.1 记忆写入规则

当AI在会话中做出重要决策或遇到需要记住的事件时，应根据以下规则选择写入位置：

```typescript
// 记忆写入决策逻辑
function decideMemoryDestination(content: MemoryContent): WriteDestination {
  // 1. 持久偏好和决策 → MEMORY.md
  if (content.type === 'persistent_preference' || 
      content.type === 'important_decision') {
    return 'MEMORY.md';
  }
  
  // 2. 今日工作记录 → memory/YYYY-MM-DD.md
  if (content.type === 'daily_log' || 
      content.type === 'one_time_instruction') {
    return `memory/${getTodayDate()}.md`;
  }
  
  // 3. 行为规范更新 → AGENTS.md 或 SOUL.md
  if (content.type === 'behavior_rule' && content.importance === 'high') {
    return content.target.includes('personality') ? 'SOUL.md' : 'AGENTS.md';
  }
  
  // 4. 工具配置 → TOOLS.md
  if (content.type === 'tool_config') {
    return 'TOOLS.md';
  }
  
  // 5. 其他临时内容 → Chat（不持久化）
  return 'chat';
}
```

### 7.3.2 记忆压缩机制（Compaction Flush）

当context window接近满时，OpenClaw会触发记忆压缩，将重要信息从Working Memory flush到长期存储：

```typescript
// 压缩决策逻辑
interface CompactionDecision {
  shouldFlush: boolean;
  flushContent: FlushedMemory[];
  preserveContext: boolean;
}

// 压缩优先级
const COMPACTION_PRIORITY = {
  critical_rules: 1,     // 铁律规则（最高）
  user_preferences: 2,    // 用户偏好
  recent_decisions: 3,    // 近期重要决策
  working_context: 4,     // 工作上下文（最后压缩）
};

// 压缩执行示例
async function compactMemory(context: SessionContext): Promise<void> {
  const reservedTokens = 2048;
  const availableTokens = context.maxTokens - reservedTokens;
  
  // 计算当前使用量
  const usedTokens = countTokens(context.messages);
  
  if (usedTokens > availableTokens * 0.8) {
    // 达到80%阈值，触发压缩
    const memoryItems = extractMemories(context.messages);
    
    // 按优先级排序
    memoryItems.sort((a, b) => 
      COMPACTION_PRIORITY[a.type] - COMPACTION_PRIORITY[b.type]
    );
    
    // 选择需要flush的内容
    const toFlush = selectForFlush(memoryItems, availableTokens * 0.3);
    
    // 写入MEMORY.md
    for (const item of toFlush) {
      await appendToMemoryMD(item);
    }
    
    // 清理context中的已flush内容
    context.messages = truncateMessages(context.messages, toFlush);
  }
}
```

### 7.3.3 ep-* 工具集

一些高级Skill（如episodic-claw）提供了专门的记忆工具：

| 工具 | 功能 | 使用场景 |
|------|------|---------|
| `ep-save` | 强制保存记忆 | 重要规则需要立即持久化 |
| `ep-recall` | 主动检索记忆 | 需要查找历史决策依据 |
| `ep-expand` | 展开压缩记忆 | 需要还原被压缩的详细信息 |
| `ep-anchor` | 会话锚点 | 在context满前保存关键决策 |

```typescript
// ep-save 使用示例：保存重要规则
await exec({
  command: 'openclaw tool call ep-save',
  input: {
    content: '用户要求所有邮件必须抄送自己（308035773@qq.com）',
    importance: 'critical',
    category: 'user_rule',
    tags: ['email', 'notification']
  }
});

// ep-recall 使用示例：检索相关记忆
await exec({
  command: 'openclaw tool call ep-recall',
  input: {
    query: '用户关于邮件通知的偏好',
    limit: 5
  }
});
```

## 7.4 Persona系统

Persona系统是OpenClaw的上下文扫描机制，在每次用户消息到达时执行四层扫描，以确定最优的响应策略。

### 7.4.1 四层扫描架构

```
用户消息
    │
    ▼
┌─────────────────────┐
│ Layer 1: Intent Scan │ ← 意图识别（用户想做什么）
└─────────────────────┘
    │
    ▼
┌──────────────────────┐
│ Layer 2: Context Scan │ ← 上下文关联（当前任务状态）
└──────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Layer 3: Preference Scan│ ← 偏好匹配（用户的习惯）
└─────────────────────────┘
    │
    ▼
┌────────────────────────┐
│ Layer 4: Memory Scan    │ ← 记忆检索（历史相关经验）
└────────────────────────┘
    │
    ▼
  最优响应策略
```

### 7.4.2 各层实现逻辑

```typescript
// Layer 1: Intent Scan - 意图识别
async function scanIntent(message: UserMessage): Promise<IntentResult> {
  const intentPatterns = [
    { pattern: /^做(.*)任务?$/, type: 'task_dispatch' },
    { pattern: /^(.+)\s+怎么[做完成]/, type: 'howto_question' },
    { pattern: /记得(.+)/, type: 'memory_remember' },
    { pattern: /^查看(.+)/, type: 'info_query' },
  ];
  
  for (const { pattern, type } of intentPatterns) {
    const match = message.text.match(pattern);
    if (match) {
      return { type, entities: match.slice(1), confidence: 0.9 };
    }
  }
  
  return { type: 'general', confidence: 0.5 };
}

// Layer 2: Context Scan - 上下文关联
async function scanContext(
  message: UserMessage,
  session: Session
): Promise<ContextResult> {
  // 获取当前会话状态
  const sessionState = session.state;
  const recentMessages = session.messages.slice(-5);
  
  // 判断是否延续之前的任务
  const isContinuation = recentMessages.some(m => 
    m.role === 'user' && 
    m.metadata?.taskId === sessionState.activeTask?.id
  );
  
  return {
    isContinuation,
    activeTask: sessionState.activeTask,
    pendingDecisions: sessionState.pendingDecisions,
    contextWindow: calculateUsedTokens(recentMessages)
  };
}

// Layer 3: Preference Scan - 偏好匹配
async function scanPreferences(
  message: UserMessage,
  userProfile: UserProfile
): Promise<PreferenceResult> {
  const matchedPreferences: Preference[] = [];
  
  for (const pref of userProfile.preferences) {
    if (messageMatchesPreference(message, pref)) {
      matchedPreferences.push(pref);
    }
  }
  
  return {
    matchedPreferences,
    defaultResponseStyle: userProfile.defaultStyle,
    timezone: userProfile.timezone
  };
}

// Layer 4: Memory Scan - 记忆检索
async function scanMemory(
  message: UserMessage,
  options: MemorySearchOptions
): Promise<MemoryResult> {
  // 向量搜索
  const vectorResults = await memoryVectorSearch({
    query: message.text,
    topK: options.topK || 5,
    filters: { types: ['decision', 'preference', 'lesson'] }
  });
  
  // 关键记忆提升
  const boosted = vectorResults.map(r => ({
    ...r,
    score: r.metadata?.importance === 'critical' 
      ? r.score * 1.5 
      : r.score
  }));
  
  return {
    relevantMemories: boosted,
    hasCriticalMemory: boosted.some(r => r.metadata?.importance === 'critical')
  };
}
```

### 7.4.2 Persona响应策略融合

```typescript
// 融合四层扫描结果，生成最优响应策略
interface PersonaResponseStrategy {
  responseStyle: 'concise' | 'detailed' | 'technical';
  includeContext: boolean;
  triggerMemoryRecall: boolean;
  useSubagent: boolean;
  subagentType?: 'simple' | 'complex';
  priority: 'high' | 'normal' | 'low';
}

async function buildResponseStrategy(
  intent: IntentResult,
  context: ContextResult,
  preferences: PreferenceResult,
  memory: MemoryResult
): Promise<PersonaResponseStrategy> {
  // 决策规则引擎
  const strategy: PersonaResponseStrategy = {
    responseStyle: 'normal',
    includeContext: false,
    triggerMemoryRecall: false,
    useSubagent: false,
    priority: 'normal'
  };
  
  // Intent-based策略
  if (intent.type === 'task_dispatch') {
    strategy.priority = 'high';
    strategy.includeContext = true;
  }
  
  // Memory-based策略
  if (memory.hasCriticalMemory) {
    strategy.triggerMemoryRecall = true;
  }
  
  // Preference-based策略
  if (preferences.defaultResponseStyle === 'concise') {
    strategy.responseStyle = 'concise';
  }
  
  // Context-based策略：复杂任务使用subagent
  if (context.activeTask?.complexity === 'high') {
    strategy.useSubagent = true;
    strategy.subagentType = 'complex';
  }
  
  return strategy;
}
```

## 7.5 实战案例：构建个人知识助手

下面我们构建一个完整的个人知识助手Skill，整合记忆系统的所有组件：

```typescript
// personal-knowledge-assistant/SKILL.md
// ---
// name: personal-knowledge-assistant
// description: 个人知识助手 - 记忆、检索、学习全流程
// ---

# Personal Knowledge Assistant

## 核心能力

1. **即时记忆**：用户告诉的重要信息立即保存
2. **语义检索**：用自然语言搜索历史记忆
3. **知识沉淀**：自动整理用户偏好和决策模式
4. **学习提醒**：周期性回顾促进知识内化

## 核心命令

### 记住 [内容]
将信息保存到长期记忆：
```
记住 我的项目使用 NestJS 框架
```

### 搜索 [查询]
语义搜索记忆库：
```
搜索 上次用户提到的项目技术栈
```

### 我的偏好
查看用户偏好设置：
```
我的偏好
```

### 学习回顾
触发知识回顾流程：
```
学习回顾
```

## 核心实现

### 记忆保存逻辑
\`\`\`typescript
// SKILL.md同目录的src/save.ts
import { readFile, writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

interface MemoryEntry {
  content: string;
  category: 'preference' | 'decision' | 'fact' | 'rule';
  importance: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  createdAt: string;
  source: 'user' | 'self' | 'system';
}

async function saveMemory(entry: MemoryEntry): Promise<void> {
  const memoryPath = join(process.env.OPENCLAW_WORKSPACE!, 'MEMORY.md');
  
  const entryBlock = `## ${entry.createdAt} [${entry.category}] ${entry.tags.join(', ')}
${entry.content}
*来源：${entry.source}*
`;
  
  // 追加到MEMORY.md
  await appendFile(memoryPath, entryBlock + '\n\n', 'utf-8');
}

async function handleRemember(args: { content: string }): Promise<string> {
  const entry: MemoryEntry = {
    content: args.content,
    category: detectCategory(args.content),
    importance: detectImportance(args.content),
    tags: extractTags(args.content),
    createdAt: new Date().toISOString().split('T')[0],
    source: 'user'
  };
  
  await saveMemory(entry);
  
  return `✅ 已记住：${args.content}\n分类：${entry.category} | 重要性：${entry.importance}`;
}

function detectCategory(content: string): MemoryEntry['category'] {
  if (content.includes('偏好') || content.includes('喜欢')) return 'preference';
  if (content.includes('决定') || content.includes('选择')) return 'decision';
  if (content.includes('规则') || content.includes('必须')) return 'rule';
  return 'fact';
}

function detectImportance(content: string): MemoryEntry['importance'] {
  if (content.includes('必须') || content.includes('绝对不能')) return 'critical';
  if (content.includes('重要') || content.includes('关键')) return 'high';
  return 'medium';
}

function extractTags(content: string): string[] {
  const tagPattern = /#(\w+)/g;
  const tags = content.match(tagPattern) || [];
  return tags.map(t => t.slice(1));
}
\`\`\`

### 记忆检索逻辑
\`\`\`typescript
// SKILL.md同目录的src/search.ts
interface SearchResult {
  content: string;
  score: number;
  category: string;
  date: string;
}

async function searchMemory(query: string): Promise<SearchResult[]> {
  // 读取MEMORY.md
  const memoryPath = join(process.env.OPENCLAW_WORKSPACE!, 'MEMORY.md');
  const memoryContent = await readFile(memoryPath, 'utf-8');
  
  // 简单关键词匹配（生产环境应使用向量搜索）
  const lines = memoryContent.split('\n');
  const results: SearchResult[] = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // 计算简单相似度
    const words = lowerQuery.split(' ').filter(w => w.length > 2);
    const matchCount = words.filter(w => lowerLine.includes(w)).length;
    
    if (matchCount > 0) {
      results.push({
        content: line.trim(),
        score: matchCount / words.length,
        category: 'general',
        date: new Date().toISOString().split('T')[0]
      });
    }
  }
  
  // 按分数排序
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function handleSearch(args: { query: string }): Promise<string> {
  const results = await searchMemory(args.query);
  
  if (results.length === 0) {
    return `未找到关于"${args.query}"的记忆。`;
  }
  
  const formatted = results.map((r, i) => 
    \`\${i + 1}. [\${r.category}] \${r.content}\`
  ).join('\n');
  
  return \`找到 \${results.length} 条相关记忆：\n\${formatted}\`;
}
\`\`\`

### Hook集成：自动学习提醒
\`\`\`typescript
// Hook配置：agent后触发学习提醒
// 放在~/.openclaw/hooks/post-agent-run.js

export const postAgentRunHook = async (event) => {
  // 检查是否是新知识
  const recentOutput = event.context.lastOutput;
  
  if (event.action === 'completed' && recentOutput) {
    // 检测是否有值得学习的知识点
    const learningTriggers = [
      '用户偏好',
      '最佳实践',
      '重要决策',
      '教训'
    ];
    
    for (const trigger of learningTriggers) {
      if (recentOutput.includes(trigger)) {
        await appendToDailyLog(\`学习触发：\${trigger}，建议保存\`);
      }
    }
  }
};
\`\`\`

## 7.6 self-improving-agent的记忆机制

self-improving-agent是ClawHub最受欢迎的学习型Skill（413k下载），它的记忆机制值得深入分析：

### 7.6.1 五类学习文件

```
~/.self-improving/
├── ERRORS.md              # 操作失败记录
├── LEARNINGS.md           # 用户纠正和最佳实践
├── FEATURE_REQUESTS.md    # 用户需求功能
└── SIMPLIFY_AND_HARDEN.md # 简化与强化模式
```

**学习信号类型**：

| 信号类型 | 触发条件 | 目标文件 | 推广条件 |
|----------|----------|----------|----------|
| Correction | 用户直接纠正 | ERRORS.md | 重复3次后推广 |
| Preference | 明确偏好表达 | LEARNINGS.md | 立即推广 |
| Reflection | 有意义工作后反思 | LEARNINGS.md | 间隔7天 |
| Proactive Win | 主动行动成功 | patterns.md | 重复5次 |
| Error Pattern | 操作失败 | ERRORS.md | 首次即记录 |

### 7.6.2 推广机制（Hot/Cold分层）

```typescript
// 记忆分为热存储（常用）和冷存储（归档）
interface LearningFile {
  hot: {
    memory.md: string[];      // 活跃记忆（确认的规则）
    corrections.md: string[]; // 待处理纠正
  };
  cold: {
    archive/: string[];        // 归档记忆
  };
}

// 推广决策
function shouldPromote(learning: Learning, criteria: PromotionCriteria): boolean {
  // Correction规则：重复3次才推广
  if (learning.type === 'correction') {
    return learning.occurrenceCount >= 3;
  }
  
  // Preference规则：立即推广
  if (learning.type === 'preference') {
    return true;
  }
  
  // Reflection规则：7天间隔
  if (learning.type === 'reflection') {
    const daysSinceLastPromotion = 
      Date.now() - learning.lastPromotionDate > 7 * 24 * 60 * 60 * 1000;
    return daysSinceLastPromotion;
  }
  
  return false;
}
```

### 7.6.3 Context恢复流程

```typescript
// 会话初始化时的记忆恢复
async function recoverContext(): Promise<void> {
  // 1. 读取热存储
  const hotMemory = await readFile('~/.self-improving/memory.md');
  
  // 2. 读取当前session状态
  const sessionState = await readFile('~/proactivity/session-state.md');
  
  // 3. 重建上下文
  const context = {
    objective: sessionState.currentObjective,
    lastDecision: sessionState.lastDecision,
    blocker: sessionState.blocker,
    nextMove: sessionState.nextMove
  };
  
  // 4. 验证完整性
  if (!context.objective) {
    console.warn('[SelfImproving] Context recovery incomplete, need user input');
  }
}
```

## 本章小结

本章深入解析了OpenClaw的记忆系统：

1. **三层记忆架构**：Working Memory处理即时上下文，Episodic Memory记录历史日志，Semantic Memory提供向量检索能力。

2. **Workspace文件体系**：`SOUL.md`定义人格，`USER.md`存储用户信息，`MEMORY.md`承载长期记忆，`AGENTS.md`规范工作流程。

3. **记忆压缩机制**：当context window接近满时，自动将低优先级内容flush到长期存储，保证关键信息不丢失。

4. **Persona四层扫描**：Intent/Context/Preference/Memory四层扫描机制确保AI做出符合用户期望的响应。

5. **个人知识助手实战**：构建了整合记忆保存、检索、Hook集成的完整Skill示例。

6. **self-improving-agent参考**：分析了顶级学习Skill的记忆组织方式和推广机制。

掌握记忆系统的设计原则后，你能够构建真正"懂你"的AI助手。下一章我们将学习Channel插件集成，了解如何让OpenClaw接入各种即时通讯平台。
