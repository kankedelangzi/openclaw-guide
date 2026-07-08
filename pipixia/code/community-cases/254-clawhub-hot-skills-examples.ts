/**
 * 第254轮：ClawHub热门技能代码实例
 * 
 * 基于Self-Improving Agent、Skill Vetter、ontology三个核心技能的设计思路
 * 实现简化版的自改进学习系统和知识图谱
 */

// ==================== 1. Self-Improving Agent 简化实现 ====================

interface LearningEntry {
  id: string;
  date: string;
  category: 'correction' | 'best_practice' | 'knowledge_gap';
  trigger: string;
  learning: string;
  applied: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  area: 'frontend' | 'backend' | 'infra' | 'tests' | 'docs' | 'config';
}

interface ErrorEntry {
  id: string;
  command: string;
  error: string;
  rootCause: string;
  fix: string;
  status: 'resolved' | 'workaround' | 'unresolved';
  timestamp: number;
}

class SelfImprovingAgent {
  private learnings: LearningEntry[] = [];
  private errors: ErrorEntry[] = [];
  
  /**
   * 记录学习条目（简化版Self-Improving Agent）
   */
  logLearning(
    category: LearningEntry['category'],
    trigger: string,
    learning: string,
    applied: string,
    priority: LearningEntry['priority'] = 'medium',
    area: LearningEntry['area'] = 'backend'
  ): LearningEntry {
    const entry: LearningEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      category,
      trigger,
      learning,
      applied,
      priority,
      area
    };
    
    this.learnings.push(entry);
    console.log(`[Learning] ${category.toUpperCase()}: ${learning}`);
    return entry;
  }
  
  /**
   * 记录错误条目
   */
  logError(
    command: string,
    error: string,
    rootCause: string,
    fix: string
  ): ErrorEntry {
    const entry: ErrorEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command,
      error,
      rootCause,
      fix,
      status: 'resolved',
      timestamp: Date.now()
    };
    
    this.errors.push(entry);
    console.log(`[Error] Command failed: ${command}`);
    console.log(`  Root cause: ${rootCause}`);
    console.log(`  Fix: ${fix}`);
    return entry;
  }
  
  /**
   * 升级高频学习到核心配置（简化版）
   */
  promoteToCore(learningId: string): void {
    const learning = this.learnings.find(l => l.id === learningId);
    if (!learning) {
      console.log('Learning entry not found');
      return;
    }
    
    // 统计同类别学习频率
    const sameCategory = this.learnings.filter(l => l.category === learning.category);
    if (sameCategory.length >= 3) {
      console.log(`[Promote] Moving to AGENTS.md: ${learning.learning}`);
      // 实际实现会写入 AGENTS.md 文件
    }
  }
  
  /**
   * 生成学习报告
   */
  generateReport(): string {
    const report = `
# Self-Improvement Report

## Learning Entries (${this.learnings.length})
${this.learnings.map(l => `- [${l.priority}] ${l.category}: ${l.learning}`).join('\n')}

## Error Entries (${this.errors.length})
${this.errors.map(e => `- ${e.command}: ${e.error}`).join('\n')}
    `.trim();
    
    return report;
  }
}

// ==================== 2. Skill Vetter 简化实现 ====================

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

interface SkillVettingResult {
  skillName: string;
  riskLevel: RiskLevel;
  concerns: string[];
  recommendations: string[];
  verdict: 'APPROVE' | 'APPROVE_WITH_CAUTION' | 'REJECT';
}

class SkillVetter {
  /**
   * 执行技能审查（简化版Skill Vetter）
   */
  vetSkill(
    skillName: string,
    source: { author: string; stars: number; lastUpdate: string },
    permissions: string[],
    codeSnippet: string
  ): SkillVettingResult {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: RiskLevel = 'LOW';
    
    // Step 1: Source Check
    if (source.stars < 50) {
      concerns.push('Low GitHub stars (< 50)');
      riskLevel = this.escalateRisk(riskLevel, 'MEDIUM');
    }
    
    // Step 2: Code Review (simplified)
    if (codeSnippet.includes('eval(') || codeSnippet.includes('exec(')) {
      concerns.push('Uses dangerous eval/exec');
      riskLevel = this.escalateRisk(riskLevel, 'HIGH');
    }
    
    if (codeSnippet.includes('process.env') || codeSnippet.includes('API_KEY')) {
      concerns.push('Accesses environment variables (potential credential leak)');
      riskLevel = this.escalateRisk(riskLevel, 'MEDIUM');
    }
    
    // Step 3: Permission Scope
    const dangerousPerms = ['file:write', 'shell:exec', 'network:all'];
    const hasDangerousPerms = permissions.some(p => dangerousPerms.includes(p));
    if (hasDangerousPerms) {
      concerns.push('Requests dangerous permissions');
      riskLevel = this.escalateRisk(riskLevel, 'HIGH');
    }
    
    // Step 4: Verdict
    let verdict: SkillVettingResult['verdict'] = 'APPROVE';
    if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
      verdict = 'REJECT';
      recommendations.push('DO NOT INSTALL - Manual review required');
    } else if (riskLevel === 'MEDIUM') {
      verdict = 'APPROVE_WITH_CAUTION';
      recommendations.push('Review code before each use');
    }
    
