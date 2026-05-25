# 第四章：Skill开发进阶

## 4.1 Hook系统入门

在第三章中，我们了解了Skill的基本结构和SKILL.md的编写方式。一个Skill可以独立工作，但如果需要与OpenClaw的Agent生命周期深度集成、理解每一次工具调用、或者在消息流转的关键节点插入自定义逻辑，就需要用到Hook系统。

Hook是OpenClaw提供的一类特殊扩展点，它让你在Agent运行时的事件流中"挂载"自定义处理逻辑。与Skill的主动调用不同，Hook是被动触发的——当特定事件发生时，OpenClaw自动调用你注册的Hook函数。

### 4.1.1 六种核心Hook类型

OpenClaw的Hook系统覆盖了Agent运行时的六个关键阶段：

| Hook类型 | 触发时机 | 典型用途 |
|---------|---------|---------|
| `Start` | Agent会话启动时 | 初始化上下文、加载会话特定配置 |
| `Stop` | Agent会话结束时 | 持久化状态、清理资源 |
| `Auth` | 每次消息处理前 | 用户身份验证、权限校验 |
| `UserPromptSubmit` | 用户消息提交给模型前 | 内容过滤、敏感词检测、变量注入 |
| `PostToolUse` | 每次工具调用完成后 | 结果验证、错误捕获、日志记录 |
| `AgentResponse` | 模型响应发送前 | 内容审核、格式转换 |

理解这六个Hook的最好方式是看一个实际场景。假设你希望Agent每次调用工具后自动记录学习到的信息，并在发现错误时自动记录到错误日志。这需要两个Hook配合工作。

### 4.1.2 第一个Hook示例

以下是一个完整的Hook实现，注册后在每次工具调用完成后记录日志：

```typescript
// hooks/tool-logger.ts
// 每次工具调用完成后自动记录日志的Hook

const toolLoggerHook = {
  name: 'tool-logger',
  description: '记录所有工具调用及其结果',

  // PostToolUse Hook - 工具调用完成后触发
  async 'PostToolUse'(toolResult, context) {
    const { toolName, parameters, result, durationMs, error } = toolResult;

    // 构建日志条目
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: context.sessionId,
      toolName,
      parameters: sanitizeParameters(parameters),
      success: !error,
      durationMs,
      errorMessage: error?.message || null
    };

    // 输出到控制台（或写入文件）
    console.log('[ToolCall]', JSON.stringify(logEntry, null, 2));

    // 关键：如果工具调用失败，是否要中断后续流程
    if (error) {
      // 返回 { continue: false } 会中断Agent执行
      // 这里我们选择继续，但记录错误
      console.warn(`[ToolError] ${toolName} failed: ${error.message}`);
    }

    // 必须返回 { continue: true } 才能让流程继续
    return { continue: true, result: toolResult };
  }
};

// 从参数中移除敏感信息（如API密钥）
function sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...params };
  const sensitiveKeys = ['apiKey', 'api_key', 'token', 'password', 'secret'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

export default toolLoggerHook;
```

将这个Hook注册到`openclaw.yaml`中：

```yaml
# openclaw.yaml
hooks:
  - name: tool-logger
    path: ./hooks/tool-logger.ts
    enabled: true
```

### 4.1.3 UserPromptSubmit Hook

UserPromptSubmit是另一个高频使用的Hook。它在用户消息提交给大模型之前触发，可以用来注入动态上下文、过滤敏感内容或转换用户输入格式：

```typescript
// hooks/context-injector.ts
// 在用户消息提交给模型前，注入动态上下文

const contextInjectorHook = {
  name: 'context-injector',
  description: '动态注入上下文信息到用户消息',

  async 'UserPromptSubmit'(userMessage, context) {
    // 构建动态上下文
    const dynamicContext: string[] = [];

    // 1. 注入当前时间（Agent无法主动获取系统时间时）
    const now = new Date();
    dynamicContext.push(
      `[系统信息] 当前时间: ${now.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }})`
    );

    // 2. 注入用户偏好（从工作空间文件读取）
    try {
      const prefs = await read('workspace/USER.md');
      if (prefs.includes('时区')) {
        dynamicContext.push('[用户偏好] 检测到非默认时区设置');
      }
    } catch {
      // 文件不存在，跳过
    }

    // 3. 注入会话状态摘要
    if (context.session && context.session.state) {
      const stateKeys = Object.keys(context.session.state);
      if (stateKeys.length > 0) {
        dynamicContext.push(`[会话状态] 当前活跃状态: ${stateKeys.join(', ')}`);
      }
    }

    // 将动态上下文追加到用户消息
    const enrichedMessage = {
      ...userMessage,
      content: userMessage.content + 
        '\n\n' + 
        dynamicContext.map(c => `> ${c}`).join('\n> ')
    };

    return { continue: true, message: enrichedMessage };
  }
};

export default contextInjectorHook;
```

