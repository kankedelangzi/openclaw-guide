# Dockerfile - Node.js 应用
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 构建（如需要）
RUN npm run build || true

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制 package 文件和依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物（如果有）
COPY --from=builder /app/dist ./dist 2>/dev/null || true
COPY --from=builder /app/src ./src

# 设置目录权限
RUN chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

# 启动命令
CMD ["node", "src/server.js"]
