/**
 * 模块3-路由解析核心机制代码示例
 * 演示 resolveAgentRoute、buildAgentSessionKey、绑定匹配等核心功能
 */

// ============================================================
// 模拟 OpenClaw Config 结构（简化版）
// ============================================================

interface RoutePeer {
    kind: "direct" | "group" | "channel";
    id: string;
}

interface AgentRouteBinding {
    agentId: string;
    match: {
        channel?: string;
        accountId?: string;
        peer?: { kind?: string; id?: string };
        guildId?: string;
        memberRoleIds?: string[];
    };
}

interface OpenClawConfig {
    agents?: Array<{
        id: string;
        bindings?: AgentRouteBinding[];
    }>;
    channels?: Record<string, any>;
}

// ============================================================
// 1. resolveAgentRoute 简化实现
// ============================================================

type MatchedBy = 
    | "binding.peer"
    | "binding.peer.parent"
    | "binding.guild+roles"
    | "binding.guild"
    | "binding.team"
    | "binding.account"
    | "binding.channel"
    | "default";

interface ResolvedAgentRoute {
    agentId: string;
    channel: string;
    accountId: string;
    sessionKey: string;
    mainSessionKey: string;
    lastRoutePolicy: "main" | "session";
    matchedBy: MatchedBy;
}

function listBindings(cfg: OpenClawConfig): AgentRouteBinding[] {
    return cfg.agents?.flatMap(agent => 
        (agent.bindings || []).map(binding => ({ ...binding, agentId: agent.id }))
    ) || [];
}

function normalizeAccountId(accountId: string): string {
    return String(accountId).trim().toLowerCase();
}

function resolveAgentRoute(input: {
    cfg: OpenClawConfig;
    channel: string;
    accountId?: string | null;
    peer?: RoutePeer | null;
    parentPeer?: RoutePeer | null;
    guildId?: string | null;
    memberRoleIds?: string[];
}): ResolvedAgentRoute {
    const { cfg, channel, accountId, peer, parentPeer, guildId, memberRoleIds } = input;
    const bindings = listBindings(cfg);
    const normAccountId = normalizeAccountId(accountId || "default");

    // L1: 精确peer绑定匹配
    if (peer) {
        const peerMatch = bindings.find(b => 
            b.match.channel === channel &&
            b.match.accountId === normAccountId &&
            b.match.peer?.id === peer.id
        );
        if (peerMatch) {
            return buildResolvedRoute(peerMatch.agentId, channel, normAccountId, "binding.peer", peer);
        }
    }

    // L2: parentPeer继承匹配
    if (parentPeer) {
        const parentMatch = bindings.find(b =>
            b.match.channel === channel &&
            b.match.accountId === normAccountId &&
            b.match.peer?.id === parentPeer.id
        );
        if (parentMatch) {
            return buildResolvedRoute(parentMatch.agentId, channel, normAccountId, "binding.peer.parent", peer!);
        }
    }

    // L3: 账号级别匹配
    const accountMatch = bindings.find(b =>
        b.match.channel === channel &&
        b.match.accountId === normAccountId
    );
    if (accountMatch) {
        return buildResolvedRoute(accountMatch.agentId, channel, normAccountId, "binding.account", peer);
    }

    // L4: 渠道级别匹配
    const channelMatch = bindings.find(b =>
        b.match.channel === channel &&
        !b.match.accountId &&
        !b.match.peer
    );
    if (channelMatch) {
        return buildResolvedRoute(channelMatch.agentId, channel, normAccountId, "binding.channel", peer);
    }

    // L5: 默认兜底
    return buildResolvedRoute("main", channel, normAccountId, "default", peer);
}

