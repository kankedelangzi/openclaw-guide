/**
 * 模块3-路由决策逻辑 - 代码示例
 * 
 * 演示OpenClaw Multi-Agent路由决策机制的核心实现
 */

// ============================================================
// 1. 模式检测（参考accounts.ts）
// ============================================================

type ResolvedMode = "disabled" | "legacy" | "matrix";

interface WecomConfig {
    enabled?: boolean;
    accounts?: Record<string, { enabled?: boolean }>;
    bot?: unknown;
}

function detectMode(config: WecomConfig | undefined): ResolvedMode {
    if (!config || config.enabled === false) return "disabled";

    const accounts = config.accounts;
    if (accounts && typeof accounts === "object") {
        const enabledEntries = Object.values(accounts).filter(
            (entry) => entry && entry.enabled !== false,
        );
        if (enabledEntries.length > 0) return "matrix";
    }

    return "legacy";
}

// 测试
console.log("=== 模式检测 ===");
console.log("undefined:", detectMode(undefined)); // disabled
console.log("无accounts:", detectMode({ enabled: true })); // legacy
console.log("有accounts:", detectMode({ enabled: true, accounts: { a: { enabled: true } } })); // matrix


// ============================================================
// 2. 动态Agent ID生成
// ============================================================

function sanitizeDynamicIdPart(value: string): string {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
}

function generateAgentId(
    chatType: "dm" | "group",
    peerId: string,
    accountId?: string
): string {
    const sanitizedPeer = sanitizeDynamicIdPart(peerId) || "unknown";
    const sanitizedAccountId = sanitizeDynamicIdPart(accountId ?? "default") || "default";
    return `wecom-${sanitizedAccountId}-${chatType}-${sanitizedPeer}`;
}

// 测试
console.log("\n=== Agent ID生成 ===");
console.log("私聊用户:", generateAgentId("dm", "u123")); // wecom-default-dm-u123
console.log("群聊:", generateAgentId("group", "g456")); // wecom-default-group-g456
console.log("指定账号:", generateAgentId("dm", "u789", "account_a")); // wecom-account_a-dm-u789
console.log("特殊字符:", generateAgentId("dm", "user@domain.com")); // wecom-default-dm-user_domain_com


// ============================================================
// 3. 动态Agent决策
// ============================================================

interface DynamicAgentConfig {
    enabled: boolean;
    dmCreateAgent: boolean;
    groupEnabled: boolean;
    adminUsers: string[];
}

interface OpenClawConfig {
    channels?: {
        wecom?: {
            dynamicAgents?: Partial<DynamicAgentConfig>;
        };
    };
}

function getDynamicAgentConfig(config: OpenClawConfig): DynamicAgentConfig {
    const dynamicAgents = config?.channels?.wecom?.dynamicAgents;
    return {
        enabled: dynamicAgents?.enabled ?? false,
        dmCreateAgent: dynamicAgents?.dmCreateAgent ?? true,
        groupEnabled: dynamicAgents?.groupEnabled ?? true,
        adminUsers: dynamicAgents?.adminUsers ?? [],
    };
}

function shouldUseDynamicAgent(params: {
    chatType: "dm" | "group";
    senderId: string;
    config: OpenClawConfig;
}): boolean {
    const { chatType, senderId, config } = params;
    const dynamicConfig = getDynamicAgentConfig(config);

    if (!dynamicConfig.enabled) {
        return false;
    }

    // 管理员绕过
    const sender = String(senderId).trim().toLowerCase();
    const isAdmin = dynamicConfig.adminUsers.some(
        (admin) => admin.trim().toLowerCase() === sender
    );
    if (isAdmin) {
        return false;
    }

    if (chatType === "group") {
        return dynamicConfig.groupEnabled;
    }
    return dynamicConfig.dmCreateAgent;
}

// 测试
console.log("\n=== 动态Agent决策 ===");
const disabledConfig: OpenClawConfig = {};
console.log("禁用动态Agent:", shouldUseDynamicAgent({ chatType: "dm", senderId: "u1", config: disabledConfig })); // false

const enabledConfig: OpenClawConfig = {
    channels: { wecom: { dynamicAgents: { enabled: true } } }
};
console.log("启用+私聊+非管理员:", shouldUseDynamicAgent({ chatType: "dm", senderId: "u1", config: enabledConfig })); // true

const adminConfig: OpenClawConfig = {
    channels: { wecom: { dynamicAgents: { enabled: true, adminUsers: ["admin1"] } } }
};
console.log("启用+管理员:", shouldUseDynamicAgent({ chatType: "dm", senderId: "admin1", config: adminConfig })); // false

const groupDisabledConfig: OpenClawConfig = {
    channels: { wecom: { dynamicAgents: { enabled: true, groupEnabled: false } } }
};
console.log("启用+群聊+群组禁用:", shouldUseDynamicAgent({ chatType: "group", senderId: "u1", config: groupDisabledConfig })); // false


