/**
 * 模块6 - Channel插件架构 代码示例
 * 演示如何构建一个完整的 Channel Plugin（最小可运行版本）
 * 皮皮虾学习笔记 | 2026-04-13
 */

// ============================================================
// 示例1：最简 Channel Plugin 骨架
// ============================================================

import type {
    ChannelPlugin,
    ChannelCapabilities,
    ChannelMeta,
    ChannelConfigAdapter,
    ChannelOutboundContext,
    ChannelAccountSnapshot,
} from "openclaw/plugin-sdk";

// 账号配置类型
interface MyChannelAccount {
    token: string | null;
    botName: string;
    enabled: boolean;
}

// 插件实例
const myChannelPlugin: ChannelPlugin<MyChannelAccount> = {
    // ---- 必须字段 ----
    id: "my-channel",

    meta: {
        id: "my-channel",
        label: "My Channel",
        selectionLabel: "My Channel",
        docsPath: "/channels/my-channel",
        blurb: "Custom channel integration for demonstration",
        order: 99,
    },

    capabilities: {
        chatTypes: ["direct", "group"],
        media: true,
        reactions: false,
        threads: false,
        polls: false,
        reply: true,
        blockStreaming: false,
    },

    // ---- 配置适配器（必须实现最低接口）----
    config: {
        listAccountIds: (cfg) => {
            const section = (cfg.channels as any)?.myChannel;
            if (!section || !section.token) return [];
            return ["default"];
        },

        resolveAccount: (cfg, accountId = "default"): MyChannelAccount => {
            const section = (cfg.channels as any)?.myChannel;
            return {
                token: section?.token ?? null,
                botName: section?.botName ?? "Bot",
                enabled: section?.enabled !== false,
            };
        },

        isEnabled: (account) => account.enabled,

        isConfigured: (account) => !!account.token,

        describeAccount: (account, cfg): ChannelAccountSnapshot => ({
            accountId: "default",
            name: account.botName,
            enabled: account.enabled,
            configured: !!account.token,
            linked: !!account.token,
        }),
    },

    // ---- 安装向导适配器 ----
    setup: {
        applyAccountConfig: ({ cfg, accountId, input }) => ({
            ...cfg,
            channels: {
                ...cfg.channels,
                myChannel: {
                    ...(cfg.channels as any)?.myChannel,
                    token: input.token,
                },
            },
        }),
    },

    // ---- 发送消息 ----
    outbound: {
        send: async (ctx: ChannelOutboundContext) => {
            const account = ctx.cfg;
            // 调用渠道 API 发送消息
            console.log(`[my-channel] Sending to ${ctx.to}: ${ctx.text}`);
            await sendToMyChannelAPI({
                token: "...", // 从 account 中取
                to: ctx.to,
                text: ctx.text,
                mediaUrl: ctx.mediaUrl,
            });
        },
    },
};

async function sendToMyChannelAPI(params: {
    token: string;
    to: string;
    text: string;
    mediaUrl?: string;
}) {
    // 具体 HTTP 请求实现
    console.log("Sending:", params);
}

// ============================================================
// 示例2：WebSocket 型渠道生命周期（长连接）
// ============================================================

import { runPassiveAccountLifecycle, createAccountStatusSink } from "openclaw/plugin-sdk";

async function startWebSocketChannelAccount(params: {
    token: string;
    accountId: string;
    setStatus: (s: ChannelAccountSnapshot) => void;
    abortSignal: AbortSignal;
}) {
    const { token, accountId, setStatus, abortSignal } = params;

    // 创建状态写入器（自动附加 accountId）
    const statusSink = createAccountStatusSink({ accountId, setStatus });

    await runPassiveAccountLifecycle({
        abortSignal,
        start: async () => {
            statusSink({ connected: false, lastStartAt: Date.now() });

            // 建立 WebSocket 连接
            const ws = new (await import("ws")).default(`wss://api.mychannel.com/ws?token=${token}`);

            ws.on("open", () => {
                statusSink({ connected: true, lastConnectedAt: Date.now() });
            });

            ws.on("message", (data) => {
                statusSink({ lastInboundAt: Date.now() });
                // 处理入站消息...
            });

            ws.on("error", (err) => {
                statusSink({ connected: false, lastError: err.message });
            });

            return ws;
        },
        stop: async (ws) => {
            ws.close();
        },
        onStop: () => {
            statusSink({ connected: false, lastStopAt: Date.now() });
        },
    });
}

