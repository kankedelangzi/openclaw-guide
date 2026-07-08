#!/bin/bash
# Mac OpenClaw Node 完整自动化配置脚本
# 包含: autossh隧道 + 自动启动 + 进程守护
# 使用配置: SSH端口转发 18790 -> 33801

set -e

echo "🦞 Mac OpenClaw Node 自动化配置"
echo "================================"
echo ""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 配置
GATEWAY_HOST="82.157.103.120"
GATEWAY_PORT="33801"
LOCAL_PORT="18790"  # SSH转发后的本地端口
TOKEN="73528e300032f9ef586aa3a17deb0b42a8b245899b3bb24d"
NODE_NAME="dayu的MacBook Pro"

CONFIG_DIR="$HOME/.openclaw"
mkdir -p "$CONFIG_DIR"

# 1. 检查并安装 autossh
echo "🔧 检查 autossh..."
if ! command -v autossh &> /dev/null; then
    echo -e "${YELLOW}⚠️  autossh 未安装，正在安装...${NC}"
    if command -v brew &> /dev/null; then
        brew install autossh
    else
        echo -e "${RED}❌ 请先安装 Homebrew: https://brew.sh${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ autossh 已安装${NC}"
fi

# 2. 创建OpenClaw Node配置文件
echo "📝 配置 OpenClaw Node..."
cat > "$CONFIG_DIR/openclaw-node.env" << EOF
# OpenClaw Node 环境变量
export OPENCLAW_GATEWAY_TOKEN=$TOKEN
export OPENCLAW_NODE_NAME="$NODE_NAME"
EOF

echo -e "${GREEN}✅ 环境变量配置已保存${NC}"

# 3. 创建SSH隧道启动脚本
echo "🔌 创建SSH隧道脚本..."
cat > "$CONFIG_DIR/start-autossh-tunnel.sh" << EOF
#!/bin/bash
# 启动 autossh 隧道
# 本地18790端口 -> 远程33801端口

GATEWAY="$GATEWAY_HOST"
REMOTE_PORT="$GATEWAY_PORT"
LOCAL_PORT="$LOCAL_PORT"

echo "🔌 启动 autossh 隧道..."
echo "   本地端口: \$LOCAL_PORT"
echo "   远程: \$GATEWAY:\$REMOTE_PORT"

# 检查是否已有隧道在运行
if pgrep -f "autossh.*\$LOCAL_PORT:127.0.0.1:\$REMOTE_PORT" > /dev/null; then
    echo "✅ 隧道已在运行"
    exit 0
fi

# 启动 autossh
# -M 0: 禁用额外监控端口
# -f: 后台运行
# -N: 不执行远程命令
# -L: 本地端口转发
autossh -M 0 -f -N -L \${LOCAL_PORT}:127.0.0.1:\${REMOTE_PORT} root@\${GATEWAY} \
    -o "ServerAliveInterval=30" \
    -o "ServerAliveCountMax=3" \
    -o "ExitOnForwardFailure=yes" \
    -o "StrictHostKeyChecking=no"

sleep 2

# 验证隧道
if nc -z 127.0.0.1 \$LOCAL_PORT 2>/dev/null; then
    echo -e "${GREEN}✅ 隧道建立成功！${NC}"
else
    echo -e "${RED}❌ 隧道建立失败${NC}"
    exit 1
fi
EOF
chmod +x "$CONFIG_DIR/start-autossh-tunnel.sh"

# 4. 创建Node启动脚本
echo "🚀 创建Node启动脚本..."
cat > "$CONFIG_DIR/start-node.sh" << 'EOF'
#!/bin/bash
# 启动 OpenClaw Node

source "$HOME/.openclaw/openclaw-node.env"

LOCAL_PORT="18790"

echo "🚀 启动 OpenClaw Node..."
echo "   连接: 127.0.0.1:$LOCAL_PORT"

# 检查隧道
if ! nc -z 127.0.0.1 $LOCAL_PORT 2>/dev/null; then
    echo "⚠️  隧道未运行，尝试启动..."
    "$HOME/.openclaw/start-autossh-tunnel.sh"
    sleep 2
fi

# 检查Node是否已在运行
if pgrep -f "openclaw node run" > /dev/null; then
    echo "✅ Node 已在运行"
    exit 0
fi

# 启动Node
openclaw node run --host 127.0.0.1 --port $LOCAL_PORT &
echo $! > "$HOME/.openclaw/node.pid"

echo -e "\033[0;32m✅ Node 已启动\033[0m"
EOF
chmod +x "$CONFIG_DIR/start-node.sh"

# 5. 创建统一启动脚本
echo "📝 创建统一启动脚本..."
cat > "$CONFIG_DIR/start-all.sh" << 'EOF'
#!/bin/bash
# 一键启动: 隧道 + Node

echo "🦞 启动 Mac OpenClaw Node 服务..."
echo ""

# 启动隧道
"$HOME/.openclaw/start-autossh-tunnel.sh"

# 等待隧道就绪
sleep 3

# 启动Node
"$HOME/.openclaw/start-node.sh"