// ============================================================
// 4. fail-closed默认路由策略
// ============================================================

function resolveWecomFailClosedOnDefaultRoute(
    cfg: OpenClawConfig
): boolean {
    const wecom = cfg?.channels?.wecom as WecomConfig | undefined;
    const explicit = wecom?.routing?.failClosedOnDefaultRoute as boolean | undefined;
    if (typeof explicit === "boolean") return explicit;
    return detectMode(wecom) === "matrix";
}

function shouldRejectWecomDefaultRoute(params: {
    cfg: OpenClawConfig;
    matchedBy: string;
    useDynamicAgent: boolean;
}): boolean {
    if (params.matchedBy !== "default") return false;
    if (params.useDynamicAgent) return false;
    return resolveWecomFailClosedOnDefaultRoute(params.cfg);
}

// 测试
console.log("\n=== fail-closed策略 ===");
const matrixCfg: OpenClawConfig = {
    channels: { wecom: { enabled: true, accounts: { a: { enabled: true } } } }
};
const legacyCfg: OpenClawConfig = {
    channels: { wecom: { enabled: true } }  // 无accounts，走legacy
};

console.log("matrix模式默认开启:", resolveWecomFailClosedOnDefaultRoute(matrixCfg)); // true
console.log("legacy模式默认关闭:", resolveWecomFailClosedOnDefaultRoute(legacyCfg)); // false

console.log("matrix+默认路由+无动态Agent:", shouldRejectWecomDefaultRoute({ cfg: matrixCfg, matchedBy: "default", useDynamicAgent: false })); // true
console.log("matrix+绑定路由:", shouldRejectWecomDefaultRoute({ cfg: matrixCfg, matchedBy: "binding.account", useDynamicAgent: false })); // false
console.log("matrix+默认路由+有动态Agent:", shouldRejectWecomDefaultRoute({ cfg: matrixCfg, matchedBy: "default", useDynamicAgent: true })); // false


// ============================================================
// 5. 完整路由决策流程演示
// ============================================================

interface RouteDecision {
    mode: ResolvedMode;
    agentId: string | null;
    shouldReject: boolean;
    reason: string;
}

function makeRouteDecision(params: {
    chatType: "dm" | "group";
    senderId: string;
    peerId: string;
    accountId?: string;
    matchedBy: string;
    config: OpenClawConfig;
}): RouteDecision {
    const { chatType, senderId, peerId, accountId, matchedBy, config } = params;
    const wecom = config?.channels?.wecom as WecomConfig | undefined;

    // Step 1: 模式检测
    const mode = detectMode(wecom);

    // Step 2: 动态Agent决策
    const useDynamicAgent = shouldUseDynamicAgent({ chatType, senderId, config });
    const agentId = useDynamicAgent
        ? generateAgentId(chatType, peerId, accountId)
        : null;

    // Step 3: 默认路由拦截
    const shouldReject = shouldRejectWecomDefaultRoute({
        cfg: config,
        matchedBy,
        useDynamicAgent,
    });

    let reason = `mode=${mode}`;
    if (agentId) reason += `, dynamicAgent=${agentId}`;
    if (shouldReject) reason += ", REJECTED";

    return { mode, agentId, shouldReject, reason };
}

// 测试完整流程
console.log("\n=== 完整路由决策 ===");
const fullCfg: OpenClawConfig = {
    channels: {
        wecom: {
            enabled: true,
            accounts: { a: { enabled: true } },
            dynamicAgents: { enabled: true }
        }
    }
};

console.log("私聊普通用户:", makeRouteDecision({
    chatType: "dm",
    senderId: "u1",
    peerId: "u1",
    accountId: "a",
    matchedBy: "default",
    config: fullCfg
}));
// { mode: 'matrix', agentId: 'wecom-a-dm-u1', shouldReject: false, reason: '...' }

console.log("管理员:", makeRouteDecision({
    chatType: "dm",
    senderId: "admin1",
    peerId: "admin1",
    accountId: "a",
    matchedBy: "default",
    config: {
        channels: {
            wecom: {
                enabled: true,
                accounts: { a: { enabled: true } },
                dynamicAgents: { enabled: true, adminUsers: ["admin1"] }
            }
        }
    }
}));
// { mode: 'matrix', agentId: null, shouldReject: false, reason: '...' }

console.log("未知路由+matrix:", makeRouteDecision({
    chatType: "dm",
    senderId: "u1",
    peerId: "u1",
    accountId: "a",
    matchedBy: "default",
    config: {
        channels: { wecom: { enabled: true, accounts: { a: { enabled: true } } } }  // 无dynamicAgents
    }
}));
// { mode: 'matrix', agentId: null, shouldReject: true, reason: '...' }
