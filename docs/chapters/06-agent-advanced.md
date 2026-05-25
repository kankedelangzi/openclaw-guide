# 第六章：Agent编排进阶

前面章节我们已经掌握了Session管理、子Agent并行、多模型路由等基础能力。本章我们将深入Multi-Agent协同的核心：如何设计一个能协调多个Agent完成复杂任务的编排系统，以及如何通过Workflow实现自动化任务调度。

## 6.1 Multi-Agent Orchestrator架构模式

当单Agent无法独立完成复杂任务时，我们需要多个Agent协同工作。OpenClaw中Multi-Agent编排有三种核心架构模式。

### 6.1.1 Sequential Orchestrator（顺序编排）

顺序编排是最简单的模式：按任务依赖顺序串行执行子Agent，每个Agent的输出作为下一个Agent的输入。

适用场景：任务有明确的先后依赖关系，如"研究→整理→写作→审核"的内容创作流水线。

```typescript
// 顺序编排器实现
class SequentialOrchestrator {
  private agents: Agent[];
  
  constructor(agents: Agent[]) {
    this.agents = agents;
  }
  
  async execute(task: Task): Promise<Result> {
    let context = task.initialContext;
    const executionLog: ExecutionRecord[] = [];
    
    for (const agent of this.agents) {
      console.log(`[Sequential] Executing agent: ${agent.id}`);
      
      const startTime = Date.now();
      const result = await agent.execute(context);
      const duration = Date.now() - startTime;
      
      executionLog.push({
        agentId: agent.id,
        duration,
        status: 'completed'
      });
      
      // 将输出作为下一个Agent的输入
      context = {
        ...context,
        output: result.output,
        previousResults: [...context.previousResults || [], { agent: agent.id, result }]
      };
    }
    
    return {
      output: context.output,
      executionLog
    };
  }
}

// 使用示例：内容创作流水线
const contentPipeline = new SequentialOrchestrator([
  researchAgent,    // 1. 研究阶段
  outlineAgent,    // 2. 整理大纲
  writingAgent,    // 3. 撰写内容
  editingAgent     // 4. 编辑审核
]);

const result = await contentPipeline.execute({
  initialContext: { topic: 'OpenClaw Multi-Agent架构' }
});
```

### 6.1.2 Broadcast Orchestrator（广播编排）

广播编排将同一任务同时分发给多个Agent，收集汇总结果。适用场景：多路搜索、多角度分析、方案对比等独立并行任务。

```typescript
// 广播编排器实现
class BroadcastOrchestrator<A extends Agent, R extends Result> {
  private aggregator: ResultAggregator<A, R>;
  
  constructor(
    private agents: A[],
    private aggregator: ResultAggregator<A, R>
  ) {}
  
  async execute(task: Task): Promise<AggregatedResult<R>> {
    console.log(`[Broadcast] Distributing to ${this.agents.length} agents`);
    
    // 并行执行所有Agent
    const results = await Promise.all(
      this.agents.map(agent => agent.execute(task.initialContext))
    );
    
    console.log(`[Broadcast] Received ${results.length} results, aggregating...`);
    
    // 聚合结果
    return this.aggregator.merge(results);
  }
}

// 结果聚合器接口
interface ResultAggregator<A extends Agent, R extends Result> {
  merge(results: R[]): AggregatedResult<R>;
}

// 投票聚合器：适用于多角度分析场景
class VotingAggregator<R extends Result> implements ResultAggregator<Agent, R> {
  merge(results: R[]): AggregatedResult<R> {
    const votes = new Map<string, number>();
    
    for (const result of results) {
      for (const item of result.items || []) {
        votes.set(item.value, (votes.get(item.value) || 0) + (item.weight || 1));
      }
    }
    
    const sorted = Array.from(votes.entries())
      .sort((a, b) => b[1] - a[1]);
    
    return {
      winner: sorted[0]?.[0] || '',
      scores: Object.fromEntries(sorted),
      confidence: sorted[0]?.[1] ? sorted[0][1] / results.length : 0,
      totalVotes: results.length
    };
  }
}

// 使用示例：多角度分析
const analysisTeam = new BroadcastOrchestrator(
  [
    technicalAnalysisAgent,   // 技术角度
    businessAnalysisAgent,   // 商业角度
    riskAnalysisAgent,       // 风险角度
    marketAnalysisAgent      // 市场角度
  ],
  new VotingAggregator()
);

const analysis = await analysisTeam.execute({
  initialContext: { target: '某科技公司IPO分析' }
});
```

