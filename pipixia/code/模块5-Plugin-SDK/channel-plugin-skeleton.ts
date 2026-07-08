/**
 * 最小Channel Plugin骨架
 * 参考: openclaw-plugin-wecom/src/channel.ts
 */

// ──────────────────────────────────────────────
// 类型导入（从 openclaw/plugin-sdk 主入口）
// ──────────────────────────────────────────────
import type {
  ChannelPlugin,
  ChannelAccountSnapshot,
  OpenClawConfig,
  OpenClawPluginApi,
} from "openclaw/plugin-sdk";

// 使用官方提供的空配置Schema（无自定义配置字段时）
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";

// ──────────────────────────────────────────────
// 1. 插件元数据
// ──────────────────────────────────────────────
const META = {
  id: "my-channel" as const,
  label: "My Channel",
  selectionLabel: "My Channel",
  docsPath: "/channels/my-channel",
  docsLabel: "my-channel",
  blurb: "My custom IM channel integration",
  aliases: ["mychan", "mc"] as string[],
  order: 50,
  quickstartAllowFrom: true,
};

// ──────────────────────────────────────────────
// 2. 账号ID解析（从配置或默认）
// ──────────────────────────────────────────────
const DEFAULT_ACCOUNT_ID = "default";

function resolveDefaultAccountId(cfg: OpenClawConfig): string | undefined {
  const accounts = (cfg as any)?.accounts?.myChannel;
  if (Array.isArray(accounts) && accounts.length > 0) {
    return accounts[0];
  }
  return undefined;
}

// ──────────────────────────────────────────────
// 3. 应用账号配置（写入cfg）
// ──────────────────────────────────────────────
function applyMyChannelConfig(
  cfg: OpenClawConfig,
  accountId: string,
  input: { url?: string; token?: string },
): OpenClawConfig {
  const normalizedAccountId = accountId || DEFAULT_ACCOUNT_ID;
  const channelConfig = {
    connectionMode: input.url?.startsWith("ws") ? "websocket" : "webhook",
    endpoint: input.url,
    token: input.token,
  };

  return {
    ...cfg,
    channels: {
      ...(cfg as any).channels,
      myChannel: {
        ...((cfg as any).channels?.myChannel ?? {}),
        [normalizedAccountId]: channelConfig,
      },
    },
  } as OpenClawConfig;
}

// ──────────────────────────────────────────────
// 4. 验证输入
// ──────────────────────────────────────────────
function validateMyChannelInput(input: {
  url?: string;
  token?: string;
}): string | null {
  if (!input.url?.trim()) {
    return "URL is required";
  }
  if (!input.token?.trim()) {
    return "Token is required";
  }
  return null;
}

// ──────────────────────────────────────────────
// 5. 完整的ChannelPlugin定义
// ──────────────────────────────────────────────
type MyChannelAccountConfig = {
  connectionMode: "websocket" | "webhook";
  endpoint?: string;
  token?: string;
};

export const myChannelPlugin: ChannelPlugin<MyChannelAccountConfig> = {
  id: META.id,
  meta: META,

  // 老版本兼容字段（可选）
  // onboarding: myOnboardingAdapter,

  // setup生命周期：账号解析 → 验证 → 应用
  setup: {
    resolveAccountId({ cfg, accountId }) {
      return (
        accountId?.trim() ||
        resolveDefaultAccountId(cfg) ||
        DEFAULT_ACCOUNT_ID
      );
    },

    validateInput({ input }) {
      return validateMyChannelInput(input as { url?: string; token?: string });
    },

    applyAccountConfig({ cfg, accountId, input }) {
      return applyMyChannelConfig(
        cfg as OpenClawConfig,
        accountId ?? DEFAULT_ACCOUNT_ID,
        input as { url?: string; token?: string },
      );
    },
  },
};

// ──────────────────────────────────────────────
// 6. 插件主入口（default导出）
// ──────────────────────────────────────────────
const myChannelExtension = {
  id: META.id,
  name: META.label,
  description: META.blurb,
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // 注册渠道插件
    api.registerChannel({ plugin: myChannelPlugin });

    // 可选：注册自定义工具
    // api.registerTool(myCustomTool);

    console.log(`[my-channel] Plugin registered.`);
  },
};

export default myChannelExtension;
