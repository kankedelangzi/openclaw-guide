# 第二章：安装配置

## 2.1 安装方式对比

OpenClaw 支持多种安装方式，选哪个取决于你的场景：

| 安装方式 | 适合人群 | 优点 | 缺点 |
|---|---|---|---|
| 安装脚本（推荐） | 大部分用户 | 全自动，检测系统，自动装Node | 需要网络下载 |
| npm/pnpm | 已有Node.js环境 | 快速，灵活 | 需手动处理依赖 |
| 源码编译 | 开发者/贡献者 | 可自定义，可调试 | 环境配置复杂 |
| Docker | 服务器部署 | 环境隔离，一键部署 | 需要Docker基础 |

### 推荐：安装脚本

一行命令搞定一切，OpenClaw 会自动检测你的操作系统，安装必要的依赖：

```bash
# macOS / Linux / WSL2
curl -fsSL https://openclaw.ai/install.sh | bash

# Windows (PowerShell)
iwr -useb https://openclaw.ai/install.ps1 | iex
```

安装脚本会自动：
1. 检测操作系统
2. 安装 Node.js（如果没有）
3. 安装 OpenClaw
4. 启动引导向导

如果不想走引导，加 `--no-onboard` 参数：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### npm / pnpm 方式

已有 Node.js 环境的话，直接用包管理器安装：

```bash
# npm
npm install -g openclaw@latest
openclaw onboard --install-daemon

# pnpm（推荐）
pnpm add -g openclaw@latest
pnpm approve-builds -g   # pnpm需要显式批准有构建脚本的包
openclaw onboard --install-daemon
```

**注意**：pnpm 对有构建脚本的包有安全限制，安装完需要运行 `pnpm approve-builds -g` 来批准。

如果遇到 `sharp` 构建错误（通常是全局 libvips 的问题）：

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

### 源码安装

适合想研究源码或做二次开发的工程师：

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install && pnpm ui:build && pnpm build
pnpm link --global
openclaw onboard --install-daemon
```

也可以不 link，直接在仓库里用 `pnpm openclaw ...` 运行。

### Docker 方式

服务器部署首选，零依赖：

```bash
# 拉取镜像
docker pull openclaw/openclaw:latest

# 运行容器
docker run -d \
  --name openclaw \
  -p 18789:18789 \
  -v ~/openclaw-data:/data \
  openclaw/openclaw:latest
```

生产环境建议使用 `docker-compose` 管理：

```yaml
version: '3.8'
services:
  openclaw:
    image: openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "18789:18789"
    volumes:
      - ./data:/data
    environment:
      - OPENCLAW_GATEWAY_TOKEN=your_secure_token_here
```

## 2.2 环境要求

### 系统要求

- **Node.js**：推荐 Node 24，最低 Node 22.14+
- **操作系统**：macOS / Linux / Windows（原生或 WSL2）
- **网络**：需要能访问 OpenClaw 安装源（部分 Skill 需要访问外网）

验证 Node 版本：

```bash
node --version
# 推荐输出：v22.x.x 或更高
```

### 磁盘空间

OpenClaw 本身很小（几十MB），但加上 Skill、数据、记忆存储，建议预留 **1GB+** 可用空间。

## 2.3 初始化项目

安装完成后，初始化一个工作目录：

```bash
openclaw init my-assistant
cd my-assistant
```

初始化会创建标准目录结构：

```
my-assistant/
├── config.yaml          # 主配置文件
├── workspace/           # 工作目录（AI的"家"）
│   ├── SOUL.md         # AI性格设定
│   ├── AGENTS.md       # Agent行为规范
│   ├── TOOLS.md        # 工具使用说明
│   └── memory/         # 记忆存储
│       └── daily/      # 每日记忆
├── skills/             # 本地Skill目录
│   └── _installed/     # 已安装的Skill
├── data/               # 数据目录
│   ├── sessions/       # Session存储
│   └── logs/           # 日志
└── package.json        # 项目元数据
```

## 2.4 配置文件详解

`config.yaml` 是 OpenClaw 的核心配置文件。以下是完整的字段说明：

### 最小配置示例

```yaml
# 唯一实例名称
name: my-assistant

