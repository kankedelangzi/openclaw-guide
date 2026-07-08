# 模块4：Skills系统

> 🦐 皮皮虾OpenClaw源码深读 | 学习时间：2026-04-08
> 目标：成为能够重写OpenClaw的大师

---

## 一、核心概念快速回顾

### 1.1 什么是Skills系统？

Skills是OpenClaw的**模块化技能扩展系统**，用于扩展AI Agent的能力。每个Skill就像一个"专业领域的 onboarding guide"，提供：
- 专业化的工作流程
- 工具集成说明
- 领域专业知识
- 打包的资源（脚本、参考文档）

### 1.2 Skills vs Tools

| 维度 | Skills | Tools |
|------|--------|-------|
| 本质 | 知识/流程指南 | 可执行函数 |
| 触发 | 通过描述匹配 | 显式调用 |
| 上下文 | 按需加载 | 始终可用 |
| 用途 | 指导AI行为 | 执行具体操作 |

---

## 二、Skill结构解剖

### 2.1 目录结构

```
skill-name/
├── SKILL.md (必需)
│   ├── YAML frontmatter (必需)
│   │   ├── name: 技能名称
│   │   └── description: 触发描述
│   └── Markdown instructions (必需)
├── scripts/ (可选)
├── references/ (可选)
└── assets/ (可选)
```

### 2.2 Frontmatter元数据

```yaml
---
name: summarize
description: Summarize or extract text from URLs, podcasts, and local files.
metadata:
  openclaw:
    emoji: "🧾"
    requires:
      bins: ["summarize"]
    install:
      - id: "brew"
        kind: "brew"
        formula: "steipete/tap/summarize"
        bins: ["summarize"]
---
```

### 2.3 OpenClaw扩展元数据

```typescript
type OpenClawSkillMetadata = {
  always?: boolean;           // 是否总是加载
  skillKey?: string;          // 技能唯一标识
  primaryEnv?: string;        // 主要环境变量
  emoji?: string;             // 表情符号
  homepage?: string;         // 技能主页
  os?: string[];              // 支持的操作系统
  requires?: {
    bins?: string[];          // 必需的二进制文件
    anyBins?: string[];       // 任一必需的二进制文件
    env?: string[];           // 必需的环境变量
    config?: string[];        // 必需的配置文件
  };
  install?: SkillInstallSpec[]; // 安装规范
};

type SkillInstallSpec = {
  id?: string;
  kind: "brew" | "node" | "go" | "uv" | "download";
  label?: string;
  bins?: string[];
  os?: string[];
  formula?: string;           // brew formula
  package?: string;           // npm package
  module?: string;            // go module
  url?: string;
  archive?: string;
  extract?: boolean;
  stripComponents?: number;
  targetDir?: string;
};
```

---

## 三、Skills加载机制

### 3.1 Skills来源（优先级从低到高）

```typescript
type SkillsLoadConfig = {
  extraDirs?: string[];       // 额外扫描目录（最低优先级）
  watch?: boolean;            // 监视变化并刷新snapshot
  watchDebounceMs?: number;   // 监视防抖ms
};
```

**加载优先级：**
1. 打包Skills（openclaw内置）
2. 托管Skills（SkillHub安装）
3. Workspace Skills（~/.openclaw/workspace/skills/）
4. ExtraDirs（自定义额外目录）

### 3.2 Skills限制配置

```typescript
type SkillsLimitsConfig = {
  maxCandidatesPerRoot?: number;    // 每个root最大子目录数
  maxSkillsLoadedPerSource?: number; // 每个source最大加载数
  maxSkillsInPrompt?: number;       // 模型可见最大技能数
  maxSkillsPromptChars?: number;   // 技能提示最大字符数
  maxSkillFileBytes?: number;       // SKILL.md最大字节数
};
```

### 3.3 Skills过滤机制

```typescript
// Agent级别技能过滤
type AgentConfig = {
  skills?: string[];  // 技能白名单
};

// 全局打包技能过滤
type SkillsConfig = {
  allowBundled?: string[];  // 打包技能白名单
};
```

---

## 四、渐进式披露设计

### 4.1 三层加载机制

```
┌─────────────────────────────────────────────┐
│ Layer 1: Metadata (name + description)      │
│ ~100 words, 始终在上下文中                   │
├─────────────────────────────────────────────┤
│ Layer 2: SKILL.md body                      │
│ <500 lines, 技能触发后加载                  │
├─────────────────────────────────────────────┤
│ Layer 3: Bundled resources                  │
│ scripts/, references/, assets/              │
│ 按需加载，不占用上下文                      │
└─────────────────────────────────────────────┘
```

### 4.2 引用文件模式

**Pattern 1: 高阶指南 + 引用**

```markdown
# PDF Processing

## Quick start
[code example]

## Advanced features
- **Form filling**: See [FORMS.md](references/FORMS.md)
- **API reference**: See [REFERENCE.md](references/REFERENCE.md)
```

**Pattern 2: 领域组织**

```
bigquery-skill/
├── SKILL.md
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

**Pattern 3: 条件详情**

```markdown
# DOCX Processing

