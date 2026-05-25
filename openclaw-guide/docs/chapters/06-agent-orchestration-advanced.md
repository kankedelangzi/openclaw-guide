# 第六章：Agent编排进阶

> 如果说第五章是学会走路，这一章就是学会跑。

## 6.1 Multi-Agent Orchestrator

当单个Agent能力不够时，需要多个Agent协同工作。OpenClaw的Orchestrator模式是解决复杂任务的标配。

### 核心概念

Orchestrator（编排器）负责：
1. 任务分解：将复杂请求拆解为子任务
2. 角色分配：决定哪个Agent处理哪个子任务
3. 结果聚合：将多个Agent的输出合并为统一响应
4. 流程控制：处理依赖关系、错误恢复

```typescript
// Orchestrator核心接口
interface Orchestrator {
  decompose(task: string): Promise<Task[]>;
  assign(task: Task, agents: Agent[]): Promise<AgentAssignment>;
  execute(assignment: AgentAssignment): AsyncGenerator<ExecutionEvent>;
  aggregate(results: SubResult[]): Promise<string>;
}

interface Task {
  id: string;
  description: string;
  priority: number;
  dependencies: string[];  // 依赖的其他任务ID
}

interface AgentAssignment {
  taskId: string;
  agentId: string;
  context: AgentContext;
}
```

### Fan-Out / Fan-In模式

最常用的编排模式：分发 → 并行执行 → 聚合结果。

```typescript
// Fan-Out / Fan-In 编排器
class FanOutInOrchestrator implements Orchestrator {
  private agentPool: AgentPool;
  
  async orchestrate(task: string): Promise<string> {
    // 1. 分解任务
    const tasks = await this.decompose(task);
    
    // 2. Fan-Out：并行分发任务给多个Agent
    const assignments = tasks.map(task => ({
      task,
      agent: this.agentPool.getAvailable()
    }));
    
    const executions = assignments.map(a => 
      a.agent.execute(a.task, a.context)
    );
    
    // 3. 等待所有执行完成（fan-in）
    const results = await Promise.all(executions);
    
    // 4. 聚合结果
    return this.aggregate(results);
  }
}

// Agent池管理
class AgentPool {
  private agents: Map<string, Agent> = new Map();
  private queue: string[] = [];
  
  getAvailable(): Agent {
    // 轮询获取可用Agent
    const id = this.queue.shift()!;
    const agent = this.agents.get(id)!;
    this.queue.push(id);
    return agent;
  }
  
  release(agent: Agent): void {
    // Agent执行完毕，归还池中
  }
}
```

### Chain模式（任务链）

串行执行，上一个Agent的输出作为下一个Agent的输入：

```typescript
// Chain模式：串行编排
class ChainOrchestrator {
  async orchestrate(task: string, chain: Agent[]): Promise<string> {
    let currentOutput = task;
    
    for (const agent of chain) {
      const result = await agent.execute(
        currentOutput,
        this.buildContext(agent)
      );
      currentOutput = result;
    }
    
    return currentOutput;
  }
  
  private buildContext(agent: Agent): AgentContext {
    return {
      model: agent.preferredModel,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature
    };
  }
}

// 使用示例
const chain = new ChainOrchestrator();
const result = await chain.orchestrate(
  "分析今天的技术趋势",
  [
    searchAgent,      // 第一步：搜索信息
    summarizerAgent,  // 第二步：摘要
    writerAgent       // 第三步：写作
  ]
);
```

## 6.2 Agent间通信协议

### Claw Switchboard

Switchboard是OpenClaw的消息总线，允许Agent之间相互通信：

