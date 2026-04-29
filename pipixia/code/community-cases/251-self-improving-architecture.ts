/**
 * 第251轮：Self-Improving Agent 架构模式实战
 * 
 * 核心代码模式：
 * 1. AgentHandover MCP接口定义
 * 2. EvolveClaw Sidecar通信协议
 * 3. 双记忆架构（战略/战术）
 * 4. 6-Gate质量控制模拟
 */

// =============================================================================
// 1. AgentHandover MCP Server 接口
// =============================================================================

interface Skill {
  slug: string;
  name: string;
  description: string;
  strategy: string;       // 策略：为什么这样做
  steps: string[];         // 执行步骤
  guardrails: string[];    // 安全限制
  selectionCriteria: string[];  // 选择标准
  voiceAndStyle: {
    tone: string;
    sentenceStyle: string;
    emoji: boolean;
    examples: string[];
  };
  confidence: number;      // 0-100，基于执行历史
  sessionsLearned: number;
  executionProtocol: {
    reportStart: string;
    reportStepResult: string;
    reportComplete: string;
  };
}

// MCP工具接口
interface AgentHandoverMCP {
  list_ready_skills(): Promise<Skill[]>;
  get_skill(slug: string): Promise<Skill>;
  search_skills(query: string): Promise<Skill[]>;
  list_all_skills(): Promise<Skill[]>;
  get_user_profile(): Promise<UserProfile>;
  report_execution_start(slug: string): Promise<void>;
  report_step_result(stepId: string, result: StepResult): Promise<void>;
  report_execution_complete(
    slug: string,
    success: boolean,
    notes?: string
  ): Promise<ExecutionReport>;
}

interface UserProfile {
  tools: string[];
  workingHours: { start: string; end: string };
  writingStyle: {
    tone: 'casual' | 'formal' | 'technical';
    sentenceLength: 'short' | 'medium' | 'long';
    emoji: boolean;
  };
  preferences: Record<string, string>;
}

interface StepResult {
  stepId: string;
  actualAction: string;
  expectedAction: string;
  deviation: number;  // 0 = 无偏离, 1 = 完全偏离
  success: boolean;
  duration: number;   // ms
}

interface ExecutionReport {
  skillSlug: string;
  overallSuccess: boolean;
  totalDuration: number;
  stepsCompleted: number;
  deviations: number;
  newDecisionBranch?: string;
  confidenceDelta: number;
}

// =============================================================================
// 2. EvolveClaw Sidecar 通信协议
// =============================================================================

// StepRequest - 报告执行步骤供分析
interface StepRequest {
  agent_name: string;
  agent_role?: string;
  task: string;
  model_output?: string;
  tool_calls?: string;
  observations?: string;
  error?: string;
  current_system_prompt?: string;
  task_id?: string;
  conversation_history?: string;
}

// StepResponse - 分析结果
interface StepResponse {
  guideline: string | null;
  guideline_type: 'strategic' | 'tactical' | null;
  guideline_id: string | null;
  skipped: boolean;
  reason: string | null;
}

// RulesResponse - 获取战略规则
interface RulesResponse {
  rules: string;
  rule_count: number;
}

// ConfigureRequest - 传递LLM配置
interface ConfigureRequest {
  provider: 'anthropic' | 'openai' | 'litellm';
  model: string;
  api_key: string;
  base_url?: string;
}

// FastAPI端点映射
const EVOLVECLAW_ENDPOINTS = {
  health: 'GET /health',
  configure: 'POST /configure',
  getRules: (agentName: string) => `GET /rules/${agentName}`,
  analyzeStep: 'POST /step',
  reset: 'POST /reset',
  stats: (agentName: string) => `GET /stats/${agentName}`,
} as const;

// =============================================================================
// 3. 双记忆架构实现
// =============================================================================

type GuidelineType = 'strategic' | 'tactical';
type GuidelineDomain = 
  | 'user_preferences'
  | 'code_quality'
  | 'communication_style'
  | 'workflow_patterns'
  | 'task_execution'
  | 'tool_usage'
  | 'safety_and_correctness';

interface Guideline {
  id: string;
  text: string;
  type: GuidelineType;
  domain: GuidelineDomain;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  source: 'error' | 'quality_efficiency' | 'quality_thoroughness';
  taskId?: string;         // 战术规则的分组ID
  createdAt: number;
  lastUsedAt: number;
  hitCount: number;         // 被应用的次数
}

class DualMemoryManager {
  private strategicRules: Map<string, Guideline[]> = new Map();  // agentName → rules
  private tacticalRules: Map<string, Guideline[]> = new Map();    // taskId → rules
  private maxStrategicPerDomain = 5;
  private maxGuidelines = 30;

