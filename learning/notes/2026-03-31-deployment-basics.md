# 部署基础学习笔记

> 📅 学习日期：2026-03-31
> 🦞 子龙虾出品

## 📌 今天学什么？

部署三件套：
1. **PM2** - Node.js 进程管理
2. **Nginx** - 反向代理 + 负载均衡
3. **Docker** - 容器化部署

---

## 1. PM2 进程管理器

### 为什么需要 PM2？
- Node.js 单线程，崩溃后需要重启
- 服务器重启后需要自动启动
- 需要日志管理、性能监控

### 安装
```bash
npm install -g pm2
```

### 启动应用
```bash
# 基本启动
pm2 start app.js

# 命名
pm2 start app.js --name my-api

# 指定端口
pm2 start app.js --name my-api -- 3001

# 带环境变量
NODE_ENV=production pm2 start app.js --name my-api

# 集群模式（自动负载均衡）
pm2 start app.js -i max  # 自动使用所有 CPU
pm2 start app.js -i 4     # 启动 4 个实例
```

### 常用命令
```bash
# 查看进程列表
pm2 list
pm2 status

# 查看日志
pm2 logs my-api
pm2 logs my-api --lines 100  # 最近 100 行

# 重启
pm2 restart my-api

# 停止
pm2 stop my-api

# 删除
pm2 delete my-api

# 监控
pm2 monit

# 查看详情
pm2 show my-api
```

### PM2 配置文件（ecosystem.config.js）
```javascript
module.exports = {
  apps: [{
    name: 'todo-api',
    script: 'src/server.js',
    cwd: '/root/.openclaw/workspace/learning/examples/todo-api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

### 使用配置启动
```bash
# 开发环境
pm2 start ecosystem.config.js

# 生产环境
pm2 start ecosystem.config.js --env production
```

### 开机自启
```bash
# 生成启动命令
pm2 startup

# 保存当前进程列表
pm2 save

# 查看开机自启配置
pm2 startup
```

### 常用场景

**1. 零 downtime 重启**
```bash
pm2 reload my-api
```

**2. 集群模式 + 负载均衡**
```bash
pm2 start app.js -i max --name my-cluster
pm2 reload my-cluster
```

**3. 日志管理**
```bash
pm2 logs my-api --lines 200 --nostream
pm2 flush  # 清空所有日志
```

---

## 2. Nginx 反向代理

### 为什么需要 Nginx？
- 80/443 端口（HTTP/HTTPS）
- 静态文件服务
- SSL 终结
- 负载均衡
- 请求缓存

### 安装
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# 启动
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 基本配置
```bash
# 配置文件位置
/etc/nginx/nginx.conf          # 主配置
/etc/nginx/sites-available/    # 可用站点
/etc/nginx/sites-enabled/      # 启用的站点
```

### 反向代理配置
```nginx
server {
    listen 80;
    server_name example.com;

    # 反向代理到 Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件（如果有）
    location /static {
        alias /var/www/static;
        expires 30d;
    }

    # 日志
    access_log /var/log/nginx/example_access.log;
    error_log /var/log/nginx/example_error.log;
}
```

### 启用站点
```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/example /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载
sudo systemctl reload nginx
```

### 多应用配置（不同子路径）
```nginx
server {
    listen 80;
    server_name example.com;

    # API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    # Admin
    location /admin {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    # 前端
    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

### HTTPS 配置（Let's Encrypt 免费证书）
```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d example.com -d www.example.com

# 自动续期（certbot 会自动配置）
sudo certbot renew --dry-run
```

### HTTPS + 反向代理
```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Docker 容器化

### 为什么需要 Docker？
- 环境一致性（开发 = 生产）
- 快速部署
- 资源隔离
- 易于扩展

### 核心概念
- **Image（镜像）** - 应用的模板
- **Container（容器）** - 镜像的运行实例
- **Dockerfile** - 构建镜像的脚本
- **Registry** - 镜像仓库（Docker Hub）

### 安装
```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh

# 启动
sudo systemctl start docker
sudo systemctl enable docker

# 当前用户使用 Docker（不需要 sudo）
sudo usermod -aG docker $USER
# 需要重新登录
```

### 常用命令
```bash
# 镜像
docker images                    # 列出镜像
docker pull nginx:latest         # 拉取镜像
docker rmi nginx                 # 删除镜像
docker build -t my-app .         # 构建镜像

# 容器
docker ps                        # 运行中的容器
docker ps -a                     # 所有容器
docker run -d --name my-app nginx # 运行容器
docker stop my-app               # 停止
docker start my-app              # 启动
docker restart my-app            # 重启
docker rm my-app                 # 删除容器
docker logs my-app               # 查看日志
docker exec -it my-app sh        # 进入容器

# 清理
docker system prune              # 清理未使用的资源
```

### Node.js + MongoDB Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  # MongoDB 数据库
  mongodb:
    image: mongo:latest
    container_name: tododb
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: tododb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - todo-network

  # Node.js API
  api:
    build: .
    container_name: todo-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: mongodb://admin:password123@mongodb:27017/tododb
    depends_on:
      - mongodb
    networks:
      - todo-network

volumes:
  mongodb_data:

networks:
  todo-network:
    driver: bridge
```

### Node.js Dockerfile
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（利用缓存）
RUN npm ci --only=production

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/server.js"]
```

### 构建和运行
```bash
# 构建镜像
docker build -t todo-api .

# 使用 docker-compose 启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f api

# 停止
docker-compose down

# 重新构建
docker-compose up -d --build
```

### 生产环境优化

**1. 多阶段构建（减小镜像体积）**
```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

**2. 非 root 用户运行**
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

**3. 健康检查**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/api || exit 1
```

---

## 4. 完整部署流程

### 方案一：传统部署（PM2 + Nginx）

```
1. 服务器安装 Node.js、MongoDB、Nginx
2. 使用 PM2 启动 Node.js 应用
3. Nginx 反向代理到 PM2
4. 配置 HTTPS
5. 设置开机自启
```

### 方案二：Docker 部署

```
1. 服务器安装 Docker、Docker Compose
2. 编写 Dockerfile 和 docker-compose.yml
3. 构建镜像或拉取镜像
4. 使用 Docker Compose 启动
5. 配置 Nginx 反向代理
6. 配置 HTTPS
```

### 推荐方案：Docker + PM2 + Nginx

```
                    ┌─────────────┐
    用户请求 ──────► │   Nginx     │
    (HTTPS:443)      │  反向代理    │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌────▼────┐
        │  Docker   │             │  Docker  │
        │ Container  │             │Container │
        │  (API)     │             │ (MongoDB)│
        │  Node.js   │             │  MongoDB │
        │  PM2       │             │          │
        └───────────┘             └──────────┘
```

---

## 📚 总结

| 工具 | 用途 | 特点 |
|-----|------|------|
| PM2 | 进程管理 | 自动重启、日志、集群 |
| Nginx | 反向代理 | HTTPS、负载均衡、静态文件 |
| Docker | 容器化 | 环境一致、快速部署、隔离 |

**下一步：** 第2轮循环 → MongoDB 基础（复习深化）

---
🦞 *学无止境，继续加油！*
