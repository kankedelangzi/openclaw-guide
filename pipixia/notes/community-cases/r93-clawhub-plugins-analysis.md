# 第93轮 ClawHub Plugins 深度分析
皮皮虾 · 2026-04-21

## 核心收获

1. **ClawVitals 企业级安全扫描插件** - 集成OpenClaw CLI命令（security audit/health/update status）到统一评分体系，Critical/-25、High/-10、Medium/-5、Low/-2计分，100分满分。配套clawvitals.io dashboard实现历史追踪。

2. **Mem0 语义记忆层** - 为Clawdbot提供动态记忆存储，区分"显式记忆"（remember this）和"隐式偏好学习"。配置灵活（embedder/llm/vectorStore可自定义），与MEMORY.md形成结构化+动态记忆互补。

3. **Feishu Bot Chat 多Bot协作** - 飞书Bot间通过原生消息投递实现协作，核心是三个Hook（before_prompt_build/message_sending/inbound_claim）。内置5个a2a协作Skill（任务分解/结果汇总/中断处理/状态查询/模式切换）。

4. **episodic-claw 情景记忆插件** - 基于人类情景记忆理论的双路径架构（Tool-first Recall）。4个记忆工具（ep-recall/ep-save/ep-expand/ep-anchor），配置项丰富（reserveTokens/dedupWindow/maxBufferChars等），支持日语/中文本地化。

5. **Emperor Claw OS 控制平面** - 将OpenClaw作为AI workforce的控制平面和持久化checkpoint层。Core Principles + Doctrine References文档体系，支持JavaScript/Python双桥接。

## 产出文件
- 笔记：/workspace/pipixia/notes/community-cases/r93-clawhub-plugins-analysis.md
- 代码：/workspace/pipixia/code/community-cases/r93-plugin-examples.js
- 截图：/workspace/pipixia/notes/community-cases/r93-clawhub-plugins-screenshot.png

## 下一步
继续分析ClawHub其他热门Plugins（Clawwatch/Gralkor Memory/Lycus等），结合Skills页面热门技能进行联合分析。

## 详细分析

---

### 1. ClawVitals v1.4.8（安全健康检查）

**场景描述**：企业级OpenClaw部署需要定期安全审计和健康检查，ClawVitals提供标准化评分体系。

**核心实现思路**：
- 调用OpenClaw CLI命令收集数据：clawvitals、security audit、health、update status、version
- 五级严重程度计分：Critical(-25)、High(-10)、Medium(-5)、Low(-2)、Info(0)
- 格式化输出带emoji的评分卡

**关键代码片段**：
// Step 1: Collect data
openclaw security audit --json
openclaw health --json
openclaw --version
openclaw update status --json
node --version

// Step 2-4: Scoring
| Severity | Deduction |
| Critical | -25      |
| High     | -10      |
| Medium   | -5       |
| Low      | -2       |
| Info     | 0        |

// Step 5: Output format
ClawVitals Skill v1.4.3 🔎
OpenClaw {version}
{band emoji} {band} — {score}/100

---

### 2. Mem0 Plugin v1.0.0（智能记忆层）

**场景描述**：需要在对话中持续学习用户偏好、模式和上下文，提供语义搜索能力。

**核心实现思路**：
- Search Before Responding：每次响应前搜索相关记忆
- Store After Interactions：交互后自动存储重要信息
- 与MEMORY.md互补：结构化事实 vs 动态偏好学习

**关键代码片段**：
// Search memories
node scripts/mem0-search.js "user preferences" --limit=3

// Add memory
node scripts/mem0-add.js "Abhay prefers concise updates"

// With messages
node scripts/mem0-add.js --messages='[{"role":"user","content":"I like brief updates"}]'

// Configuration
{
  embedder: "openai/text-embedding-3-small",
  llm: "openai/gpt-4o-mini",
  vectorStore: "memory"
}

// JSON output
JSON_OUTPUT=1 node scripts/mem0-search.js "query"

---

### 3. Feishu Bot Chat v0.1.7（飞书Bot协作）

**场景描述**：飞书群聊中多个Bot需要协作，通过原生消息投递实现Bot间通信。

**核心实现思路**：
- 三个核心Hook：
  - before_prompt_build：注入可用Bot列表和协作规则
  - message_sending：将@botName替换为飞书<at>标签
  - inbound_claim：过滤消息、检测原生投递状态
- 自动发现群内Bot
- 内置5个a2a协作Skill

**关键配置**：
{
  "plugins": {
    "entries": {
      "feishu-bot-chat": {
        "enabled": true,
        "config": { ... }
      }
    }
  }
}

**内置Skills**：
- a2a-collaboration-guide：协作规则速查
- a2a-task-decompose：任务分解与分配
- a2a-result-merge：多Bot结果汇总
- a2a-interrupt：协作中断处理
- a2a-status-check：状态查询
- a2a-mode-switch：模式切换

---

### 4. episodic-claw v0.4.22（情景记忆）

**场景描述**：AI需要像人类一样记住经历的事件、时间、地点、情感，超越简单Key-Value存储。

**核心实现思路**：
- v0.4.x核心：Tool-first Recall（双路径架构）
- 四步工作流：编码→存储→检索→重激活
- Surprise Score机制：基于惊讶度的事件重要性判定
- "Indestructible Narrative Queue"：保证叙事完整性

**四个记忆工具**：
| Tool | Action | Description |
| ep-recall | Manual search | 主动回忆指定主题的记忆 |
| ep-save | Manual save | 强制保存重要信息 |
| ep-expand | Lookup & expand | 展开详细记忆 |
| ep-anchor | Proactive anchor | 会话锚点预写入 |

**关键配置项**：
- reserveTokens (2048)：AI系统提示保留token数
- dedupWindow (5)：去重时间窗口
- maxBufferChars (7200)：实时路径上限
- maxPoolChars (15000)：叙事池触发阈值
- segmentationLambda (2.0)：主题敏感度
- recallSemanticFloor：语义检索下限
- recallReInjectionCooldownTurns (24)：重复注入冷却

---

### 5. Emperor Claw OS / control-plane v1.14.15（控制平面）

**场景描述**：将OpenClaw作为AI workforce的操作系统，提供控制平面和持久化checkpoint。

**核心原则**：
- OpenClaw作为控制平面
- 持久化checkpoint层
- AI workforce编排

**技术架构**：
- JavaScript Bridge (Node.js)
- Python Bridge (Asyncio)
- 完整的Doctrine References文档体系

---

## 趋势观察

1. **企业级插件增多**：ClawVitals、Mem0、TencentDB Agent Memory等面向企业部署
2. **本地化深化**：Feishu Bot Chat（飞书）、episodic-claw支持日语/中文
3. **记忆系统进化**：从简单存储到情景记忆、语义记忆、多层记忆架构
4. **控制平面概念**：Emperor Claw OS将OpenClaw定位为AI OS
5. **安全成为刚需**：Skill Vetter、ClawVitals等安全相关插件下载量高
