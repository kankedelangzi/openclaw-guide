/**
 * 动态Agent路由实现
 *
 * 为每个用户/群组生成独立Agent ID，实现会话隔离。
 * 参考: openclaw-plugin-wecom/src/dynamic-agent.ts
 */

// ──────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────
import type { OpenClawConfig } from "openclaw/plugin-sdk";

interface DynamicAgentConfig {
  enabled: boolean;
  dmCreateAgent: boolean;
  groupEnabled: boolean;
  adminUsers: string[];
}

interface RouteDecision {
  useDynamic: boolean;
  agentId: string;
  reason: string;
}

// ──────────────────────────────────────────────
// 1. 读取动态Agent配置（带默认值）
// ──────────────────────────────────────────────
export function getDynamicAgentConfig(
  config: OpenClawConfig,
  channelId: string = "wecom",
): DynamicAgentConfig {
  const channelConfig = (config as any)?.channels?.[channelId] ?? {};
  const dynamicAgents = channelConfig.dynamicAgents ?? {};

  return {
    enabled: Boolean(dynamicAgents.enabled),
    dmCreateAgent: dynamicAgents.dmCreateAgent ?? true,
    groupEnabled: dynamicAgents.groupEnabled ?? true,
    adminUsers: Array.isArray(dynamicAgents.adminUsers)
      ? dynamicAgents.adminUsers
      : [],
  };
}

