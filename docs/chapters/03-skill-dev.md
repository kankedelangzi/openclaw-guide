# 第三章：Skill系统设计模式与开发实践

## 3.1 Skill系统概述

OpenClaw的Skill系统是扩展AI能力的主流方式。与Plugin系统不同，Skill更轻量、更专注，通常围绕单一功能域设计。截至2026年4月，ClawHub上已有数百个社区Skill，覆盖浏览器自动化、记忆管理、多搜索引擎集成、企业工具连接等场景。

理解Skill的本质：Skill是一组约定格式的文件，通过OpenClaw的skills框架被发现、加载和执行。一个Skill本质上是一个包含SKILL.md声明文件的工作单元，它向系统声明自己的能力、依赖和使用方式。

Skill与Plugin的核心区别在于设计哲学。Plugin通过OpenClaw的Plugin SDK实现，需要编写TypeScript/JavaScript代码，深入Gateway内部，注册到config中。Skill则通过SKILL.md声明文件描述能力边界，可以包含脚本、参考文档甚至源代码片段，门槛更低，适合社区共享。

从架构角度看，Skill填补了"纯配置文件不够灵活、Plugin开发门槛太高"之间的空白。你可以在Skill中组合Shell脚本、Python工具、甚至调用外部API，同时通过OpenClaw的Hook系统与Agent生命周期深度集成。

## 3.2 Skill标准结构

### 3.2.1 目录规范

一个标准Skill的目录结构如下：

```
my-skill/
├── SKILL.md              # 必须：Skill主文件（元数据+使用说明）
├── README.md             # 推荐：详细文档
├── scripts/              # 可选：辅助脚本
│   ├── setup.sh
│   └── helper.py
├── src/                  # 可选：源代码
│   └── index.ts
├── references/           # 可选：参考资料
│   └── guide.md
└── _meta.json            # ClawHub自动生成
```

所有Skill文件放在`extensions/<extension-name>/skills/<skill-name>/`目录下，或者在工作空间的`skills/`目录下。后者是用户自定义Skill的推荐位置。

### 3.2.2 SKILL.md格式

SKILL.md是Skill的声明核心，格式分两部分：YAML front matter元数据，和Markdown正文说明。

```yaml
---
name: my-skill
description: "简短描述 - 什么场景使用"
metadata:
  openclaw: {}
  author: "Your Name"
  version: "1.0.0"
  tags: ["productivity", "tools"]
---

# My Skill

## 一句话描述

详细的功能描述...

## 主要功能

1. 功能一
2. 功能二

## 使用示例

```typescript
// 示例代码
```

## 依赖

- CLI工具X
- API密钥Y

## 注意事项

- 重要提示1
- 重要提示2
```

元数据中`openclaw: {}`是必须项，标识这是一个OpenClaw Skill。name字段唯一标识Skill，description会显示在Skill列表中。tags用于分类检索。

### 3.2.3 实际热门Skill结构示例

self-improving-agent是ClawHub第一热门Skill（3.2k stars, 389k installs），它的结构代表了高质量Skill的典范：

```
self-improving-agent/
├── SKILL.md
├── scripts/
│   ├── error-detector.sh      # 检测命令失败并记录到ERRORS.md
│   ├── activator.sh           # 定期提醒学习回顾
│   ├── learning-categorizer.py # 学习内容分类
│   └── pattern-detector.sh    # 递归模式检测
├── src/
│   └── feedback-loop.ts       # 反馈循环核心逻辑
└── references/
    └── promotion-rules.md      # 晋升规则说明
```

ERRORS.md、LEARNINGS.md、FEATURE_REQUESTS.md三个文件直接在workspace根目录创建，体现了Skill与Agent工作空间的深度集成策略。

## 3.3 热门Skill设计模式分析

### 3.3.1 平台集成型

代表Skill：Slack（116 stars, 38.7k installs）、Trello（127 stars）、Obsidian（324 stars, 81.1k installs）

