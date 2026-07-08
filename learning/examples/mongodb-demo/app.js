// Express + MongoDB 用户管理 API

const express = require('express');
const { connectDB } = require('./config/db');
const User = require('./models/User');

const app = express();
app.use(express.json());

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: 'MongoDB 用户管理 API',
    endpoints: [
      'GET    /api/users      - 获取所有用户',
      'GET    /api/users/:id  - 获取单个用户',
      'POST   /api/users      - 创建用户',
      'PUT    /api/users/:id  - 更新用户',
      'DELETE /api/users/:id  - 删除用户'
    ]
  });
});

// ===== API 路由 =====

// GET /api/users - 获取所有用户
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
    
    const users = await User.find()
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments();
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id - 获取单个用户
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: '无效的用户ID' });
  }
});

// POST /api/users - 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const { username, email, age, hobbies } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名和邮箱是必填项' 
      });
    }
    
    const user = new User({ username, email, age, hobbies });
    await user.save();
    
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名或邮箱已存在' 
      });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id - 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, email, age, hobbies, status } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, age, hobbies, status },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({ success: true, data: user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名或邮箱已存在' 
      });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id - 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({ success: true, message: '用户已删除', data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: '无效的用户ID' });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: '路由不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 启动服务器
async function startServer() {
  await connectDB();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('\n📌 API 使用示例:');
    console.log('# 创建用户');
    console.log(`curl -X POST http://localhost:${PORT}/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"username":"dayu","email":"dayu@example.com","age":25}'`);
    console.log('\n# 获取所有用户');
    console.log(`curl http://localhost:${PORT}/api/users`);
  });
}

startServer();