# Gateway端口（默认18789）
port: 18789

# 安全令牌（远程连接时必须设置）
gateway:
  token: "your_secure_token_here"

# 消息渠道配置
channels:
  telegram:
    enabled: true
    bot_token: "YOUR_BOT_TOKEN"

# Skill目录
skills:
  dirs:
    - ./skills            # 本地Skill
    - ~/.openclaw/skills   # 全局Skill

# 模型配置
models:
  default: openai/gpt-4o-mini
  providers:
    openai:
      api_key: "sk-..."
```

### 完整配置字段

```yaml
# ========== 基础信息 ==========
name: my-assistant           # 实例名称
version: 1                   # 配置版本（目前固定为1）

# ========== Gateway配置 ==========
gateway:
  port: 18789               # WebSocket端口
  host: "0.0.0.0"           # 绑定地址（0.0.0.0=所有网卡）
  token: ""                 # 安全令牌（生产环境必设）
  cors:
    enabled: false          # 是否允许跨域
    origins: ["*"]           # 允许的源
  tls:
    enabled: false          # 是否启用TLS
    cert: ""                # 证书路径
    key: ""                 # 私钥路径

# ========== 渠道配置 ==========
channels:
  telegram:
    enabled: false
    bot_token: ""
    admin_ids: []           # 管理员Telegram ID
  feishu:
    enabled: false
    app_id: ""
    app_secret: ""
    bot_name: "OpenClaw"
  discord:
    enabled: false
    bot_token: ""
    guild_id: ""
  slack:
    enabled: false
    bot_token: ""
    signing_secret: ""
  whatsapp:
    enabled: false
    session_path: "./data/whatsapp"
  webchat:
    enabled: false
    secret: ""              # 页面访问密钥

# ========== Skill配置 ==========
skills:
  dirs:
    - ./skills
    - ~/.openclaw/skills
  allow:
    - "*"                   # 允许所有Skill
  deny:
    - "dangerous-skill"     # 禁用特定Skill

# ========== 模型配置 ==========
models:
  default: openai/gpt-4o-mini
  fallback: []              # 备用模型列表
  providers:
    openai:
      api_key: ""
      base_url: ""          # 可选：代理地址
      organization: ""      # 可选：组织ID
    anthropic:
      api_key: ""
    minimax:
      api_key: ""
      api_id: ""
    kimi:
      api_key: ""

# ========== 记忆配置 ==========
memory:
  type: file                # file | sqlite | postgres
  path: ./workspace/memory
  auto_summarize: true      # 自动摘要超长上下文
  max_context_tokens: 128000

# ========== 日志配置 ==========
logging:
  level: info               # trace | debug | info | warn | error
  file: ./data/logs/openclaw.log
  max_size: 10mb
  max_files: 5
  format: pretty            # pretty | json

# ========== 安全配置 ==========
security:
  allowed_senders: []       # 允许发送消息的用户ID
  blocked_senders: []       # 禁止发送的用户ID
  rate_limit:
    enabled: true
    max_per_minute: 60

# ========== 节点配置 ==========
nodes:
  enabled: false
  list: []

# ========== 高级配置 ==========
advanced:
  session:
    ttl_days: 30            # Session保留天数
    max_count: 1000         # 最大Session数
  exec:
    timeout_ms: 30000        # 命令执行超时
    allowed_commands: []     # 允许执行的命令（空=全部）