// ============================================================
// 示例3：Webhook 型渠道生命周期（HTTP 服务器）
// ============================================================

import { keepHttpServerTaskAlive } from "openclaw/plugin-sdk";
import http from "http";

async function startWebhookChannelAccount(params: {
    port: number;
    onMessage: (from: string, text: string) => void;
    abortSignal?: AbortSignal;
}) {
    const { port, onMessage, abortSignal } = params;

    const server = http.createServer((req, res) => {
        if (req.method === "POST" && req.url === "/webhook") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                const payload = JSON.parse(body);
                onMessage(payload.from, payload.text);
                res.writeHead(200).end("OK");
            });
        } else {
            res.writeHead(404).end();
        }
    });

    server.listen(port, () => {
        console.log(`[my-channel] Webhook listening on port ${port}`);
    });

    // 保持服务器存活直到 AbortSignal 触发
    await keepHttpServerTaskAlive({
        server,
        abortSignal,
        onAbort: () => {
            server.close();
        },
    });
}

// ============================================================
// 示例4：@mention 门控（群聊中只在被@时响应）
// ============================================================

import { resolveMentionGating, createInboundDebouncer } from "openclaw/plugin-sdk";

// 防抖器：500ms 内多条消息合并处理
const debouncer = createInboundDebouncer({ ms: 500 });

async function handleInboundMessage(params: {
    from: string;
    text: string;
    chatType: "direct" | "group";
    cfg: any;
}) {
    const { from, text, chatType, cfg } = params;

    // 群聊中检查是否被@
    if (chatType === "group") {
        const gateResult = resolveMentionGating({
            text,
            cfg,
            channelId: "my-channel",
            chatType: "group",
        });

        if (!gateResult.allowed) {
            console.log("[my-channel] Not mentioned, dropping message");
            return;
        }

        // 使用去掉@后的文字
        params.text = gateResult.strippedText ?? text;
    }

    // 防抖处理
    debouncer.debounce(from, () => {
        console.log(`[my-channel] Processing: ${params.text} from ${from}`);
        // 分发给 Agent 处理...
    });
}

// ============================================================
// 示例5：message tool 能力扩展（向Agent注入自定义参数）
// ============================================================

import { Type } from "@sinclair/typebox";

const channelWithMessageTool: ChannelPlugin = {
    id: "my-channel",
    meta: {} as any,
    capabilities: { chatTypes: ["direct"] },
    config: {} as any,

    actions: {
        describeMessageTool: (ctx) => ({
            actions: ["send", "react"] as any,
            capabilities: ["reactions"] as any,
            schema: {
                properties: {
                    // 向 message tool 注入自定义字段
                    myChannelExtra: Type.Optional(
                        Type.Object({
                            priority: Type.Union([
                                Type.Literal("normal"),
                                Type.Literal("urgent"),
                            ]),
                            ttl: Type.Optional(Type.Number()),
                        })
                    ),
                },
                visibility: "current-channel",
            },
        }),

        handleAction: async (ctx) => {
            switch (ctx.action) {
                case "send": {
                    const extra = ctx.params.myChannelExtra as any;
                    const priority = extra?.priority ?? "normal";
                    console.log(`Sending with priority: ${priority}`);
                    return { result: { messageId: "msg123" } };
                }
                case "react": {
                    const emoji = ctx.params.emoji as string;
                    const messageId = ctx.params.messageId as string;
                    console.log(`Reacting ${emoji} to ${messageId}`);
                    return { result: { ok: true } };
                }
                default:
                    throw new Error(`Unsupported action: ${ctx.action}`);
            }
        },
    },
};

export {
    myChannelPlugin,
    startWebSocketChannelAccount,
    startWebhookChannelAccount,
    handleInboundMessage,
    channelWithMessageTool,
};
