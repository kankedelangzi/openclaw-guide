# 代码示例：第92轮案例

## 案例1：Skill Vetter安全检查流程

### 场景描述
在安装任何Skill前进行四步安全审查，包括源码检查、权限评估、风险分级。

### 核心实现思路
```
安装前审查流程：
1. 源码检查 - 查找curl/wget/eval/exec等危险命令
2. 权限分析 - 文件读写/网络访问/命令执行范围
3. 风险定级 - LOW/MEDIUM/HIGH/EXTREME四级
4. 操作建议 - 基础审查/完整审查/人工审批/拒绝安装
```

### 关键代码片段

```markdown
# RED FLAGS检查清单
🚨 REJECT IMMEDIATELY IF YOU SEE:
• curl/wget to unknown URLs
• Sends data to external servers
• Requests credentials/tokens/API keys
• Reads ~/.ssh, ~/.aws, ~/.config without clear reason
• Accesses MEMORY.md, USER.md, SOUL.md, IDENTITY.md
• Uses base64 decode on anything
• Uses eval() or exec() with external input
• Modifies system files outside workspace

# 风险分级表
🟢 LOW    | Notes, weather, formatting    | Basic review, install OK
🟡 MEDIUM | File ops, browser, APIs        | Full code review required
🔴 HIGH   | Credentials, trading, system   | Human approval required
⛔ EXTREME| Security configs, root access  | Do NOT install

# 输出格式
SKILL VETTING REPORT
═══════════════════════════════════════
Skill: [name]
Source: [ClawdHub / GitHub / other]
RISK LEVEL: [🟢 LOW / 🟡 MEDIUM / 🔴 HIGH / ⛔ EXTREME]
VERDICT: [✅ SAFE TO INSTALL / ⚠️ INSTALL WITH CAUTION / ❌ DO NOT INSTALL]
```

## 案例2：Agent Autonomy Kit自主运行

### 场景描述
让AI agent从被动响应转为主动工作，通过任务队列+心跳机制实现持续运行。

### 核心实现思路
```
QUEUE.md四状态任务管理：
- Ready: 待处理任务
- In Progress: 执行中
- Blocked: 等待条件
- Done: 完成

心跳机制：
HEARTBEAT.md → 拉取队列任务 → 执行 → 更新状态
```

### 关键代码片段

```markdown
# Quick Start
Create tasks/QUEUE.md with Ready/In Progress/Blocked/Done sections
Update HEARTBEAT.md to pull from queue and do work
Set up cron jobs for overnight work and daily reports
Watch work happen without prompting

# Key Concepts
Task Queue — Always have work ready
Proactive Heartbeat — Do work, don't just check
Continuous Operation — Work until limits hit
```

## 案例3：Proactive Agent WAL协议

### 场景描述
通过Write-Ahead Logging确保关键信息在响应前被持久化，避免上下文丢失导致的信息断层。

### 核心实现思路
```
触发条件（每条消息扫描）：
✏️ Corrections — "It's X, not Y" / "Actually..."
📍 Proper nouns — Names, places, companies, products
🎨 Preferences — Colors, styles, approaches
📋 Decisions — "Let's do X" / "Go with Y"
📝 Draft changes — Edits to something we're working on

执行顺序：STOP → WRITE SESSION-STATE.md → THEN respond
```

### 关键代码片段

```markdown
# Example
Human says: "Use the blue theme, not red"

WRONG: "Got it, blue!" 
RIGHT: Write to SESSION-STATE.md: "Theme: blue (not red)" → THEN respond

# Working Buffer危险区协议
At 60% context: CLEAR the old buffer, start fresh
Every message after 60%: Append both human's message AND your response summary
After compaction: Read the buffer FIRST, extract important context

# Compaction Recovery步骤
1. Read memory/working-buffer.md — raw danger-zone exchanges
2. Read SESSION-STATE.md — active task state  
3. Read today's + yesterday's daily notes
4. If still missing context, search all sources
5. Extract & Clear: Pull important context from buffer into SESSION-STATE.md
6. Present: "Recovered from working buffer. Last task was X. Continue?"
```

## 案例4：Autonomous vs Prompted Crons

### 场景描述
区分systemEvent和agentTurn两种cron模式，避免任务空转。

### 核心实现思路
```
systemEvent → 主会话 → 需要agent注意力 → 交互式任务
agentTurn → 隔离会话 → 自主执行 → 后台维护任务
```

### 关键代码片段

```markdown
# Wrong (systemEvent - 会空转)
{
  "sessionTarget": "main",
  "payload": { "kind": "systemEvent", "text": "Check if X needs updating..." }
}

# Right (agentTurn - 自主执行)  
{
  "sessionTarget": "isolated",
  "payload": { "kind": "agentTurn", "message": "AUTONOMOUS: Read SESSION-STATE.md..." }
}

# Verify Implementation, Not Intent
Text changes ≠ behavior changes

# Tool Migration Checklist
1. Cron jobs — Update all prompts mentioning old tool
2. Scripts — Check scripts/ directory
3. Docs — TOOLS.md, HEARTBEAT.md, AGENTS.md
4. Skills — Any SKILL.md files referencing it
5. Templates — Onboarding templates, example configs
```

## 案例5：Agents Orchestrator多Agent管道

### 场景描述
自主管道管理器协调多Agent完成完整开发流程，PM→架构师→开发↔QA循环→集成。

### 核心实现思路
```
Phase 1: Project Analysis & Planning (spawn project-manager-senior)
Phase 2: Technical Architecture (spawn ArchitectUX)
Phase 3: Development-QA Continuous Loop (Dev agent ↔ EvidenceQA loop per task)
Phase 4: Final Integration & Validation (spawn testing-reality-checker)

关键规则：
- No shortcuts: Every task must pass QA validation
- Retry limits: Maximum 3 attempts per task before escalation
- Automatic retry logic: Failed tasks loop back to dev with specific feedback
```

### 关键代码片段

```markdown
# 启动命令
"Please spawn an agents-orchestrator to execute complete development pipeline 
for project-specs/[project]-setup.md"

# 状态报告
Track and report: current phase, task completion %, QA status, retry counts, blockers
```