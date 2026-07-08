# 模块6 - Channel插件架构（渠道插件系统）

> 皮皮虾学习笔记 | 学习时间：2026-04-13
> 目标：掌握Channel插件系统设计原理，能独立开发完整渠道插件

---

## 🎯 学前检测

**问题1：ChannelPlugin 和普通 Plugin 的核心区别？**
答：ChannelPlugin 专门处理消息渠道（收/发消息），有 `id`、`meta`、`capabilities`、`config`、`outbound` 等渠道专属字段；普通 Plugin 是通用扩展点，Channel Plugin 是其特化子集。

**问题2：Channel Plugin 的 `config` adapter 必须实现什么？**
答：`listAccountIds`（列出所有账号ID）+ `resolveAccount`（解析账号配置）是最低必须实现的两个方法。

**问题3：渠道如何声明自己支持图片/投票/回复等能力？**
答：通过 `capabilities` 字段声明：`{ chatTypes: [...], polls: true, reactions: true, media: true, ... }`

---

## 一、Channel Plugin 整体类型结构

```typescript
type ChannelPlugin<ResolvedAccount = any, Probe = unknown, Audit = unknown> = {
    // 必须字段
    id: ChannelId;                           // 渠道唯一标识
    meta: ChannelMeta;                       // 元数据（名称、文档链接等）
    capabilities: ChannelCapabilities;       // 能力声明
    config: ChannelConfigAdapter<ResolvedAccount>; // 配置解析器

    // 可选字段（按功能分组）
    // ---- 设置/配置 ----
    configSchema?: ChannelConfigSchema;      // JSON Schema 配置描述
    setup?: ChannelSetupAdapter;             // 设置向导适配器
    setupWizard?: ChannelSetupWizard;        // 设置向导
    
    // ---- 消息收发 ----
    outbound?: ChannelOutboundAdapter;       // 发送消息
    messaging?: ChannelMessagingAdapter;     // 消息路由/目标解析
    actions?: ChannelMessageActionAdapter;   // message tool 行为
    streaming?: ChannelStreamingAdapter;     // 流式消息配置
    
    // ---- 安全/授权 ----
    security?: ChannelSecurityAdapter<ResolvedAccount>;  // DM 安全策略
    auth?: ChannelAuthAdapter;               // 认证
    elevated?: ChannelElevatedAdapter;       // 提权操作
    allowlist?: ChannelAllowlistAdapter;     // 白名单
    
    // ---- 生命周期 ----
    lifecycle?: ChannelLifecycleAdapter;     // 启动/停止钩子
    pairing?: ChannelPairingAdapter;         // 设备配对
    heartbeat?: ChannelHeartbeatAdapter;     // 心跳健康检查
    status?: ChannelStatusAdapter<...>;      // 状态快照
    
    // ---- 高级功能 ----
    threading?: ChannelThreadingAdapter;     // 线程/回复模式
    groups?: ChannelGroupAdapter;            // 群组策略
    mentions?: ChannelMentionAdapter;        // @mention 处理
    directory?: ChannelDirectoryAdapter;     // 联系人目录
    resolver?: ChannelResolverAdapter;       // 目标解析
    agentTools?: ChannelAgentToolFactory | ChannelAgentTool[]; // Agent工具注入
    agentPrompt?: ChannelAgentPromptAdapter; // prompt 提示扩展
    
    // ---- 其他 ----
    reload?: { configPrefixes: string[] };   // 热重载触发前缀
    gatewayMethods?: string[];               // 暴露给 Gateway 的方法
    gateway?: ChannelGatewayAdapter<ResolvedAccount>;  // Gateway 方法实现
    commands?: ChannelCommandAdapter;        // 原生命令支持
    execApprovals?: ChannelExecApprovalAdapter;        // exec 审批
    bindings?: ChannelConfiguredBindingProvider;       // 绑定规则提供者
};
```

---

## 二、核心 Adapter 深度解析

### 2.1 ChannelConfigAdapter — 配置适配器（必须实现）

```typescript
type ChannelConfigAdapter<ResolvedAccount> = {
    // 必须实现
    listAccountIds: (cfg: OpenClawConfig) => string[];
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => ResolvedAccount;
    
    // 可选扩展
    defaultAccountId?: (cfg: OpenClawConfig) => string;
    isEnabled?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean;
    isConfigured?: (account: ResolvedAccount, cfg: OpenClawConfig) => boolean | Promise<boolean>;
    describeAccount?: (account: ResolvedAccount, cfg: OpenClawConfig) => ChannelAccountSnapshot;
    resolveAllowFrom?: (params: { cfg: OpenClawConfig; accountId?: string | null }) => Array<string | number> | undefined;
    resolveDefaultTo?: (params: { cfg: OpenClawConfig; accountId?: string | null }) => string | undefined;
    setAccountEnabled?: (params: { cfg: OpenClawConfig; accountId: string; enabled: boolean }) => OpenClawConfig;
    deleteAccount?: (params: { cfg: OpenClawConfig; accountId: string }) => OpenClawConfig;
};
```