function buildResolvedRoute(
    agentId: string,
    channel: string,
    accountId: string,
    matchedBy: MatchedBy,
    peer?: RoutePeer | null
): ResolvedAgentRoute {
    const sessionKey = peer
        ? `agent:${agentId}:${channel}:${accountId}:${peer.kind}:${peer.id}`
        : `agent:${agentId}:${channel}:${accountId}`;
    
    const mainSessionKey = `agent:${agentId}:${channel}:${accountId}`;
    const lastRoutePolicy = sessionKey === mainSessionKey ? "main" : "session";

    return {
        agentId,
        channel,
        accountId,
        sessionKey,
        mainSessionKey,
        lastRoutePolicy,
        matchedBy,
    };
}

// ============================================================
// 2. buildAgentPeerSessionKey 演示
// ============================================================

function buildAgentPeerSessionKey(params: {
    agentId: string;
    channel: string;
    accountId?: string | null;
    peerKind?: "direct" | "group" | "channel" | null;
    peerId?: string | null;
    dmScope?: "main" | "per-peer" | "per-channel-peer";
}): string {
    const { agentId, channel, accountId, peerKind, peerId, dmScope = "per-peer" } = params;
    const normAccountId = normalizeAccountId(accountId || "default");

    switch (dmScope) {
        case "main":
            return `agent:${agentId}:${channel}:${normAccountId}`;
        case "per-peer":
            if (!peerKind || !peerId) return `agent:${agentId}:${channel}:${normAccountId}`;
            return `agent:${agentId}:${channel}:${normAccountId}:${peerKind}:${peerId}`;
        case "per-channel-peer":
            if (!peerKind || !peerId) return `agent:${agentId}:${channel}:${normAccountId}`;
            return `agent:${agentId}:${channel}:${normAccountId}:${peerKind}:${peerId}`;
        default:
            return `agent:${agentId}:${channel}:${normAccountId}`;
    }
}

// ============================================================
// 3. 测试示例
// ============================================================

const config: OpenClawConfig = {
    agents: [
        {
            id: "support-agent",
            bindings: [
                { match: { channel: "wecom", accountId: "acc1", peer: { id: "user123" } } },
                { match: { channel: "discord", guildId: "guild456" } },
            ]
        },
        {
            id: "sales-agent",
            bindings: [
                { match: { channel: "wecom", accountId: "acc2" } },
            ]
        },
    ]
};

// 测试1: 精确peer匹配
const route1 = resolveAgentRoute({
    cfg: config,
    channel: "wecom",
    accountId: "acc1",
    peer: { kind: "direct", id: "user123" },
});
console.log("Test 1 - Peer Match:", route1);
// Expected: matchedBy="binding.peer", agentId="support-agent"

// 测试2: 账号匹配（无peer绑定）
const route2 = resolveAgentRoute({
    cfg: config,
    channel: "wecom",
    accountId: "acc2",
    peer: { kind: "direct", id: "user456" },  // 无直接绑定
});
console.log("Test 2 - Account Match:", route2);
// Expected: matchedBy="binding.account", agentId="sales-agent"

// 测试3: 默认兜底
const route3 = resolveAgentRoute({
    cfg: config,
    channel: "wecom",
    accountId: "acc999",  // 无任何绑定
    peer: { kind: "direct", id: "user789" },
});
console.log("Test 3 - Default:", route3);
// Expected: matchedBy="default", agentId="main"

// 测试4: DM Scope
const sessionKey1 = buildAgentPeerSessionKey({
    agentId: "main",
    channel: "wecom",
    accountId: "acc1",
    peerKind: "direct",
    peerId: "user1",
    dmScope: "main",  // 所有DM共享
});
const sessionKey2 = buildAgentPeerSessionKey({
    agentId: "main",
    channel: "wecom",
    accountId: "acc1",
    peerKind: "direct",
    peerId: "user1",
    dmScope: "per-peer",  // 每个用户独立
});
console.log("Test 4 - DM Scope:");
console.log("  main:", sessionKey1);
console.log("  per-peer:", sessionKey2);

export { resolveAgentRoute, buildAgentPeerSessionKey, type ResolvedAgentRoute, type RoutePeer };
