// Express 应用入口
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 创建应用
const app = express();

// 全局中间件
app.use(corsMiddleware);
app.use(express.json());  // 解析 JSON
app.use(express.urlencoded({ extended: true }));  // 解析 URL 编码

// 请求日志（简单版）
app.use((req, res, next) => {
  console.log(`📌 ${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// 根路由
app.get('/api', (req, res) => {
  res.json({
    name: 'Express 进阶 API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': '注册用户',
        'POST /api/auth/login': '登录',
        'GET /api/auth/me': '获取当前用户（需认证）'
      },
      users: {
        'GET /api/users': '获取所有用户（需认证）',
        'GET /api/users/:id': '获取单个用户（需认证）',
        'PUT /api/users/:id': '更新用户（需认证）',
        'DELETE /api/users/:id': '删除用户（需认证）'
      }
    }
  });
});

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

module.exports = app;