这类Skill的核心价值是连接主流工具生态。设计要点：

```typescript
// Slack Skill核心接口设计
interface SlackSkill {
  // 消息操作
  sendMessage(channel: string, text: string): Promise<MessageResult>;
  replyToThread(threadTs: string, text: string): Promise<MessageResult>;
  
  // 交互操作
  addReaction(channel: string, messageTs: string, emoji: string): Promise<void>;
  pinMessage(channel: string, messageTs: string): Promise<void>;
  
  // 频道管理
  renameChannel(channelId: string, newName: string): Promise<void>;
  createChannel(name: string): Promise<Channel>;
  
  // 认证管理
  validateToken(): Promise<boolean>;
  refreshToken(): Promise<string>;
}
```

平台集成型Skill的共同特点：完整的CRUD操作封装、标准API调用、清晰的认证流程。Obsidian Skill的架构尤其值得参考——它操作Vault中的Markdown文件，实现了笔记的创建、读取、更新、删除全套操作，同时支持Vault搜索能力。

### 3.3.2 记忆与学习型

代表Skill：self-improving-agent（3.2k stars）、ontology（532 stars, 164k installs）

self-improving-agent的设计体现了"让Agent拥有自我改进能力"的核心思想。它不直接执行任务，而是记录Agent的行为，在适当时机触发学习和改进。

三层文件分离架构：

```
ERRORS.md       # 命令失败、API错误（完整Context+Stack trace）
LEARNINGS.md    # 用户纠正、最佳实践、知识gap（标签分类）
FEATURE_REQUESTS.md  # 用户期望但缺失的能力
```

统一格式：`[类型-YYYYMMDD-XXX]`，每个条目带Priority、Status、Area标签。

ontology的设计则关注"类型化知识图谱"，用结构化方式组织Agent记忆，支持可组合Skill调用。它定义了类型系统，让记忆不仅是被动存储，而是可以被查询、推理和复用的知识网络。

### 3.3.3 能力增强型

代表Skill：Agent Browser（318 stars, 87.1k installs）、Multi Search Engine（558 stars, 118k installs）

Agent Browser是AI Agent优化的无头浏览器自动化CLI，核心价值是扩展Agent的核心能力。Multi Search Engine集成了16个搜索引擎（7个中国+9个全球），支持高级搜索算子。

这类Skill的设计共通点：多引擎支持、结果标准化、错误处理与重试、输出格式统一。

```typescript
// Multi Search Engine核心接口
interface MultiSearchEngine {
  search(query: string, options?: {
    engines?: string[];      // 指定引擎列表
    numResults?: number;     // 每引擎结果数
    safeSearch?: boolean;
  }): Promise<SearchResult[]>;
  
  // 高级搜索算子
  withSite(query: string, domain: string): SearchResult[];
  withTimeRange(query: string, start: Date, end: Date): SearchResult[];
}

// 统一结果格式
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  timestamp: Date;
}
```

### 3.3.4 领域专用型

代表Skill：Baidu Search、Polymarket、AdMapix

这类Skill针对垂直领域提供专业数据查询能力。设计要点：API封装、数据清洗、结果格式化、错误处理。

## 3.4 Hook系统集成

Hook系统是Skill与OpenClaw深度集成的核心机制。通过Hook，Skill可以在Agent生命周期的关键节点插入自定义逻辑。

### 3.4.1 Hook类型

OpenClaw的Hook系统在Agent Runtime层面工作，主要类型：

PreToolUse Hook在工具执行前触发，可以检查参数合法性、记录意图、决定是否跳过执行。PostToolUse Hook在工具执行后触发，是记录学习、处理错误、实现反馈循环的绝佳位置。UserPromptSubmit Hook在用户消息提交给模型前触发，可以做意图分析、内容增强。Error Hook在异常发生时触发，记录诊断信息。

### 3.4.2 自改进框架实战

self-improving-agent的核心就是Hook系统集成。以下是它的Hook配置模式：