  // 获取当前有效的所有规则
  getActiveGuidelines(agentName: string, taskId?: string): Guideline[] {
    const strategic = this.strategicRules.get(agentName) || [];
    const tactical = taskId ? (this.tacticalRules.get(taskId) || []) : [];
    
    // 战略规则优先，按置信度排序
    const all = [...strategic, ...tactical];
    all.sort((a, b) => {
      const confidenceRank = { high: 0, medium: 1, low: 2 };
      return confidenceRank[a.confidence] - confidenceRank[b.confidence];
    });
    
    // 限制总数
    return all.slice(0, this.maxGuidelines);
  }

  // 添加规则
  addGuideline(agentName: string, guideline: Guideline): void {
    if (guideline.type === 'strategic') {
      this.addStrategicRule(agentName, guideline);
    } else {
      this.addTacticalRule(guideline.taskId!, guideline);
    }
  }

  private addStrategicRule(agentName: string, guideline: Guideline): void {
    const rules = this.strategicRules.get(agentName) || [];
    
    // 检查是否重复
    if (rules.some(r => r.text === guideline.text)) {
      return;
    }
    
    // 按domain分组限制
    const domainRules = rules.filter(r => r.domain === guideline.domain);
    if (domainRules.length >= this.maxStrategicPerDomain) {
      // 移除最低置信度的
      domainRules.sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.confidence] - rank[b.confidence];
      });
      const toRemove = domainRules[0];
      const idx = rules.indexOf(toRemove);
      rules.splice(idx, 1);
    }
    
    rules.push(guideline);
    this.strategicRules.set(agentName, rules);
  }

  private addTacticalRule(taskId: string, guideline: Guideline): void {
    const rules = this.tacticalRules.get(taskId) || [];
    rules.push(guideline);
    this.tacticalRules.set(taskId, rules);
  }

  // 清除战术记忆（会话结束时）
  clearTacticalMemory(taskId: string): void {
    this.tacticalRules.delete(taskId);
  }

  // 清除所有战术记忆（新会话开始时）
  clearAllTacticalMemory(): void {
    this.tacticalRules.clear();
  }

  // 从规则列表生成系统提示片段
  formatForSystemPrompt(agentName: string, taskId?: string): string {
    const guidelines = this.getActiveGuidelines(agentName, taskId);
    if (guidelines.length === 0) return '';

    const strategic = guidelines.filter(g => g.type === 'strategic');
    const tactical = guidelines.filter(g => g.type === 'tactical');

    let output = '\n\n## PERSISTENT GUIDELINES (learned from past interactions)\n';
    for (const g of strategic) {
      output += `- ${g.text}  [${g.domain}:${g.confidence}]\n`;
    }

    if (tactical.length > 0) {
      output += '\n## TASK-SPECIFIC GUIDELINES (ephemeral)\n';
      for (const g of tactical) {
        output += `- ${g.text}\n`;
      }
    }

    return output;
  }
}

// =============================================================================
// 4. 6-Gate 质量控制系统
// =============================================================================

type LifecycleStage = 'observed' | 'draft' | 'reviewed' | 'verified' | 'agent_ready';

interface SkillQuality {
  slug: string;
  lifecycle: LifecycleStage;
  trust: boolean;
  lastObserved: number;    // timestamp
  observationCount: number;
  executionHistory: ExecutionRecord[];
  confidence: number;      // 0-100
  contradictions: number;
}

interface ExecutionRecord {
  timestamp: number;
  success: boolean;
  deviationCount: number;
  duration: number;
  agent: string;
}

class SixGateQualityControl {
  private skills: Map<string, SkillQuality> = new Map();

  // Gate 1: Lifecycle - 检查是否推进到下一阶段
  private canPromoteLifecycle(skill: SkillQuality, toStage: LifecycleStage): boolean {
    const stages: LifecycleStage[] = ['observed', 'draft', 'reviewed', 'verified', 'agent_ready'];
    const currentIdx = stages.indexOf(skill.lifecycle);
    const targetIdx = stages.indexOf(toStage);

    // 不能跳级
    if (targetIdx > currentIdx + 1) return false;
    
    // 降级总是可以
    if (targetIdx < currentIdx) return true;

    // 推进需要最低观察次数
    const minObservations: Record<LifecycleStage, number> = { 
      observed: 0, draft: 1, reviewed: 3, verified: 5, agent_ready: 10
    };
    return skill.observationCount >= (minObservations[toStage] || 0);
  }

