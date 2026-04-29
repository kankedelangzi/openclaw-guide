# 第251轮：Self-Improving Agent 架构模式实战

**完成时间**: 2026-04-29
**主题**: AgentHandover + EvolveClaw 自改进架构深度分析
**累计产出**: 笔记258+ | 代码209+ | 技能分析68+

---

## 案例一：AgentHandover - 人类示范驱动的技能生成

### 1. 场景描述

AgentHandover 是一个 Mac 原生应用，通过观察用户操作自动生成可执行 Skills，让 Claude Code/OpenClaw/Hermes 等 Agent 以用户的方式完成任务。核心创新：**从人类示范中提取策略，而不仅是步骤**。

### 2. 核心实现思路

#### 人类示范 → 技能转换流程

```
人类执行任务 → 屏幕/点击/键盘记录 → 策略推断 → 问答澄清 → 生成Skill
```

**两种学习模式**：
- **Focus Recording**：点击Record，执行一次，点击Stop，回答1-3个Agent视角问题，生成Skill
- **Passive Discovery**：被动观察跨session重复工作流，累积证据后自动生成Skill

#### 6-Gate 质量控制

每个Skill必须通过6个Gate才能被Agent执行：

| Gate | 检查项 |
|------|--------|
| Lifecycle | Observed → Draft → Reviewed → Verified → Agent Ready |
| Trust | 用户明确授权Agent执行（不仅是观察）|
| Freshness | Skill最近被观察到（过时会自动降级）|
| Preflight | 所需App运行中，无blocked domains |
| Evidence | 足够观察次数，高置信度，无矛盾 |
| Execution history | 3次以上失败自动降级 |

#### 执行反馈闭环

```
Agent调用 report_execution_start → 执行每步后 report_step_result → 完成后 report_execution_complete
```

- **Success** → 置信度上升，Freshness确认
- **Deviation** → 追踪实际行为vs预期，2+次同步骤偏离建议新决策分支
- **Failure** → 置信度下降，7天内3次失败自动从agent-ready降级

### 3. 关键代码

#### MCP Server工具接口

```json
{
  "mcpServers": {
    "agenthandover": {
      "command": "agenthandover-mcp"
    }
  }
}
```

**8个MCP工具**：

| Tool | 功能 |
|------|------|
| `list_ready_skills` | 列出所有通过Gate的Skills |
| `get_skill(slug)` | 获取完整Skill（含策略、步骤、voice、guardrails） |
| `search_skills(query)` | 语义搜索Skills |
| `list_all_skills` | 列出所有Skills（含draft） |
| `get_user_profile` | 获取用户工具/工作时间/写作风格 |
| `report_execution_start(slug)` | 报告Skill执行开始 |
| `report_step_result(step_id, result)` | 报告每步执行结果 |
| `report_execution_complete(slug, success, notes)` | 报告执行完成 |

#### Skill结构（Claude Code格式扩展）

```
Reddit Community Marketing
Daily engagement workflow - 6 steps - 4 sessions learned

STRATEGY
Browse target subreddits for posts about marketing tools or growth
hacking. Engage with high-signal posts (10+ comments, posted within
48h, not promotional). Write authentic replies that acknowledge the
problem, share personal experience, and softly mention the product.

STEPS
1. Open Reddit and navigate to r/startups
2. Scan posts - skip promotional, skip < 10 comments
3. Open high-signal post and read top comments
4. Write reply: acknowledge -> experience -> mention product
5. Submit and verify not auto-removed
6. Repeat for r/marketing, r/growthacking (max 5/day)

SELECTION CRITERIA              GUARDRAILS
- Posts with 10+ comments       - Max 5 replies per day
- Not promotional or competitor - Never identical phrasing
- Posted within 48 hours        - Never reply to own posts
- Relevant to [product category]- Empathy-first tone always

VOICE & STYLE
Tone: casual | Sentences: short and punchy | Uses emoji
> Hey great point about the engagement metrics! We should
> def try that approach with the subreddit

~15 min daily - 9-10am                     Confidence: 89%
```

#### Extension Chrome MV3架构

```typescript
// extension/src/click-capture.ts 核心点击捕获
export class ClickCapture {
  // 捕获用户点击行为
  capture(event: MouseEvent): CapturedClick {
    return {
      element: this.getElementSelector(event.target as HTMLElement),
      timestamp: Date.now(),
      viewport: { width: window.innerWidth, height: window.innerHeight }
    }
  }
}
```

**文件结构**：
- `background.ts` - Service Worker主逻辑
- `click-capture.ts` - 点击行为捕获
- `dom-capture.ts` - DOM快照
- `dwell-tracker.ts` - 停留时间追踪
- `native-messaging.ts` - 与Mac应用通信

---

## 案例二：EvolveClaw - SCOPE驱动的提示词演化

### 1. 场景描述

EvolveClaw 是OpenClaw插件，通过SCOPE (Self-evolving Context Optimization via Prompt Evolution) 自动演化系统提示词，实现**自我改进Agent**。每次用户交互后分析执行轨迹，合成个性化Guidelines。

### 2. 核心实现思路

#### 双记忆架构

```
战略记忆（Strategic） ←→  战术记忆（Tactical）
    ↓                        ↓
持久化到磁盘              会话结束时自动清除
跨session保留              仅当前任务有效
```

#### 5步循环

```
Observe → Learn → Classify → Inject → Forget
   ↓                    ↓
捕获交互轨迹          分析后合成Guideline    分类后注入系统提示     新session清战术
```