```typescript
// .claude/hooks.json 或 OpenClaw hooks配置
{
  "postToolUse": {
    "enabled": true,
    "script": "scripts/error-detector.sh",
    "triggerOnNonZero": true,
    "captureContext": true
  },
  "userPromptSubmit": {
    "enabled": true,
    "script": "scripts/learning-reminder.sh",
    "throttleMinutes": 60
  },
  "error": {
    "enabled": true,
    "script": "scripts/error-logger.sh",
    "includeStackTrace": true
  }
}
```

error-detector.sh的核心逻辑：

```bash
#!/bin/bash
# error-detector.sh - 检测命令失败并记录

EXIT_CODE=$1
COMMAND=$2
CONTEXT=$3

if [ $EXIT_CODE -ne 0 ]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  ERROR_ID=$(uuidgen)
  
  # 追加到ERRORS.md
  cat >> ERRORS.md << EOF

## [$ERROR_ID] $(date '+%Y%m%d-%H%M%S')

### 类型: COMMAND_FAILURE
### 优先级: P2
### 状态: OPEN

**命令**: \`$COMMAND\`
**退出码**: $EXIT_CODE

**完整Context**:
\`\`\`
$CONTEXT
\`\`\`

**初步分析**:
<!-- 在此填写初步分析 -->

**解决方案**:
<!-- 在此填写已验证的解决方案 -->

EOF
  echo "Error recorded to ERRORS.md: $ERROR_ID"
fi
```

### 3.4.3 自定义Skill Hook集成

创建一个带Hook集成的Skill，完整示例：

```typescript
// src/learning-recorder.ts
// 在workspace中创建，用于记录用户反馈

import * as fs from 'fs';
import * as path from 'path';

interface LearningEntry {
  id: string;
  type: 'correction' | 'best_practice' | 'knowledge_gap';
  timestamp: string;
  content: string;
  context: string;
  priority: 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'VERIFIED' | 'PROMOTED';
  area: string;
}

export class LearningRecorder {
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  record(entry: Omit<LearningEntry, 'id' | 'timestamp' | 'status'>): void {
    const fullEntry: LearningEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      status: 'OPEN'
    };
    
    const filePath = path.join(this.workspaceRoot, 'LEARNINGS.md');
    const formatted = this.formatEntry(fullEntry);
    
    fs.appendFileSync(filePath, formatted, 'utf-8');
  }
  
  private formatEntry(entry: LearningEntry): string {
    return `
## [${entry.type.toUpperCase()}-${entry.timestamp.split('T')[0]}-${entry.id.slice(0,8)}]

### 优先级: ${entry.priority}
### 状态: ${entry.status}
### 领域: ${entry.area}

**内容**:
${entry.content}

**Context**:
\`\`\`
${entry.context}
\`\`\`

**标签**: #${entry.type}
`;
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
```

对应的SKILL.md：

```yaml
---
name: learning-recorder
description: "用户反馈记录器 - 记录纠正、最佳实践和知识差距"
metadata:
  openclaw: {}
  author: "community"
  version: "1.0.0"
  tags: ["memory", "self-improvement", "learning"]
---

# Learning Recorder

自动记录用户在对话中的纠正和反馈，实现持续学习。

## 功能

- 记录用户纠正（correction类型）
- 记录最佳实践（best_practice类型）
- 记录知识差距（knowledge_gap类型）
- 统一格式输出到LEARNINGS.md

## Hook集成

配合OpenClaw的UserPromptSubmit Hook使用：

```json
{
  "userPromptSubmit": {
    "script": "scripts/activator.sh",
    "throttleMinutes": 60
  }
}
```

## 依赖

- Node.js 18+
- TypeScript 5+

## 使用方式

