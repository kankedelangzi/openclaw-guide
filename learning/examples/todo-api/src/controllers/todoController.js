// 待办控制器
const Todo = require('../models/Todo');
const AppError = require('../utils/AppError');
const asyncHandler = require('../middleware/asyncHandler');

// 获取所有待办
exports.getTodos = asyncHandler(async (req, res) => {
  const { category, priority, completed, sort = '-createdAt', page = 1, limit = 10 } = req.query;
  
  // 构建查询条件
  const query = { user: req.user.userId };
  
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (completed !== undefined) query.completed = completed === 'true';
  
  // 查询
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const todos = await Todo.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Todo.countDocuments(query);
  
  res.json({
    success: true,
    data: todos,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// 获取单个待办
exports.getTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user.userId
  });
  
  if (!todo) {
    throw new AppError('待办不存在', 404);
  }
  
  res.json({
    success: true,
    data: todo
  });
});

// 创建待办
exports.createTodo = asyncHandler(async (req, res) => {
  const { title, description, category, priority, dueDate } = req.body;
  
  if (!title) {
    throw new AppError('待办标题不能为空', 400);
  }
  
  const todo = await Todo.create({
    title,
    description,
    category,
    priority,
    dueDate,
    user: req.user.userId
  });
  
  res.status(201).json({
    success: true,
    data: todo
  });
});

// 更新待办
exports.updateTodo = asyncHandler(async (req, res) => {
  const { title, description, category, priority, completed, dueDate } = req.body;
  
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user.userId
  });
  
  if (!todo) {
    throw new AppError('待办不存在', 404);
  }
  
  // 更新字段
  if (title !== undefined) todo.title = title;
  if (description !== undefined) todo.description = description;
  if (category !== undefined) todo.category = category;
  if (priority !== undefined) todo.priority = priority;
  if (completed !== undefined) todo.completed = completed;
  if (dueDate !== undefined) todo.dueDate = dueDate;
  
  await todo.save();
  
  res.json({
    success: true,
    data: todo
  });
});

// 删除待办
exports.deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndDelete({
    _id: req.params.id,
    user: req.user.userId
  });
  
  if (!todo) {
    throw new AppError('待办不存在', 404);
  }
  
  res.json({
    success: true,
    message: '待办已删除'
  });
});

// 切换完成状态
exports.toggleTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user.userId
  });
  
  if (!todo) {
    throw new AppError('待办不存在', 404);
  }
  
  todo.completed = !todo.completed;
  await todo.save();
  
  res.json({
    success: true,
    data: todo
  });
});

// 获取统计
exports.getStats = asyncHandler(async (req, res) => {
  const total = await Todo.countDocuments({ user: req.user.userId });
  const completed = await Todo.countDocuments({ user: req.user.userId, completed: true });
  const pending = total - completed;
  
  const byCategory = await Todo.aggregate([
    { $match: { user: req.user.userId } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  
  const byPriority = await Todo.aggregate([
    { $match: { user: req.user.userId } },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);
  
  res.json({
    success: true,
    data: {
      total,
      completed,
      pending,
      byCategory,
      byPriority
    }
  });
});