### 2.2 ChannelCapabilities — 能力声明

```typescript
type ChannelCapabilities = {
    chatTypes: Array<ChatType | "thread">;  // 支持的会话类型：direct/group/channel/thread
    polls?: boolean;          // 投票
    reactions?: boolean;      // 表情回应
    edit?: boolean;           // 编辑消息
    unsend?: boolean;         // 撤回消息
    reply?: boolean;          // 回复消息
    effects?: boolean;        // 特效消息（Telegram/iMessage）
    groupManagement?: boolean;// 群管理
    threads?: boolean;        // 线程支持
    media?: boolean;          // 媒体发送
    nativeCommands?: boolean; // 原生命令支持
    blockStreaming?: boolean;  // 流式块输出
};
```

### 2.3 ChannelOutboundAdapter — 发消息适配器

```typescript
type ChannelOutboundContext = {
    cfg: OpenClawConfig;
    to: string;            // 目标（用户ID/群ID）
    text: string;          // 消息文本
    mediaUrl?: string;     // 媒体URL
    audioAsVoice?: boolean;// 作为语音发送
    replyToId?: string | null;
    threadId?: string | number | null;
    silent?: boolean;      // 静默消息
    accountId?: string | null;
    // ... 更多字段
};
```

### 2.4 ChannelSetupAdapter — 安装向导

```typescript
type ChannelSetupAdapter = {
    resolveAccountId?: (params: {...}) => string;
    applyAccountConfig: (params: {       // 必须实现
        cfg: OpenClawConfig;
        accountId: string;
        input: ChannelSetupInput;
    }) => OpenClawConfig;
    afterAccountConfigWritten?: (...) => Promise<void> | void;
    validateInput?: (...) => string | null;
};
```

---

## 三、生命周期管理

### 3.1 账号生命周期工具函数

```typescript
// 被动账号生命周期（长连接类型如 WebSocket）
export async function runPassiveAccountLifecycle<Handle>(params: {
    abortSignal?: AbortSignal;
    start: () => Promise<Handle>;        // 启动连接
    stop?: (handle: Handle) => void | Promise<void>;  // 清理
    onStop?: () => void | Promise<void>;
}): Promise<void>

// HTTP 服务器生命周期（Webhook 类型）
export async function keepHttpServerTaskAlive(params: {
    server: CloseAwareServer;
    abortSignal?: AbortSignal;
    onAbort?: () => void | Promise<void>;
}): Promise<void>

// 中止信号等待
export async function waitUntilAbort(
    signal?: AbortSignal, 
    onAbort?: () => void | Promise<void>
): Promise<void>
```

### 3.2 账号状态追踪

```typescript
// 创建状态写入器（绑定 accountId）
const statusSink = createAccountStatusSink({
    accountId: "default",
    setStatus: (next: ChannelAccountSnapshot) => {
        // 保存快照到内存/数据库
    }
});

// 更新状态（自动附加 accountId）
statusSink({
    connected: true,
    lastConnectedAt: Date.now(),
    name: "Bot Account",
});
```

---

## 四、消息收发架构

### 4.1 Inbound（入站）核心工具

```typescript
// Inbound 防抖（避免快速消息触发多次AI推理）
const debouncer = createInboundDebouncer({ ms: 500 });

// 提到（mention）门控
const gateResult = resolveMentionGating({
    text: inboundText,
    cfg,
    channelId: "discord",
    chatType: "group",
});
// gateResult.allowed: boolean - 是否放行
// gateResult.strippedText: string - 去掉@后的文字

// Envelope 格式化（给AI看的消息标头）
const envelope = formatInboundEnvelope({ 
    from: "user123", 
    chatType: "group",
    cfg 
});
```

### 4.2 Outbound（出站）线程策略

```typescript
type ChannelThreadingAdapter = {
    resolveReplyToMode: (params) => "off" | "first" | "all";
    // "off" = 不自动回复到原消息
    // "first" = 只有第一条回复带replyToId
    // "all" = 每条回复都带replyToId
    
    buildToolContext: (params) => ChannelThreadingToolContext | undefined;
    resolveAutoThreadId: (params) => string | undefined;
    resolveReplyTransport: (params) => ChannelReplyTransport | null;
};
```

---

## 五、Agent Tool 注入

### 5.1 静态工具注入

