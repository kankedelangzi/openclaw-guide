/**
 * 模块4-Skills系统 - 代码示例
 * 
 * 本文件演示Skills系统的核心概念：
 * 1. SKILL.md frontmatter解析
 * 2. Skills配置结构
 * 3. SkillEligibilityContext检测
 */

// ============================================
// 1. SKILL.md Frontmatter 解析示例
// ============================================

/**
 * 解析YAML frontmatter
 * 这是OpenClaw解析SKILL.md的核心逻辑
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }
  
  const yamlStr = match[1];
  const result = {};
  
  // 简化的YAML解析器（支持基本类型）
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let currentIndent = 0;
  const stack = [{ obj: result, indent: -1 }];
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#')) continue; // 注释
    
    // 检测缩进级别变化
    while (indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].obj;
    
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIdx).trim();
      let value = trimmed.substring(colonIdx + 1).trim();
      
      if (value === '' || value === '|' || value === '>') {
        // 空值或块标量，准备嵌套
        parent[key] = {};
        stack.push({ obj: parent[key], indent });
      } else if (value.startsWith('"') && value.endsWith('"')) {
        parent[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        parent[key] = value.slice(1, -1);
      } else if (value === 'true') {
        parent[key] = true;
      } else if (value === 'false') {
        parent[key] = false;
      } else if (!isNaN(value)) {
        parent[key] = Number(value);
      } else {
        parent[key] = value;
      }
    }
  }
  
  return result;
}

// 示例：解析summarize技能的frontmatter
const sampleSkillContent = `---
name: summarize
description: Summarize or extract text from URLs.
metadata:
  openclaw:
    emoji: "🧾"
    requires:
      bins: ["summarize"]
    install:
      - id: "brew"
        kind: "brew"
        formula: "steipete/tap/summarize"
---

# Summarize

Fast CLI to summarize URLs...
`;

console.log('=== Frontmatter解析示例 ===');
console.log(parseFrontmatter(sampleSkillContent));

// ============================================
// 2. Skills配置结构
// ============================================

/**
 * OpenClaw Skills完整配置结构
 */
const skillsConfigExample = {
  // 全局Skills配置
  skills: {
    // 打包技能白名单（仅影响打包技能）
    allowBundled: ['healthcheck', 'tmux', 'github'],
    
    load: {
      // 额外扫描目录（最低优先级）
      extraDirs: [
        '~/.openclaw/custom-skills',
        '/opt/openclaw/skills'
      ],
      // 监视变化并刷新snapshot
      watch: true,
      // 监视防抖ms
      watchDebounceMs: 500
    },
    
    install: {
      // 优先使用brew安装
      preferBrew: true,
      // Node包管理器
      nodeManager: 'pnpm'
    },
    
    limits: {
      // 每个root最大子目录数
      maxCandidatesPerRoot: 100,
      // 每个source最大加载数
      maxSkillsLoadedPerSource: 50,
      // 模型可见最大技能数
      maxSkillsInPrompt: 20,
      // 技能提示最大字符数
      maxSkillsPromptChars: 10000,
      // SKILL.md最大字节数
      maxSkillFileBytes: 50000
    },
    
    // 每技能配置
    entries: {
      'github': {
        enabled: true,
        apiKey: 'sk-xxx',  // 实际使用时从secrets读取
        env: {
          GITHUB_TOKEN: 'ghp_xxx'
        },
        config: {
          defaultRepo: 'openclaw/openclaw'
        }
      },
      'weather': {
        enabled: true,
        config: {
          defaultUnit: 'celsius',
          defaultLocation: 'Beijing'
        }
      }
    }
  }
};

// ============================================
// 3. Agent级别Skills配置
// ============================================

/**
 * 在Agent配置中引用Skills
 */
const agentConfigExample = {
  id: 'coding-assistant',
  name: 'Coding Assistant',
  workspace: '~/.openclaw/workspace-coding',
  
  // Agent专属技能白名单
  skills: [
    'github',
    'summarize',
    'skill-creator'
  ],
  
  // 其他Agent配置...
  model: {
    id: 'anthropic/claude-sonnet-4-5'
  }
};

// ============================================
// 4. SkillEligibilityContext检测
// ============================================

/**
 * 模拟技能Eligibility检测
 */
