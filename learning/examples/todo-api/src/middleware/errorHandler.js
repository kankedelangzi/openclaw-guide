// 错误处理中间件
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
    return;
  }
  
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    console.error('❌ 未知错误:', err);
    res.status(500).json({
      status: 'error',
      message: '服务器内部错误'
    });
  }
};

const notFoundHandler = (req, res, next) => {
  next(new AppError(`找不到路由: ${req.originalUrl}`, 404));
};

module.exports = { errorHandler, notFoundHandler };