## Creating documents
Use docx-js. See [DOCX-JS.md](references/DOCX-JS.md).

**For tracked changes**: See [REDLINING.md](references/REDLINING.md)
```

---

## 五、Skill调用策略

### 5.1 调用策略配置

```typescript
type SkillInvocationPolicy = {
  userInvocable: boolean;           // 用户可直接调用
  disableModelInvocation: boolean;  // 禁止模型调用
};

type SkillCommandDispatchSpec = {
  kind: "tool";
  toolName: string;                 // 工具名称
  argMode?: "raw";                  // raw=不解析参数
};
```

### 5.2 命令规格

```typescript
type SkillCommandSpec = {
  name: string;                     // 命令名称
  skillName: string;               // 所属技能
  description: string;             // 命令描述
  dispatch?: SkillCommandDispatchSpec;
  promptTemplate?: string;        // 提示模板
  sourceFilePath?: string;         // 源文件路径
};
```

---

## 六、环境变量覆盖

### 6.1 Skill环境注入

```typescript
// 应用技能环境覆盖
applySkillEnvOverrides({
  skills: skillEntries,
  config: openClawConfig
}): () => void  // 返回撤销函数

// 从Snapshot应用
applySkillEnvOverridesFromSnapshot({
  snapshot: skillsSnapshot,
  config: openClawConfig
}): () => void
```

### 6.2 Skill配置

```typescript
type SkillConfig = {
  enabled?: boolean;
  apiKey?: SecretInput;           // API密钥
  env?: Record<string, string>;   // 环境变量
  config?: Record<string, unknown>; // 配置对象
};
```

---

## 七、技能Eligibility检测

### 7.1  EligibilityContext

```typescript
type SkillEligibilityContext = {
  remote?: {
    platforms: string[];          // 支持的平台
    hasBin: (bin: string) => boolean;      // 检查二进制
    hasAnyBin: (bins: string[]) => boolean; // 检查任一二进制
    note?: string;
  };
};
```

### 7.2 包含判断

```typescript
function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: OpenClawConfig;
  eligibility?: SkillEligibilityContext;
}): boolean
```

---

## 八、Skills Prompt构建

### 8.1 Snapshot结构

```typescript
type SkillSnapshot = {
  prompt: string;                 // 构建的提示文本
  skills: Array<{
    name: string;
    primaryEnv?: string;
    requiredEnv?: string[];
  }>;
  skillFilter?: string[];        // 应用的过滤器
  resolvedSkills?: Skill[];
  version?: number;               // 快照版本
};
```

### 8.2 Prompt构建流程

```typescript
buildWorkspaceSkillSnapshot(workspaceDir, opts)
  → 扫描skills目录
  → 解析每个SKILL.md的frontmatter
  → 按配置过滤
  → 构建compact/skilled prompt
  → 返回SkillSnapshot
```

---

## 九、Skills与Agent集成

### 9.1 Agent配置中的Skills

```typescript
type AgentConfig = {
  skills?: string[];              // 技能白名单
  // ...
};

// SkillsConfig
type SkillsConfig = {
  allowBundled?: string[];        // 打包技能白名单
  load?: SkillsLoadConfig;
  install?: SkillsInstallConfig;
  limits?: SkillsLimitsConfig;
  entries?: Record<string, SkillConfig>; // 每技能配置
};
```

### 9.2 解析函数

```typescript
// 解析技能配置
resolveSkillConfig(config, skillKey): SkillConfig | undefined

// 解析打包白名单
resolveBundledAllowlist(config): string[] | undefined

// 检查打包技能是否允许
isBundledSkillAllowed(entry, allowlist): boolean

// 检查是否应包含技能
shouldIncludeSkill(params): boolean
```

---

## 十、核心设计思想

### 10.1 知识与执行分离
- SKILL.md = 知识指南（告诉AI怎么做）
- scripts/ = 确定性执行（可靠地做事）

### 10.2 按需加载
- 不是所有技能都加载到上下文
- 只有匹配描述的技能才被触发
- 大型资源按需读取

### 10.3 配置驱动
- 每个Agent可配置不同技能集
- 支持技能级别的enable/disable
- 支持per-skill的API key和env

### 10.4 渐进式披露
- Layer 1: 始终可见（name + description）
- Layer 2: 触发后加载（body）
- Layer 3: 按需访问（bundled resources）

---

## 十一、关键收获

1. **Skills是知识系统**：告诉AI"怎么做"而不是"做什么"

2. **三层加载设计**：Metadata → SKILL.md → Bundled resources，平衡上下文和功能

3. **Skills通过描述匹配触发**：description写得好不好决定技能会不会被用到

4. **scripts/实现确定性**：避免每次都让AI重新生成复杂代码

5. **配置灵活性**：支持白名单、黑名单、per-skill配置

6. **Eligibility机制**：支持OS/平台/二进制检测，决定技能是否可用

---

## 📁 产出文件

- 笔记：`/workspace/pipixia/notes/模块4-Skills系统.md`
- 代码：`/workspace/pipixia/code/模块4-Skills系统/`

🦐 **皮皮虾 - 追求深度，拒绝浅薄**
