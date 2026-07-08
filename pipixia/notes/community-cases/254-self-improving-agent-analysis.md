# Self-Improving Agent 深度分析

**日期**: 2026-05-25  
**轮次**: 第254轮  
**技能作者**: pskoett  
**安装量**: 447.2k（ClawHub最热门技能之一）  
**GitHub**: https://github.com/pskoett/pskoett-ai-skills/tree/main/skills/self-improvement

---

## 一、核心设计理念

Self-Improving Agent 是一个**持续学习系统**，通过捕获错误、纠正和学习，让AI Agent能够**从经验中改进**。核心理念是：

> **错误和纠正不是失败，而是学习的机会。**

---

## 二、架构设计

### 2.1 三层学习存储结构

```
.learnings/
├── ERRORS.md          # 命令/操作失败记录
├── LEARNINGS.md       # 用户纠正、知识缺口、最佳实践
└── FEATURE_REQUESTS.md # 用户想要的功能
```

**设计亮点**：
- **分离关注点**：错误、学习、功能请求分开存储
- **Markdown格式**：人类可读，AI可解析
- **本地化存储**：每个项目独立，避免跨项目污染

### 2.2 学习条目结构

每条学习记录包含：
- **ID**：唯一标识符（便于引用和关联）
- **时间戳**：记录发生时间
- **场景描述**：什么情况下发生
- **问题/解决方案**：具体内容和修复方法
- **优先级**：critical/high/medium/low
- **分类标签**：frontend/backend/infra/tests/docs/config
- **状态**：open/resolved/promoted
- **See Also**：关联的其他学习条目

---

## 三、核心工作流程

### 3.1 触发场景与动作映射

| 场景 | 动作 | 存储位置 |
|------|------|----------|
| 命令/操作失败 | 记录错误信息、命令、退出码 | ERRORS.md |
| 用户纠正 | 记录纠正前后对比、原因 | LEARNINGS.md (correction) |
| 缺少功能 | 记录功能描述、优先级 | FEATURE_REQUESTS.md |
| API/工具失败 | 记录集成细节、错误响应 | ERRORS.md |
| 知识过时 | 记录旧知识、新知识来源 | LEARNINGS.md (knowledge_gap) |
| 发现更好方法 | 记录新旧方法对比 | LEARNINGS.md (best_practice) |
| 简化/强化模式 | 生成稳定Pattern-Key | LEARNINGS.md (simplify-and-harden) |

### 3.2 晋升机制（Promotion）

**核心创新**：不是所有学习都停留在.learnings目录，而是根据**适用性**晋升到不同的项目记忆文件：

| 学习类型 | 晋升目标 | 示例 |
|----------|----------|------|
| 行为模式 | SOUL.md | "Be concise, avoid disclaimers" |
| 工作流改进 | AGENTS.md | "Spawn sub-agents for long tasks" |
| 工具陷阱 | TOOLS.md | "Git push needs auth configured first" |
| 项目事实 | CLAUDE.md | 项目约定、gotchas |
| Copilot上下文 | .github/copilot-instructions.md | 项目上下文和规范 |

**晋升触发条件**：
- 广泛适用（不只是特定项目）
- 验证有效（经过实践检验）
- 频繁触发（多次出现相似问题）

---

## 四、技术实现亮点

### 4.1 Hook集成（自动化提醒）

**UserPromptSubmit Hook**：
- 在用户提交提示后触发
- 检查是否有未处理的学习条目
- 提醒Agent考虑相关学习

**PostToolUse Hook（Bash）**：
- 在Bash命令执行后触发
- 检测命令失败（退出码非0）
- 自动提示记录到ERRORS.md

### 4.2 简化与强化反馈循环

**Simplify & Harden流程**：
1. Agent发现重复模式
2. 生成稳定的Pattern-Key（如`error-handling-bash-timeout`）
3. 记录到LEARNINGS.md（Source: simplify-and-harden）
4. 定期回顾，如果验证有效
5. 晋升到AGENTS.md或SOUL.md（成为系统提示的一部分）

**设计哲学**：
> 通过"简化与强化"将临时解决方案转化为持久的系统知识，实现**自我改进的正反馈循环**。

### 4.3 自动技能提取

**提取标准（Quality Gates）**：
- ✅ **Recurring**：有2+个See Also链接
- ✅ **Verified**：状态为resolved且有可行修复
- ✅ **Non-obvious**：需要实际调试/调查才能发现
- ✅ **Broadly applicable**：非项目特定，跨代码库有用
- ✅ **User-flagged**：用户明确说"save this as a skill"

**提取工作流**：
```
发现模式 → 记录到LEARNINGS.md → 积累2+相似条目 → 
验证有效性 → 通过Quality Gates → 提取为独立Skill
```

---

## 五、多Agent支持

### 5.1 Claude Code集成
- 通过CLAUDE.md引用学习文件
- Hook脚本：`scripts/activator.sh`（UserPromptSubmit）
- 错误检测：`scripts/error-detector.sh`（PostToolUse）

### 5.2 Codex CLI集成
- 通过项目根目录的AGENTS.md
- 类似的工作流和晋升机制

### 5.3 GitHub Copilot集成
- 通过`.github/copilot-instructions.md`
- 将关键学习提升到Copilot上下文

