/**
 * 生产环境服务器入口
 * 使用方法：
 *   开发：node server.js
 *   生产：pm2 start ecosystem.config.js
 */

const http = require('http');

// 简单的健康检查端点（Docker / PM2 健康探针需要）
const server = http.createServer((req, res) => {
  const url = req.url;

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Todo API',
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   PID: ${process.pid}`);
});

// 优雅退出（PM2 需要）
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
