# Express 设计模式与进阶技巧

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. 中间件模式与组合
2. 路由分组与嵌套
3. 设计模式（工厂、策略、装饰器）
4. API 版本管理
5. 请求验证与规范化

---

## 1. 中间件模式与组合

### 中间件执行流程
```
请求 → MW1 → MW2 → MW3 → Route Handler → MW3 → MW2 → MW1 → 响应
```

### 中间件组合器
```javascript
// compose - 串行组合
const compose = (...middlewares) => {
  return (ctx, next) => {
    let index = -1;
    
    const dispatch = (i) => {
      if (i <= index) throw new Error('next() 被调用多次');
      index = i;
      
      if (i === middlewares.length) return next();
      
      const mw = middlewares[i];
      try {
        return mw(ctx, () => dispatch(i + 1));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    
    return dispatch(0);
  };
};

// 使用
const composed = compose(mw1, mw2, mw3);
await composed(ctx, handler);
```

### 中间件缓存模式
```javascript
// 缓存中间件
const cache = new Map();

const cacheMiddleware = (duration = 60000) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < duration) {
      return res.json(cached.data);
    }
    
    // 拦截 res.json
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, { data, timestamp: Date.now() });
      return originalJson(data);
    };
    
    next();
  };
};
```

### 请求限流中间件
```javascript
// 简单限流
const requestCounts = new Map();

const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const window = requestCounts.get(key) || { count: 0, resetAt: now + windowMs };
    
    if (now > window.resetAt) {
      window.count = 0;
      window.resetAt = now + windowMs;
    }
    
    window.count++;
    requestCounts.set(key, window);
    
    if (window.count > maxRequests) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试'
      });
    }
    
    res.setHeader('X-RateLimit-Remaining', maxRequests - window.count);
    next();
  };
};
```

---

## 2. 路由分组与嵌套

### 路由分组
```javascript
// routes/api.js
const express = require('express');
const router = express.Router();

// 嵌套路由
const userRouter = express.Router();
const postRouter = express.Router();

// 用户路由
userRouter.get('/', (req, res) => res.json([]));
userRouter.get('/:id', (req, res) => res.json({}));
userRouter.post('/', (req, res) => res.json({}));

// 文章路由
postRouter.get('/', (req, res) => res.json([]));
postRouter.get('/:id', (req, res) => res.json({}));

// 注册嵌套路由
router.use('/users', userRouter);
router.use('/posts', postRouter);

module.exports = router;

// app.js
app.use('/api/v1', require('./routes/api'));
// GET /api/v1/users
// GET /api/v1/posts
```

### 资源路由模式
```javascript
// 标准的 REST 资源
const resourceRouter = (name, controller) => {
  const router = express.Router();
  
  // 列表
  router.get('/', controller.index);
  // 新建表单（如果需要）
  router.get('/new', controller.new);
  // 创建
  router.post('/', controller.create);
  // 详情
  router.get('/:id', controller.show);
  // 编辑表单
  router.get('/:id/edit', controller.edit);
  // 更新
  router.put('/:id', controller.update);
  router.patch('/:id', controller.update);
  // 删除
  router.delete('/:id', controller.destroy);
  
  return router;
};

// 使用
app.use('/users', resourceRouter('users', userController));
app.use('/posts', resourceRouter('posts', postController));
```

---

## 3. 设计模式

### 工厂模式
```javascript
// 控制器工厂
const createController = (dependencies) => {
  return {
    index: async (req, res, next) => {
      const { service } = dependencies;
      const data = await service.findAll();
      res.json(data);
    },
    
    show: async (req, res, next) => {
      const { service } = dependencies;
      const data = await service.findById(req.params.id);
      if (!data) return res.status(404).json({ error: 'Not found' });
      res.json(data);
    }
  };
};

// 使用
const userController = createController({
  service: userService
});
```

### 策略模式
```javascript
// 支付策略
class PaymentStrategy {
  async pay(amount) {
    throw new Error('Not implemented');
  }
}

class AlipayStrategy extends PaymentStrategy {
  async pay(amount) {
    // 支付宝支付逻辑
    console.log(`支付宝支付 ${amount}`);
  }
}

class WechatPayStrategy extends PaymentStrategy {
  async pay(amount) {
    // 微信支付逻辑
    console.log(`微信支付 ${amount}`);
  }
}

class PaymentContext {
  constructor(strategy) {
    this.strategy = strategy;
  }
  
  async pay(amount) {
    return this.strategy.pay(amount);
  }
}

// 使用
const payment = new PaymentContext(new AlipayStrategy());
await payment.pay(100);
```