### 6.1.3 Hierarchical Orchestrator（层级编排）

层级编排引入Manager Agent负责任务分解和结果汇总，下层多个Worker Agent负责具体执行。适用场景：复杂任务需要智能分解、动态资源分配。

```typescript
// 层级编排器实现
class HierarchicalOrchestrator {
  private manager: Agent;
  private workers: Map<string, Agent[]>;
  private taskQueue: PriorityQueue<SubTask>;
  
  constructor(
    manager: Agent,
    workerPools: Map<string, Agent[]>
  ) {
    this.manager = manager;
    this.workers = workerPools;
    this.taskQueue = new PriorityQueue<SubTask>(
      (a, b) => b.priority - a.priority
    );
  }
  
  async execute(task: Task): Promise<Result> {
    console.log(`[Hierarchical] Manager ${this.manager.id} decomposing task...`);
    
    // 第一阶段：Manager分解任务
    const decomposition = await this.manager.execute({
      ...task.initialContext,
      action: 'decompose',
      constraints: {
        maxSubtasks: task.maxSubtasks || 10,
        workerTypes: Array.from(this.workers.keys())
      }
    });
    
    const subTasks: SubTask[] = decomposition.subTasks;
    console.log(`[Hierarchical] Decomposed into ${subTasks.length} subtasks`);
    
    // 第二阶段：并行执行子任务
    const subResults = await Promise.all(
      subTasks.map(st => this.dispatchToWorker(st))
    );
    console.log(`[Hierarchical] All subtasks completed`);
    
    // 第三阶段：Manager汇总结果
    const aggregation = await this.manager.execute({
      ...task.initialContext,
      action: 'aggregate',
      subResults
    });
    
    return aggregation;
  }
  
  private async dispatchToWorker(task: SubTask): Promise<SubResult> {
    const workerPool = this.workers.get(task.type) || [];
    if (workerPool.length === 0) {
      throw new Error(`No workers available for task type: ${task.type}`);
    }
    
    // 选择最空闲的Worker
    const worker = this.selectLeastLoadedWorker(workerPool);
    console.log(`[Hierarchical] Dispatching ${task.id} to ${worker.id}`);
    
    return worker.execute(task);
  }
  
  private selectLeastLoadedWorker(workers: Agent[]): Agent {
    return workers.reduce((best, current) => {
      const bestLoad = this.getWorkerLoad(best);
      const currentLoad = this.getWorkerLoad(current);
      return currentLoad < bestLoad ? current : best;
    });
  }
  
  private getWorkerLoad(agent: Agent): number {
    // 根据活跃任务数计算负载
    return agent.activeTasks || 0;
  }
}

// 使用示例：智能客服系统
const customerServiceTeam = new HierarchicalOrchestrator(
  triageManager,     // Manager：任务分诊
  new Map([
    ['billing', [billingAgent1, billingAgent2]],
    ['technical', [techAgent1, techAgent2]],
    ['complaint', [complaintAgent1]]
  ])
);

const result = await customerServiceTeam.execute({
  initialContext: { customerId: 'C10086', issue: '账单异常' },
  maxSubtasks: 5
});
```

## 6.2 Agent间通信协议

多个Agent协同工作时，它们之间需要标准化的通信机制。OpenClaw提供两种核心通信模式：消息总线（Switchboard）和点对点直连（P2P）。

### 6.2.1 Claw Switchboard消息总线

Switchboard是基于topic的发布-订阅消息总线，支持消息路由、订阅过滤、负载均衡。

