# ClawHub 热门技能插件设计分析 - 第十五轮

**收集时间**: 2026-04-15
**主题**: ClawHub 热门技能设计思路 + 社区实战案例架构

---

## 一、ClawHub 热门技能核心设计模式

### 1. self-improving-agent (3.2k ⭐ | 387k 使用)
**设计思路**: WAL (Write-Audit-Learn) 协议 + 持久化学习环

**核心架构**:
```
~/.openclaw/workspace/
├── AGENTS.md          # 多Agent工作流/委托模式
├── SOUL.md            # 行为模式（性格、偏好）
├── TOOLS.md           # 工具使用技巧（gotchas）
├── memory/            # Agent持续学习存储
│   ├── LEARNINGS.md   # 通用学习（correction/best_practice/knowledge_gap）
│   ├── ERRORS.md      # 错误日志（命令失败/API失败）
│   └── FEATURE_REQUESTS.md  # 功能需求
└── .learnings/        # 本地学习快照（跨会话）
```

**学习信号 → 晋升规则**:
| 场景 | 动作 | 晋升目标 |
|------|------|---------|
| 命令/操作失败 | 记录到 `.learnings/ERRORS.md` | - |
| 用户纠正 | 记录到 LEARNINGS.md (category=correction) | - |
| 发现更好方案 | 记录到 LEARNINGS.md (category=best_practice) | - |
| 工作流改进 | 晋升到 `AGENTS.md` | ✅ |
| 工具技巧 | 晋升到 `TOOLS.md` | ✅ |
| 行为模式 | 晋升到 `SOUL.md` | ✅ |
| 广泛适用学习 | 晋升到 `CLAUDE.md` / `.github/copilot-instructions.md` | ✅ |

**关键创新**: Hook集成机制 (`hooks/openclaw`) 可在OpenClaw生命周期中插入学习回调

---

### 2. ontology (527 ⭐ | 163k 使用)
**设计思路**: typed knowledge graph（类型化知识图谱）+ 可组合技能

**核心概念**:
```
Entity: { id, type, properties, relations, created, updated }
Relation: { from_id, relation_type, to_id, metadata }

Core Types: Person, Project, Task, Event, Document, Commitment
```

**触发 → 动作映射**:
| 触发词 | 动作 |
|--------|------|
| "Remember that..." | 创建/更新实体 |
| "What do I know about X?" | 查询图谱 |
| "Link X to Y" | 创建关系 |
| "Show all tasks for project Z" | 图遍历 |
| "What depends on X?" | 依赖查询 |
| 规划多步骤工作 | 建模为图转换 |

**存储**: append-only JSONL (`memory/ontology/graph.jsonl`)

**集成模式**:
- 与因果推理结合：创建实体时同时记录到 causal action log
- 跨技能通信：Email skill 创建 Commitment → 被其他技能查询

**规划即图转换示例**:
```
Plan: "Schedule team meeting and create follow-up tasks"
1. CREATE Event { title: "Team Sync", attendees: [...] }
2. CREATE Task { depends_on: event, title: "Send follow-up" }
3. RELATE event → has_task → task
```

---

### 3. Self-Improving Proactive Agent (955 ⭐ | 162k 使用)
**设计思路**: 统一架构（self-improving + proactive）双层记忆

**存储结构**:
```
~/self-improving/
├── memory.md          # HOT: 确认的持久规则和偏好
├── corrections.md     # 纠正历史
└── reflections.md     # 反思

~/proactivity/
├── session-state.md   # 当前会话状态
└── memory/
    └── working-buffer.md  # 工作缓冲
```

**核心原则**:
1. 从显式证据学习（explicit evidence）
2. 推送下一个有用动作（proactive push）
3. 信息路由到正确位置
4. 先恢复再询问（recover before ask）
5. 验证实现而非意图
6. 在硬边界内保持主动

**学习信号**: Corrections > Preferences > Reflections > Proactive wins

**晋升/衰减规则**: 记忆分层（memory.md ← corrections.md ← reflections.md）

---

## 二、社区实战案例架构

### 1. multi-agent-team (多Agent专业团队)
**场景**: 独角兽创始人需要多领域AI团队