### 4.1.4 Auth Hook

Auth Hook用于在消息处理的最早阶段验证用户身份。如果返回`continue: false`，该消息不会被进一步处理：

```typescript
// hooks/auth-guard.ts
// 基于白名单的身份验证

const authGuardHook = {
  name: 'auth-guard',
  description: '验证用户是否在白名单中',

  async 'Auth'(message, context) {
    // 从配置中读取白名单
    const allowedUsers = context.config.allowedUsers || [];
    const senderId = message.sender?.id || message.from?.id || '';

    if (allowedUsers.length === 0) {
      // 没有配置白名单，放行所有用户
      return { continue: true };
    }

    if (!allowedUsers.includes(senderId)) {
      console.warn(`[Auth] Unauthorized access attempt from ${senderId}`);
      return {
        continue: false,
        response: {
          // 返回一个字符串将直接作为回复消息发出
          content: '抱歉，您没有权限使用此服务。如需开通请联系管理员。'
        }
      };
    }

    return { continue: true };
  }
};

export default authGuardHook;
```

## 4.2 Hook与Skill联动

Hook的真正威力在于它能与Skill联动。单独的Hook只能观察和过滤，而与Skill结合后，Hook可以触发Skill执行、修改Skill行为、甚至在特定条件下启动子Agent处理复杂任务。

### 4.2.1 错误自动捕获与学习记录

一个典型场景：每次工具调用失败时，自动记录错误并启动一个学习过程，防止同类错误再次发生。这需要Hook捕获错误后，通过Skill执行实际的记录和纠正逻辑：

```typescript
// hooks/auto-error-recovery.ts
// 错误捕获Hook + 联动Skill机制

const autoErrorRecoveryHook = {
  name: 'auto-error-recovery',
  description: '捕获工具错误并触发自动学习',

  privateState: {
    errorHistory: new Map<string, number>(),  // 工具名 -> 错误次数
    recentErrors: [] as Array<{
      toolName: string;
      error: string;
      timestamp: Date;
      context: string;
    }>
  },

  async 'PostToolUse'(toolResult, context) {
    if (!toolResult.error) {
      return { continue: true };
    }

    const { toolName, error, parameters } = toolResult;
    const errorKey = `${toolName}:${error.message}`;

    // 记录错误历史
    const errorCount = (this.privateState.errorHistory.get(errorKey) || 0) + 1;
    this.privateState.errorHistory.set(errorKey, errorCount);

    // 记录最近错误
    this.privateState.recentErrors.push({
      toolName,
      error: error.message,
      timestamp: new Date(),
      context: JSON.stringify(parameters)
    });

    // 保留最近100条错误记录
    if (this.privateState.recentErrors.length > 100) {
      this.privateState.recentErrors.shift();
    }

    console.log(
      `[AutoErrorRecovery] ${toolName} failed (count: ${errorCount}): ${error.message}`
    );

    // 如果同一个错误连续出现3次，触发深度学习流程
    if (errorCount >= 3) {
      await this.triggerLearningProcess(toolName, error, context);
    }

    return { continue: true };  // 即使出错也让流程继续
  },

  // 触发学习过程：启动一个子Agent分析错误模式
  async triggerLearningProcess(toolName: string, error: any, context: any) {
    // 通过sessions_spawn创建子Agent进行错误分析
    const analysisSession = await sessions_spawn({
      task: `分析以下错误的根本原因，并提出解决方案：
      
工具: ${toolName}
错误信息: ${error.message}
错误上下文: ${JSON.stringify(error)}

请搜索相关资料，给出：
1. 可能的根本原因
2. 具体的修复步骤
3. 预防措施

将分析结果追加到 workspace/memory/error-analysis.md 文件中。`,
      label: `error-analysis-${toolName}`,
      mode: 'run',
      timeoutSeconds: 120
    });

    console.log(
      `[AutoErrorRecovery] Spawned analysis session: ${analysisSession.sessionKey}`
    );
  }
};

export default autoErrorRecoveryHook;
```

### 4.2.2 学习记录的持久化

