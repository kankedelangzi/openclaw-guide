# MongoDB 基础学习笔记

> 📅 学习日期：2026-03-31
> 🦞 子龙虾出品

## 📌 什么是 MongoDB？

MongoDB 是一个基于文档（Document）的 **NoSQL** 数据库，数据以 BSON 格式存储，类似于 JSON。

### vs 传统 SQL
| SQL 概念 | MongoDB 概念 |
|---------|-------------|
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |
| Primary Key | `_id` (自动生成) |

---

## 1. 安装 MongoDB

### Docker 方式（推荐）
```bash
docker pull mongo:latest
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:latest
```

### 本地安装
```bash
# macOS
brew install mongodb-community

# Ubuntu
sudo apt update
sudo apt install -y mongodb
```

---

## 2. 连接 MongoDB

### 使用 mongosh（命令行）
```bash
mongosh "mongodb://admin:password123@localhost:27017"
```

### 使用 mongoose（Node.js）
```bash
npm install mongoose
```

```javascript
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://admin:password123@localhost:27017/mydb')
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch(err => console.error('❌ 连接失败:', err));
```

---

## 3. CRUD 操作

### 定义 Schema（数据模型）

```javascript
const mongoose = require('mongoose');

// 定义 Schema
const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  email: String,
  hobbies: [String],
  createdAt: { type: Date, default: Date.now }
});

// 创建 Model
const User = mongoose.model('User', userSchema);
```

### Create（创建）

```javascript
// 单条插入
const user = new User({
  name: '大鱼',
  age: 25,
  email: 'dayu@example.com',
  hobbies: ['编程', '钓鱼']
});

await user.save();

// 批量插入
await User.insertMany([
  { name: '张三', age: 20, hobbies: ['游戏'] },
  { name: '李四', age: 22, hobbies: ['运动'] }
]);
```

### Read（读取）

```javascript
// 查询所有
const allUsers = await User.find();

// 条件查询
const youngUsers = await User.find({ age: { $lt: 25 } });

// 查询单个
const user = await User.findOne({ name: '大鱼' });

// 字段选择
const namesOnly = await User.find({}, 'name age');

// 排序 & 分页
const sorted = await User.find()
  .sort({ age: -1 })  // -1 降序，1 升序
  .skip(0)
  .limit(10);
```

### Update（更新）

```javascript
// 更新单个
await User.updateOne(
  { name: '大鱼' },
  { $set: { age: 26 } }
);

// 批量更新
await User.updateMany(
  { age: { $lt: 18 } },
  { $set: { status: '未成年' } }
);

// findOneAndUpdate 返回更新后的文档
const updated = await User.findOneAndUpdate(
  { name: '大鱼' },
  { $inc: { age: 1 } },  // $inc 增加
  { new: true }
);
```

### Delete（删除）

```javascript
// 删除单个
await User.deleteOne({ name: '大鱼' });

// 批量删除
await User.deleteMany({ age: { $lt: 18 } });

// findOneAndDelete 返回被删除的文档
const deleted = await User.findOneAndDelete({ name: '张三' });
```

---

## 4. 常用查询操作符

| 操作符 | 说明 | 示例 |
|-------|------|------|
| `$eq` | 等于 | `{ age: { $eq: 20 } }` |
| `$ne` | 不等于 | `{ age: { $ne: 20 } }` |
| `$gt` | 大于 | `{ age: { $gt: 18 } }` |
| `$gte` | 大于等于 | `{ age: { $gte: 18 } }` |
| `$lt` | 小于 | `{ age: { $lt: 30 } }` |
| `$lte` | 小于等于 | `{ age: { $lte: 30 } }` |
| `$in` | 在数组中 | `{ name: { $in: ['大鱼', '张三'] } }` |
| `$nin` | 不在数组中 | `{ name: { $nin: ['大鱼'] } }` |
| `$and` | 逻辑与 | `{ $and: [{ age: { $gt: 18 } }, { age: { $lt: 30 } }] }` |
| `$or` | 逻辑或 | `{ $or: [{ age: { $lt: 18 } }, { age: { $gt: 60 } }] }` |

---

## 5. 嵌套文档 & 数组

```javascript
const orderSchema = new mongoose.Schema({
  userId: String,
  items: [{
    product: String,
    quantity: Number,
    price: Number
  }],
  address: {
    city: String,
    district: String,
    street: String
  },
  createdAt: { type: Date, default: Date.now }
});

// 查询嵌套字段
const orders = await Order.find({ 'address.city': '上海' });

// 数组查询
const orders = await Order.find({
  'items.product': '手机'
});
```

---

## 6. 关系处理

### 手动引用（推荐小规模）
```javascript
const authorSchema = new mongoose.Schema({
  name: String
});

const bookSchema = new mongoose.Schema({
  title: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' }
});

// 填充查询
const books = await Book.find().populate('author');
```

---

## 7. 实战示例：用户管理系统

```javascript
// app.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// 连接 MongoDB
mongoose.connect('mongodb://admin:password123@localhost:27017/userdb')
  .then(() => console.log('✅ MongoDB 连接成功'));

// 定义 User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  age: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// API 路由
// GET /users - 获取所有用户
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /users - 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /users/:id - 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /users/:id - 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '用户已删除' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log('🚀 Server running on port 3000'));
```

---

## 8. Mongoose 钩子（Middleware）

```javascript
userSchema.pre('save', function(next) {
  console.log(`📝 保存用户: ${this.username}`);
  next();
});

userSchema.post('save', function(doc) {
  console.log(`✅ 用户已保存: ${doc.username}`);
});
```

---

## 📚 总结

MongoDB 的核心优势：
- ✅ 文档型存储，灵活易扩展
- ✅ 高性能，适合大数据
- ✅ 强大的查询语言
- ✅ 支持索引、分片集群

**下一步：** 学习 Express 进阶（路由模块化、错误处理、CORS、JWT）

---
🦞 *学无止境，继续加油！*