  // Gate 2: Trust - 用户是否授权Agent执行
  private hasTrust(skill: SkillQuality): boolean {
    return skill.trust;
  }

  // Gate 3: Freshness - 是否最近被观察到
  private isFresh(skill: SkillQuality, maxAgeDays = 7): boolean {
    const ageMs = Date.now() - skill.lastObserved;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    return ageMs < maxAgeMs;
  }

  // Gate 4: Preflight - 前置条件检查（模拟）
  private passPreflight(skill: SkillQuality): boolean {
    // 实际实现会检查：所需App是否运行、blocked domains等
    return true;
  }

  // Gate 5: Evidence - 足够证据
  private hasEnoughEvidence(skill: SkillQuality): boolean {
    const minConfidence = 70;
    const maxContradictions = 2;
    return skill.confidence >= minConfidence && skill.contradictions <= maxContradictions;
  }

  // Gate 6: Execution History - 执行成功率
  private hasGoodHistory(skill: SkillQuality): boolean {
    const recent = skill.executionHistory.slice(-10);
    if (recent.length < 3) return true;  // 少于3次执行不降级
    
    const failures = recent.filter(r => !r.success).length;
    return failures < 3;  // 10次内失败少于3次
  }

  // 综合检查：是否可以通过所有Gate执行
  canExecute(skillSlug: string): { allowed: boolean; blockedBy: string[] } {
    const skill = this.skills.get(skillSlug);
    if (!skill) return { allowed: false, blockedBy: ['not_found'] };

    const blockedBy: string[] = [];

    // 检查所有Gate
    if (!this.hasTrust(skill)) blockedBy.push('trust');
    if (!this.isFresh(skill)) blockedBy.push('freshness');
    if (!this.passPreflight(skill)) blockedBy.push('preflight');
    if (!this.hasEnoughEvidence(skill)) blockedBy.push('evidence');
    if (!this.hasGoodHistory(skill)) blockedBy.push('execution_history');

    // Lifecycle必须是agent_ready
    if (skill.lifecycle !== 'agent_ready') blockedBy.push('lifecycle_not_ready');

    return { allowed: blockedBy.length === 0, blockedBy };
  }

  // 执行后更新质量状态
  updateAfterExecution(
    skillSlug: string,
    success: boolean,
    deviationCount: number,
    duration: number,
    agent: string
  ): void {
    const skill = this.skills.get(skillSlug);
    if (!skill) return;

    // 记录执行历史
    skill.executionHistory.push({
      timestamp: Date.now(),
      success,
      deviationCount,
      duration,
      agent,
    });

    // 更新置信度
    if (success && deviationCount === 0) {
      skill.confidence = Math.min(100, skill.confidence + 5);
    } else if (deviationCount > 2) {
      skill.confidence = Math.max(0, skill.confidence - 10);
    } else if (!success) {
      skill.confidence = Math.max(0, skill.confidence - 15);
    }

    // 失败降级
    const recent = skill.executionHistory.slice(-7);
    const recentFailures = recent.filter(r => !r.success).length;
    if (recentFailures >= 3) {
      this.demote(skillSlug);
    }
  }

  // 降级Skill
  private demote(skillSlug: string): void {
    const skill = this.skills.get(skillSlug);
    if (!skill) return;

    const stages: LifecycleStage[] = ['observed', 'draft', 'reviewed', 'verified', 'agent_ready'];
    const currentIdx = stages.indexOf(skill.lifecycle);
    if (currentIdx > 0) {
      skill.lifecycle = stages[currentIdx - 1];
    }
  }

  // 推进Lifecycle
  promote(skillSlug: string, toStage: LifecycleStage): boolean {
    const skill = this.skills.get(skillSlug);
    if (!skill) return false;

    if (this.canPromoteLifecycle(skill, toStage)) {
      skill.lifecycle = toStage;
      return true;
    }
    return false;
  }
}

// =============================================================================
// 5. SCOPE分析器模拟
// =============================================================================

interface SCOPEAnalysisResult {
  guideline: string | null;
  guidelineType: GuidelineType | null;
  guidelineId: string | null;
  skipped: boolean;
  reason: string | null;
}

type ReflectionType = 'error' | 'quality_efficiency' | 'quality_thoroughness';

class SCOPEAnalyzer {
  private qualityThreshold = 0.7;
  private strategicConfidenceThreshold = 0.8;
  private maxRulesPerTask = 5;

  async analyzeStep(
    req: StepRequest,
    reflectionType: ReflectionType
  ): Promise<SCOPEAnalysisResult> {
    // 模拟：基于错误类型决定是否生成guideline
    if (req.error) {
      return this.analyzeError(req);
    }
    
    if (reflectionType === 'quality_efficiency') {
      return this.analyzeQualityEfficiency(req);
    }

    return { guideline: null, guidelineType: null, guidelineId: null, skipped: true, reason: 'no_issue_detected' };
  }