Hook可以触发Skill执行，但学习内容需要持久化才能真正改进Agent行为。以下是一个将学习内容写入工作空间文件的Skill：

```typescript
// skills/learning-recorder/SKILL.md
---
name: learning-recorder
description: "自动记录学习成果到持久化存储"
metadata:
  openclaw: {}
  author: "community"
  version: "1.0.0"
  tags: ["memory", "automation"]
---

# Learning Recorder Skill

## 功能描述

自动记录Agent学习到的知识、用户偏好和错误教训到持久化文件。

## 使用方式

在Hook中调用 `skill:execute` 执行本Skill：

```typescript
await sessions_spawn({
  task: `调用learning-recorder skill记录以下学习内容：
  类型: {type}
  内容: {content}
  来源: {source}`
});
```

## 记录格式

学习内容按类型存储到不同文件：
- `memory/preferences.md` - 用户偏好
- `memory/error-analysis.md` - 错误分析
- `memory/workflows.md` - 工作流程
```

对应的记录脚本`scripts/record.sh`：

```bash
#!/bin/bash
# skills/learning-recorder/scripts/record.sh
# 记录学习内容到对应文件

TYPE="$1"       # preference | error | workflow
CONTENT="$2"    # 学习内容
SOURCE="$3"     # 来源

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

case "$TYPE" in
  preference)
    FILE="workspace/memory/preferences.md"
    ENTRY="## 偏好 [$TIMESTAMP] (来源: $SOURCE)\n\n$CONTENT\n"
    ;;
  error)
    FILE="workspace/memory/error-analysis.md"
    ENTRY="## 错误记录 [$TIMESTAMP]\n\n错误: $CONTENT\n来源: $SOURCE\n"
    ;;
  workflow)
    FILE="workspace/memory/workflows.md"
    ENTRY="## 工作流 [$TIMESTAMP]\n\n$CONTENT\n"
    ;;
  *)
    echo "Unknown type: $TYPE" >&2
    exit 1
    ;;
esac

mkdir -p "$(dirname "$FILE")"
echo -e "$ENTRY" >> "$FILE"
echo "Recorded to $FILE"

# 如果文件超过1000行，进行压缩
LINE_COUNT=$(wc -l < "$FILE")
if [ "$LINE_COUNT" -gt 1000 ]; then
  # 保留后半部分（前500行移到归档）
  tail -n 500 "$FILE" > "${FILE}.tmp"
  mv "${FILE}.tmp" "$FILE"
  echo "File compacted (was $LINE_COUNT lines)"
fi
```

## 4.3 多Step Skill（状态机模式）

真实的业务场景中，一个Skill往往需要多个步骤才能完成。这些步骤之间有依赖关系，需要维护状态，并且可能需要根据中间结果决定下一步走哪条路径。这就是多Step Skill的核心场景。

### 4.3.1 状态机设计

多Step Skill的推荐模式是状态机。每个Skill维护一个状态对象，记录当前执行到哪一步、以及每个步骤的产出：

