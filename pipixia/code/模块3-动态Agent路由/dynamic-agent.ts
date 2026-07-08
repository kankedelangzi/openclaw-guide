/**
 * 动态Agent路由机制 - 代码示例
 * 
 * 核心功能：
 * 1. 为每个用户/群组生成确定性Agent ID
 * 2. 运行时动态注册Agent到配置
 * 3. 支持私聊/群聊独立隔离
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";

// ============ 类型定义 ============

export interface DynamicAgentConfig {
    enabled: boolean;
    dmCreateAgent: boolean;
    groupEnabled: boolean;
    adminUsers: string[];
}

interface AgentEntry {
    id: string;
    [key: string]: unknown;
}

// ============ 1. 配置读取 ============

export function getDynamicAgentConfig(
    config: OpenClawConfig
): DynamicAgentConfig {
    const dynamicAgents = (config as Record<string, unknown>)?.channels?.wecom?.dynamicAgents as Partial<DynamicAgentConfig> | undefined;
    return {
        enabled: dynamicAgents?.enabled ?? false,
        dmCreateAgent: dynamicAgents?.dmCreateAgent ?? true,
        groupEnabled: dynamicAgents?.groupEnabled ?? true,
        adminUsers: dynamicAgents?.adminUsers ?? [],
    };
}

// ============ 2. ID生成（确定性 + 安全） ============

function sanitizeDynamicIdPart(value: string): string {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
}

/**
 * 生成动态Agent ID
 * 格式: {channel}-{accountId}-{type}-{peerId}
 * 示例: wecom-001-dm-zhangsan
 */
export function generateAgentId(
    chatType: "dm" | "group",
    peerId: string,
    accountId?: string
): string {
    const sanitizedPeer = sanitizeDynamicIdPart(peerId) || "unknown";
    const sanitizedAccountId = sanitizeDynamicIdPart(accountId ?? "default") || "default";
    return `wecom-${sanitizedAccountId}-${chatType}-${sanitizedPeer}`;
}

// ============ 3. 路由决策 ============

export function shouldUseDynamicAgent(params: {
    chatType: "dm" | "group";
    senderId: string;
    config: OpenClawConfig;
}): boolean {
    const { chatType, senderId, config } = params;
    const dynamicConfig = getDynamicAgentConfig(config);

    if (!dynamicConfig.enabled) return false;

    // 管理员白名单
    const sender = String(senderId).trim().toLowerCase();
    const isAdmin = dynamicConfig.adminUsers.some(
        (admin) => admin.trim().toLowerCase() === sender
    );
    if (isAdmin) return false;

    // 按类型决策
    if (chatType === "group") return dynamicConfig.groupEnabled;
    return dynamicConfig.dmCreateAgent;
}

// ============ 4. 动态注册（幂等 + 串行） ============

const ensuredDynamicAgentIds = new Set<string>();
let ensureDynamicAgentWriteQueue: Promise<void> = Promise.resolve();

function upsertAgentIdOnlyEntry(
    cfg: Record<string, unknown>,
    agentId: string
): boolean {
    if (!cfg.agents || typeof cfg.agents !== "object") {
        cfg.agents = {};
    }

    const agentsObj = cfg.agents as Record<string, unknown>;
    const currentList: AgentEntry[] = Array.isArray(agentsObj.list) 
        ? agentsObj.list as AgentEntry[] 
        : [];

    const existingIds = new Set(
        currentList
            .map((entry) => entry?.id?.trim().toLowerCase())
            .filter((id): id is string => Boolean(id))
    );

    let changed = false;
    const nextList = [...currentList];

    // 确保main存在
    if (nextList.length === 0) {
        nextList.push({ id: "main" });
        existingIds.add("main");
        changed = true;
    }

    // 添加新Agent
    if (!existingIds.has(agentId.toLowerCase())) {
        nextList.push({ id: agentId });
        changed = true;
    }

    if (changed) {
        agentsObj.list = nextList;
    }

    return changed;
}

export async function ensureDynamicAgentListed(
    agentId: string,
    runtime: { config: { loadConfig: () => unknown; writeConfigFile: (cfg: unknown) => Promise<void> } }
): Promise<void> {
    const normalizedId = String(agentId).trim().toLowerCase();
    if (!normalizedId) return;
    if (ensuredDynamicAgentIds.has(normalizedId)) return;

    const configRuntime = runtime?.config;
    if (!configRuntime?.loadConfig || !configRuntime?.writeConfigFile) return;

    ensureDynamicAgentWriteQueue = ensureDynamicAgentWriteQueue
        .then(async () => {
            if (ensuredDynamicAgentIds.has(normalizedId)) return;

            const latestConfig = configRuntime.loadConfig();
            if (!latestConfig || typeof latestConfig !== "object") return;

            const changed = upsertAgentIdOnlyEntry(
                latestConfig as Record<string, unknown>,
                normalizedId
            );
            if (changed) {
                await configRuntime.writeConfigFile(latestConfig);
            }

            ensuredDynamicAgentIds.add(normalizedId);
        })
        .catch((err) => {
            console.warn(`[dynamic-agent] 动态Agent注册失败: ${normalizedId}`, err);
        });

    await ensureDynamicAgentWriteQueue;
}

// ============ 5. 使用示例 ============

async function example() {
    // 模拟配置
    const mockConfig: OpenClawConfig = {
        agents: { list: [{ id: "main" }] },
        channels: {
            wecom: {
                dynamicAgents: {
                    enabled: true,
                    dmCreateAgent: true,
                    groupEnabled: true,
                    adminUsers: ["admin001"],
                },
            },
        },
    } as unknown as OpenClawConfig;

    // 模拟runtime
    const mockRuntime = {
        config: {
            loadConfig: () => JSON.parse(JSON.stringify(mockConfig)),
            writeConfigFile: async (cfg: unknown) => {
                Object.assign(mockConfig, cfg);
                console.log("配置已更新:", (cfg as { agents: { list: AgentEntry[] } }).agents.list);
            },
        },
    };

    // 生成ID
    const userAgentId = generateAgentId("dm", "zhangsan", "001");
    const groupAgentId = generateAgentId("group", "team_alpha", "001");
    console.log("用户Agent ID:", userAgentId);
    console.log("群组Agent ID:", groupAgentId);

    // 路由决策
    const shouldRoute = shouldUseDynamicAgent({
        chatType: "dm",
        senderId: "zhangsan",
        config: mockConfig,
    });
    console.log("应使用动态Agent:", shouldRoute);

    // 动态注册
    await ensureDynamicAgentListed(userAgentId, mockRuntime as any);
    await ensureDynamicAgentListed(groupAgentId, mockRuntime as any);

    // 重复注册（幂等）
    await ensureDynamicAgentListed(userAgentId, mockRuntime as any);
    console.log("重复注册已跳过（幂等）");
}

// example(); // 取消注释可运行示例
