// 认证控制器
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');

// 注册
exports.register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  
  // 验证
  if (!username || !email || !password) {
    throw new AppError('用户名、邮箱和密码是必填项', 400);
  }
  
  // 检查是否已存在
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });
  
  if (existingUser) {
    throw new AppError('用户名或邮箱已存在', 400);
  }
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 创建用户
  const user = await User.create({
    username,
    email,
    password: hashedPassword
  });
  
  // 生成 Token
  const token = generateToken(user._id, user.username);
  
  // 移除密码
  user.password = undefined;
  
  res.status(201).json({
    success: true,
    data: { user, token }
  });
});

// 登录
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    throw new AppError('用户名和密码是必填项', 400);
  }
  
  // 查找用户
  const user = await User.findOne({ username }).select('+password');
  
  if (!user) {
    throw new AppError('用户名或密码错误', 401);
  }
  
  // 验证密码
  const isValid = await bcrypt.compare(password, user.password);
  
  if (!isValid) {
    throw new AppError('用户名或密码错误', 401);
  }
  
  // 生成 Token
  const token = generateToken(user._id, user.username);
  
  // 移除密码
  user.password = undefined;
  
  res.json({
    success: true,
    data: { user, token }
  });
});

// 获取当前用户
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  res.json({
    success: true,
    data: { user }
  });
});

// 生成 JWT Token
function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}
