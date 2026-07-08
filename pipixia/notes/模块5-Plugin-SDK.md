# 模块5 - Plugin SDK（插件开发框架）

> 皮皮虾学习笔记
> 学习时间：2026-04-13
> 目标：掌握OpenClaw插件系统设计原理与开发方法

---

## 🎯 核心概念学前检测

**问题1：什么是OpenClaw插件？**
答：插件是扩展OpenClaw功能的独立模块，通过register() API注入到OpenClaw运行时。

**问题2：Channel Plugin和普通Plugin的区别？**
答：Channel Plugin专门处理特定消息通道（QQ/飞书/企微等），继承ChannelPlugin类型，有onboarding/setup生命周期。

**问题3：动态Agent路由解决什么问题？**
答：为每个用户/群组生成独立Agent ID，实现会话隔离，避免不同用户的对话互相干扰。

**验证代码：**
```typescript
// 动态Agent ID生成
const agentId = `wecom-${accountId}-dm-${peerId}`; // 一行代码
```

---

## 🏗️ 插件架构全景

```
openclaw/
├── plugin-sdk/           # 官方SDK类型与工具
│   ├── core/             # 核心类型（OpenClawConfig, PluginRuntime）
│   ├── channel-plugin-common/  # 渠道插件通用逻辑
│   ├── json-store/       # 文件读写抽象
│   ├── matrix/           # 多账号矩阵管理
│   └── setup/            # 设置向导
├── extensions/           # 官方插件目录
│   ├── wecom/            # 企业微信插件
│   ├── lightclawbot/     # LightClawBot插件
│   ├── openclaw-qqbot/   # QQ机器人插件
│   └── ...
└── workspace/skills/     # 用户自定义技能
```

---

## 📦 插件包结构（package.json）

```json
{
  "name": "openclaw-plugin-xxx",
  "openclaw": {
    "extensions": ["./dist/index.js"],
    "channel": {
      "id": "xxx",
      "label": "Display Name",
      "selectionLabel": "Menu Label",
      "docsPath": "/channels/xxx",
      "blurb": "One-line description",
      "order": 60
    }
  },
  "peerDependencies": {
    "openclaw": ">=2026.3.22"
  }
}
```

**关键字段：**
- `openclaw.extensions`：插件入口点数组
- `openclaw.channel`：渠道插件元数据（非渠道插件可省略）
- `peerDependencies`：声明兼容的OpenClaw版本

---

## 🔌 最小插件骨架

```typescript
// my-plugin/dist/index.js
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const plugin = {
  id: "my-plugin",
  name: "My Plugin",
  description: "Description",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // api.runtime - 运行时接口
    // api.registerChannel({ plugin: myChannelPlugin })
    // api.registerTool(...)
  }
};

export default plugin;
```

---

## 📨 Channel Plugin（渠道插件）

Channel Plugin专门处理特定IM通道的消息接入。

### 核心类型

```typescript
interface ChannelPlugin<AccountConfig = unknown> {
  id: string;
  meta: {
    id: string;
    label: string;
    selectionLabel: string;
    docsPath: string;
    blurb: string;
    aliases?: string[];        // 快捷别名
    order?: number;             // UI排序
    quickstartAllowFrom?: boolean;
  };
  onboarding?: (...);          // 老版本兼容
  setup: {
    resolveAccountId: ({ cfg, accountId }) => string;
    applyAccountConfig: ({ cfg, accountId, input }) => cfg;
    validateInput?: ({ input }) => string | null;  // 错误消息
  };
  // ... 更多生命周期
}
```

### 企业微信插件完整示例

```typescript
// wecom/src/channel.ts
export const wecomPlugin: ChannelPlugin<ResolvedWecomAccount> = {
  id: "wecom",
  meta: {
    id: "wecom",
    label: "WeCom",
    selectionLabel: "WeCom (plugin)",
    docsPath: "/channels/wecom",
    blurb: "Enterprise WeCom intelligent bot via encrypted webhooks",
    aliases: ["wechatwork", "wework", "qywx", "企微", "企业微信"],
    order: 85,
    quickstartAllowFrom: true,
  },
  onboarding: wecomOnboardingAdapter,
  setup: {
    resolveAccountId: ({ cfg, accountId }) => {
      return accountId?.trim() || resolveDefaultWecomAccountId(cfg) || DEFAULT_ACCOUNT_ID;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      // 根据输入应用配置
    },
    validateInput: ({ input }) => { /* 验证逻辑 */ }
  }
};
```

---

## 🔀 动态Agent路由机制

**问题**：如何让每个用户/群组有独立的对话上下文？

**解决方案**：动态Agent路由——根据senderId生成唯一Agent ID。

### 原理

```
用户A (DM)    →  Agent: wecom-default-dm-user_a   → 独立上下文
用户B (DM)    →  Agent: wecom-default-dm-user_b   → 独立上下文
群组C        →  Agent: wecom-default-group-group_c → 独立上下文
管理员      →  Agent: main (绕过动态路由)
```

### 核心实现