function checkSkillEligibility(entry, context) {
  const { skill, metadata } = entry;
  
  // 检查OS要求
  if (metadata?.os) {
    const currentOS = process.platform; // 'darwin' | 'linux' | 'win32'
    const osMap = {
      'darwin': 'macos',
      'linux': 'linux',
      'win32': 'windows'
    };
    const currentOSName = osMap[currentOS];
    
    if (!metadata.os.includes(currentOSName)) {
      return { eligible: false, reason: `OS not supported: ${metadata.os.join(', ')}` };
    }
  }
  
  // 检查二进制依赖
  if (metadata?.requires?.bins && context?.remote) {
    for (const bin of metadata.requires.bins) {
      if (!context.remote.hasBin(bin)) {
        return { eligible: false, reason: `Missing required binary: ${bin}` };
      }
    }
  }
  
  // 检查任一二进制依赖
  if (metadata?.requires?.anyBins && context?.remote) {
    const hasAny = metadata.requires.anyBins.some(bin => context.remote.hasBin(bin));
    if (!hasAny) {
      return { eligible: false, reason: `Missing any of: ${metadata.requires.anyBins.join(', ')}` };
    }
  }
  
  return { eligible: true };
}

// 示例：检测一个技能是否可用
const skillEntry = {
  skill: { name: 'summarize' },
  metadata: {
    os: ['linux', 'macos'],
    requires: {
      bins: ['summarize']
    }
  }
};

const eligibilityContext = {
  remote: {
    platforms: ['linux', 'macos'],
    hasBin: (bin) => bin === 'summarize', // 假设有这个二进制
    hasAnyBin: (bins) => bins.some(b => b === 'summarize')
  }
};

console.log('\n=== Eligibility检测示例 ===');
console.log(checkSkillEligibility(skillEntry, eligibilityContext));

// ============================================
// 5. SkillSnapshot构建流程
// ============================================

/**
 * 模拟SkillSnapshot构建
 */
function buildSkillSnapshot(skills, options = {}) {
  const {
    maxSkillsInPrompt = 20,
    maxSkillsPromptChars = 10000,
    skillFilter = null
  } = options;
  
  // 过滤技能
  let filtered = skills;
  if (skillFilter && skillFilter.length > 0) {
    filtered = skills.filter(s => skillFilter.includes(s.name));
  }
  
  // 限制数量
  filtered = filtered.slice(0, maxSkillsInPrompt);
  
  // 构建prompt
  const promptParts = [];
  let totalChars = 0;
  
  for (const skill of filtered) {
    const entry = `${skill.name}: ${skill.description}`;
    if (totalChars + entry.length > maxSkillsPromptChars) {
      break;
    }
    promptParts.push(entry);
    totalChars += entry.length;
  }
  
  return {
    prompt: promptParts.join('\n'),
    skills: filtered.map(s => ({
      name: s.name,
      primaryEnv: s.metadata?.primaryEnv,
      requiredEnv: s.metadata?.requires?.env || []
    })),
    skillFilter,
    version: 1
  };
}

// 示例：构建技能快照
const sampleSkills = [
  { name: 'github', description: 'GitHub operations', metadata: {} },
  { name: 'summarize', description: 'Summarize URLs and files', metadata: { primaryEnv: 'SUMMARIZE_API_KEY' } },
  { name: 'weather', description: 'Weather information', metadata: { requires: { env: ['WEATHER_API_KEY'] } } },
  { name: 'tmux', description: 'Terminal multiplexer', metadata: {} }
];

console.log('\n=== SkillSnapshot构建示例 ===');
console.log(buildSkillSnapshot(sampleSkills, { maxSkillsInPrompt: 3 }));

// ============================================
// 6. 完整的SKILL.md示例（带metadata）
// ============================================

const completeSkillExample = `---
name: custom-skill
description: A complete example skill demonstrating all frontmatter fields.
metadata:
  openclaw:
    always: false                    # 是否总是加载
    skillKey: "custom-skill-v1"     # 技能唯一标识
    primaryEnv: "CUSTOM_API_KEY"     # 主要环境变量
    emoji: "🎯"                     # 表情符号
    homepage: "https://example.com" # 技能主页
    os: ["linux", "macos"]          # 支持的操作系统
    requires:
      bins: ["curl", "jq"]          # 必需的二进制文件
      anyBins: ["python3", "python"] # 任一必需的二进制
      env: ["API_SECRET"]           # 必需的环境变量
      config: ["./config.json"]    # 必需的配置文件
    install:
      - id: "brew-formula"
        kind: "brew"
        label: "Install via Homebrew"
        formula: "custom/formula"
        bins: ["custom-tool"]
        os: ["darwin"]
      - id: "npm-package"
        kind: "node"
        label: "Install via npm"
        package: "custom-tool-cli"
        bins: ["custom-tool"]
        os: ["linux", "darwin"]
---

# Custom Skill

This skill demonstrates all available frontmatter fields.

## When to use

- Example triggers based on description matching

## Workflow

1. Check prerequisites (bins, env)
2. Load configuration
3. Execute task

## Reference

See [references/detailed-guide.md](references/detailed-guide.md) for more.
`;

console.log('\n=== 完整SKILL.md示例 ===');
console.log('Name:', parseFrontmatter(completeSkillExample)?.name);
console.log('Metadata:', JSON.stringify(parseFrontmatter(completeSkillExample)?.metadata, null, 2));
