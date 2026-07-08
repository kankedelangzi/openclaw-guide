# Node.js 性能优化与监控

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. 性能分析工具
2. 内存管理与优化
3. 异步优化
4. 错误监控与日志
5. 压力测试

---

## 1. 性能分析工具

### 内置 Performance API
```javascript
const { PerformanceObserver, performance } = require('perf_hooks');

// 标记开始
performance.mark('operation-start');

// 执行操作
async function heavyOperation() {
  // ...
}

// 标记结束
performance.mark('operation-end');

// 测量
performance.measure('Heavy Operation', 'operation-start', 'operation-end');

// 观察者
const observer = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
  performance.clearMarks();
});

observer.observe({ entryTypes: ['measure'] });
```

### Clinic.js（推荐）
```bash
# 安装
npm install -g clinic

# 性能分析
clinic doctor -- node server.js

# CPU 火焰图
clinic flame -- node server.js

# 事件循环延迟
clinic bubbleprof -- node server.js
```

### 0x（火焰图）
```bash
npm install -g 0x
0x server.js
# 访问 http://localhost:3000 查看火焰图
```

---

## 2. 内存管理与优化

### 内存泄漏常见原因

```javascript
// 1. 全局变量泄漏
global.data = [];  // ❌ 不要这样做
global.data.push(userData);

// 2. 闭包泄漏
function createLeak() {
  const largeData = new Array(1000000);
  
  return function() {  // 闭包持有 largeData
    console.log(largeData.length);
  };
}

// 3. 事件监听器未清理
server.on('connection', (conn) => {
  conn.on('data', handleData);
  // 如果 conn 永远不关闭，监听器会累积
});

// 4. 缓存无限增长
const cache = new Map();

function getData(key) {
  if (cache.has(key)) return cache.get(key);
  
  const data = loadFromDB(key);
  cache.set(key, data);  // 永远不清理
  return data;
}
```

### 正确清理缓存
```javascript
// LRU 缓存
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    // 移到末尾（最新使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

// TTL 缓存
class TTLCache {
  constructor(ttl = 60000) {
    this.ttl = ttl;
    this.cache = new Map();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }
  
  set(key, value) {
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}
```

### 内存监控
```javascript
// 定期检查内存
setInterval(() => {
  const used = process.memoryUsage();
  console.log({
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`
  });
}, 30000);

// V8 堆内存限制
// node --max-old-space-size=4096 server.js  // 4GB
```

---

## 3. 异步优化

### 并行 vs 串行
```javascript
// ❌ 串行（慢）
async function serialFetch() {
  const a = await fetchA();
  const b = await fetchB();
  const c = await fetchC();
  return { a, b, c };
}

// ✅ 并行（快）
async function parallelFetch() {
  const [a, b, c] = await Promise.all([
    fetchA(),
    fetchB(),
    fetchC()
  ]);
  return { a, b, c };
}

// Promise.allSettled（不阻塞）
async function safeFetch() {
  const results = await Promise.allSettled([
    fetchA(),
    fetchB(),
    fetchC()
  ]);
  
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`请求${i}失败:`, r.reason);
    return null;
  });
}
```

### 控制并发
```javascript
// 批量控制
async function parallelLimit(tasks, limit = 5) {
  const results = [];
  const executing = new Set();
  
  for (const task of tasks) {
    const promise = task().then(result => {
      executing.delete(promise);
      return result;
    });
    
    results.push(promise);
    executing.add(promise);
    
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

// 使用 p-limit 库
const pLimit = require('p-limit');
const limit = pLimit(5);

const results = await Promise.all(
  urls.map(url => limit(() => fetchUrl(url)))
);
```

### 流处理大文件
```javascript
// ❌ 内存压力
const data = fs.readFileSync('large-file.csv');
const lines = data.toString().split('\n');

// ✅ 流式处理
const fs = require('fs');
const readline = require('readline');

async function processLargeFile(filePath) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream });
  
  for await (const line of rl) {
    // 每次只处理一行
    await processLine(line);
  }
}
```

---

## 4. 错误监控与日志

### 错误监控
```javascript
// 全局错误处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 发送到监控服务
  sendToMonitoring(err);
  process.exit(1);  // 必须退出
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// Express 错误处理
app.use((err, req, res, next) => {
  // 记录错误
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date()
  });
  
  // 发送监控
  if (!err.isOperational) {
    sendToMonitoring(err);
  }
  
  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  });
});
```

### 结构化日志
```javascript
class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }
  
  log(level, message, meta = {}) {
    if (this.levels[level] <= this.levels[this.level]) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
      }));
    }
  }
  
  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  info(message, meta) { this.log('info', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
}

const logger = new Logger(process.env.LOG_LEVEL || 'info');

// 使用
logger.info('用户登录', { userId: '123', ip: '192.168.1.1' });
logger.error('数据库连接失败', { error: err.message, retry: 3 });
```

### 日志输出到文件
```javascript
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

---

## 5. 压力测试

### Apache Bench
```bash
# 简单测试
ab -n 1000 -c 100 http://localhost:3000/api/users

# -n 请求数
# -c 并发数
```

### Artillery
```bash
npm install -g artillery

# 配置文件 test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"

scenarios:
  - name: "获取用户列表"
    request:
      - get:
          url: "/api/users"
```

### 启动测试
```bash
artillery run test.yml
```

---

## 📚 总结

Node.js 性能优化核心：
1. **性能分析** - perf_hooks、Clinic.js、火焰图
2. **内存管理** - 避免泄漏、LRU/TTL 缓存
3. **异步优化** - Promise.all、控制并发、流处理
4. **错误监控** - 全局处理、结构化日志
5. **压力测试** - ab、Artillery

---
🦞 *学无止境，继续加油！*