```typescript
// 动态Agent配置
interface DynamicAgentConfig {
  enabled: boolean;        // 总开关
  dmCreateAgent: boolean;  // DM是否创建独立Agent
  groupEnabled: boolean;   // 群组是否创建独立Agent
  adminUsers: string[];   // 管理员列表（绕过动态路由）
}

// 生成确定性Agent ID
export function generateAgentId(
  chatType: "dm" | "group",
  peerId: string,
  accountId?: string
): string {
  const sanitizedPeer = peerId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const sanitizedAccount = accountId?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "default";
  return `wecom-${sanitizedAccount}-${chatType}-${sanitizedPeer}`;
}

// 路由决策
export function shouldUseDynamicAgent(params): boolean {
  const { chatType, senderId, config } = params;
  const dynamicConfig = getDynamicAgentConfig(config);
  
  if (!dynamicConfig.enabled) return false;
  if (isAdmin(senderId)) return false;  // 管理员走主Agent
  if (chatType === "group") return dynamicConfig.groupEnabled;
  return dynamicConfig.dmCreateAgent;
}
```

### 写入agents.list（幂等+串行）

```typescript
// 使用Promise队列避免并发写入冲突
let ensureDynamicAgentWriteQueue = Promise.resolve();

export async function ensureDynamicAgentListed(agentId: string, runtime: any): Promise<void> {
  // 1. 幂等检查（内存Set）
  if (ensuredDynamicAgentIds.has(agentId)) return;
  
  // 2. 串行队列
  ensureDynamicAgentWriteQueue = ensureDynamicAgentWriteQueue.then(async () => {
    const latestConfig = runtime.config.loadConfig();
    const changed = upsertAgentIdOnlyEntry(latestConfig, agentId);
    if (changed) {
      await runtime.config.writeConfigFile(latestConfig);
    }
    ensuredDynamicAgentIds.add(agentId);
  });
  
  await ensureDynamicAgentWriteQueue;
}
```

---

## 🛡️ Plugin SDK兼容性Shim

OpenClaw版本升级时，plugin-sdk的内部路径可能重构。wecom插件使用shim模式解决：

```typescript
// compat/plugin-sdk-shim.ts

// 策略1: 类型直接从主入口重导出（稳定）
export type { OpenClawConfig } from "openclaw/plugin-sdk";
export { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";

// 策略2: DEFAULT_ACCOUNT_ID硬编码常量
export const DEFAULT_ACCOUNT_ID = "default";

// 策略3: 动态导入 + 缓存（子路径可能变化）
async function tryImport<T>(specifier: string): Promise<T | undefined> {
  try {
    return await import(specifier) as T;
  } catch {
    return undefined;
  }
}

// 尝试多个可能的子路径
for (const subpath of [
  "openclaw/plugin-sdk/core",
  "openclaw/plugin-sdk/channel-plugin-common",
]) {
  const mod = await tryImport<Record<string, AnyFn>>(subpath);
  if (mod?.deleteAccountFromConfigSection) {
    _deleteAccountFromConfigSection = mod.deleteAccountFromConfigSection;
    return;
  }
}
```

---

## 🔧 OpenClawPluginApi核心接口

```typescript
interface OpenClawPluginApi {
  // 运行时
  runtime: PluginRuntime;
  
  // 配置
  config: OpenClawConfig;
  
  // 注册渠道插件
  registerChannel(options: { plugin: ChannelPlugin }): void;
  
  // 注册工具
  registerTool(tool: Tool): void;
  
  // 注册Skill
  registerSkill(skill: Skill): void;
}

// PluginRuntime核心能力
interface PluginRuntime {
  // 操作用户配置
  config: {
    loadConfig: () => OpenClawConfig;
    writeConfigFile: (cfg: OpenClawConfig) => Promise<void>;
  };
  
  // 创建新会话/Agent
  createSession(options: SessionOptions): Promise<Session>;
  
  // 发送消息
  sendMessage(options: SendMessageOptions): Promise<void>;
}
```

---

## 📋 插件开发 checklist

- [ ] 创建 `package.json`，声明 `peerDependencies.openclaw`
- [ ] 创建 `openclaw.plugin.json` 清单文件
- [ ] 实现 `default` 导出插件对象
- [ ] 实现 `register(api)` 入口函数
- [ ] 如果是Channel Plugin：实现完整的 `setup` 生命周期
- [ ] 使用 `emptyPluginConfigSchema()` 初始化configSchema
- [ ] 动态Agent路由（如需会话隔离）
- [ ] 兼容性shim（如需跨版本兼容）
- [ ] 编写 `dist/index.js` 编译产物

---

## 💡 核心收获

1. **插件即扩展**：OpenClaw通过`register(api)`机制接纳任何插件，插件通过`OpenClawPluginApi`访问运行时能力

2. **Channel Plugin是特殊插件**：专门处理消息通道，有标准化生命周期（resolveAccountId → validateInput → applyAccountConfig）

3. **动态Agent路由实现会话隔离**：每个用户/群组有独立Agent ID，通过确定性ID生成+幂等写入agents.list实现

4. **SDK子路径脆弱性**：plugin-sdk内部模块路径在版本间可能变化，shim模式提供向后兼容

5. **Promise队列模式**：避免并发写入同一配置文件的经典模式——串行promise链 + 内存Set幂等检查

---

## 📁 产出文件

- 笔记：模块5-Plugin-SDK.md
- 代码：channel-plugin-skeleton.ts（最小插件骨架）
- 代码：dynamic-agent-router.ts（动态路由实现）
