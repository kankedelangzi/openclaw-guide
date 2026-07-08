# 部署命令速查

## PM2 命令
```bash
# 启动
pm2 start ecosystem.config.js
pm2 start src/server.js --name my-api

# 管理
pm2 list
pm2 logs my-api
pm2 restart my-api
pm2 stop my-api
pm2 delete my-api

# 集群模式
pm2 start src/server.js -i max --name my-cluster

# 开机自启
pm2 startup
pm2 save

# 重载（零 downtime）
pm2 reload my-api
```

## Nginx 命令
```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 重启
sudo systemctl restart nginx
```

## Docker 命令
```bash
# 构建镜像
docker build -t todo-api .

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f api

# 重建
docker-compose up -d --build

# 停止
docker-compose down

# 清理
docker system prune -f
```

## 完整部署流程（传统方式）
```bash
# 1. 安装依赖
sudo apt update
sudo apt install -y nodejs npm nginx

# 2. 安装 PM2
npm install -g pm2

# 3. 复制项目
cd /var/www
git clone https://github.com/yourrepo/todo-api.git
cd todo-api
npm install

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env

# 5. 启动
pm2 start ecosystem.config.js --env production

# 6. 配置 Nginx
sudo cp nginx.conf /etc/nginx/sites-available/todo-api
sudo ln -s /etc/nginx/sites-available/todo-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 7. SSL（Let's Encrypt）
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 8. 开机自启
pm2 startup
pm2 save
```

## 完整部署流程（Docker 方式）
```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker

# 2. 安装 Docker Compose
sudo apt install docker-compose

# 3. 复制项目
cd /var/www
git clone https://github.com/yourrepo/todo-api.git
cd todo-api/examples/deployment-basics

# 4. 启动
docker-compose up -d --build

# 5. 查看状态
docker-compose ps
docker-compose logs -f api

# 6. 配置 Nginx（反向代理到 Docker）
sudo cp nginx.conf /etc/nginx/sites-available/todo-api
sudo ln -s /etc/nginx/sites-available/todo-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```