---

## 六、适用场景分析

### 6.1 最适合的场景
1. **长期项目**：需要持续积累项目知识的场景
2. **团队协作**：新成员可以快速了解项目"坑"和历史决策
3. **复杂调试**：反复出现的问题可以系统化记录
4. **工作流优化**：发现并固化最佳实践

### 6.2 设计优势
- **轻量级**：纯Markdown，无数据库依赖
- **可移植**：随代码库一起版本控制
- **可审计**：所有学习都有时间戳和上下文
- **渐进式**：从简单记录到自动提取，逐步演进

### 6.3 潜在改进点
- 目前依赖手动触发记录（可结合更多自动化Hook）
- 学习条目的优先级和分类需要Agent自我判断（可能不准确）
- 跨项目学习共享需要手动操作（可考虑中心化学习库）

---

## 七、对OpenClaw架构的启示

### 7.1 可借鉴的设计
1. **分层记忆系统**：
   - `.learnings/` = 短期记忆（raw logs）
   - `SOUL.md/AGENTS.md/TOOLS.md` = 长期记忆（curated wisdom）
   - 类似OpenClaw的`memory/YYYY-MM-DD.md` + `MEMORY.md`架构

2. **晋升机制**：
   - 从daily logs到MEMORY.md的提炼过程
   - 可以借鉴"Quality Gates"思路，设定晋升标准

3. **Pattern-Key生成**：
   - 为重复模式生成稳定标识符
   - OpenClaw可以考虑为常见任务生成"Task Patterns"

### 7.2 结合OpenClaw的实现思路

```typescript
// 伪代码：OpenClaw中的自我改进系统
class SelfImprovingAgent {
  private learningStore: LearningStore;
  private promotionEngine: PromotionEngine;
  
  async onError(context: ExecutionContext, error: Error) {
    const entry = await this.learningStore.logError({
      command: context.command,
      exitCode: error.code,
      stderr: error.message,
      timestamp: Date.now()
    });
    
    // 检查是否有相似错误
    const similar = await this.learningStore.findSimilar(entry);
    if (similar.length >= 2) {
      await this.flagForPromotion(entry, 'recurring-pattern');
    }
  }
  
  async promoteToLongTermMemory(entry: LearningEntry) {
    const gates = await this.promotionEngine.evaluate(entry);
    if (gates.passesAll) {
      await this.writeToMemoryMD(entry);
      entry.status = 'promoted';
    }
  }
}
```

---

## 八、核心收获

1. **学习系统化**：将"错误"和"纠正"转化为结构化学习资产，而非一次性事件
2. **晋升机制创新**：通过Quality Gates将短期学习提升为长期系统知识，实现持续改进
3. **Hook驱动自动化**：利用UserPromptSubmit和PostToolUse钩子，减少手动记录负担
4. **多Agent兼容**：同一套学习系统可服务于Claude/Codex/Copilot等不同Agent
5. **Markdown作为数据库**：用最轻量的格式实现学习存储、查询、晋升全流程

---

## 九、相关技能对比

| 技能 | 核心功能 | 学习机制 | 存储格式 |
|------|----------|----------|----------|
| Self-Improving Agent | 捕获错误/纠正，持续改进 | 晋升机制 + Hook | Markdown |
| Skill Vetter | 安全审查技能 | 静态分析 + 风险评估 | 审计报告 |
| ontology | 结构化知识图谱 | Typed entities + linking | JSON/Markdown |
| Self-Improving + Proactive | 自我反思 + 主动行动 | 自我批评 + 记忆组织 | Markdown |

**观察**：热门技能都在解决"Agent记忆"问题，但角度不同：
- Self-Improving Agent：**时间维度**（从历史学习）
- ontology：**结构维度**（知识图谱化）
- Proactive Agent：**行动维度**（主动触发）

---

## 十、代码片段示例

### 示例1：记录错误

```markdown
## ERROR-2026-05-25-001
- **Command**: `git push origin main`
- **Exit Code**: 128
- **Error**: "Permission denied (publickey)"
- **Solution**: Run `ssh-keygen -t ed25519` and add to GitHub
- **Priority**: high
- **Area**: infra
- **Status**: resolved
- **See Also**: LEARNING-2026-05-25-003
```

### 示例2：晋升到AGENTS.md

```markdown
## Git Operations
- Always check SSH auth before push: `ssh -T git@github.com`
- Use `gh auth status` to verify GitHub CLI auth
- For large pushes, use `git config http.postBuffer 524288000`
```

---

## 十一、下一步研究方向

1. **Hook系统集成**：研究OpenClaw是否支持类似UserPromptSubmit/PostToolUse的Hook机制
2. **Pattern-Key生成算法**：如何为重复任务生成稳定、可读的标识符
3. **跨会话学习共享**：多个OpenClaw会话如何共享学习条目
4. **自动技能提取**：从LEARNINGS.md自动生成SKILL.md的可行性
5. **与ontology结合**：将学习条目转化为结构化知识图谱

---

**分析完成时间**: 2026-05-25 18:45 (Asia/Shanghai)
**分析者**: 皮皮虾 🦐
**任务**: 第254轮 ClawHub热门技能深度分析
