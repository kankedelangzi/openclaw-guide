#!/bin/bash
# OpenClaw Mac Node 完整自动化配置脚本
# 运行一次，以后Mac重启/开机都会自动启动

set -e

echo "=== 1. 配置白名单（允许所有命令无需审批）==="
openclaw approvals allowlist add --agent "*" "**"

echo "=== 2. 配置 launchd开机自启动 ==="
# 创建 launchd plist
sudo tee /Library/LaunchDaemons/ai.openclaw.node.plist > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.node</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd /Users/dayu && source ~/.nvm/nvm.sh && exec openclaw node run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/dayu/.openclaw/node-launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/dayu/.openclaw/node-launchd.error.log</string>
    <key>UserName</key>
    <string>dayu</string>
    <key>SessionCreate</key>
    <true/>
</dict>
</plist>
EOF

# 加载自启动服务
sudo launchctl unload /Library/LaunchDaemons/ai.openclaw.node.plist 2>/dev/null || true
sudo launchctl load /Library/LaunchDaemons/ai.openclaw.node.plist

echo "=== 3. 关闭watchdog，改用系统服务守护 ==="
# 停掉watchdog
pkill -f "openclaw-node" 2>/dev/null || true
sleep 2

# 启动新的node（由launchd守护）
launchctl kickstart -k gui/$(id -u)/ai.openclaw.node 2>/dev/null || true

echo "=== 4. 验证配置 ==="
echo "Node进程:"
pgrep -l openclaw-node || echo "未运行（launchd会在下次启动）"
echo ""
echo "Launchd服务:"
launchctl list | grep openclaw || echo "服务未加载"
echo ""
echo "白名单:"
openclaw approvals get

echo ""
echo "=== 配置完成 ==="
echo "以后Mac重启后，OpenClaw Node会自动启动，无需手动操作"
