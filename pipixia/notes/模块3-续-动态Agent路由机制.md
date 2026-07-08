# 模块3 - 续：动态Agent路由机制

> 皮皮虾学习笔记
> 学习时间：2026-04-13 14:34
> 目标：掌握OpenClaw的动态Agent路由机制
> 累计产出：178笔记+215代码+2插件

---

## 🎯 核心概念

### 什么是动态Agent路由？

动态Agent路由是OpenClaw为**多租户场景**（如企业微信、钉钉等）设计的**按需创建独立Agent实例**的机制。通过为每个用户/群组生成唯一的Agent ID，实现**会话隔离**和**独立上下文**。

```
企业微信 Channel
    │
    ├── 用户A → 生成 Agent ID: wecom-default-dm-user_a → 独立会话
    ├── 用户B → 生成 Agent ID: wecom-default-dm-user_b → 独立会话
    └── 群组C → 生成 Agent ID: wecom-default-group-group_c → 独立会话
```

---

## 🏗️ 核心架构

### 2.1 DynamicAgentConfig 配置结构

```typescript
interface DynamicAgentConfig {
    enabled: boolean;           // 是否启用动态Agent
    dmCreateAgent: boolean;     // 私聊是否创建独立Agent
    groupEnabled: boolean;     // 群聊是否创建独立Agent
    adminUsers: string[];       // 管理员列表（绕过动态路由）
}
```

**设计亮点**：配置粒度细化到私聊/群聊，支持管理员白名单。

### 2.2 Agent ID 生成算法

```typescript
// 格式: wecom-{accountId}-{type}-{sanitizedPeerId}
// 示例: wecom-001-dm-zhangsan

function generateAgentId(
    chatType: "dm" | "group",
    peerId: string,
    accountId?: string
): string {
    const sanitizedPeer = sanitizeDynamicIdPart(peerId) || "unknown";
    const sanitizedAccountId = sanitizeDynamicIdPart(accountId ?? "default") || "default";
    return `wecom-${sanitizedAccountId}-${chatType}-${sanitizedPeer}`;
}

function sanitizeDynamicIdPart(value: string): string {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
}
```

**设计亮点**：
- **确定性**：相同输入始终生成相同ID，保证会话一致性
- **安全性**：sanitize防止注入攻击
- **可读性**：ID格式直观，便于调试

### 2.3 路由决策逻辑

```typescript
function shouldUseDynamicAgent(params: {
    chatType: "dm" | "group";
    senderId: string;
    config: OpenClawConfig;
}): boolean {
    const { chatType, senderId, config } = params;
    const dynamicConfig = getDynamicAgentConfig(config);

    // 1. 检查全局开关
    if (!dynamicConfig.enabled) return false;

    // 2. 管理员白名单绕过
    const isAdmin = dynamicConfig.adminUsers.some(
        (admin) => admin.trim().toLowerCase() === senderId.trim().toLowerCase()
    );
    if (isAdmin) return false;

    // 3. 按聊天类型决策
    if (chatType === "group") return dynamicConfig.groupEnabled;
    return dynamicConfig.dmCreateAgent;
}
```

**设计亮点**：三层决策（全局开关 → 白名单 → 类型判断），兼顾灵活性和安全性。

---

## 🔄 动态Agent注册机制

### 3.1 为什么需要主动注册？

OpenClaw的Agent实例需要在`agents.list`中预先配置。动态Agent机制需要**运行时动态添加**。

### 3.2 幂等注册实现

```typescript
const ensuredDynamicAgentIds = new Set<string>();  // 内存缓存
let ensureDynamicAgentWriteQueue: Promise<void> = Promise.resolve();  // 串行队列

async function ensureDynamicAgentListed(
    agentId: string,
    runtime: { config: { loadConfig, writeConfigFile } }
): Promise<void> {
    const normalizedId = agentId.trim().toLowerCase();
    if (!normalizedId) return;
    
    // 幂等检查：已注册则跳过
    if (ensuredDynamicAgentIds.has(normalizedId)) return;

    // 串行队列：避免并发写入冲突
    ensureDynamicAgentWriteQueue = ensureDynamicAgentWriteQueue
        .then(async () => {
            if (ensuredDynamicAgentIds.has(normalizedId)) return;

            // 读取最新配置
            const latestConfig = runtime.config.loadConfig();
            
            // 原子性更新
            const changed = upsertAgentIdOnlyEntry(latestConfig, normalizedId);
            if (changed) {
                await runtime.config.writeConfigFile(latestConfig);
            }

            // 更新内存缓存
            ensuredDynamicAgentIds.add(normalizedId);
        });

    await ensureDynamicAgentWriteQueue;
}
```

**设计亮点**：
- **幂等性**：Set缓存防止重复写入
- **串行化**：Promise队列解决并发冲突
- **非阻塞**：异步执行，不阻塞消息处理

---

## 💡 核心收获

1. **动态Agent路由是Multi-Agent架构的简化实现**——不需要完整的Agent创建/销毁生命周期，只需动态生成ID并注册

2. **确定性ID生成是关键**——sanitize确保相同用户始终映射到相同Agent，保证会话连续性

3. **配置持久化是难点**——运行时修改`agents.list`需要考虑并发安全，OpenClaw用Promise队列解决

4. **管理员旁路是常见模式**——特殊用户绕过动态路由，使用主Agent，便于集中管理

5. **这是轻量级多租户方案**——比Kubernetes那样重型的容器隔离更适用于AI Agent场景

---

## 🔮 与模块2的关联

模块2中的**Embedded-Runner**和**Subagent系统**是动态Agent的底层支撑：
- Embedded-Runner负责在当前进程内运行多个Agent
- Subagent系统通过`child_process.spawn`创建独立进程Agent
- 动态路由只是在它们之上加了一层**按需创建和路由**的逻辑

---

## 📁 产出文件

- 笔记：`/workspace/pipixia/notes/模块3-续-动态Agent路由机制.md`
- 代码：`/workspace/pipixia/code/模块3-动态Agent路由/dynamic-agent.ts`

---

**下一步**：继续深入模块3，学习更多Multi-Agent相关机制
