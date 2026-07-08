/**
 * Plugin SDK 兼容性 Shim 模式
 *
 * 解决 openclaw plugin-sdk 子路径在版本间重构的问题。
 * 参考: openclaw-plugin-wecom/src/compat/plugin-sdk-shim.ts
 *
 * 三种策略：
 * 1. 纯类型 → 直接从主入口重导出（永远稳定）
 * 2. 常量 → 硬编码（如 DEFAULT_ACCOUNT_ID = "default"）
 * 3. 函数 → 动态导入 + 多路径探测 + 缓存
 */

// ──────────────────────────────────────────────
// 策略1: 类型重导出（主入口始终稳定）
// ──────────────────────────────────────────────
import type {
  OpenClawConfig,
  PluginRuntime,
  OpenClawPluginApi,
  ChannelPlugin,
  ChannelConfigSchema,
  ChannelAccountSnapshot,
  ChannelGatewayContext,
  WizardPrompter,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
} from "openclaw/plugin-sdk";

// 导出类型（供外部使用）
export type {
  OpenClawConfig,
  PluginRuntime,
  OpenClawPluginApi,
  ChannelPlugin,
  ChannelAccountSnapshot,
  ChannelGatewayContext,
};

// ──────────────────────────────────────────────
// 策略2: 常量硬编码
// ──────────────────────────────────────────────
export const DEFAULT_ACCOUNT_ID = "default";
export const PLUGIN_SDK_VERSION = "2026.3.24";

// ──────────────────────────────────────────────
// 策略3: 动态导入 + 多路径探测 + 缓存
// ──────────────────────────────────────────────

type AnyFn = (...args: any[]) => unknown;

// 3a. 配置相关函数（同步使用）
type ConfigSectionHelpers = {
  deleteAccountFromConfigSection: AnyFn;
  setAccountEnabledInConfigSection: AnyFn;
};

let _configHelpers: ConfigSectionHelpers | undefined;
let _configHelpersReady: Promise<void>;

async function resolveConfigHelpers(): Promise<void> {
  const possiblePaths = [
    "openclaw/plugin-sdk/core",
    "openclaw/plugin-sdk/channel-plugin-common",
    "openclaw/plugin-sdk/channel-setup",
  ];

  for (const subpath of possiblePaths) {
    try {
      const mod = await import(subpath) as ConfigSectionHelpers;
      if (typeof mod?.deleteAccountFromConfigSection === "function") {
        _configHelpers = {
          deleteAccountFromConfigSection: mod.deleteAccountFromConfigSection,
          setAccountEnabledInConfigSection: mod.setAccountEnabledInConfigSection,
        };
        return;
      }
    } catch {
      // 路径不存在，尝试下一个
    }
  }

  // 所有路径都失败 → 抛出明确错误
  throw new Error(
    "[plugin-shim] Cannot resolve config section helpers. " +
    "Ensure openclaw >=2026.2.24 is installed.",
  );
}

function ensureConfigHelpers(): void {
  if (!_configHelpersReady) {
    _configHelpersReady = resolveConfigHelpers();
  }
}

export async function awaitConfigHelpers(): Promise<void> {
  if (_configHelpers) return;
  ensureConfigHelpers();
  await _configHelpersReady;
}

// 同步包装（须先调用 awaitConfigHelpers）
export function deleteAccountFromConfigSection(...args: unknown[]): unknown {
  if (!_configHelpers) {
    throw new Error(
      "[plugin-shim] Config helpers not initialized. Call awaitConfigHelpers() first.",
    );
  }
  return _configHelpers.deleteAccountFromConfigSection(...args);
}

export function setAccountEnabledInConfigSection(...args: unknown[]): unknown {
  if (!_configHelpers) {
    throw new Error(
      "[plugin-shim] Config helpers not initialized. Call awaitConfigHelpers() first.",
    );
  }
  return _configHelpers.setAccountEnabledInConfigSection(...args);
}

// ──────────────────────────────────────────────
// 3b. Onboarding相关函数（异步）
// ──────────────────────────────────────────────
type PromptAccountIdFn = (params: {
  cfg: unknown;
  prompter: unknown;
  label: string;
  currentId: string;
  listAccountIds: (cfg: unknown) => string[];
  defaultAccountId: string;
}) => Promise<string>;

