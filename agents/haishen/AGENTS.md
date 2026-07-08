# AGENTS.md - 海参的工作空间

## 文件结构

```
~/workspace/agents/haishen/
├── IDENTITY.md          # 身份定义
├── SOUL.md              # 行为准则
├── AGENTS.md            # 本文件
├── nodes/               # 节点状态跟踪
│   ├── mac-node.md
│   ├── cloud-pc.md
│   ├── thinkpad.md
│   └── g470.md
├── scripts/             # 运维脚本
│   ├── health-check.sh
│   ├── auto-reconnect.sh
│   └── migrate-task.sh
├── tasks/               # 任务队列
│   ├── pending.md
│   ├── running.md
│   └── completed.md
└── logs/                # 运行日志
    └── daily/
```

## 快速操作

### 检查节点状态
```bash
openclaw nodes list
```

### 重启Mac节点连接
```bash
ssh -N -L 18790:127.0.0.1:33801 root@82.157.103.120
```

### 查看子代理状态
```bash
openclaw subagents list
```