```typescript
// Switchboard消息格式
interface SwitchboardMessage {
  from: string;       // 发送者Agent ID
  to: string;        // 接收者Agent ID（可填broadcast）
  type: 'task' | 'result' | 'query' | 'signal';
  payload: any;
  replyTo?: string;  // 回调消息ID
}

// Switchboard路由
class Switchboard {
  private subscriptions: Map<string, Set<(msg: SwitchboardMessage) => void>> = new Map();
  
  subscribe(agentId: string, handler: (msg: SwitchboardMessage) => void): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set());
    }
    this.subscriptions.get(agentId)!.add(handler);
  }
  
  publish(message: SwitchboardMessage): void {
    const handlers = this.subscriptions.get(message.to);
    if (handlers) {
      handlers.forEach(h => h(message));
    }
    
    // broadcast处理
    if (message.to === 'broadcast') {
      this.subscriptions.forEach((handlers) => {
        handlers.forEach(h => h(message));
      });
    }
  }
}
```

### P2P直接通信

Agent可以直接发送消息给另一个Agent：

```typescript
// Agent间直接通信
class AgentClient {
  constructor(
    private session: Session,
    private switchboard: Switchboard
  ) {}
  
  // 直接发送任务给另一个Agent
  async sendTask(to: string, task: Task): Promise<Result> {
    return new Promise((resolve, reject) => {
      const correlationId = uuid();
      
      // 设置超时
      const timeout = setTimeout(() => {
        this.switchboard.unsubscribe(correlationId);
        reject(new Error('Task timeout'));
      }, 60000);
      
      // 订阅结果
      this.switchboard.subscribe(correlationId, (msg) => {
        clearTimeout(timeout);
        resolve(msg.payload);
      });
      
      // 发送任务
      this.switchboard.publish({
        from: this.session.agentId,
        to,
        type: 'task',
        payload: task,
        replyTo: correlationId
      });
    });
  }
}
```

## 6.3 Workflow自动化

### CronJob集成

定时任务可以通过cron表达式触发Workflow：

```typescript
// Workflow定义
interface Workflow {
  id: string;
  name: string;
  trigger: CronExpression | ManualTrigger;
  steps: WorkflowStep[];
  onError?: ErrorHandlingStrategy;
}

interface WorkflowStep {
  id: string;
  type: 'agent' | 'skill' | 'http' | 'condition';
  config: StepConfig;
  next?: string[];     // 下一步骤ID列表
  onError?: string;    // 错误时跳转
}

// Workflow引擎
class WorkflowEngine {
  private cronScheduler: CronScheduler;
  
  async executeWorkflow(workflow: Workflow, context: WorkflowContext): Promise<void> {
    const execution = this.createExecution(workflow);
    
    for (const step of workflow.steps) {
      try {
        await this.executeStep(step, execution, context);
        
        // 根据结果决定下一步
        const nextSteps = this.resolveNextSteps(step, execution);
        for (const nextId of nextSteps) {
          const nextStep = workflow.steps.find(s => s.id === nextId);
          if (nextStep) {
            await this.executeStep(nextStep, execution, context);
          }
        }
      } catch (error) {
        if (step.onError) {
          const errorStep = workflow.steps.find(s => s.id === step.onError);
          if (errorStep) {
            await this.executeStep(errorStep, execution, context);
          }
        } else if (workflow.onError === 'abort') {
          throw error;
        }
      }
    }
  }
}

// Workflow调度器
class WorkflowScheduler {
  scheduleWorkflow(workflow: Workflow): void {
    if (workflow.trigger.kind === 'cron') {
      this.cronScheduler.add(workflow.trigger.expr, () => {
        this.engine.executeWorkflow(workflow, {});
      });
    }
  }
}
```

### 条件分支与循环

```typescript
// 条件分支步骤
class ConditionStep implements WorkflowStep {
  async execute(execution: Execution, context: WorkflowContext): Promise<void> {
    const result = execution.getLastResult();
    
    // 评估条件
    const condition = this.evaluate(this.config.condition, result);
    
    if (condition) {
      execution.setNextSteps(this.config.onTrue);
    } else {
      execution.setNextSteps(this.config.onFalse);
    }
  }
  
  private evaluate(condition: string, context: any): boolean {
    // 简单的条件评估
    const fn = new Function('context', `return ${condition}`);
    return fn(context);
  }
}

// 并行执行步骤
class ParallelStep implements WorkflowStep {
  async execute(execution: Execution, context: WorkflowContext): Promise<void> {
    const results = await Promise.all(
      this.config.steps.map(step => 
        this.engine.executeStep(step, execution, context)
      )
    );
    
    execution.setResult(this.config.collector, results);
  }
}
```

