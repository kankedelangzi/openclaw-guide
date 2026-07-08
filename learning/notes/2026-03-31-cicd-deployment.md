# CI/CD 与生产部署进阶

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. CI/CD 概念与流程
2. GitHub Actions 实战
3. Docker Compose 生产配置
4. 环境配置管理
5. 自动化部署脚本

---

## 1. CI/CD 概念

### CI - 持续集成（Continuous Integration）
- 每次代码提交自动构建
- 自动运行测试
- 早发现 bug

### CD - 持续部署（Continuous Deployment）
- 自动部署到测试/生产环境
- 快速迭代交付

### 完整流程
```
代码提交 → GitHub → 触发 CI → 构建镜像 → 运行测试 → 部署
              ↓
         Slack 通知
```

---

## 2. GitHub Actions 实战

### 基本结构
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
```

### Docker 构建与推送
```yaml
# .github/workflows/docker.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: yourusername/yourapp
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### 部署到服务器
```yaml
# .github/workflows/deploy.yml
name: Deploy to Server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /var/www/app
            git pull origin main
            docker-compose down
            docker-compose pull
            docker-compose up -d
            docker image prune -f
```

---

## 3. Docker Compose 生产配置

### 生产级配置
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: yourusername/todo-api:latest
    container_name: todo-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - todo-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  mongodb:
    image: mongo:7
    container_name: tododb
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: tododb
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    networks:
      - todo-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: todo-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - todo-network

volumes:
  mongodb_data:
    driver: local
  mongodb_config:
    driver: local

networks:
  todo-network:
    driver: bridge
```

### 生产级 Nginx 配置
```nginx
# nginx.prod.conf
upstream api_backend {
    server api:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL 配置
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # API 代理
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # 超时
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 健康检查
    location /health {
        proxy_pass http://api_backend/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}
```

---

## 4. 环境配置管理

### .env 文件（开发）
```
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://admin:password123@localhost:27017/tododb
JWT_SECRET=dev-secret-key
```

### .env.production（生产 - 不提交！）
```
NODE_ENV=production
PORT=3000
DATABASE_URL=mongodb://admin:REAL_PASSWORD@localhost:27017/tododb
JWT_SECRET=REAL-PRODUCTION-SECRET
```

### GitHub Secrets
```
DOCKER_USERNAME=yourusername
DOCKER_PASSWORD=yourpassword
SERVER_HOST=your-server-ip
SERVER_USER=root
SERVER_SSH_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
```

### 使用 docker-compose 环境变量
```bash
# .env 文件
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=securepassword
DATABASE_URL=mongodb://admin:securepassword@mongodb:27017/tododb

# 启动时使用生产配置
docker-compose --env-file .env -f docker-compose.prod.yml up -d
```

---

## 5. 自动化部署脚本

### 部署脚本
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 开始部署..."

# 拉取最新代码
git pull origin main

# 构建并启动
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --build

# 清理旧镜像
docker image prune -f

# 检查健康状态
echo "⏳ 等待服务启动..."
sleep 10

# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查日志
echo "📋 最近日志:"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo "✅ 部署完成!"
```

### 回滚脚本
```bash
#!/bin/bash
# rollback.sh

set -e

IMAGE_TAG=${1:-previous}

echo "🔄 回滚到 $IMAGE_TAG..."

docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

echo "✅ 回滚完成!"
```

### 监控脚本
```bash
#!/bin/bash
# health-check.sh

ENDPOINT="http://localhost:3000/api"
MAX_RETRIES=3
RETRY_INTERVAL=5

check_health() {
    curl -sf "$ENDPOINT" > /dev/null
}

for i in $(seq 1 $MAX_RETRIES); do
    if check_health; then
        echo "✅ 健康检查通过"
        exit 0
    fi
    echo "⚠️ 检查失败，重试 $i/$MAX_RETRIES..."
    sleep $RETRY_INTERVAL
done

echo "❌ 健康检查失败，执行回滚"
./rollback.sh
exit 1
```

---

## 📚 总结

CI/CD 核心流程：
1. **代码提交** → GitHub
2. **CI** → 构建、测试
3. **Docker 镜像** → 推送
4. **CD** → 部署到服务器
5. **监控** → 健康检查、回滚

---
🦞 *学无止境，继续加油！*
