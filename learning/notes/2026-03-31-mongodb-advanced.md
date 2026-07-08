# MongoDB 进阶学习笔记

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. 索引优化
2. 聚合管道（Aggregation Pipeline）
3. 事务（Transactions）
4. 性能优化
5. 安全配置

---

## 1. 索引（Indexes）

### 为什么需要索引？
- 大幅提升查询速度
- 未经索引的查询需要全表扫描（collscan）
- 索引使用 B-Tree 数据结构

### 创建索引
```javascript
// 单字段索引
db.users.createIndex({ email: 1 }, { unique: true })

// 复合索引（字段顺序很重要！）
db.users.createIndex({ age: 1, name: 1 })

// 多键索引（数组字段）
db.articles.createIndex({ tags: 1 })

// 文本索引（全文搜索）
db.articles.createIndex({ title: "text", content: "text" })

// 地理位置索引
db.places.createIndex({ location: "2dsphere" })
```

### 索引类型
| 类型 | 用途 |
|-----|------|
| 单字段 | 简单查询 |
| 复合 | 多条件查询 |
| 多键 | 数组字段 |
| 文本 | 全文搜索 |
| 2dsphere | 地理坐标 |
| 哈希 | 分片集群 |

### 查看索引
```javascript
db.collection.getIndexes()
db.collection.getIndexSpecs()
```

### 删除索引
```javascript
db.collection.dropIndex("index_name")
db.collection.dropIndexes()  // 删除所有（除了 _id）
```

### 索引策略
```javascript
// 1. 等值查询字段放前面
// 查询：{ status: "active", age: 25 }
db.users.createIndex({ status: 1, age: 1 })

// 2. 排序字段放最后
// 查询：{ status: "active" } 排序：{ createdAt: -1 }
db.users.createIndex({ status: 1, createdAt: -1 })

// 3. 覆盖索引（查询只需要索引字段）
db.users.createIndex({ name: 1, age: 1 })
// 查询：db.users.find({ name: "大鱼" }, { name: 1, age: 1, _id: 0 })
```

### 慢查询分析
```javascript
// 开启慢查询日志（> 100ms）
db.setProfilingLevel(1, { slowms: 100 })

// 查看慢查询
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 })

// 使用 explain
db.users.find({ email: "test@example.com" }).explain("executionStats")
```

---

## 2. 聚合管道（Aggregation Pipeline）

### 什么是聚合？
处理数据记录，返回计算结果。

### 基本语法
```javascript
db.collection.aggregate([
  { $match: { field: value } },    // 筛选
  { $group: { _id: "$field", total: { $sum: 1 } } },  // 分组
  { $sort: { total: -1 } },       // 排序
  { $limit: 10 },                  // 限制
  { $project: { field: 1 } }      // 投影
])
```

### 常用阶段

#### $match - 筛选
```javascript
// 筛选已完成订单
db.orders.aggregate([
  { $match: { status: "completed" } }
])
```

#### $group - 分组
```javascript
// 按用户统计订单数量
db.orders.aggregate([
  { $group: {
      _id: "$userId",
      totalOrders: { $sum: 1 },
      totalAmount: { $sum: "$amount" },
      avgAmount: { $avg: "$amount" },
      maxAmount: { $max: "$amount" },
      minAmount: { $min: "$amount" }
  }}
])
```

#### $project - 投影
```javascript
// 选择字段、重命名
db.users.aggregate([
  { $project: {
      _id: 0,
      name: 1,
      email: 1,
      isAdult: { $gte: ["$age", 18] }
  }}
])
```

#### $sort - 排序
```javascript
{ $sort: { totalAmount: -1, name: 1 } }
```

#### $limit / $skip - 分页
```javascript
{ $skip: 0 },
{ $limit: 10 }
```

#### $lookup - 表关联
```javascript
// 左连接 orders 和 users
db.orders.aggregate([
  { $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
  }},
  { $unwind: "$user" },
  { $project: {
      orderId: "$_id",
      amount: 1,
      "user.name": 1,
      "user.email": 1
  }}
])
```

#### $unwind - 展开数组
```javascript
// 展开用户的爱好数组
db.users.aggregate([
  { $unwind: "$hobbies" }
])
```

#### $bucket - 分桶
```javascript
// 按年龄段分组
db.users.aggregate([
  { $bucket: {
      groupBy: "$age",
      boundaries: [0, 18, 30, 50, 100],
      default: "其他",
      output: { count: { $sum: 1 } }
  }}
])
```

