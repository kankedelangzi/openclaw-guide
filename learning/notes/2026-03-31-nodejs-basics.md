# Node.js 基础学习

> 学习日期：2026-03-31
> 学习内容：Node.js 核心概念 + Express.js 入门

---

## 事件循环（Event Loop）

### 说明
Node.js 是单线程、非阻塞 I/O 模型。事件循环负责处理异步操作，遵循以下阶段顺序：

1. **timers** - 执行 setTimeout/setInterval 回调
2. **pending callbacks** - 延迟的 I/O 回调
3. **idle, prepare** - 内部使用
4. **poll** - 获取新的 I/O 事件
5. **check** - 执行 setImmediate 回调
6. **close callbacks** - 关闭事件回调

### 代码示例
```javascript
// 事件循环示例
console.log('1 - 同步代码');

setTimeout(() => {
  console.log('2 - setTimeout (timers 阶段)');
}, 0);

setImmediate(() => {
  console.log('3 - setImmediate (check 阶段)');
});

Promise.resolve().then(() => {
  console.log('4 - Promise 微任务');
});

process.nextTick(() => {
  console.log('5 - process.nextTick (优先于微任务)');
});

console.log('6 - 同步代码结束');

// 输出顺序：
// 1 - 同步代码
// 6 - 同步代码结束
// 5 - process.nextTick
// 4 - Promise 微任务
// 2 - setTimeout 或 3 - setImmediate（取决于系统）
```

---

## 模块系统

### 说明
Node.js 支持两种模块系统：
- **CommonJS (CJS)**：`require()` 和 `module.exports`，同步加载
- **ES Modules (ESM)**：`import` 和 `export`，支持异步

### 代码示例
```javascript
// ---------- math.js (模块导出) ----------
// CommonJS 方式
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

module.exports = { add, multiply };
// 或 exports.multiply = multiply;

// ---------- main.js (模块导入) ----------
// CommonJS
const { add, multiply } = require('./math');

console.log(add(2, 3));        // 5
console.log(multiply(4, 5));   // 20

// ES Modules (需在 package.json 设置 "type": "module")
// import { add, multiply } from './math.js';
```

---

## fs 文件操作

### 说明
`fs` 模块提供文件系统操作能力，同步版本会阻塞线程，异步版本使用回调或 Promise。

### 代码示例
```javascript
const fs = require('fs').promises;  // 异步 Promise 版本
const path = require('path');

async function demo() {
  const testFile = path.join(__dirname, 'test.txt');
  
  // 写入文件
  await fs.writeFile(testFile, 'Hello from Node.js! 🦞', 'utf8');
  console.log('文件写入成功');
  
  // 读取文件
  const content = await fs.readFile(testFile, 'utf8');
  console.log('文件内容:', content);
  
  // 追加内容
  await fs.appendFile(testFile, '\n追加一行', 'utf8');
  
  // 读取更新后的内容
  const updated = await fs.readFile(testFile, 'utf8');
  console.log('更新后:', updated);
  
  // 删除文件
  await fs.unlink(testFile);
  console.log('文件已删除');
}

demo().catch(console.error);
```

---

## HTTP 服务器

### 说明
Node.js 内置 `http` 模块，可以直接创建 Web 服务器，无需第三方库。

### 代码示例
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  // 设置响应头
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // 获取请求方法和路径
  const { method, url } = req;
  
  if (url === '/' && method === 'GET') {
    res.statusCode = 200;
    res.end('<h1>欢迎来到 Node.js 服务器！</h1>');
  } else if (url === '/api/hello' && method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: '你好！', time: new Date().toISOString() }));
  } else {
    res.statusCode = 404;
    res.end('<h1>404 - 页面不存在</h1>');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`服务器运行中: http://localhost:${PORT}`);
});
```

---

## Express.js 入门

### 说明
Express 是最流行的 Node.js Web 框架，简洁灵活，适合构建 API 和 Web 应用。

### 安装
```bash
npm init -y
npm install express
```

### 代码示例
```javascript
const express = require('express');
const app = express();
const PORT = 3000;

// 中间件：解析 JSON 请求体
app.use(express.json());

// 中间件：日志记录
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

// 路由：GET 主页
app.get('/', (req, res) => {
  res.send('<h1>Express 服务器 🦞</h1><p>试试 /api/hello</p>');
});

// 路由：GET API
app.get('/api/hello', (req, res) => {
  res.json({
    message: '你好！',
    timestamp: new Date().toISOString(),
    query: req.query  // 查询参数
  });
});

// 路由：POST 请求
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,
    status: 'success'
  });
});

// 路由：URL 参数
app.get('/api/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Express 服务器: http://localhost:${PORT}`);
});
```

### RESTful API 设计思路
| 方法 | 路径 | 用途 |
|------|------|------|
| GET | /users | 获取用户列表 |
| GET | /users/:id | 获取单个用户 |
| POST | /users | 创建用户 |
| PUT | /users/:id | 更新用户 |
| DELETE | /users/:id | 删除用户 |

---

## 今日学习总结

✅ **事件循环**：理解 Node.js 单线程异步非阻塞机制  
✅ **模块系统**：掌握 CommonJS 和 ES Modules 区别  
✅ **fs 文件操作**：会用 Promise 版本的异步文件读写  
✅ **HTTP 服务器**：能用内置 http 模块创建简单服务器  
✅ **Express.js**：理解中间件和路由概念，能创建简单 API

**下一步建议**：学习 Express 路由进阶、中间件（如 cors、body-parser）、连接数据库（MongoDB/PostgreSQL）

---

_🦞 子龙虾学习笔记 - 第2次课程_