  private analyzeError(req: StepRequest): SCOPEAnalysisResult {
    // 模拟：从错误中提取guideline
    if (!req.error) {
      return { guideline: null, guidelineType: null, guidelineId: null, skipped: true, reason: 'no_error' };
    }

    const guidelineText = this.extractGuidelineFromError(req.error, req.task);
    
    if (!guidelineText) {
      return { guideline: null, guidelineType: null, guidelineId: null, skipped: true, reason: 'not_actionable' };
    }

    return {
      guideline: guidelineText,
      guidelineType: 'strategic',
      guidelineId: `err_${Date.now()}`,
      skipped: false,
      reason: null,
    };
  }

  private analyzeQualityEfficiency(req: StepRequest): SCOPEAnalysisResult {
    // 模拟：分析响应质量
    // 实际会调用LLM分析
    return { guideline: null, guidelineType: null, guidelineId: null, skipped: true, reason: 'quality_acceptable' };
  }

  private extractGuidelineFromError(error: string, task: string): string | null {
    // 模拟：基于错误模式返回guideline
    const patterns: [RegExp, string][] = [
      [/permission denied/i, 'Always check file permissions before writing'],
      [/not found/i, 'Verify file paths exist before operating on them'],
      [/timeout/i, 'Add timeout parameters and handle timeout gracefully'],
      [/invalid argument/i, 'Validate all tool arguments match expected types'],
    ];

    for (const [pattern, guideline] of patterns) {
      if (pattern.test(error)) {
        return guideline;
      }
    }

    return null;
  }
}

// =============================================================================
// 6. 执行反馈闭环
// =============================================================================

class ExecutionFeedbackLoop {
  private qualityControl: SixGateQualityControl;
  private memory: DualMemoryManager;

  constructor() {
    this.qualityControl = new SixGateQualityControl();
    this.memory = new DualMemoryManager();
  }

  async executeWithFeedback(
    skill: Skill,
    executeFn: (step: string) => Promise<void>
  ): Promise<ExecutionReport> {
    const startTime = Date.now();
    let deviations = 0;
    const stepResults: StepResult[] = [];

    // 报告开始
    // await agenthandover.report_execution_start(skill.slug);

    try {
      for (const step of skill.steps) {
        const stepStart = Date.now();
        
        try {
          await executeFn(step);
          
          // 报告步骤结果
          // await agenthandover.report_step_result(step.id, {
          //   stepId: step.id,
          //   actualAction: step.description,
          //   expectedAction: step.description,
          //   deviation: 0,
          //   success: true,
          //   duration: Date.now() - stepStart,
          // });
          
          stepResults.push({
            stepId: step,
            actualAction: step,
            expectedAction: step,
            deviation: 0,
            success: true,
            duration: Date.now() - stepStart,
          });
        } catch (error) {
          deviations++;
          // await agenthandover.report_step_result(step.id, {
          //   stepId: step.id,
          //   actualAction: String(error),
          //   expectedAction: step.description,
          //   deviation: 1,
          //   success: false,
          //   duration: Date.now() - stepStart,
          // });
          
          stepResults.push({
            stepId: step,
            actualAction: String(error),
            expectedAction: step,
            deviation: 1,
            success: false,
            duration: Date.now() - stepStart,
          });
        }
      }

      const success = deviations === 0;
      
      // 更新质量状态
      this.qualityControl.updateAfterExecution(
        skill.slug,
        success,
        deviations,
        Date.now() - startTime,
        'openclaw'
      );

      return {
        skillSlug: skill.slug,
        overallSuccess: success,
        totalDuration: Date.now() - startTime,
        stepsCompleted: stepResults.filter(r => r.success).length,
        deviations,
        confidenceDelta: success ? 5 : -15,
      };
    } finally {
      // 报告完成
      // await agenthandover.report_execution_complete(
      //   skill.slug,
      //   stepResults.every(r => r.success),
      //   stepResults.map(r => `${r.stepId}:${r.success ? 'ok' : 'fail'}`).join(',')
      // );
    }
  }
}

export {
  Skill,
  AgentHandoverMCP,
  StepRequest,
  StepResponse,
  RulesResponse,
  ConfigureRequest,
  DualMemoryManager,
  Guideline,
  SixGateQualityControl,
  SCOPEAnalyzer,
  ExecutionFeedbackLoop,
  ExecutionReport,
};
