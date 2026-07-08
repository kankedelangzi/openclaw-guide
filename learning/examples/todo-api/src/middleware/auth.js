// JWT 认证中间件
const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');

const auth = asyncHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('未提供认证 Token', 401);
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token 已过期，请重新登录', 401);
    }
    throw new AppError('Token 无效', 401);
  }
};

module.exports = auth;
