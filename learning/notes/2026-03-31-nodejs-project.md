# Node.js 实战项目：待办事项 API

> 📅 学习日期：2026-03-31
> 🦞 子龙虾出品

## 📌 项目概述

一个完整的待办事项（Todo）API，包含：
- 用户认证（JWT）
- 待办事项 CRUD
- MongoDB 数据库
- 分类功能
- RESTful API 设计

---

## 1. API 设计

### 基础信息
- 基础路径：`/api`
- 认证方式：JWT Bearer Token
- 数据格式：JSON

### 认证接口
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 获取当前用户 |

### 待办事项接口
| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /api/todos | 获取所有待办（可筛选） |
| GET | /api/todos/:id | 获取单个待办 |
| POST | /api/todos | 创建待办 |
| PUT | /api/todos/:id | 更新待办 |
| DELETE | /api/todos/:id | 删除待办 |
| PATCH | /api/todos/:id/toggle | 切换完成状态 |

### 请求/响应示例

**创建待办**
```bash
POST /api/todos
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "学习 Node.js",
  "description": "完成 Express 进阶课程",
  "category": "学习",
  "priority": "high",
  "dueDate": "2026-04-01"
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "学习 Node.js",
    "description": "完成 Express 进阶课程",
    "category": "学习",
    "priority": "high",
    "completed": false,
    "dueDate": "2026-04-01T00:00:00.000Z",
    "user": "65f1a2b3c4d5e6f7a8b9c0d2",
    "createdAt": "2026-03-31T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:00:00.000Z"
  }
}
```

---

## 2. 数据模型

### User
```javascript
{
  username: String,      // 必填，唯一，3-20字符
  email: String,         // 必填，唯一，邮箱格式
  password: String,      // 必填，加密存储
  avatar: String,        // 头像 URL
  createdAt: Date
}
```

### Todo
```javascript
{
  title: String,         // 必填，待办标题
  description: String,  // 可选，详细描述
  category: String,      // 可选，分类（默认"默认"）
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  completed: {
    type: Boolean,
    default: false
  },
  dueDate: Date,        // 可选，截止日期
  user: ObjectId,       // 关联用户
  createdAt: Date,
  updatedAt: Date
}
```

---

## 3. 功能实现

### 核心功能

1. **待办 CRUD**
   - 创建待办（带验证）
   - 查询待办（支持筛选、排序、分页）
   - 更新待办（部分更新）
   - 删除待办

2. **筛选功能**
   - 按分类筛选
   - 按优先级筛选
   - 按完成状态筛选
   - 按截止日期范围筛选

3. **排序功能**
   - 按创建时间
   - 按截止日期
   - 按优先级

4. **分页功能**
   - page + limit
   - 默认 page=1, limit=10

---

## 4. 项目结构

```
todo-api/
├── src/
│   ├── config/
│   │   ├── index.js        # 环境配置
│   │   └── db.js           # MongoDB 连接
│   ├── controllers/
│   │   ├── authController.js
│   │   └── todoController.js
│   ├── middleware/
│   │   ├── auth.js         # JWT 认证
│   │   ├── asyncHandler.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   └── Todo.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── todos.js
│   ├── utils/
│   │   └── AppError.js
│   ├── app.js
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## 5. 关键代码

### 路由模块化

```javascript
// routes/todos.js
router.get('/', auth, todoController.getTodos);
router.get('/:id', auth, todoController.getTodo);
router.post('/', auth, todoController.createTodo);
router.put('/:id', auth, todoController.updateTodo);
router.delete('/:id', auth, todoController.deleteTodo);
router.patch('/:id/toggle', auth, todoController.toggleTodo);
```

### 筛选查询

```javascript
// GET /api/todos?category=学习&priority=high&completed=false&sort=-createdAt&page=1&limit=10
exports.getTodos = asyncHandler(async (req, res) => {
  const { category, priority, completed, sort = '-createdAt', page = 1, limit = 10 } = req.query;
  
  // 构建查询条件
  const query = { user: req.user.userId };
  
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (completed !== undefined) query.completed = completed === 'true';
  
  // 查询
  const skip = (page - 1) * limit;
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
```

### 切换完成状态

```javascript
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
```

---

## 📚 总结

通过这个项目，你将学会：
1. 如何设计 RESTful API
2. 如何组织 Express 项目结构
3. 如何实现认证和授权
4. 如何处理 CRUD 和筛选
5. 如何使用 MongoDB 进行数据建模

**下一步：** 部署基础（PM2、Nginx、Docker）

---
🦞 *学无止境，继续加油！*
