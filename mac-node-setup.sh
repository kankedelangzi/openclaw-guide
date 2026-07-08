#!/bin/bash
# Mac OpenClaw Node 自动化配置脚本
# 作者: 龙虾 🦞
# 用途: 配置Mac成为可靠的OpenClaw Node，支持自动重连和守护进程

set -e

echo "🦞 开始配置 Mac OpenClaw Node..."
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置参数
GATEWAY_HOST="82.157.103.120"
GATEWAY_PORT="33801"
GATEWAY_URL="ws://${GATEWAY_HOST}:${GATEWAY_PORT}"
NODE_NAME="dayu的MacBook Pro"

# 检查OpenClaw是否已安装
if ! command -v openclaw &> /dev/null; then
    echo -e "${RED}❌ 错误: openclaw 命令未找到${NC}"
    echo "请先安装 OpenClaw: npm install -g openclaw"
    exit 1
fi

echo -e "${GREEN}✅ OpenClaw 已安装${NC}"

# 创建配置目录
CONFIG_DIR="$HOME/.openclaw"
mkdir -p "$CONFIG_DIR"

# 备份现有配置
if [ -f "$CONFIG_DIR/openclaw.json" ]; then
    BACKUP_FILE="$CONFIG_DIR/openclaw.json.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CONFIG_DIR/openclaw.json" "$BACKUP_FILE"
    echo -e "${YELLOW}📦 已备份现有配置到: $BACKUP_FILE${NC}"
fi

# 读取现有配置或创建新配置
if [ -f "$CONFIG_DIR/openclaw.json" ]; then
    echo "📝 读取现有配置..."
    EXISTING_CONFIG=$(cat "$CONFIG_DIR/openclaw.json")
else
    EXISTING_CONFIG='{"meta":{}}'
fi

# 创建新的配置文件
echo "📝 写入Node配置..."
cat > "$CONFIG_DIR/openclaw.json" << EOF
{
  "meta": {
    "lastTouchedVersion": "2026.4.5",
    "lastTouchedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "configuredBy": "龙虾自动化脚本"
  },
  "node": {
    "gatewayUrl": "$GATEWAY_URL",
    "displayName": "$NODE_NAME",
    "autoReconnect": true,
    "reconnectIntervalMs": 5000,
    "maxReconnectAttempts": 0
  }
}
EOF

echo -e "${GREEN}✅ 配置文件已更新${NC}"

# 创建LaunchAgent plist文件（Mac开机自动启动）
echo "🚀 创建开机自动启动服务..."
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS_DIR"

PLIST_FILE="$LAUNCH_AGENTS_DIR/com.openclaw.node.plist"

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.node</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/openclaw</string>
        <string>node</string>
        <string>run</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>$HOME</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$HOME/.openclaw/node.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.openclaw/node.error.log</string>
</dict>
</plist>
EOF

echo -e "${GREEN}✅ LaunchAgent 已创建: $PLIST_FILE${NC}"

# 加载LaunchAgent
echo "🔄 加载 LaunchAgent..."
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"
echo -e "${GREEN}✅ LaunchAgent 已加载${NC}"

# 创建便捷脚本
echo "📝 创建便捷管理脚本..."

# 重启脚本
cat > "$CONFIG_DIR/restart-node.sh" << 'EOF'
#!/bin/bash
# 快速重启 OpenClaw Node

echo "🔄 重启 OpenClaw Node..."

# 停止现有进程
pkill -f "openclaw node run" 2>/dev/null || true
sleep 2

# 重新启动
openclaw node run &

echo "✅ Node 已重启"
EOF
chmod +x "$CONFIG_DIR/restart-node.sh"

# 状态检查脚本
cat > "$CONFIG_DIR/check-status.sh" << 'EOF'
#!/bin/bash
# 检查 OpenClaw Node 状态

echo "🔍 检查 OpenClaw Node 状态..."

if pgrep -f "openclaw node run" > /dev/null; then
    echo "✅ Node 正在运行"
    echo "📊 进程信息:"
    pgrep -lf "openclaw node run"
else
    echo "❌ Node 未运行"
    echo "🔄 尝试启动..."
    openclaw node run &
fi

echo ""
echo "📋 最近日志:"
tail -n 20 ~/.openclaw/node.log 2>/dev/null || echo "暂无日志"
EOF
chmod +x "$CONFIG_DIR/check-status.sh"

