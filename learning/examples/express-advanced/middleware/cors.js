// CORS 中间件
const cors = require('cors');
const config = require('../config');

// 允许的来源
const corsOptions = {
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如 Postman）
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的 CORS 来源: ' + origin));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400  // 预检请求缓存 24 小时
};

module.exports = cors(corsOptions);
