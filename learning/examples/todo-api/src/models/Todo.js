// 待办事项模型
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '待办标题不能为空'],
    trim: true,
    maxlength: [200, '标题不能超过 200 字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, '描述不能超过 1000 字符'],
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: '默认'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  completed: {
    type: Boolean,
    default: false
  },
  dueDate: {
    type: Date,
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引
todoSchema.index({ user: 1, createdAt: -1 });
todoSchema.index({ user: 1, category: 1 });
todoSchema.index({ user: 1, priority: 1 });
todoSchema.index({ user: 1, completed: 1 });

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;