```typescript
// skills/multi-step-task/state-machine.ts
// 多Step Skill状态机实现

interface StepResult {
  step: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

interface MultiStepState {
  taskId: string;
  currentStep: number;
  steps: StepDefinition[];
  results: StepResult[];
  startTime: Date;
  metadata: Record<string, unknown>;
}

interface StepDefinition {
  name: string;
  execute: (context: StepContext) => Promise<StepOutput>;
  rollback?: (context: StepContext, result: StepOutput) => Promise<void>;
  condition?: (state: MultiStepState) => boolean;  // 条件执行
}

interface StepContext {
  state: MultiStepState;
  input: unknown;
  sharedData: Record<string, unknown>;  // 步骤间共享数据
}

interface StepOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  nextStep?: string;  // 指定下一步（非顺序执行时）
}

// 状态机执行引擎
class StateMachineExecutor {
  private state: MultiStepState;

  constructor(taskId: string, steps: StepDefinition[]) {
    this.state = {
      taskId,
      currentStep: 0,
      steps,
      results: [],
      startTime: new Date(),
      metadata: {}
    };
  }

  async execute(input: unknown): Promise<MultiStepState> {
    const sharedData: Record<string, unknown> = {};
    let stepIndex = 0;

    while (stepIndex < this.state.steps.length) {
      const step = this.state.steps[stepIndex];
      const context: StepContext = {
        state: this.state,
        input,
        sharedData
      };

      // 检查条件是否满足
      if (step.condition && !step.condition(this.state)) {
        console.log(`[StateMachine] Step ${step.name} skipped (condition not met)`);
        stepIndex++;
        continue;
      }

      console.log(`[StateMachine] Executing step: ${step.name}`);
      const startTime = Date.now();

      try {
        const output = await step.execute(context);
        const durationMs = Date.now() - startTime;

        const result: StepResult = {
          step: step.name,
          success: output.success,
          output: output.data,
          error: output.error,
          durationMs
        };
        this.state.results.push(result);

        if (!output.success) {
          // 执行失败，尝试回滚
          await this.rollback(context, stepIndex);
          break;
        }

        // 更新共享数据
        if (output.data) {
          Object.assign(sharedData, output.data);
        }

        // 决定下一步
        if (output.nextStep) {
          const nextIndex = this.state.steps.findIndex(s => s.name === output.nextStep);
          if (nextIndex === -1) {
            throw new Error(`Unknown next step: ${output.nextStep}`);
          }
          stepIndex = nextIndex;
        } else {
          stepIndex++;
        }

      } catch (error) {
        const durationMs = Date.now() - startTime;
        this.state.results.push({
          step: step.name,
          success: false,
          output: null,
          error: (error as Error).message,
          durationMs
        });
        await this.rollback(context, stepIndex);
        break;
      }
    }

    return this.state;
  }

  private async rollback(context: StepContext, failedIndex: number): Promise<void> {
    console.log(`[StateMachine] Rolling back from step ${failedIndex}`);

    // 从失败步骤向前回滚
    for (let i = failedIndex - 1; i >= 0; i--) {
      const step = this.state.steps[i];
      if (step.rollback) {
        try {
          const result = this.state.results[i];
          await step.rollback(context, { success: true, data: result.output });
          console.log(`[StateMachine] Rolled back step: ${step.name}`);
        } catch (rollError) {
          console.error(`[StateMachine] Rollback failed for ${step.name}:`, rollError);
        }
      }
    }
  }

  getState(): MultiStepState {
    return this.state;
  }

  getSummary(): { totalSteps: number; successful: number; failed: boolean } {
    return {
      totalSteps: this.state.steps.length,
      successful: this.state.results.filter(r => r.success).length,
      failed: this.state.results.some(r => !r.success)
    };
  }
}

export { StateMachineExecutor, MultiStepState, StepDefinition, StepContext };
```

### 4.3.2 多Step Skill实战：自动化研究助手

以下是一个完整的多Step Skill，实现自动化研究报告生成：

```typescript
// skills/research-assistant/steps.ts
// 自动化研究助手 - 多Step Skill实现

import { StateMachineExecutor, StepDefinition } from './state-machine.ts';

// 定义研究助手的各个步骤
const researchSteps: StepDefinition[] = [
  {
    name: 'topic-analysis',
    execute: async (ctx) => {
      const query = ctx.input as string;
      
      // 使用搜索工具收集初步信息
      const searchResults = await exec({
        command: `curl -s "https://api.search.example.com?q=${encodeURIComponent(query)}&limit=5"`,
      });

      const parsed = JSON.parse(searchResults);
      const topics = parsed.results?.map((r: any) => r.title) || [];

      return {
        success: true,
        data: { query, topics, searchResults: parsed },
        nextStep: 'deep-research'
      };
    }
  },

  {
    name: 'deep-research',
    execute: async (ctx) => {
      const { query, topics } = ctx.sharedData as any;
      
      // 对每个主题进行深入研究
      const researchTasks = topics.map((topic: string) => 
        exec({
          command: `curl -s "https://api.search.example.com?q=${encodeURIComponent(topic + ' ' + query)}&limit=3"`,
        }).then(r => JSON.parse(r))
      );

      const detailedResults = await Promise.allSettled(researchTasks);
      const successfulResults = detailedResults
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      return {
        success: true,
        data: { detailedResults: successfulResults }
      };
    },

    // 回滚：清除缓存的搜索结果
    rollback: async (ctx) => {
      console.log('[Rollback] Clearing research cache...');
    }
  },

  {
    name: 'synthesize',
    condition: (state) => {
      // 只有当deep-research成功时才执行
      const deepResearchResult = state.results.find(r => r.step === 'deep-research');
      return deepResearchResult?.success === true;
    },
    execute: async (ctx) => {
      const { detailedResults } = ctx.sharedData as any;

      // 生成摘要（这里简化处理，实际可用LLM API）
      const summary = detailedResults
        .map((r: any) => `- ${r.title}: ${r.snippet}`)
        .join('\n');

      return {
        success: true,
        data: { summary }
      };
    }
  },

  {
    name: 'format-output',
    execute: async (ctx) => {
      const { query, summary } = ctx.sharedData as any;
      const timestamp = new Date().toISOString();

      const report = `# 研究报告: ${query}