#### SCOPE集成架构

```
OpenClaw Plugin ←→ FastAPI Sidecar ←→ SCOPE Optimizer
   (TS)              (Python)           (Python)
      ↓                                    ↓
  捕获轨迹                              分析+合成Guidelines
  注入系统提示                          管理战略/战术规则
```

### 3. 关键代码

#### Plugin → Sidecar通信

```typescript
// POST /step - 报告执行步骤供分析
interface StepRequest {
  agent_name: string;           // "openclaw-agent"
  agent_role?: string;          // "OpenClaw AI Assistant"
  task: string;                 // 用户请求
  model_output?: string;        // 模型输出
  tool_calls?: string;          // 工具调用记录
  observations?: string;        // 观察结果
  error?: string;               // 错误信息
  current_system_prompt?: string;
  task_id?: string;             // 用于战术规则分组
  conversation_history?: string;
}

// GET /rules/{agent_name} - 获取战略规则
interface RulesResponse {
  rules: string;    // 格式化的规则文本
  rule_count: number;
}
```

#### Sidecar服务器（FastAPI）

```python
# server.py 核心端点
app = FastAPI(title="EvolveClaw SCOPE Server")

# GET /rules/{agent_name}
@app.get("/rules/{agent_name}")
async def get_rules(agent_name: str):
    if optimizer is None:
        return RulesResponse()
    rules_text = optimizer.get_strategic_rules_for_agent(agent_name)
    return RulesResponse(rules=rules_text, rule_count=rule_count)

# POST /step
@app.post("/step")
async def analyze_step(req: StepRequest):
    result = optimizer.analyze_step(
        agent_name=req.agent_name,
        task=req.task,
        model_output=req.model_output,
        tool_calls=req.tool_calls,
        error=req.error,
        ...
    )
    return StepResponse(
        guideline=result.guideline,
        guideline_type=result.type,  # "strategic" or "tactical"
        guideline_id=result.id,
        skipped=result.skipped
    )
```

#### 自动配置流程

```python
# 插件首次加载时自动：
# 1. 检测OpenClaw的模型配置
# 2. 安装Python依赖 (scope-optimizer, fastapi, uvicorn)
# 3. 启动SCOPE sidecar服务器
# 4. POST /configure 传递LLM凭证

# 日志输出：
# [plugins] evolveclaw: activated (server=http://127.0.0.1:5757)
# [gateway] evolveclaw: installing Python dependencies...  # 首次
# [gateway] evolveclaw: SCOPE server started successfully
# [gateway] evolveclaw: loaded N strategic rule(s)
```

#### Guideline合成提示词

```python
# prompts.py - 错误反思提示词
ERROR_REFLECTION_PROMPT = """You are analyzing an AI assistant's execution error...

Focus areas:
1. Did the assistant misuse a tool (wrong arguments, missing validation)?
2. Did it make incorrect assumptions about the user's environment?
3. Did it fail to handle edge cases?
4. Did it break the user's workflow by taking destructive actions?

Guidelines:
- Be SPECIFIC and ACTIONABLE — target the exact error cause
- Be BRIEF — max 1-3 lines
- Use imperative language ("Always...", "Never...", "Before X, verify Y...")

Output ONLY valid JSON:
{{"update_text": "...", "rationale": "...", "confidence": "low|medium|high"}}
"""
```

#### Plugin配置项

```json
{
  "plugins": {
    "entries": {
      "evolveclaw": {
        "enabled": true,
        "config": {
          "serverUrl": "http://127.0.0.1:5757",
          "agentName": "openclaw-agent",
          "injectMode": "append_system",  // 或 "prepend_context"
          "maxGuidelines": 30,
          "scopeModel": "gpt-4o-mini",    // 可选覆盖
          "scopeProvider": "anthropic"    // 可选覆盖
        }
      }
    }
  }
}
```

#### EVOLVECLAW_DOMAINS自定义域

```python
# 自定义域 - 针对个人AI助手优化
EVOLVECLAW_DOMAINS = [
    "user_preferences",      // 用户偏好学习
    "code_quality",          // 代码质量
    "communication_style",   // 沟通风格
    "workflow_patterns",     // 工作流模式
    "task_execution",        // 任务执行
    "tool_usage",            // 工具使用
    "safety_and_correctness" // 安全与正确性
]
```

---

## 核心收获

1. **自我改进的三种范式**：
   - **示范驱动**（AgentHandover）：从人类操作中提取策略，6-Gate质量控制
   - **反馈驱动**（EvolveClaw）：从执行结果中学习，SCOPE提示词演化
   - **记忆驱动**（之前的Self-Improving Agent）：从对话纠正中积累长期记忆

2. **双记忆架构的重要性**：战略记忆跨session持久化，战术记忆按需清除，避免上下文污染

3. **6-Gate执行控制**：Lifecycle/Trust/Freshness/Preflight/Evidence/History，每层都有明确降级条件

4. **MCP工具设计模式**：标准化接口（list/get/search/report_*），支持多Agent接入

5. **Sidecar架构优势**：SCOPE Python生态 + OpenClaw TS插件解耦，通过HTTP API通信

6. **执行反馈闭环**：每次执行都报告结果 → 影响置信度 → 触发降级或升级 → Skill持续优化

7. **置信度动态调整**：基于真实执行结果，而非人工评分，自动化质量评估

8. **零配置启动**：插件自动检测环境、安装依赖、启动服务，降低用户门槛