```

## 2.5 第一个Channel：Telegram配置详解

Telegram 是最容易配置的渠道，以下是完整步骤。

### 第一步：创建Bot

1. 在Telegram搜索 **@BotFather**
2. 发送 `/newbot`
3. 按提示输入Bot名称（display name）和用户名（username）
4. 获得 `bot_token`，格式类似：`123456789:ABCdefGhIJKlmNoPQRsTUVwxYZ`

### 第二步：在config.yaml中配置

```yaml
channels:
  telegram:
    enabled: true
    bot_token: "123456789:ABCdefGhIJKlmNoPQRsTUVwxYZ"
    admin_ids:
      - 123456789      # 你的Telegram用户ID
```

### 第三步：获取自己的Telegram ID

发一条消息给你的Bot，然后访问：

```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

JSON响应中的 `"id":123456789` 就是你的用户ID。

### 第四步：验证

重启 Gateway：

```bash
openclaw gateway restart
```

向你的Bot发一条消息，应该能收到回复了。

### 常见Telegram配置问题

**Q：Bot收不到消息？**
- 检查 bot_token 是否正确
- 确认 `enabled: true`
- 查看日志：`openclaw gateway logs`

**Q：如何设置Bot的命令菜单？**
在 BotFather 处发送 `/setcommands`，输入：

```
start - 开始使用
help - 获取帮助
skill - 列出所有技能
```

## 2.6 验证安装

安装配置完成后，运行以下命令验证：

```bash
# 检查CLI是否可用
openclaw --version

# 检查Gateway健康状态
openclaw gateway status

# 检查配置问题
openclaw doctor
```

正常输出示例：

```
$ openclaw --version
openclaw v2026.3.24

$ openclaw gateway status
Gateway: running (PID 12345)
Port: 18789
Channels: telegram ✓
Skills: 12 loaded
```

## 2.7 目录结构详解

理解每个目录的作用：

```
my-assistant/
├── config.yaml              # 唯一需要手动编辑的配置
│
├── workspace/               # AI的"家"——它在这里思考、工作、记忆
│   ├── SOUL.md             # AI的性格、说话风格、行事原则
│   │                       # 编辑这个文件改变AI的性格
│   ├── AGENTS.md           # Agent行为规范、工作流程
│   │                       # 定义Agent如何处理任务
│   ├── TOOLS.md            # 工具使用说明
│   │                       # 描述每个工具的能力和限制
│   ├── MEMORY.md           # 长期记忆（跨会话持久化）
│   ├── HEARTBEAT.md        # 心跳检查清单
│   ├── IDENTITY.md         # AI的身份设定
│   ├── USER.md             # 用户信息
│   └── memory/             # 记忆存储
│       └── daily/          # 每日记忆碎片
│
├── skills/                  # 本地Skill（你自己开发的）
│   ├── hello/
│   │   └── SKILL.md
│   └── _installed/         # 自动生成：已安装的Skill副本
│
├── data/                    # 运行时数据
│   ├── sessions/           # Session状态文件
│   ├── logs/               # 日志文件
│   └── whatsapp/           # WhatsApp会话数据
│
└── package.json            # 项目元数据（不要手动编辑）
```

### workspace/ 目录特别说明

`workspace/` 是 OpenClaw 最重要的目录。AI在这里读取它的"记忆"，在这里执行任务，在这里写笔记。

当你给AI分配新任务时，它会首先在workspace中查找相关文件。

**新建工作目录的推荐流程：**

```bash
openclaw init my-project
cd my-project
# 编辑 workspace/SOUL.md 定义AI的性格
# 编辑 workspace/AGENTS.md 定义行为规范
openclaw gateway start
```

## 2.8 下一步

第二章到此结束。你现在应该能够：

- 选择合适的安装方式（推荐安装脚本）
- 正确配置 config.yaml
- 配置至少一个 Channel（Telegram）
- 理解 workspace 目录结构

下一章我们将进入实战部分——**Skill开发**，手把手教你写第一个真正的Skill：

- SKILL.md 的标准格式
- Skill的目录结构
- 调试技巧
- 一个完整的天气查询Skill

准备好了 → [第三章：Skill开发基础](chapters/03-skill-dev.md)