### 装饰器模式
```javascript
// 日志装饰器
const withLogging = (fn) => {
  return async (...args) => {
    console.log(`调用 ${fn.name}，参数:`, args);
    const start = Date.now();
    try {
      const result = await fn(...args);
      console.log(`${fn.name} 执行成功，耗时: ${Date.now() - start}ms`);
      return result;
    } catch (err) {
      console.error(`${fn.name} 执行失败:`, err);
      throw err;
    }
  };
};

// 缓存装饰器
const withCache = (fn, cache, ttl = 60000) => {
  return async (...args) => {
    const key = `${fn.name}:${JSON.stringify(args)}`;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log(`缓存命中: ${key}`);
      return cached.data;
    }
    
    const result = await fn(...args);
    cache.set(key, { data: result, timestamp: Date.now() });
    return result;
  };
};

// 使用
const getUser = withCache(
  withLogging(async (id) => {
    return await User.findById(id);
  }),
  new Map()
);
```

### 中间件装饰器
```javascript
// 防抖装饰器（限制请求频率）
const debounce = (ms) => {
  const lastCall = new Map();
  
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const last = lastCall.get(key) || 0;
    
    if (now - last < ms) {
      return res.status(429).json({
        error: '请求过于频繁'
      });
    }
    
    lastCall.set(key, now);
    next();
  };
};

// 使用
router.post('/api/data', debounce(1000), controller.handleData);
```

---

## 4. API 版本管理

### 路径版本
```javascript
// routes/v1/index.js
const v1Router = express.Router();
v1Router.use('/users', require('./users'));
v1Router.use('/posts', require('./posts'));

// routes/v2/index.js
const v2Router = express.Router();
v2Router.use('/users', require('./users'));  // v2 可能有不同的实现
v2Router.use('/posts', require('./posts'));

// app.js
app.use('/api/v1', require('./routes/v1'));
app.use('/api/v2', require('./routes/v2'));
```

### Header 版本
```javascript
// Accept: application/vnd.api.v2+json
app.use((req, res, next) => {
  const accept = req.headers.accept || '';
  const match = accept.match(/application\/vnd\.api\.v(\d+)\+json/);
  
  req.apiVersion = match ? parseInt(match[1]) : 1;
  next();
});

// 控制器中使用
exports.getUser = async (req, res) => {
  if (req.apiVersion >= 2) {
    // v2 响应格式
    res.json({ data: { id, name, email, avatar } });
  } else {
    // v1 响应格式
    res.json({ id, name, email });
  }
};
```

---

## 5. 请求验证与规范化

### 自定义验证器
```javascript
// utils/validators.js
const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

const userValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名3-20字符')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字、下划线'),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少6位')
    .matches(/\d/)
    .withMessage('密码必须包含数字'),
  
  param('id').isMongoId().withMessage('无效的ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  
  validate
];

// 使用
router.post('/users', userValidation, controller.create);
router.get('/users/:id', userValidation, controller.show);
```

### 请求规范化中间件
```javascript
// normalizeQuery - 规范化查询参数
const normalizeQuery = (req, res, next) => {
  const { page = 1, limit = 10, sort, fields, ...filters } = req.query;
  
  // 规范化分页
  req.pagination = {
    page: Math.max(1, parseInt(page)),
    limit: Math.min(100, Math.max(1, parseInt(limit))),
    skip: (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)))
  };
  
  // 规范化排序
  if (sort) {
    req.sort = sort.split(',').reduce((acc, s) => {
      const [key, order] = s.startsWith('-') ? [s.slice(1), -1] : [s, 1];
      acc[key] = order;
      return acc;
    }, {});
  }
  
  // 字段选择
  if (fields) {
    req.fields = fields.split(',').reduce((acc, f) => {
      acc[f.trim()] = 1;
      return acc;
    }, { _id: 1 });  // 默认包含 _id
  }
  
  // 清理过滤器（移除空值）
  req.filters = Object.entries(filters)
    .filter(([_, v]) => v !== '' && v !== undefined)
    .reduce((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
  
  next();
};
```

---

## 📚 总结

Express 深化核心：
1. **中间件模式** - 组合、缓存、限流
2. **路由分组** - 嵌套、资源路由
3. **设计模式** - 工厂、策略、装饰器
4. **API 版本** - 路径/Header 版本管理
5. **验证规范化** - 请求验证、数据清洗

---
🦞 *学无止境，继续加油！*