```typescript
const myPlugin: ChannelPlugin = {
    id: "my-channel",
    // ...
    agentTools: [
        {
            name: "my_channel_action",
            description: "Perform a channel-specific action",
            schema: Type.Object({ target: Type.String() }),
            run: async ({ target }) => ({ result: "done" }),
            ownerOnly: true,  // 仅所有者可用
        }
    ],
};
```

### 5.2 动态工具工厂（依赖配置）

```typescript
const myPlugin: ChannelPlugin = {
    agentTools: ({ cfg }) => {
        if (!cfg?.channels?.myChannel?.enabled) return [];
        return [/* 工具列表 */];
    }
};
```

---

## 六、消息行为（message tool）扩展

### 6.1 describeMessageTool — 向 message tool 贡献能力

```typescript
actions: {
    describeMessageTool: (ctx: ChannelMessageActionDiscoveryContext) => ({
        // 声明本渠道支持的 action
        actions: ["send", "react", "thread-reply", "edit", "pin"] as const,
        
        // 能力标记
        capabilities: ["reactions", "threads"] as const,
        
        // 向 message tool schema 注入参数
        schema: {
            properties: {
                silent: Type.Optional(Type.Boolean()),
                effectId: Type.Optional(Type.String()),
            },
            visibility: "current-channel",  // 仅当前渠道活跃时显示
        },
    }),
    
    // 处理 action 调用
    handleAction: async (ctx: ChannelMessageActionContext) => {
        switch (ctx.action) {
            case "send": return await sendMessage(ctx);
            case "react": return await addReaction(ctx);
            // ...
        }
    }
}
```

---

## 七、渠道插件注册流程

```
1. 创建 ChannelPlugin 对象（包含 id/meta/capabilities/config）
2. 通过 register() API 注入到 OpenClaw 运行时
3. Gateway 加载插件 → 注册到 ChannelRegistry
4. 消息入站 → ChannelRegistry 查找匹配渠道插件
5. 调用插件的 config.resolveAccount() 获取账号配置
6. 调用 inbound 处理链 → Mention 门控 → 防抖 → 分发给 Agent
7. Agent 回复 → outbound.send() → 渠道 API
```

---

## 八、支持的渠道列表（内置）

| 渠道 | ID | 特点 |
|------|-----|------|
| Discord | discord | threads/reactions/全功能 |
| Telegram | telegram | effects/forceDocument |
| Slack | slack | threading/reactions |
| WhatsApp | whatsapp | media/voice/group |
| 企业微信 | wecom | matrix多账号/动态Agent路由 |
| 飞书 | feishu | 文档集成 |
| QQ Bot | qqbot | 群组/私聊 |
| iMessage | imessage | effects/Apple设备 |
| Matrix | matrix | 开放协议 |
| Line | line | 亚洲市场 |

---

## 九、设计思想总结

### 9.1 能力驱动（Capability-Driven）
渠道不是强行适配所有功能，而是通过 `capabilities` 声明自己能做什么，core 根据能力决策是否暴露某功能（如 `/react` 命令）。

### 9.2 适配器模式（Adapter Pattern）
每个插件通过独立的适配器接口（`config`、`outbound`、`security`等）实现功能，解耦清晰，可按需实现。

### 9.3 账号快照（Account Snapshot）
`ChannelAccountSnapshot` 是渠道账号的统一状态视图，包含 connected/linked/lastError 等，供 `/status` 命令展示。

### 9.4 生命周期隔离
长连接（WebSocket）用 `runPassiveAccountLifecycle`；Webhook 型用 `keepHttpServerTaskAlive`——两种模式适配不同渠道架构。

---

## 十、核心 API 速查

| API | 类型 | 职责 |
|-----|------|------|
| `ChannelPlugin.id` | 字段 | 渠道唯一标识 |
| `ChannelPlugin.capabilities` | 字段 | 能力声明 |
| `config.listAccountIds()` | 必须 | 列出账号ID |
| `config.resolveAccount()` | 必须 | 解析账号配置 |
| `outbound.send()` | 可选 | 发送消息 |
| `actions.describeMessageTool()` | 可选 | 声明 message tool 能力 |
| `actions.handleAction()` | 可选 | 处理 message tool 调用 |
| `lifecycle.onStart/onStop` | 可选 | 生命周期钩子 |
| `runPassiveAccountLifecycle()` | 工具函数 | WebSocket型生命周期 |
| `keepHttpServerTaskAlive()` | 工具函数 | Webhook型生命周期 |
| `createAccountStatusSink()` | 工具函数 | 状态更新写入器 |
| `resolveMentionGating()` | 工具函数 | @mention 门控 |
| `createInboundDebouncer()` | 工具函数 | 入站防抖 |