```typescript
// Switchboard消息总线核心接口
interface Switchboard {
  // 发布消息到主题
  publish(topic: string, message: SwitchboardMessage): void;
  
  // 订阅主题，返回订阅句柄
  subscribe(
    topic: string, 
    handler: MessageHandler
  ): Subscription;
  
  // 请求-响应模式
  request(
    topic: string, 
    message: SwitchboardMessage,
    timeout?: number
  ): Promise<Response>;
  
  // P2P直连通道
  connect(peerId: string): PeerChannel;
  
  // 取消订阅
  unsubscribe(subscription: Subscription): void;
}

// 消息结构
interface SwitchboardMessage {
  id: string;
  topic: string;
  payload: any;
  sender: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// 订阅处理器
type MessageHandler = (message: SwitchboardMessage) => Promise<any> | any;
```

消息总线的核心使用模式：

```typescript
// 示例：研究-写作团队协作
class ResearchWritingTeam {
  private switchboard: Switchboard;
  private researchAgent: Agent;
  private writingAgent: Agent;
  
  async setup() {
    // 写作Agent订阅研究主题
    const researchSub = this.switchboard.subscribe('topic/research', async (msg) => {
      console.log(`[Writer] Received research request: ${msg.id}`);
      
      const researchResult = await this.researchAgent.execute({
        query: msg.payload.query,
        depth: msg.payload.depth || 'normal'
      });
      
      return { status: 'ready', data: researchResult };
    });
    
    // 质量审核Agent订阅完成主题
    const qualitySub = this.switchboard.subscribe('topic/publish', async (msg) => {
      console.log(`[Quality] Checking content quality...`);
      return await this.qualityAgent.execute(msg.payload);
    });
    
    // Manager协调整个流程
    await this.coordinate();
  }
  
  async coordinate() {
    // 发布研究任务
    const researchTopic = 'topic/research';
    this.switchboard.publish(researchTopic, {
      id: `msg-${Date.now()}`,
      topic: researchTopic,
      payload: {
        query: '分析OpenClaw Multi-Agent架构的最新发展',
        depth: 'deep'
      },
      sender: 'manager'
    });
    
    // 等待研究结果后发布写作任务
    const researchResult = await this.switchboard.request(
      'topic/research',
      { /* ... */ },
      30000 // 30秒超时
    );
    
    // 发布写作任务
    this.switchboard.publish('topic/write', {
      payload: {
        researchData: researchResult.data,
        style: 'technical',
        audience: 'developers'
      }
    });
  }
}
```

### 6.2.2 P2P直连通道

对于私密通信或低延迟场景，Switchboard提供P2P直连通道：

```typescript
// P2P直连通道
interface PeerChannel {
  readonly peerId: string;
  readonly remotePeerId: string;
  
  // 发送消息
  send(message: PeerMessage): void;
  
  // 接收消息
  onMessage(handler: (msg: PeerMessage) => void): void;
  
  // 请求-响应
  request(message: PeerMessage, timeout?: number): Promise<PeerMessage>;
  
  // 关闭通道
  close(): void;
}

// 使用示例
class P2PCollaboration {
  private channel: PeerChannel;
  
  async setup(peerId: string) {
    // 建立P2P通道
    this.channel = this.switchboard.connect(peerId);
    
    // 监听对方消息
    this.channel.onMessage(async (msg) => {
      console.log(`[P2P] Received from ${msg.sender}:`, msg.type);
      
      switch (msg.type) {
        case 'delegate_task':
          const result = await this.executeTask(msg.payload);
          this.channel.send({
            type: 'task_result',
            payload: result
          });
          break;
          
        case 'sync_state':
          await this.handleStateSync(msg.payload);
          break;
      }
    });
  }
  
  // 委托任务给对端
  async delegateTask(task: Task): Promise<Result> {
    const response = await this.channel.request({
      type: 'delegate_task',
      payload: task
    }, 60000);
    
    return response.payload;
  }
}
```

### 6.2.3 消息主题设计模式

良好的topic设计是消息总线可维护性的关键：