在Agent工作空间初始化后启用，自动工作。
```

## 3.5 Skill开发完整流程

### 3.5.1 从零创建Skill

开发一个新Skill的完整流程：

第一步：确定Skill定位。回答三个问题：这个Skill解决什么问题？与其他已有Skill的差异是什么？用户如何发现和使用它？

以"天气查询Skill"为例：解决用户询问天气的问题，差异在于多数据源和预报能力，通过OpenClaw skills list发现。

第二步：设计接口。定义Skill暴露的核心API，保持单一职责。

```typescript
// weather-skill/src/index.ts
interface WeatherQuery {
  location: string;
  date?: string;  // 可选，默认今天
  unit?: 'celsius' | 'fahrenheit';
}

interface WeatherResult {
  location: string;
  date: string;
  temperature: number;
  unit: string;
  condition: string;  // sunny/rainy/cloudy/snowy
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

export class WeatherSkill {
  async query(input: WeatherQuery): Promise<WeatherResult> {
    // 实现...
  }
  
  async forecast(location: string, days: number = 7): Promise<WeatherResult[]> {
    // 实现...
  }
}
```

第三步：编写SKILL.md。

第四步：实现核心逻辑。

第五步：测试和调试。

完整实现代码：

```typescript
// weather-skill/src/index.ts
interface WeatherConfig {
  apiKey: string;
  defaultUnit: 'celsius' | 'fahrenheit';
  timeout: number;
}

interface WeatherData {
  location: string;
  date: string;
  temperature: number;
  unit: string;
  condition: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  source: string;
}

export class WeatherSkill {
  private config: WeatherConfig;
  
  constructor(config: WeatherConfig) {
    this.config = {
      defaultUnit: 'celsius',
      timeout: 10000,
      ...config
    };
  }
  
  async query(location: string, options?: {
    date?: string;
    unit?: 'celsius' | 'fahrenheit';
  }): Promise<WeatherData> {
    const unit = options?.unit ?? this.config.defaultUnit;
    const date = options?.date ?? new Date().toISOString().split('T')[0];
    
    // 构建API请求
    const params = new URLSearchParams({
      location,
      date,
      unit,
      key: this.config.apiKey
    });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(
        `https://api.weather.example.com/v1/query?${params}`,
        { signal: controller.signal }
      );
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      return this.normalizeResponse(data, unit);
    } finally {
      clearTimeout(timeout);
    }
  }
  
  async forecast(location: string, days: number = 7): Promise<WeatherData[]> {
    const results: WeatherData[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        const dayWeather = await this.query(location, { date: dateStr });
        results.push(dayWeather);
      } catch (error) {
        console.error(`Failed to fetch forecast for ${dateStr}:`, error);
      }
    }
    
    return results;
  }
  
  private normalizeResponse(data: any, unit: string): WeatherData {
    return {
      location: data.location,
      date: data.date,
      temperature: data.temperature,
      unit,
      condition: this.categorizeCondition(data.conditionCode),
      humidity: data.humidity,
      windSpeed: data.wind.speed,
      uvIndex: data.uv.index,
      source: 'weather-api'
    };
  }
  
  private categorizeCondition(code: number): string {
    if (code >= 200 && code < 300) return 'thunderstorm';
    if (code >= 300 && code < 400) return 'drizzle';
    if (code >= 500 && code < 600) return 'rainy';
    if (code >= 600 && code < 700) return 'snowy';
    if (code >= 700 && code < 800) return 'foggy';
    if (code === 800) return 'sunny';
    if (code > 800) return 'cloudy';
    return 'unknown';
  }
}
```

对应的脚本封装：

```bash
#!/bin/bash
# weather-skill/scripts/query.sh

LOCATION=$1
DATE=${2:-$(date '+%Y-%m-%d')}
UNIT=${3:-celsius}

if [ -z "$LOCATION" ]; then
  echo "Usage: query.sh <location> [date] [unit]"
  exit 1
fi

# 读取配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../config.json"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Error: config.json not found"
  exit 1
fi

API_KEY=$(node -e "console.log(require('$CONFIG_PATH').apiKey)")