    return {
      skillName,
      riskLevel,
      concerns,
      recommendations,
      verdict
    };
  }
  
  private escalateRisk(current: RiskLevel, target: RiskLevel): RiskLevel {
    const levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
    const currentIdx = levels.indexOf(current);
    const targetIdx = levels.indexOf(target);
    return targetIdx > currentIdx ? target : current;
  }
}

// ==================== 3. Ontology 简化实现 ====================

interface OntologyEntity {
  id: string;
  type: 'Person' | 'Project' | 'Task' | 'Event' | 'Document';
  name: string;
  attributes: Record<string, any>;
  links: Array<{ targetId: string; relation: string }>;
  created_at: string;
  updated_at: string;
}

class Ontology {
  private entities: Map<string, OntologyEntity> = new Map();
  
  /**
   * 创建实体（简化版ontology）
   */
  createEntity(
    type: OntologyEntity['type'],
    name: string,
    attributes: Record<string, any> = {}
  ): OntologyEntity {
    const id = `${type.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date().toISOString();
    
    const entity: OntologyEntity = {
      id,
      type,
      name,
      attributes,
      links: [],
      created_at: now,
      updated_at: now
    };
    
    this.entities.set(id, entity);
    console.log(`[Ontology] Created ${type}: ${name} (${id})`);
    return entity;
  }
  
  /**
   * 创建关系链接
   */
  linkEntities(sourceId: string, targetId: string, relation: string): void {
    const source = this.entities.get(sourceId);
    if (!source) {
      throw new Error(`Source entity not found: ${sourceId}`);
    }
    
    source.links.push({ targetId, relation });
    source.updated_at = new Date().toISOString();
    console.log(`[Ontology] Linked ${sourceId} --[${relation}]--> ${targetId}`);
  }
  
  /**
   * 查询实体（简化版图谱遍历）
   */
  query(
    filter: Partial<Pick<OntologyEntity, 'type' | 'name'>> = {}
  ): OntologyEntity[] {
    let results = Array.from(this.entities.values());
    
    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    
    if (filter.name) {
      results = results.filter(e => e.name.includes(filter.name!));
    }
    
    return results;
  }
  
  /**
   * 获取实体的完整关系图（简化版）
   */
  getGraph(entityId: string, depth: number = 2): string {
    const visited = new Set<string>();
    
    const traverse = (id: string, currentDepth: number): string => {
      if (currentDepth > depth || visited.has(id)) return '';
      visited.add(id);
      
      const entity = this.entities.get(id);
      if (!entity) return '';
      
      let result = `${'  '.repeat(currentDepth)}${entity.type}: ${entity.name}\n`;
      for (const link of entity.links) {
        result += traverse(link.targetId, currentDepth + 1);
      }
      return result;
    };
    
    return traverse(entityId, 0);
  }
}

// ==================== 使用示例 ====================

function runExamples() {
  console.log('=== ClawHub Hot Skills Examples ===\n');
  
  // 1. Self-Improving Agent 示例
  console.log('--- 1. Self-Improving Agent ---');
  const agent = new SelfImprovingAgent();
  
  agent.logLearning(
    'correction',
    'User corrected my git push command',
    'Need to configure SSH keys before pushing',
    'Check SSH config before git push',
    'high',
    'infra'
  );
  
  agent.logError(
    'npm install',
    'EACCES: permission denied',
    'npm prefix set to global directory without permissions',
    'Use nvm or set npm prefix to user directory',
  );
  
  console.log('\n' + agent.generateReport());
  
  // 2. Skill Vetter 示例
  console.log('\n--- 2. Skill Vetter ---');
  const vetter = new SkillVetter();
  
  const result = vetter.vetSkill(
    'dangerous-skill',
    { author: 'unknown', stars: 5, lastUpdate: '2024-01-01' },
    ['file:write', 'shell:exec'],
    'eval(process.env.API_KEY); console.log("Hello");'
  );
  
  console.log(`Skill: ${result.skillName}`);
  console.log(`Risk Level: ${result.riskLevel}`);
  console.log(`Concerns: ${result.concerns.join(', ')}`);
  console.log(`Verdict: ${result.verdict}`);
  
  // 3. Ontology 示例
  console.log('\n--- 3. Ontology ---');
  const ontology = new Ontology();
  
  const person = ontology.createEntity('Person', '大鱼', { email: '308035773@qq.com' });
  const project = ontology.createEntity('Project', 'OpenClaw学习', { status: 'active' });
  const task = ontology.createEntity('Task', '完成第254轮', { priority: 'high' });
  
  ontology.linkEntities(person.id, project.id, 'owns');
  ontology.linkEntities(project.id, task.id, 'has_task');
  ontology.linkEntities(task.id, person.id, 'assigned_to');
  
  console.log('\nGraph for Person (depth=2):');
  console.log(ontology.getGraph(person.id, 2));
  
  console.log('\nQuery Projects:', ontology.query({ type: 'Project' }).map(e => e.name));
}

// 运行示例
runExamples();