echo ""
echo "✅ 所有服务已启动"
echo "📊 查看状态: ~/.openclaw/status.sh"
EOF
chmod +x "$CONFIG_DIR/start-all.sh"

# 6. 创建状态检查脚本
echo "📊 创建状态检查脚本..."
cat > "$CONFIG_DIR/status.sh" << 'EOF'
#!/bin/bash
# 检查所有服务状态

echo "🔍 Mac OpenClaw Node 状态检查"
echo "=============================="
echo ""

# 检查SSH隧道
echo -n "🔌 SSH隧道 (18790): "
if pgrep -f "autossh.*18790:127.0.0.1:33801" > /dev/null; then
    echo -e "\033[0;32m✅ 运行中\033[0m"
else
    echo -e "\033[0;31m❌ 未运行\033[0m"
fi

# 检查端口
echo -n "📡 端口 18790: "
if nc -z 127.0.0.1 18790 2>/dev/null; then
    echo -e "\033[0;32m✅ 可连接\033[0m"
else
    echo -e "\033[0;31m❌ 不可连接\033[0m"
fi

# 检查Node进程
echo -n "🚀 OpenClaw Node: "
if pgrep -f "openclaw node run" > /dev/null; then
    echo -e "\033[0;32m✅ 运行中\033[0m"
    echo "   PID: $(pgrep -f "openclaw node run")"
else
    echo -e "\033[0;31m❌ 未运行\033[0m"
fi

echo ""
echo "📋 最近日志:"
tail -n 10 "$HOME/.openclaw/node.log" 2>/dev/null || echo "暂无日志"
EOF
chmod +x "$CONFIG_DIR/status.sh"

# 7. 创建停止脚本
echo "🛑 创建停止脚本..."
cat > "$CONFIG_DIR/stop-all.sh" << 'EOF'
#!/bin/bash
# 停止所有服务

echo "🛑 停止 Mac OpenClaw Node 服务..."

# 停止Node
if pgrep -f "openclaw node run" > /dev/null; then
    pkill -f "openclaw node run"
    echo "✅ Node 已停止"
else
    echo "ℹ️  Node 未运行"
fi

# 停止autossh隧道
if pgrep -f "autossh.*18790:127.0.0.1:33801" > /dev/null; then
    pkill -f "autossh.*18790:127.0.0.1:33801"
    echo "✅ SSH隧道已停止"
else
    echo "ℹ️  SSH隧道未运行"
fi

echo "✅ 所有服务已停止"
EOF
chmod +x "$CONFIG_DIR/stop-all.sh"

# 8. 创建LaunchAgent (开机自动启动)
echo "🔄 创建开机自动启动服务..."
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS_DIR"

PLIST_FILE="$LAUNCH_AGENTS_DIR/com.openclaw.macnode.plist"

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.macnode</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${CONFIG_DIR}/start-all.sh</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>${HOME}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>30</integer>
    <key>StandardOutPath</key>
    <string>${CONFIG_DIR}/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>${CONFIG_DIR}/launchd.error.log</string>
</dict>
</plist>
EOF

echo -e "${GREEN}✅ LaunchAgent 已创建${NC}"

# 9. 加载LaunchAgent
echo "🔄 加载 LaunchAgent..."
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"
echo -e "${GREEN}✅ LaunchAgent 已加载${NC}"

# 10. 创建重启脚本
cat > "$CONFIG_DIR/restart-all.sh" << 'EOF'
#!/bin/bash
# 重启所有服务

echo "🔄 重启 Mac OpenClaw Node..."
"$HOME/.openclaw/stop-all.sh"
sleep 2
"$HOME/.openclaw/start-all.sh"
EOF
chmod +x "$CONFIG_DIR/restart-all.sh"

echo ""
echo "================================"
echo -e "${GREEN}🎉 配置完成！${NC}"
echo "================================"
echo ""
echo "📁 生成的脚本:"
echo "   • 一键启动: ~/.openclaw/start-all.sh"
echo "   • 一键停止: ~/.openclaw/stop-all.sh"
echo "   • 状态检查: ~/.openclaw/status.sh"
echo "   • 重启服务: ~/.openclaw/restart-all.sh"
echo ""
echo "🔧 使用方法:"
echo "   1. 手动启动: ~/.openclaw/start-all.sh"
echo "   2. 查看状态: ~/.openclaw/status.sh"
echo "   3. 停止服务: ~/.openclaw/stop-all.sh"
echo ""
echo "🚀 开机自动启动: 已启用"
echo "   LaunchAgent: ~/Library/LaunchAgents/com.openclaw.macnode.plist"
echo ""
echo "📊 日志位置:"
echo "   • Node日志: ~/.openclaw/node.log"
echo "   • 启动日志: ~/.openclaw/launchd.log"
echo ""
echo -e "${GREEN}🦞 这台Mac现在完全自动化了！重启后会自动连接。${NC}"
echo ""

# 询问是否立即启动
read -p "是否立即启动服务? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    "$CONFIG_DIR/start-all.sh"
fi