## 6.4 WorkflowPlanner

让Agent自动规划任务分解和执行顺序：

```typescript
// Workflow自动规划器
class WorkflowPlanner {
  private llm: LLMClient;
  
  async plan(task: string, availableAgents: Agent[]): Promise<Workflow> {
    // 构建规划Prompt
    const prompt = `
你是一个Workflow规划专家。用户需求是：

${task}

可用Agent：
${availableAgents.map(a => `- ${a.name}: ${a.capabilities}`).join('\n')}

请规划执行步骤，包括：
1. 任务分解
2. 执行顺序（考虑依赖关系）
3. 每个步骤使用的Agent
4. 错误处理策略

以JSON格式输出：
{
  "steps": [
    {"agent": "xxx", "input": "xxx", "dependsOn": []}
  ]
}
`;
    
    const response = await this.llm.complete(prompt);
    const plan = JSON.parse(response.content);
    
    return this.buildWorkflow(task, plan);
  }
  
  private buildWorkflow(task: string, plan: Plan): Workflow {
    return {
      id: uuid(),
      name: `Auto: ${task.substring(0, 30)}`,
      trigger: { kind: 'manual' },
      steps: plan.steps.map((s, i) => ({
        id: `step-${i}`,
        type: 'agent',
        config: {
          agentName: s.agent,
          input: s.input
        },
        next: [`step-${i + 1}`],
        onError: `error-handler`
      }))
    };
  }
}
```

## 6.5 案例：自动化工作流

### 完整示例：技术周报生成

```typescript
// 定义工作流
const techReportWorkflow: Workflow = {
  id: 'tech-report-weekly',
  name: '技术周报生成',
  trigger: { kind: 'cron', expr: '0 9 * * 5' },  // 每周五9点
  steps: [
    {
      id: 'search-trends',
      type: 'agent',
      config: {
        agentName: 'search-agent',
        systemPrompt: '搜索本周技术趋势',
        input: 'search:技术趋势 本周'
      },
      next: ['analyze-trends', 'search-news']
    },
    {
      id: 'analyze-trends',
      type: 'agent',
      config: {
        agentName: 'analyzer-agent',
        systemPrompt: '分析技术趋势数据'
      }
    },
    {
      id: 'search-news',
      type: 'agent',
      config: {
        agentName: 'search-agent',
        systemPrompt: '搜索本周技术新闻',
        input: 'search:技术新闻 本周'
      }
    },
    {
      id: 'compile-report',
      type: 'agent',
      config: {
        agentName: 'writer-agent',
        systemPrompt: '汇总生成技术周报'
      },
      dependsOn: ['analyze-trends', 'search-news']
    },
    {
      id: 'send-report',
      type: 'skill',
      config: {
        skillName: 'email-sender',
        params: {
          to: 'team@company.com',
          subject: '技术周报'
        }
      }
    }
  ]
};

// 执行工作流
const engine = new WorkflowEngine();
await engine.executeWorkflow(techReportWorkflow, {});
```

## 6.6 小结

这一章我们学了：
- Multi-Agent Orchestrator的Fan-Out/Fan-In和Chain模式
- Agent间通过Switchboard和P2P通信
- Workflow自动化与CronJob集成
- WorkflowPlanner自动规划任务分解

下一章我们将学习 **记忆系统**，了解OpenClaw如何管理Agent的上下文和长期记忆。

→ [第七章：记忆系统](../openclaw-internals/docs/chapters/08-memory.md)（深入原理）
→ [第七章：记忆系统应用](../openclaw-guide/docs/chapters/07-memory.md)（实战指南）