```typescript
// 推荐的主题命名规范
const Topics = {
  // 任务流
  TASK_DISPATCH: 'task/dispatch/{taskType}',
  TASK_RESULT: 'task/result/{taskId}',
  TASK_PROGRESS: 'task/progress/{taskId}',
  
  // 协作事件
  COLLAB_REQUEST: 'collab/{teamId}/request',
  COLLAB_RESPONSE: 'collab/{teamId}/response',
  
  // 系统事件
  AGENT_HEARTBEAT: 'system/heartbeat/{agentId}',
  AGENT_STATUS: 'system/status/{agentId}',
  
  // 通配符订阅示例
  ALL_TASK_RESULTS: 'task/result/*',      // 监听所有任务结果
  TEAM_TASKS: 'task/dispatch/team-*',      // 监听团队所有任务
};
```

## 6.3 Workflow自动化与任务调度

Workflow将Multi-Agent协作固化为可重复执行的自动化流程。结合OpenClaw的cron系统，可以实现定时任务和事件驱动任务。

### 6.3.1 DAG任务图设计

复杂Workflow通常建模为DAG（有向无环图），节点是任务，边是依赖关系：

```typescript
// DAG任务定义
interface DAGTask {
  id: string;
  name: string;
  dependencies: string[];   // 依赖的任务ID
  execute: () => Promise<TaskResult>;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

// DAG执行器
class DAGExecutor {
  private tasks: Map<string, DAGTask> = new Map();
  private results: Map<string, TaskResult> = new Map();
  
  addTask(task: DAGTask): this {
    this.tasks.set(task.id, task);
    return this;
  }
  
  async execute(): Promise<Map<string, TaskResult>> {
    const inDegree = this.computeIndegrees();
    const queue = this.buildInitialQueue(inDegree);
    
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      const task = this.tasks.get(taskId)!;
      
      console.log(`[DAG] Executing: ${task.name}`);
      
      // 等待依赖完成
      const depsResults = task.dependencies.map(depId => this.results.get(depId));
      
      // 执行任务
      const result = await this.executeWithRetry(task, depsResults);
      this.results.set(taskId, result);
      
      // 更新入度，入度为0的加入队列
      this.propagateCompletion(taskId, inDegree, queue);
    }
    
    return this.results;
  }
  
  private async executeWithRetry(
    task: DAGTask, 
    depsResults: (TaskResult | undefined)[]
  ): Promise<TaskResult> {
    const maxRetries = task.retryPolicy?.maxRetries || 0;
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          task.execute(),
          this.timeout(task.timeout || 60000)
        ]);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`[DAG] Task ${task.id} attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries) {
          await this.delay(task.retryPolicy!.backoff || 1000 * Math.pow(2, attempt));
        }
      }
    }
    
    throw new Error(`Task ${task.id} failed after ${maxRetries} retries: ${lastError}`);
  }
}
```

### 6.3.2 Workflow与Cron集成

OpenClaw的cron系统可以驱动Workflow定时执行：

```typescript
// 定时报告生成Workflow
const dailyReportWorkflow = new DAGExecutor()
  .addTask({
    id: 'fetch_data',
    name: '获取数据',
    dependencies: [],
    execute: async () => {
      return await dataAgent.execute({ action: 'fetch', range: 'daily' });
    }
  })
  .addTask({
    id: 'analyze',
    name: '数据分析',
    dependencies: ['fetch_data'],
    execute: async () => {
      const data = workflow.results.get('fetch_data');
      return await analyticsAgent.execute({ data });
    }
  })
  .addTask({
    id: 'generate_report',
    name: '生成报告',
    dependencies: ['analyze'],
    execute: async () => {
      const analysis = workflow.results.get('analyze');
      return await reportAgent.execute({ analysis, template: 'daily' });
    }
  })
  .addTask({
    id: 'send_report',
    name: '发送报告',
    dependencies: ['generate_report'],
    execute: async () => {
      const report = workflow.results.get('generate_report');
      return await notifier.execute({ report, recipients: ['manager@company.com'] });
    },
    retryPolicy: { maxRetries: 3, backoff: 5000 }
  });

