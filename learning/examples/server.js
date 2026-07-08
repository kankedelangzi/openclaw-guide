/**
 * Node.js + Express 简单示例服务器
 * 学习目标：掌握 Express 基础、路由、中间件
 */

const express = require('express');
const app = express();
const PORT = 3000;

// ==========================================
// 中间件
// ==========================================

// JSON 请求体解析
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 静态文件服务（如果有 public 目录）
app.use(express.static('public'));

// ==========================================
// 路由
// ==========================================

// 主页
app.get('/', (req, res) => {
  res.send(`
    <h1>🦞 Node.js 学习服务器</h1>
    <p>试试以下接口：</p>
    <ul>
      <li><a href="/api/hello">GET /api/hello</a></li>
      <li><a href="/api/time">GET /api/time</a></li>
      <li>POST /api/echo (发送 JSON)</li>
      <li>GET /api/users/:id</li>
    </ul>
  `);
});

// GET 请求示例
app.get('/api/hello', (req, res) => {
  res.json({
    message: '你好！欢迎使用 Express 🦞',
    query: req.query,
    version: '1.0.0'
  });
});

// 获取当前时间
app.get('/api/time', (req, res) => {
  res.json({
    now: new Date().toISOString(),
    timestamp: Date.now(),
    timezone: 'Asia/Shanghai'
  });
});

// URL 参数路由
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    id,
    name: `用户 ${id}`,
    role: id === '1' ? '管理员' : '普通用户'
  });
});

// POST 请求示例
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '页面不存在', path: req.url });
});

// ==========================================
// 启动服务器
// ==========================================

app.listen(PORT, () => {
  console.log('='.repeat(40));
  console.log(`🦞 Express 服务器启动成功！`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`📍 文档: http://localhost:${PORT}/`);
  console.log('='.repeat(40));
});
