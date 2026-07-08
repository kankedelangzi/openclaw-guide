// Express 应用入口
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`📌 ${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/todos', require('./routes/todos'));

app.get('/api', (req, res) => {
  res.json({
    name: '待办事项 API',
    version: '1.0.0',
    description: '完整的待办事项管理 API',
    endpoints: {
      auth: {
        'POST /api/auth/register': '注册用户',
        'POST /api/auth/login': '登录',
        'GET /api/auth/me': '获取当前用户（需认证）'
      },
      todos: {
        'GET /api/todos': '获取待办列表（支持筛选）',
        'GET /api/todos/stats': '获取统计数据',
        'GET /api/todos/:id': '获取单个待办',
        'POST /api/todos': '创建待办',
        'PUT /api/todos/:id': '更新待办',
        'DELETE /api/todos/:id': '删除待办',
        'PATCH /api/todos/:id/toggle': '切换完成状态'
      }
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