**架构**:
```
角色分工:
- Milo (Strategy Lead): 战略/协调/OKR跟踪 → Claude Opus + Telegram @milo
- Josh (Business & Growth): 定价/增长/KPI → Claude Sonnet + Telegram @josh
- Marketing Agent: 内容/竞品监控/SEO → Gemini + Telegram @marketing
- Dev Agent: 代码/架构/CI/CD → Claude Opus/Codex + Telegram @dev

协调机制:
- 共享内存: team/GOALS.md, DECISIONS.md, PROJECT_STATUS.md
- 私有上下文: team/agents/{milo,josh,marketing,dev}/
- 单一控制平面: Telegram group，@tag路由
```

**关键设计**: 单一入口（telegram group）+ 专业化 + 并行执行

---

### 2. n8n-workflow-orchestration (n8n工作流编排)
**场景**: OpenClaw将所有外部API交互委托给n8n

**代理模式**:
```
OpenClaw (agent) --webhook call--> n8n Workflow (locked, API keys) --API call--> External Service
                                    (no credentials)
```

**优势**:
- 可观测性：n8n拖拽UI可视化管理
- 安全性：凭证隔离，agent永远不接触API key
- 性能：确定性子任务不走LLM推理

**关键操作流程**:
1. Agent设计workflow → n8n API创建
2. 人工添加credentials并lock workflow
3. Agent仅调用webhook URL

---

### 3. autonomous-project-management (自主项目管理)
**场景**: 复杂项目中subagent并行工作

**STATE.yaml协调模式**:
```yaml
project: website-redesign
tasks:
  - id: homepage-hero
    status: in_progress
    owner: pm-frontend
  - id: api-auth
    status: done
    output: "src/api/auth.ts"
  - id: content-migration
    status: blocked
    blocked_by: api-auth
```

**工作流**:
1. Main agent收任务 → spawn subagent
2. Subagent读STATE.yaml → 找分配任务
3. Subagent自主工作 → 更新STATE.yaml
4. 其他agents轮询STATE.yaml → 拾取未阻塞工作
5. Main agent定期检查 → 调整优先级

**关键洞察**: 去中心化协调（无中心编排开销）+ CEO模式（main session只做战略）

---

### 4. second-brain (第二大脑)
**场景**: 零摩擦记忆捕获 + 可搜索UI

**核心设计**:
- 捕获: 任意平台（Telegram/Discord/iMessage）直接发消息
- 存储: OpenClaw内置memory系统（持久累积）
- 检索: Next.js dashboard + Cmd+K全局搜索

**关键洞察**: 
- capture = 发消息（零摩擦）
- retrieval = 搜索（零组织）
- 随着对话增加价值（累积记忆）

---

## 三、ClawHub技能生态分类（5200+技能）

**VoltAgent/awesome-openclaw-skills** 分类体系:
- ai-and-llms.md
- apple-apps-and-services.md
- browser-and-automation.md
- calendar-and-scheduling.md
- clawdbot-tools.md
- cli-utilities.md
- coding-agents-and-ides.md
- communication.md
- data-and-analytics.md
- devops-and-cloud.md
- gaming.md
- git-and-github.md
- health-and-fitness.md
- image-and-video-generation.md
- ios-and-macos-development.md
- marketing-and-sales.md
- media-and-streaming.md
- moltbook.md
- notes-and-pkm.md
- ...

---

## 四、核心设计模式总结

1. **WAL协议** (Write-Audit-Learn): 所有交互都记录学习，跨会话持久化
2. **类型化知识图谱**: 实体+关系建模，触发词驱动动作
3. **双层记忆**: HOT(热) + COLD(冷) 分层 + 晋升/衰减机制
4. **代理模式**: OpenClaw专注LLM推理，外部API委托给n8n等工具
5. **去中心化协调**: STATE.yaml共享文件，无中心瓶颈
6. **零摩擦捕获**: 任意通信渠道写入，统一检索

---

## 产出文件
- 笔记: `/workspace/pipixia/notes/community-cases/round15-clawhub-skills-community.md`
- 源码分析参考: 前十四轮产出

## 下一步计划
继续深入社区use cases，聚焦：
1. autonomous-game-dev-pipeline（游戏开发自动化）
2. knowledge-base-rAG（知识库RAG实现）
3. 多模型架构（混合使用不同Provider）