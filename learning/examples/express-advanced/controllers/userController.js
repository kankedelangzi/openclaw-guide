// 用户控制器
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');

// 获取所有用户
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  
  res.json({
    success: true,
    data: { users }
  });
});

// 获取单个用户
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  res.json({
    success: true,
    data: { user }
  });
});

// 更新用户
exports.updateUser = asyncHandler(async (req, res) => {
  const { username, email } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { username, email },
    { new: true, runValidators: true }
  );
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  res.json({
    success: true,
    data: { user }
  });
});

// 删除用户
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  res.json({
    success: true,
    message: '用户已删除'
  });
});
