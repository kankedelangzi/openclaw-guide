# Express 进阶学习笔记

> 📅 学习日期：2026-03-31
> 🦞 子龙虾出品

## 📌 今天学什么？

Express 进阶核心：
1. 路由模块化（Router）
2. 错误处理中间件
3. CORS 跨域
4. JWT 用户认证
5. 项目结构最佳实践

---

## 1. 路由模块化（Router）

### 问题：所有路由都写在 app.js 里会怎样？
- 代码臃肿，难以维护
- 难以团队协作
- 路由冲突难排查

### 解决方案：Express Router

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

// GET /users
router.get('/', async (req, res) => {
  res.json({ users: [] });
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  res.json({ id: req.params.id });
});

// POST /users
router.post('/', async (req, res) => {
  res.json({ created: req.body });
});

module.exports = router;

// routes/posts.js
const express = require('express');
const router = express.Router();

// GET /posts
router.get('/', (req, res) => res.json({ posts: [] }));

module.exports = router;
```

### 在 app.js 中使用

```javascript
// app.js
const express = require('express');
const app = express();

const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');

// 挂载路由
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

app.listen(3000);
```

---

## 2. 中间件（Middleware）

中间件是 Express 的灵魂！每个请求都会经过中间件处理。

### 中间件分类

```javascript
// 1. 应用级中间件（所有请求）
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.path}`);
  next();  // 必须调用 next() 才能继续
});

// 2. 路由级中间件（特定路由）
const authMiddleware = (req, res, next) => {
  if (req.headers.authorization) {
    next();
  } else {
    res.status(401).json({ error: '未授权' });
  }
};

router.get('/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 3. 错误处理中间件（4个参数）
app.use((err, req, res, next) => {
  console.error('❌ 错误:', err.message);
  res.status(err.status || 500).json({
    error: err.message || '服务器错误'
  });
});

// 4. 内置中间件
app.use(express.json());        // 解析 JSON
app.use(express.urlencoded());  // 解析 URL编码
app.use(express.static('public')); // 静态文件

// 5. 第三方中间件
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

app.use(cors());               // CORS
app.use(helmet());             // 安全头
app.use(morgan('dev'));        // 日志
```

---

## 3. CORS 跨域资源共享

### 什么是跨域？
浏览器同源策略禁止请求不同域的资源。

```
http://localhost:3000  →  请求 →  http://localhost:5000  ❌ 跨域！
```

### 解决方案：cors 中间件

```bash
npm install cors
```

```javascript
const cors = require('cors');

// 允许所有来源（开发用）
app.use(cors());

// 配置更精细的 CORS
app.use(cors({
  origin: 'http://localhost:5173',  // 只允许这个来源
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // 允许的方法
  allowedHeaders: ['Content-Type', 'Authorization'],  // 允许的头
  credentials: true  // 允许携带 cookie
}));

// 多个来源
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://my-app.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源'));
    }
  }
}));
```

### 手动设置 CORS 头

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

---

## 4. JWT 用户认证

### JWT 是什么？
JSON Web Token，用于身份验证的令牌。

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.fluc4R
│─────Header─────│.─────Payload─────│.───Signature───│
```

### 安装
```bash
npm install jsonwebtoken bcryptjs
```

### 生成 Token

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'your-secret-key';
const TOKEN_EXPIRY = '7d';

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  // 密码加密
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 创建用户（存到数据库）
  const user = await User.create({
    username,
    password: hashedPassword
  });
  
  // 生成 Token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    SECRET_KEY,
    { expiresIn: TOKEN_EXPIRY }
  );
  
  res.json({ token });
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 查找用户
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  // 验证密码
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  // 生成 Token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    SECRET_KEY,
    { expiresIn: TOKEN_EXPIRY }
  );
  
  res.json({ token });
});
```

### 验证 Token 中间件

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // 从 Header 获取 Token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供 Token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // 验证 Token
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;  // 把用户信息挂到 req 上
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};

// 使用
app.get('/api/user/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});
```

### 在路由中使用

```javascript
// routes/protected.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/profile', authMiddleware, (req, res) => {
  res.json({
    message: '受保护的路由',
    user: req.user
  });
});

module.exports = router;
```

---

## 5. 错误处理进阶

### 自定义错误类

```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;  // 操作性错误 vs 编程错误
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 使用
app.post('/api/users', async (req, res, next) => {
  try {
    if (!req.body.email) {
      throw new AppError('邮箱是必填项', 400);
    }
    // ...
  } catch (err) {
    next(err);  // 传给错误处理中间件
  }
});
```

### 全局错误处理

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // 开发环境显示完整错误
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } else {
    // 生产环境
    if (err.isOperational) {
      // 操作性错误
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // 编程错误
      console.error('❌ 未知错误:', err);
      res.status(500).json({
        status: 'error',
        message: '服务器内部错误'
      });
    }
  }
};

module.exports = errorHandler;
```

### Async Handler（避免 try/catch 重复）

```javascript
// middleware/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 使用 - 不需要 try/catch 了！
app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json({ users });
}));
```

---

## 6. 项目结构最佳实践

### 标准 Express 项目结构

```
my-express-app/
├── src/
│   ├── config/
│   │   └── db.js           # 数据库配置
│   ├── controllers/
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js         # 认证中间件
│   │   ├── errorHandler.js # 错误处理
│   │   └── cors.js         # CORS 配置
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── users.js
│   ├── utils/
│   │   └── AppError.js
│   ├── app.js              # Express 应用入口
│   └── server.js           # 服务器启动
├── .env                    # 环境变量
├── .gitignore
├── package.json
└── README.md
```

### 入口文件分离

```javascript
// src/server.js
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));

// 错误处理
app.use(errorHandler);

module.exports = app;
```

---

## 7. 环境变量配置

### 安装 dotenv
```bash
npm install dotenv
```

### .env 文件
```bash
# .env
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/myapp
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
```

### 加载环境变量
```javascript
// src/config/config.js
require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN
};
```

---

## 📚 总结

Express 进阶三板斧：
1. **Router** - 路由模块化
2. **Middleware** - 中间件（认证、日志、错误处理）
3. **JWT** - 用户认证

**下一步：** TypeScript 进阶（泛型、装饰器、类型守卫）

---
🦞 *学无止境，继续加油！*