// 通过cron定时触发
cron.add({
  name: 'daily-report',
  schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
  payload: {
    kind: 'agentTurn',
    message: 'Execute daily report workflow'
  },
  delivery: { mode: 'announce' }
});
```

## 6.4 决策树与规划

在动态任务场景下，Agent需要根据状态做决策。OpenClaw支持两种规划模式：基于规则的决策树和基于LLM的动态规划。

### 6.4.1 规则决策树

适用于状态明确、转换规则固定的场景：

```typescript
// 决策树节点
interface DecisionNode {
  id: string;
  condition: (context: WorkflowContext) => boolean;
  action: (context: WorkflowContext) => Promise<Transition>;
}

// 工作流状态机
class WorkflowStateMachine {
  private states: Map<string, StateNode> = new Map();
  private currentState: string;
  
  constructor(initialState: string) {
    this.currentState = initialState;
  }
  
  addState(id: string, node: StateNode): this {
    this.states.set(id, node);
    return this;
  }
  
  async transition(context: WorkflowContext): Promise<void> {
    const currentNode = this.states.get(this.currentState)!;
    
    // 执行入口动作
    if (currentNode.onEnter) {
      await currentNode.onEnter(context);
    }
    
    // 评估决策条件，找到下一个状态
    for (const transition of currentNode.transitions) {
      if (transition.condition(context)) {
        console.log(`[FSM] Transition: ${this.currentState} -> ${transition.target}`);
        
        // 执行退出动作
        if (currentNode.onExit) {
          await currentNode.onExit(context);
        }
        
        this.currentState = transition.target;
        return this.transition(context);  // 递归处理新状态
      }
    }
    
    // 无匹配转换，停在终态
    console.log(`[FSM] Reached terminal state: ${this.currentState}`);
  }
}

// 示例：客服工单处理状态机
const ticketWorkflow = new WorkflowStateMachine('new')
  .addState('new', {
    transitions: [
      { condition: ctx => ctx.ticket.priority === 'urgent', target: 'urgent_queue' },
      { condition: ctx => ctx.ticket.type === 'billing', target: 'billing' },
      { condition: ctx => true, target: 'general' }
    ]
  })
  .addState('urgent_queue', {
    onEnter: async (ctx) => {
      await notifier.alert({ message: 'Urgent ticket!', ticket: ctx.ticket });
    },
    transitions: [
      { condition: ctx => ctx.escalated, target: 'escalated' },
      { condition: ctx => true, target: 'resolved' }
    ]
  })
  .addState('billing', {
    transitions: [
      { condition: ctx => ctx.resolved, target: 'resolved' },
      { condition: ctx => ctx.needsRefund, target: 'refund' }
    ]
  })
  .addState('refund', {
    transitions: [
      { condition: ctx => ctx.refundApproved, target: 'resolved' },
      { condition: ctx => ctx.refundDenied, target: 'closed' }
    ]
  })
  .addState('resolved', {
    onEnter: async (ctx) => {
      await surveyAgent.execute({ ticket: ctx.ticket });
    },
    transitions: []
  });
```

### 6.4.2 LLM动态规划

适用于复杂、不确定场景，让LLM决定下一步行动：

```typescript
// 动态规划器
class DynamicPlanner {
  private plannerModel: Model;
  private executorAgent: Agent;
  
  async plan(task: Task, maxSteps: number = 10): Promise<Plan> {
    const plan: PlanStep[] = [];
    let currentContext = task.initialContext;
    
    for (let step = 0; step < maxSteps; step++) {
      // 让Planner模型决定下一步
      const nextStep = await this.plannerModel.complete({
        prompt: this.buildPlanningPrompt(task, plan, currentContext),
        schema: PlanStepSchema
      });
      
      if (nextStep.type === 'finish') {
        plan.push(nextStep);
        break;
      }
      
      // 执行步骤
      const result = await this.executeStep(nextStep, currentContext);
      currentContext = { ...currentContext, lastResult: result };
      plan.push({ ...nextStep, result });
      
      // 检查是否需要重新规划
      if (nextStep.type === 'replan') {
        console.log('[Planner] Context changed, replanning...');
      }
    }
    
    return { steps: plan, finalContext: currentContext };
  }
  