// ──────────────────────────────────────────────
// 2. 清理ID（移除非法字符）
// ──────────────────────────────────────────────
function sanitizeIdPart(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

// ──────────────────────────────────────────────
// 3. 生成确定性Agent ID
// ──────────────────────────────────────────────
export function generateAgentId(
  chatType: "dm" | "group",
  peerId: string,
  accountId: string = "default",
  channelId: string = "wecom",
): string {
  const sanitizedPeer = sanitizeIdPart(peerId) || "unknown";
  const sanitizedAccount = sanitizeIdPart(accountId) || "default";
  const sanitizedChannel = sanitizeIdPart(channelId);

  return `${sanitizedChannel}-${sanitizedAccount}-${chatType}-${sanitizedPeer}`;
}

// ──────────────────────────────────────────────
// 4. 判断是否管理员（绕过动态路由）
// ──────────────────────────────────────────────
function isAdmin(senderId: string, adminUsers: string[]): boolean {
  const normalized = senderId.trim().toLowerCase();
  return adminUsers.some((admin) => admin.trim().toLowerCase() === normalized);
}

// ──────────────────────────────────────────────
// 5. 路由决策
// ──────────────────────────────────────────────
export function shouldUseDynamicAgent(params: {
  chatType: "dm" | "group";
  senderId: string;
  config: OpenClawConfig;
  channelId?: string;
}): RouteDecision {
  const { chatType, senderId, config, channelId } = params;
  const dynamicConfig = getDynamicAgentConfig(config, channelId);

  // 总开关关闭 → 不使用动态路由
  if (!dynamicConfig.enabled) {
    return { useDynamic: false, agentId: "main", reason: "disabled" };
  }

  // 管理员 → 使用主Agent（main）
  if (isAdmin(senderId, dynamicConfig.adminUsers)) {
    return { useDynamic: false, agentId: "main", reason: "admin" };
  }

  // 群组检查
  if (chatType === "group") {
    if (dynamicConfig.groupEnabled) {
      return { useDynamic: true, agentId: "dynamic", reason: "group_enabled" };
    }
    return { useDynamic: false, agentId: "main", reason: "group_disabled" };
  }

  // DM检查
  if (dynamicConfig.dmCreateAgent) {
    return { useDynamic: true, agentId: "dynamic", reason: "dm_create" };
  }

  return { useDynamic: false, agentId: "main", reason: "dm_disabled" };
}

// ──────────────────────────────────────────────
// 6. 完整路由函数（一步到位）
// ──────────────────────────────────────────────
export function resolveRoute(params: {
  chatType: "dm" | "group";
  peerId: string;
  senderId: string;
  accountId?: string;
  config: OpenClawConfig;
  channelId?: string;
}): { agentId: string; isDynamic: boolean } {
  const decision = shouldUseDynamicAgent(params);

  if (!decision.useDynamic) {
    return { agentId: decision.agentId, isDynamic: false };
  }

  const agentId = generateAgentId(
    params.chatType,
    params.peerId,
    params.accountId,
    params.channelId,
  );

  return { agentId, isDynamic: true };
}

// ──────────────────────────────────────────────
// 7. 幂等+串行写入agents.list（核心实现）
// ──────────────────────────────────────────────

// 内存缓存：已确保的Agent ID集合
const ensuredDynamicAgentIds = new Set<string>();

// 串行队列：避免并发写入冲突
let writeQueue: Promise<void> = Promise.resolve();

function upsertAgentIdEntry(
  cfg: Record<string, unknown>,
  agentId: string,
): boolean {
  if (!cfg.agents || typeof cfg.agents !== "object") {
    cfg.agents = {};
  }

  const agentsObj = cfg.agents as Record<string, unknown>;
  const currentList: Array<{ id: string }> = Array.isArray(agentsObj.list)
    ? (agentsObj.list as Array<{ id: string }>)
    : [];

  const existingIds = new Set(
    currentList
      .map((entry) => entry?.id?.trim().toLowerCase())
      .filter((id): id is string => Boolean(id)),
  );

  let changed = false;
  const nextList = [...currentList];

  // 首次创建时保留 main 作为默认
  if (nextList.length === 0) {
    nextList.push({ id: "main" });
    existingIds.add("main");
    changed = true;
  }

  // 添加新Agent ID
  if (!existingIds.has(agentId.toLowerCase())) {
    nextList.push({ id: agentId });
    changed = true;
  }

  if (changed) {
    agentsObj.list = nextList;
  }

  return changed;
}

interface PluginRuntime {
  config: {
    loadConfig: () => OpenClawConfig;
    writeConfigFile: (cfg: OpenClawConfig) => Promise<void>;
  };
}

export async function ensureDynamicAgentListed(
  agentId: string,
  runtime: PluginRuntime,
): Promise<void> {
  const normalized = agentId.trim().toLowerCase();
  if (!normalized) return;

  // 幂等检查
  if (ensuredDynamicAgentIds.has(normalized)) return;
  if (!runtime?.config?.loadConfig || !runtime?.config?.writeConfigFile) return;

  // 串行写入队列
  writeQueue = writeQueue
    .then(async () => {
      if (ensuredDynamicAgentIds.has(normalized)) return;

      const latestConfig = runtime.config.loadConfig();
      if (!latestConfig || typeof latestConfig !== "object") return;

      const changed = upsertAgentIdEntry(
        latestConfig as Record<string, unknown>,
        normalized,
      );

      if (changed) {
        await runtime.config.writeConfigFile(latestConfig as OpenClawConfig);
      }

      ensuredDynamicAgentIds.add(normalized);
    })
    .catch((err) => {
      console.warn(`[dynamic-agent] Failed to ensure agent: ${normalized}`, err);
    });

  await writeQueue;
}

// 重置缓存（测试用）
export function resetEnsuredCache(): void {
  ensuredDynamicAgentIds.clear();
}

// ──────────────────────────────────────────────
// 8. 完整使用示例
// ──────────────────────────────────────────────
function example() {
  const config = {
    channels: {
      wecom: {
        dynamicAgents: {
          enabled: true,
          dmCreateAgent: true,
          groupEnabled: true,
          adminUsers: ["admin-user-001", "admin-user-002"],
        },
      },
    },
  } as unknown as OpenClawConfig;

  const testCases = [
    { chatType: "dm" as const, peerId: "user_123", senderId: "user_123" },
    { chatType: "dm" as const, peerId: "user_456", senderId: "user_456" },
    { chatType: "group" as const, peerId: "group_789", senderId: "user_123" },
    { chatType: "dm" as const, peerId: "user_admin", senderId: "admin-user-001" },
  ];

  for (const tc of testCases) {
    const result = resolveRoute({
      ...tc,
      accountId: "default",
      config,
      channelId: "wecom",
    });

    const agentId = result.isDynamic
      ? generateAgentId(tc.chatType, tc.peerId, "default", "wecom")
      : "main";

    console.log(
      `[${tc.chatType}] sender=${tc.senderId} → agent=${agentId} (dynamic=${result.isDynamic})`,
    );
  }
}

// example()输出:
// [dm] sender=user_123 → agent=wecom-default-dm-user_123 (dynamic=true)
// [dm] sender=user_456 → agent=wecom-default-dm-user_456 (dynamic=true)
// [group] sender=user_123 → agent=wecom-default-group-group_789 (dynamic=true)
// [dm] sender=admin-user-001 → agent=main (dynamic=false) ← 管理员