### 实战：销售报表
```javascript
// 2026年每月销售统计
db.orders.aggregate([
  // 筛选2026年
  { $match: {
      createdAt: {
        $gte: new Date("2026-01-01"),
        $lt: new Date("2027-01-01")
      }
  }},
  // 按月分组
  { $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      totalSales: { $sum: "$amount" },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: "$amount" }
  }},
  // 排序
  { $sort: { "_id.year": 1, "_id.month": 1 } },
  // 格式化输出
  { $project: {
      _id: 0,
      period: { $concat: [
        { $toString: "$_id.year" },
        "-",
        { $toString: "$_id.month" }
      ]},
      totalSales: 1,
      orderCount: 1,
      avgOrderValue: { $round: ["$avgOrderValue", 2] }
  }}
])
```

---

## 3. 事务（Transactions）

### 为什么需要事务？
保证多个操作的原子性（要么全部成功，要么全部失败）。

### MongoDB 事务
```javascript
// 开启会话
const session = db.getMongo().startSession();

session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
});

try {
  const ordersCollection = session.getDatabase("mydb").orders;
  const usersCollection = session.getDatabase("mydb").users;
  
  // 创建订单
  ordersCollection.insertOne({
    userId: ObjectId("..."),
    items: [...],
    total: 100
  }, { session });
  
  // 更新用户余额
  usersCollection.updateOne(
    { _id: ObjectId("...") },
    { $inc: { balance: -100 } },
    { session }
  );
  
  // 提交
  session.commitTransaction();
  
} catch (err) {
  // 回滚
  session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

### Mongoose 事务
```javascript
const mongoose = require('mongoose');

async function createOrderWithTransaction(orderData, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const Order = mongoose.model('Order');
    const User = mongoose.model('User');
    
    const order = new Order(orderData);
    await order.save({ session });
    
    await User.updateOne(
      { _id: userId },
      { $inc: { balance: -orderData.total } },
      { session }
    );
    
    await session.commitTransaction();
    
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
```

---

## 4. 安全配置

### 用户认证
```javascript
// 创建管理员用户
db.createUser({
  user: "admin",
  pwd: "strong_password",
  roles: [
    { role: "root", db: "admin" }
  ]
});

// 创建应用用户
db.createUser({
  user: "app_user",
  pwd: "app_password",
  roles: [
    { role: "readWrite", db: "mydb" }
  ]
});
```

### 启用认证（重启生效）
```bash
# mongod.conf
security:
  authorization: enabled
```

### SSL/TLS 连接
```bash
# 生成自签名证书
openssl req -newkey rsa:4096 -keyout key.pem -out cert.pem -x509 -days 365 -nodes

# 启动时启用 SSL
mongod --sslMode requireSSL \
       --sslPEMKeyFile /path/to/key.pem \
       --sslCAFile /path/to/cert.pem
```

### 网络配置
```yaml
# 绑定 IP（仅本地）
net:
  bindIp: 127.0.0.1

# 防火墙规则
# 只允许应用服务器访问
```

---

## 5. 性能优化技巧

### 连接池
```javascript
mongoose.connect(uri, {
  maxPoolSize: 10,      // 最大连接数
  minPoolSize: 2,      // 最小连接数
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

### 查询优化
```javascript
// 避免 SELECT *
db.users.find({ _id: id }, { password: 0 })  // 排除敏感字段

// 使用 hint 强制使用索引
db.users.find({ age: { $gte: 18 } }).hint({ age: 1 })

// 分批处理大数据
const batchSize = 1000;
let processed = 0;

while (true) {
  const batch = await Collection
    .find({ processed: false })
    .limit(batchSize)
    .toArray();
  
  if (batch.length === 0) break;
  
  // 处理...
  processed += batch.length;
}
```

### 缓存热点数据
```javascript
// 使用 Redis 缓存频繁访问的数据
async function getUserWithCache(userId) {
  const cacheKey = `user:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const user = await User.findById(userId);
  await redis.setex(cacheKey, 3600, JSON.stringify(user));  // 1小时过期
  
  return user;
}
```

---

## 📚 总结

MongoDB 进阶核心：
1. **索引** - 查询优化的关键
2. **聚合** - 复杂数据处理
3. **事务** - 数据一致性保证
4. **安全** - 认证、授权、网络
5. **性能** - 连接池、查询优化、缓存

---
🦞 *学无止境，继续加油！*