let _promptAccountId: PromptAccountIdFn | undefined;

export async function resolvePromptAccountId(): Promise<PromptAccountIdFn> {
  if (_promptAccountId) return _promptAccountId;

  const possiblePaths = [
    "openclaw/plugin-sdk/matrix",
    "openclaw/plugin-sdk/channel-setup",
    "openclaw/plugin-sdk/setup",
  ];

  for (const subpath of possiblePaths) {
    try {
      const mod = await import(subpath) as { promptAccountId?: PromptAccountIdFn };
      if (typeof mod?.promptAccountId === "function") {
        _promptAccountId = mod.promptAccountId;
        return _promptAccountId;
      }
    } catch {
      // 路径不存在，尝试下一个
    }
  }

  // 兜底实现
  _promptAccountId = async (params) =>
    params.currentId || params.defaultAccountId;
  return _promptAccountId;
}

// ──────────────────────────────────────────────
// 3c. 文件IO相关（异步函数，async模式天然兼容）
// ──────────────────────────────────────────────
type FileLockFn = <T>(
  filePath: string,
  options: unknown,
  fn: () => Promise<T>,
) => Promise<T>;

type ReadJsonFn = <T>(
  filePath: string,
  fallback: T,
) => Promise<{ value: T; exists: boolean }>;

type WriteJsonFn = (filePath: string, value: unknown) => Promise<void>;

interface FileIoHelpers {
  withFileLock: FileLockFn;
  readJsonFileWithFallback: ReadJsonFn;
  writeJsonFileAtomically: WriteJsonFn;
}

let _fileIo: FileIoHelpers | undefined;

export async function resolveFileIoHelpers(): Promise<FileIoHelpers> {
  if (_fileIo) return _fileIo;

  // 尝试SDK内置实现
  const jsonStore = await import("openclaw/plugin-sdk/json-store").catch(() => null);
  const msteams = await import("openclaw/plugin-sdk/msteams").catch(() => null);

  const readFn = (jsonStore as any)?.readJsonFileWithFallback;
  const writeFn = (jsonStore as any)?.writeJsonFileAtomically;
  const lockFn = (msteams as any)?.withFileLock;

  if (readFn && writeFn && lockFn) {
    _fileIo = {
      readJsonFileWithFallback: readFn,
      writeJsonFileAtomically: writeFn,
      withFileLock: lockFn,
    };
    return _fileIo;
  }

  // Node.js原生回退（仅作为兜底）
  const fs = await import("node:fs/promises");
  const nodePath = await import("node:path");

  const fallbackRead: ReadJsonFn = async <T>(filePath: string, fallback: T) => {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return { value: JSON.parse(raw) as T, exists: true };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return { value: fallback, exists: false };
      }
      return { value: fallback, exists: false };
    }
  };

  const fallbackWrite: WriteJsonFn = async (filePath: string, value: unknown) => {
    const dir = nodePath.dirname(filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const content = JSON.stringify(value, null, 2) + "\n";
    const tmpPath = `${filePath}.tmp.${process.pid}`;
    await fs.writeFile(tmpPath, content, { mode: 0o600 });
    await fs.rename(tmpPath, filePath);
  };

  const fallbackLock: FileLockFn = async <T>(
    _filePath: string,
    _options: unknown,
    fn: () => Promise<T>,
  ): Promise<T> => fn();

  _fileIo = {
    readJsonFileWithFallback: readFn ?? fallbackRead,
    writeJsonFileAtomically: writeFn ?? fallbackWrite,
    withFileLock: lockFn ?? fallbackLock,
  };

  return _fileIo;
}

// ──────────────────────────────────────────────
// 4. 空配置Schema（从主入口直接导出）
// ──────────────────────────────────────────────
export { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";

// ──────────────────────────────────────────────
// 使用示例
// ──────────────────────────────────────────────
async function example() {
  // 初始化所有helpers
  await awaitConfigHelpers();
  const fileIo = await resolveFileIoHelpers();
  const promptFn = await resolvePromptAccountId();

  console.log("Config helpers resolved:", !!_configHelpers);
  console.log("File IO resolved:", !!fileIo);
  console.log("Prompt fn resolved:", !!promptFn);
}