  private buildPlanningPrompt(
    task: Task, 
    completedSteps: PlanStep[],
    context: any
  ): string {
    return `
Task: ${task.description}
    
Completed steps:
${completedSteps.map(s => `- ${s.action}: ${s.result}`).join('\n')}

Current context:
${JSON.stringify(context, null, 2)}

Available actions:
- research(query): 搜索信息
- analyze(data, type): 分析数据
- write(content, format): 撰写内容
- review(draft): 审核内容
- delegate(agent, task): 委托给其他Agent
- finish(result): 完成任务

What should I do next? Choose ONE action and explain why.
`;
  }
}
```

## 6.5 实战案例：自动化内容创作流水线

下面我们构建一个完整的自动化内容创作系统，整合所有编排模式：

```typescript
// 自动化内容创作Workflow
class ContentCreationWorkflow {
  private orchestrator: HierarchicalOrchestrator;
  private switchboard: Switchboard;
  
  constructor() {
    this.switchboard = new Switchboard();
    this.setupMessageBus();
    
    // 构建层级编排团队
    this.orchestrator = new HierarchicalOrchestrator(
      contentManager,  // Manager: 分解任务、协调流程
      new Map([
        ['research', [researchAgent1, researchAgent2]],
        ['writing', [blogWriter, techWriter]],
        ['design', [imageAgent]],
        ['review', [grammarReview, factCheck]]
      ])
    );
  }
  
  private setupMessageBus() {
    // 订阅质量检查事件
    this.switchboard.subscribe('quality/check', async (msg) => {
      return await this.qualityAgent.execute(msg.payload);
    });
    
    // 订阅发布事件
    this.switchboard.subscribe('publish/target', async (msg) => {
      return await this.publishAgent.execute(msg.payload);
    });
  }
  
  async createContent(request: ContentRequest): Promise<ContentResult> {
    console.log(`[Workflow] Starting content creation: ${request.topic}`);
    
    // 使用层级编排执行
    const result = await this.orchestrator.execute({
      initialContext: {
        topic: request.topic,
        style: request.style,
        audience: request.audience,
        channels: request.targetChannels
      },
      maxSubtasks: 8
    });
    
    // 发布到目标渠道
    for (const channel of request.targetChannels) {
      this.switchboard.publish('publish/target', {
        payload: {
          content: result.output,
          channel,
          schedule: request.publishTime
        }
      });
    }
    
    return result;
  }
}

// 使用示例
const workflow = new ContentCreationWorkflow();

const result = await workflow.createContent({
  topic: 'OpenClaw Multi-Agent架构实战',
  style: 'technical',
  audience: 'AI开发者',
  targetChannels: ['blog', 'twitter', 'newsletter'],
  publishTime: '2026-04-28T10:00:00+08:00'
});

console.log(`Content created and scheduled: ${result.status}`);
```

## 本章小结

本章深入介绍了OpenClaw Agent编排的进阶能力：

1. **三种Orchestrator模式**：Sequential适合有明确依赖的流水线，Broadcast适合多路并行分析，Hierarchical适合需要智能分解的复杂任务。

2. **消息总线Switchboard**：基于topic的发布-订阅机制，支持请求-响应和P2P直连，是Multi-Agent通信的标准基础设施。

3. **DAG任务图**：通过拓扑排序保证依赖顺序的执行，支持重试策略和超时控制，是Workflow自动化的核心模型。

4. **决策树与动态规划**：规则决策树适用于状态明确的场景，LLM动态规划适用于需要判断的复杂场景。

5. **完整案例**：内容创作流水线展示了所有编排模式的综合应用，是实际项目的参考模板。

掌握这些能力后，你已经具备了设计复杂Multi-Agent系统的全栈能力。下一章我们将学习记忆系统，了解OpenClaw如何持久化上下文和跨会话学习。