echo -e "${GREEN}✅ 便捷脚本已创建${NC}"

# 创建SSH隧道保活脚本（备用方案）
echo "📝 创建SSH隧道保活脚本（备用）..."
cat > "$CONFIG_DIR/ssh-tunnel.sh" << EOF
#!/bin/bash
# SSH 反向隧道保活脚本
# 用于在Node连接不稳定时提供备用通道

GATEWAY_HOST="$GATEWAY_HOST"
TUNNEL_PORT="33801"
LOCAL_PORT="33801"

echo "🔌 建立SSH反向隧道..."
echo "本地端口 \$LOCAL_PORT -> 远程 \$GATEWAY_HOST:\$TUNNEL_PORT"

# 使用autossh保持隧道稳定（如果安装了autossh）
if command -v autossh &> /dev/null; then
    autossh -M 0 -f -N -R \${TUNNEL_PORT}:localhost:\${LOCAL_PORT} root@\${GATEWAY_HOST} \
        -o "ServerAliveInterval=30" \
        -o "ServerAliveCountMax=3" \
        -o "ExitOnForwardFailure=yes"
    echo "✅ autossh 隧道已建立"
else
    # 普通ssh隧道
    ssh -f -N -R \${TUNNEL_PORT}:localhost:\${LOCAL_PORT} root@\${GATEWAY_HOST} \
        -o "ServerAliveInterval=30" \
        -o "ServerAliveCountMax=3"
    echo "✅ SSH 隧道已建立（建议安装 autossh 获得更好的稳定性）"
fi
EOF
chmod +x "$CONFIG_DIR/ssh-tunnel.sh"

echo -e "${GREEN}✅ SSH隧道脚本已创建${NC}"

# 创建卸载脚本
cat > "$CONFIG_DIR/uninstall-service.sh" << 'EOF'
#!/bin/bash
# 卸载 OpenClaw Node 服务

echo "🗑️  卸载 OpenClaw Node 服务..."

# 卸载LaunchAgent
PLIST_FILE="$HOME/Library/LaunchAgents/com.openclaw.node.plist"
if [ -f "$PLIST_FILE" ]; then
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm "$PLIST_FILE"
    echo "✅ LaunchAgent 已卸载"
fi

# 停止Node进程
pkill -f "openclaw node run" 2>/dev/null || true
echo "✅ Node 进程已停止"

echo "📝 配置文件保留在: $HOME/.openclaw/"
echo "如需完全删除，请手动删除该目录"
EOF
chmod +x "$CONFIG_DIR/uninstall-service.sh"

echo ""
echo "================================"
echo -e "${GREEN}🎉 Mac OpenClaw Node 配置完成！${NC}"
echo "================================"
echo ""
echo "📋 配置摘要:"
echo "   • Gateway地址: $GATEWAY_URL"
echo "   • 节点名称: $NODE_NAME"
echo "   • 自动重连: 启用"
echo "   • 开机启动: 启用"
echo ""
echo "📁 生成的文件:"
echo "   • 配置: ~/.openclaw/openclaw.json"
echo "   • 服务: ~/Library/LaunchAgents/com.openclaw.node.plist"
echo "   • 重启脚本: ~/.openclaw/restart-node.sh"
echo "   • 状态检查: ~/.openclaw/check-status.sh"
echo "   • 隧道脚本: ~/.openclaw/ssh-tunnel.sh"
echo "   • 卸载脚本: ~/.openclaw/uninstall-service.sh"
echo ""
echo "🔧 常用命令:"
echo "   • 重启Node: ~/.openclaw/restart-node.sh"
echo "   • 检查状态: ~/.openclaw/check-status.sh"
echo "   • 查看日志: tail -f ~/.openclaw/node.log"
echo "   • 停止服务: launchctl unload ~/Library/LaunchAgents/com.openclaw.node.plist"
echo ""
echo "⚠️  注意:"
echo "   • 首次配置需要手动启动一次: openclaw node run"
echo "   • 如果连接不稳定，可以运行: ~/.openclaw/ssh-tunnel.sh"
echo "   • Mac重启后会自动启动Node服务"
echo ""
echo -e "${GREEN}🦞 配置完成！这台Mac现在是你的可靠大后方了。${NC}"
