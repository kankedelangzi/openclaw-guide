# Mac OpenClaw Node 配置档案
# 设备: dayu的MacBook Pro (2018, 32GB)
# 管理AI: 龙虾 🦞
# 创建时间: 2026-04-08

## 🔌 连接配置 (关键!)

### 当前工作配置
```bash
# SSH本地端口转发 (Mac -> 云电脑Gateway)
ssh -N -L 18790:127.0.0.1:33801 root@82.157.103.120

# 环境变量
export OPENCLAW_GATEWAY_TOKEN=73528e300032f9ef586aa3a17deb0b42a8b245899b3bb24d

# 启动命令
openclaw node run --host 127.0.0.1 --port 18790
```

### 配置说明
- **SSH端口**: 18790 (本地转发端口)
- **Gateway端口**: 33801 (云电脑上)
- **连接方式**: SSH本地端口转发
- **认证Token**: 73528e300032f9ef586aa3a17deb0b42a8b245899b3bb24d

## 📝 历史问题记录

### 2026-04-08 端口问题
- **问题**: Node默认连接 127.0.0.1:18789，但实际Gateway在 33801
- **解决**: 使用SSH端口转发 18790 -> 33801
- **教训**: 必须明确指定 --host 和 --port 参数

## 🚀 自动化方案

### 方案1: autossh + launchd (推荐)

```bash
# 安装 autossh
brew install autossh

# 创建LaunchAgent
```

### 方案2: 普通SSH + 保活脚本

## 🔧 管理脚本位置

- 重启脚本: `~/.openclaw/restart-node.sh`
- 状态检查: `~/.openclaw/check-status.sh`
- SSH隧道: `~/.openclaw/ssh-tunnel.sh`

## ⚠️ 维护注意事项

1. **Token安全**: 不要泄露 OPENCLAW_GATEWAY_TOKEN
2. **SSH连接**: 保持SSH隧道稳定，断线后Node会重连
3. **端口一致**: 确保SSH转发端口和Node连接端口一致
4. **日志监控**: 定期检查 `~/.openclaw/node.log`

## 📊 节点状态

- **Node ID**: f2d4f1e3073891d622d00dfec11abcef821faec1ac40ddb750fbee0cee6b621a
- **状态**: ✅ 已配对 + 已连接
- **能力**: browser, system
- **平台**: darwin (macOS)