生成时间: ${timestamp}

## 核心发现

${summary}

## 下一步建议

1. 深入验证关键信息点
2. 寻找原始来源进行交叉验证
3. 制定实施计划
`;

      // 保存到文件
      await exec({
        command: `mkdir -p workspace/research && echo '${report.replace(/'/g, "'\"'\"'")}' > workspace/research/${Date.now()}.md`
      });

      return {
        success: true,
        data: { report, savedPath: `workspace/research/${Date.now()}.md` }
      };
    }
  }
];

// 执行研究助手
async function runResearchAssistant(query: string) {
  const executor = new StateMachineExecutor(
    `research-${Date.now()}`,
    researchSteps
  );

  console.log(`[ResearchAssistant] Starting research for: ${query}`);

  const finalState = await executor.execute(query);
  const summary = executor.getSummary();

  console.log(`[ResearchAssistant] Completed. ${summary.successful}/${summary.totalSteps} steps succeeded`);

  if (summary.failed) {
    const failedStep = finalState.results.find(r => !r.success);
    console.error(`[ResearchAssistant] Failed at: ${failedStep?.step} - ${failedStep?.error}`);
  }

  return finalState;
}

// 运行示例
// runResearchAssistant('OpenClaw Plugin SDK architecture');
```

## 4.4 Skill之间的调用

当一个复杂任务需要多种能力时，单个Skill往往不够用。OpenClaw支持Skill之间相互调用，这使得能力组合成为可能。

### 4.4.1 通过sessions_spawn调用其他Skill

最直接的方式是通过` sessions_spawn`启动一个子会话来执行目标Skill：

```typescript
// skills/task-coordinator/call-other-skills.ts
// 任务协调器 - 演示Skill间调用

interface SkillCall {
  skillName: string;
  input: unknown;
  timeout?: number;      // 超时时间（毫秒）
  retryCount?: number;   // 重试次数
}

interface SkillResult {
  skillName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  attempts: number;
}

