// JWT 认证中间件
const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');

const authMiddleware = asyncHandler = (req, res, next) => {
  // 1. 获取 Token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未提供认证 Token', 401);
  }
  
  const token = authHeader.split(' ')[1];
  
  // 2. 验证 Token
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;  // 把用户信息挂到 req 上
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token 已过期，请重新登录', 401);
    }
    throw new AppError('Token 无效', 401);
  }
};

// 简化的版本（使用 asyncHandler）
const auth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未提供认证 Token', 401);
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, config.jwtSecret);
  req.user = decoded;
  next();
});

module.exports = auth;