# 调用API
response=$(curl -s "https://api.weather.example.com/v1/query" \
  -H "Authorization: Bearer $API_KEY" \
  -d "location=$LOCATION" \
  -d "date=$DATE" \
  -d "unit=$UNIT")

echo "$response"
```

### 3.5.2 测试与调试

Skill调试推荐方法：

本地测试脚本：

```bash
#!/bin/bash
# weather-skill/scripts/test.sh

set -e

echo "=== Weather Skill Test Suite ==="

# 测试1：基本查询
echo "[Test 1] Basic query..."
result=$(./scripts/query.sh "Beijing")
if echo "$result" | grep -q "temperature"; then
  echo "[PASS] Basic query"
else
  echo "[FAIL] Basic query"
  exit 1
fi

# 测试2：带日期查询
echo "[Test 2] Query with date..."
result=$(./scripts/query.sh "Shanghai" "2026-04-21")
if echo "$result" | grep -q "temperature"; then
  echo "[PASS] Query with date"
else
  echo "[FAIL] Query with date"
  exit 1
fi

# 测试3：华氏度
echo "[Test 3] Fahrenheit unit..."
result=$(./scripts/query.sh "Tokyo" "2026-04-21" "fahrenheit")
if echo "$result" | grep -q "temperature"; then
  echo "[PASS] Fahrenheit unit"
else
  echo "[FAIL] Fahrenheit unit"
  exit 1
fi

echo "=== All tests passed ==="
```

## 3.6 Skill发布与分发

### 3.6.1 ClawHub提交流程

发布Skill到ClawHub的标准流程：

第一步：确保SKILL.md完整。所有必填字段齐全，description清晰有用，代码示例可运行。

第二步：创建_meta.json（如果不存在）。ClawHub会自动生成，但本地开发时可以有：

```json
{
  "name": "weather-skill",
  "version": "1.0.0",
  "publishedAt": "2026-04-20T00:00:00Z",
  "downloads": 0
}
```

第三步：创建Git仓库并推送到GitHub。

```bash
git init
git add .
git commit -m "Initial commit: weather-skill v1.0.0"
git remote add origin git@github.com:yourname/weather-skill.git
git push -u origin main
```

第四步：在ClawHub上提交Skill URL。ClawHub会抓取仓库，自动解析SKILL.md并创建发布页面。

### 3.6.2 版本管理策略

Skill版本管理遵循语义化版本（SemVer）：

- 主版本（1.0.0 → 2.0.0）：不兼容的API变更
- 次版本（1.0.0 → 1.1.0）：向后兼容的功能新增
- 修订版本（1.0.0 → 1.0.1）：向后兼容的缺陷修复

每次版本更新需要：
1. 更新SKILL.md中的version字段
2. 在CHANGELOG.md记录变更
3. 更新README.md中的版本说明
4. Git tag推送

```bash
# 版本发布流程
git tag -a v1.1.0 -m "Add forecast() method with multi-day support"
git push origin v1.1.0
```

## 3.7 设计模式总结

回顾高质量Skill的共同特征：

单一职责原则：每个Skill专注一个功能域，不贪多。self-improving-agent只做自我改进，Agent Browser只做浏览器自动化，正是这种克制成就了它们的广泛使用。

清晰接口设计：暴露简洁明确的API，参数类型明确，返回值可预期。用户在集成时不需要阅读大量内部实现。

错误处理优雅：连接外部服务的Skill必须处理网络超时、API限流、认证失效等情况。提供清晰的错误信息和重试建议。

与OpenClaw深度集成：利用Hook系统在Agent生命周期中插入自定义逻辑，是Skill区别于独立脚本的核心价值。

文档完整可运行：SKILL.md、README.md、代码示例一个都不能少。ClawHub上的Skill被发现的质量门槛，就是用户决定是否尝试的第一印象。

社区反馈驱动迭代：self-improving-agent之所以持续进化，正是因为它自己记录反馈、自己分析模式、自我改进——用自身证明了"记录用户反馈"的价值。