// 调用单个Skill（通过子会话）
async function callSkill(skillCall: SkillCall): Promise<SkillResult> {
  const { skillName, input, timeout = 30000, retryCount = 1 } = skillCall;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[SkillCall] Attempting ${skillName} (attempt ${attempt}/${retryCount})`);

      const session = await sessions_spawn({
        task: `请使用 ${skillName} 处理以下任务：

任务输入：
${JSON.stringify(input, null, 2)}

请执行 ${skillName}，并将最终结果以JSON格式输出。`,
        label: `skill-call-${skillName}-${Date.now()}`,
        mode: 'run',
        timeoutSeconds: Math.floor(timeout / 1000)
      });

      // 等待结果
      const result = await waitForSession(session.sessionKey, timeout);

      return {
        skillName,
        success: true,
        output: result,
        durationMs: Date.now() - startTime,
        attempts: attempt
      };

    } catch (error) {
      console.warn(`[SkillCall] ${skillName} failed on attempt ${attempt}: ${error}`);

      if (attempt === retryCount) {
        return {
          skillName,
          success: false,
          error: (error as Error).message,
          durationMs: Date.now() - startTime,
          attempts: attempt
        };
      }

      // 等待后重试（指数退避）
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  // 不应到达这里
  throw new Error('Unexpected error in callSkill');
}

// 并行调用多个Skill
async function callSkillsParallel(skillCalls: SkillCall[]): Promise<SkillResult[]> {
  const results = await Promise.allSettled(
    skillCalls.map(call => callSkill(call))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      skillName: skillCalls[index].skillName,
      success: false,
      error: (result as PromiseRejectedResult).reason?.message || 'Unknown error',
      durationMs: 0,
      attempts: 0
    };
  });
}

// 串行调用多个Skill（管道模式）
async function callSkillsPipeline(
  skillCalls: SkillCall[],
  initialInput: unknown
): Promise<SkillResult[]> {
  let currentOutput: unknown = initialInput;
  const results: SkillResult[] = [];

  for (const call of skillCalls) {
    const result = await callSkill({
      ...call,
      input: currentOutput  // 前一个Skill的输出作为输入
    });

    results.push(result);

    if (!result.success) {
      console.error(`[Pipeline] ${call.skillName} failed, stopping pipeline`);
      break;
    }

    currentOutput = result.output;
  }

  return results;
}

// 等待会话完成
function waitForSession(sessionKey: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Session ${sessionKey} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // 轮询会话状态（实际应使用事件驱动）
    const poll = async () => {
      try {
        const session = await sessions_list({ sessionKey });
        if (session.status === 'completed') {
          clearTimeout(timeout);
          resolve(session.output);
        } else {
          setTimeout(poll, 1000);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    poll();
  });
}

// 使用示例：组合天气Skill + 邮件Skill
async function weatherEmailWorkflow(city: string, recipient: string) {
  const pipelineResults = await callSkillsPipeline(
    [
      {
        skillName: 'weather',
        input: { city, format: 'detailed' },
        timeout: 15000,
        retryCount: 2
      },
      {
        skillName: 'send-email',
        input: {
          to: recipient,
          subject: `${city}今日天气`,
          body: ''  // 会被前一步输出填充
        },
        timeout: 20000,
        retryCount: 1
      }
    ],
    {}  // 初始输入
  );

  return pipelineResults;
}
```

### 4.4.2 事件驱动：Skill间解耦通信

紧密耦合的Skill调用有个问题：调用方需要知道被调Skill的存在。更优雅的方式是通过事件总线解耦：

```typescript
// skills/event-bus/skill-communication.ts
// 基于事件总线的Skill间通信

type EventHandler = (payload: unknown) => Promise<void>;

class SimpleEventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  // 订阅事件
  subscribe(event: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler]);

    // 返回取消订阅函数
    return () => {
      const handlers = this.handlers.get(event) || [];
      this.handlers.set(event, handlers.filter(h => h !== handler));
    };
  }

  // 发布事件
  async publish(event: string, payload: unknown): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    console.log(`[EventBus] Publishing ${event} to ${handlers.length} handlers`);

    await Promise.allSettled(
      handlers.map(handler => handler(payload))
    );
  }

  // 订阅一次性事件
  once(event: string, handler: EventHandler): Promise<unknown> {
    return new Promise(async (resolve) => {
      const unsubscribe = this.subscribe(event, async (payload) => {
        unsubscribe();
        await handler(payload);
        resolve(payload);
      });
    });
  }
}

// 全局事件总线实例
const globalEventBus = new SimpleEventBus();

// Skill A：发布事件
async function skillA_execute(input: string) {
  const result = await processUserInput(input);

  // 发布任务完成事件
  await globalEventBus.publish('task:completed', {
    taskId: `task-${Date.now()}`,
    input,
    result,
    timestamp: new Date().toISOString()
  });

  return { status: 'success', published: true };
}

// Skill B：订阅事件
const unsubscribeTaskCompleted = globalEventBus.subscribe(
  'task:completed',
  async (payload: any) => {
    console.log(`[SkillB] Received task completion: ${payload.taskId}`);

    // 执行后续处理
    if (payload.result.needsFollowUp) {
      await globalEventBus.publish('notification:send', {
        recipient: payload.result.owner,
        message: `任务 ${payload.input} 已完成`
      });
    }
  }
);

// Skill C：订阅通知事件
globalEventBus.subscribe('notification:send', async (payload: any) => {
  console.log(`[SkillC] Sending notification: ${payload.message}`);
  // 调用邮件或消息Skill发送通知
});
```

## 4.5 Skill发布到ClawHub

当一个Skill开发完成并经过充分测试后，可以发布到ClawHub与社区共享。ClawHub是OpenClaw的官方Skill市场，截至2026年4月已收录数百个社区Skill，覆盖浏览器自动化、记忆管理、多搜索引擎、企业集成等数十个分类。

### 4.5.1 发布前检查清单

在发布之前，确保Skill满足以下要求：

**必选项（审核必过）**
- `SKILL.md`文件存在且格式正确，包含`name`、`description`和`metadata.openclaw: {}`
- `description`清晰描述Skill的功能和使用场景，不超过200字
- Skill目录结构规范，主要文件在根目录下

**推荐项（提升质量）**
- 包含`README.md`详细文档
- 代码示例完整可运行
- 包含`scripts/`辅助脚本（如有需要）
- 在本地测试过加载和执行

**禁止项（直接拒绝）**
- 硬编码API密钥或密码
- 包含`eval()`或动态代码执行
- 未做任何输入验证
- 包含明显恶意代码

### 4.5.2 发布流程

第一步：准备目录结构

```bash
# 假设你要发布一个天气Skill
mkdir -p weather-skill
cd weather-skill

# 创建SKILL.md
cat > SKILL.md << 'EOF'
---
name: weather
description: "查询全球城市天气 - 支持3天预报和空气质量"
metadata:
  openclaw: {}
  author: "your-name"
  version: "1.0.0"
  tags: ["utilities", "weather", "api"]
---

# Weather Skill

## 功能

查询全球主要城市的天气预报，支持3天预报和空气质量指数。

## 使用方式

在Agent对话中直接说：
- "北京今天天气怎么样？"
- "上海未来三天天气预报"

## 依赖

- OpenWeatherMap API密钥（免费注册获取）

## 配置

在环境变量中设置：
```
OPENWEATHER_API_KEY=your_api_key_here
```
EOF

# 创建README.md
cat > README.md << 'EOF'
# Weather Skill

实时天气查询，支持全球城市和3天预报。

## 安装

\`\`\`bash
openclaw skills install weather
\`\`\`

## 配置

\`\`\`bash
export OPENWEATHER_API_KEY=your_free_api_key
\`\`\`

## 使用示例

\`\`\`
用户：北京天气怎么样？
Agent：[调用weather skill] → 返回预报信息
\`\`\`

## API限制

免费API限制：每分钟60次，每天100万次。生产环境建议使用付费方案。
EOF
```

第二步：本地验证

```bash
# 检查SKILL.md格式
cat weather-skill/SKILL.md | head -15

# 尝试加载（如果openclaw CLI支持）
openclaw skills list | grep -i weather || echo "Not installed yet"

# 检查硬编码密钥
grep -r "api[_-]key" weather-skill/ || echo "No API key found (good)"
grep -r "eval(" weather-skill/ || echo "No eval found (good)"
```

第三步：发布到ClawHub

```bash
# 使用clawhub CLI发布
npx clawhub publish ./weather-skill \
  --slug weather \
  --name "Weather Query" \
  --version 1.0.0 \
  --changelog "Initial release with 3-day forecast support"

# 或者使用交互模式
npx clawhub publish --interactive
```

### 4.5.3 Tags系统与分类

ClawHub使用Tags对Skill进行分类。合理的Tags能大幅提升Skill的发现率：

| Tag分类 | 适用场景 |
|--------|---------|
| `productivity` | 效率工具、自动化 |
| `memory` | 记忆管理、上下文 |
| `browser` | 浏览器自动化 |
| `search` | 搜索、多引擎 |
| `communication` | 消息、邮件、通知 |
| `development` | 代码、调试、技术 |
| `enterprise` | 企业工具集成 |
| `ai` | AI能力扩展 |

建议每个Skill选择2-5个Tags，既不过于狭窄也不过于宽泛。

### 4.5.4 完整可运行的Skill示例

以下是`browser-use` Skill的核心实现结构，这是一个ClawHub上的热门Skill：

```typescript
// skills/browser-use/SKILL.md
---
name: browser-use
description: "通过自然语言控制浏览器 - 导航、点击、填表、截图"
metadata:
  openclaw: {}
  author: "clawhub"
  version: "3.2.1"
  tags: ["browser", "automation", "web"]
---

# Browser Use Skill

通过自然语言描述控制浏览器，支持Chrome/Firefox/Edge。
```

```bash
# skills/browser-use/scripts/install.sh
#!/bin/bash
# 安装浏览器驱动依赖

# 安装Playwright（推荐）
npm install -g playwright
npx playwright install chromium

# 或者安装Selenium
# npm install -g selenium-webdriver
# npx selenium- install chrome

echo "Browser drivers installed"
```

```typescript
// skills/browser-use/src/browser-controller.ts
// 浏览器控制核心实现

interface BrowserAction {
  type: 'navigate' | 'click' | 'fill' | 'screenshot' | 'wait' | 'evaluate';
  target?: string;
  value?: string;
  options?: Record<string, unknown>;
}

class BrowserController {
  private browser: any = null;
  private page: any = null;

  async launch(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium') {
    const playwright = await import('playwright');
    this.browser = await playwright[browserType].launch({ headless: true });
    this.page = await this.browser.newPage();
    console.log(`[Browser] Launched ${browserType}`);
  }

  async executeAction(action: BrowserAction): Promise<unknown> {
    switch (action.type) {
      case 'navigate':
        await this.page.goto(action.target!, { waitUntil: 'networkidle' });
        return { success: true, url: this.page.url() };

      case 'click':
        await this.page.click(action.target!);
        return { success: true, clicked: action.target };

      case 'fill':
        await this.page.fill(action.target!, action.value!);
        return { success: true, filled: action.value };

      case 'screenshot':
        const path = action.value || `/tmp/screenshot-${Date.now()}.png`;
        await this.page.screenshot({ path });
        return { success: true, screenshotPath: path };

      case 'wait':
        await this.page.waitForTimeout(parseInt(action.value || '1000'));
        return { success: true };

      case 'evaluate':
        return await this.page.evaluate(action.value!);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async  
  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    console.log('[Browser] Closed');
  }
}

// Skill主执行函数
async function execute(input: { task: string; browser?: string }) {
  const controller = new BrowserController();
  
  try {
    await controller.launch(input.browser as any || 'chromium');
    
    // 解析自然语言任务为动作
    const actions = parseTaskToActions(input.task);
    
    const results = [];
    for (const action of actions) {
      const result = await controller.executeAction(action);
      results.push(result);
    }
    
    return {
      success: true,
      actions: results.length,
      results
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  } finally {
    await controller.close();
  }
}

// 简化版任务解析（实际可用LLM）
function parseTaskToActions(task: string): BrowserAction[] {
  const actions: BrowserAction[] = [];
  
  const navigateMatch = task.match(/打开?(?:网站|网址|URL)?[:：]?\s*(https?:\/\/[^\s]+|[^\s]+(?:\.com|\.cn|\.org)[^\s]*)/i);
  if (navigateMatch) {
    let url = navigateMatch[1];
    if (!url.startsWith('http')) url = 'https://' + url;
    actions.push({ type: 'navigate', target: url });
  }
  
  if (/截[图]/.test(task)) {
    actions.push({ type: 'screenshot', value: '/tmp/screenshot.png' });
  }
  
  if (/等待?(\d+)(?:秒|毫秒)/.test(task)) {
    const match = task.match(/等待?(\d+)(?:秒|毫秒)/);
    const ms = match![1] * (task.includes('秒') ? 1000 : 1);
    actions.push({ type: 'wait', value: String(ms) });
  }
  
  return actions;
}

export { BrowserController, execute };
```

### 4.5.5 版本管理与更新

当Skill需要更新时，使用语义化版本号：

```bash
# 1.0.0 → 1.0.1：小改动（Bug修复）
npx clawhub publish ./weather-skill --version 1.0.1 \
  --changelog "Fix: timezone offset calculation error"

# 1.0.1 → 1.1.0：新功能（向后兼容）
npx clawhub publish ./weather-skill --version 1.1.0 \
  --changelog "Add: air quality index (AQI) support"

# 1.1.0 → 2.0.0：破坏性变更（不兼容API修改）
npx clawhub publish ./weather-skill --version 2.0.0 \
  --changelog "Breaking: rename 'temperature' to 'temp' in output schema"
```

## 本章小结

本章我们深入了Skill开发的进阶内容，涵盖四个核心主题：

**Hook系统**：通过六种Hook类型（Start、Stop、Auth、UserPromptSubmit、PostToolUse、AgentResponse），你可以在Agent运行时的任何关键节点插入自定义逻辑。Hook的注册简单但能力强大，配合私有状态可以构建复杂的行为模式。

**Hook与Skill联动**：Hook本身只能观察和过滤，真正的业务逻辑需要通过Skill执行。通过在Hook中调用`sessions_spawn`，可以在特定条件下触发子Agent执行复杂的学习、分析、记录任务。

**多Step Skill**：对于需要多个步骤的业务流程，状态机模式是最清晰的设计。每个步骤独立可测试，支持条件执行、错误回滚和结果共享，是构建复杂自动化任务的推荐模式。

**Skill间通信**：紧耦合的`skill.execute`调用和基于事件总线的解耦通信各有适用场景。管道模式适合有明确依赖关系的步骤链，事件模式适合解耦的发布-订阅场景。

**ClawHub发布**：发布前检查清单能帮助避免常见的审核被拒原因。Tags的合理使用和清晰的README文档能大幅提升Skill的发现率和社区认可度。

下一章我们将进入Agent编排的学习，从Session机制到Multi-Agent Orchestrator，探索如何将多个Agent组织成协作网络，解决更复杂的任务。
