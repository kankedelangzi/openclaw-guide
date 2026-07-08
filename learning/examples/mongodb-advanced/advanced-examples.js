// MongoDB 进阶示例

const mongoose = require('mongoose');

// 连接配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password123@localhost:27017/mydb';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2
    });
    console.log('✅ MongoDB 连接成功');
  } catch (err) {
    console.error('❌ 连接失败:', err.message);
    process.exit(1);
  }
}

// ===== 1. 索引示例 =====
async function indexExamples() {
  console.log('\n=== 索引示例 ===');
  
  const userSchema = new mongoose.Schema({
    email: { type: String },
    age: Number,
    name: String,
    createdAt: Date
  });
  
  // 创建复合索引
  userSchema.index({ age: 1, name: 1 });
  // 创建唯一索引
  userSchema.index({ email: 1 }, { unique: true });
  // 文本索引
  userSchema.index({ name: 'text' });
  
  const User = mongoose.model('User', userSchema);
  
  // 查看索引
  console.log('索引列表:', await User.getIndexes());
  
  // explain 查询计划
  const explain = await User.find({ age: 25 }).explain('executionStats');
  console.log('查询耗时:', explain.executionStats.executionStages);
  
  // 创建订单模型（演示多键索引）
  const orderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    items: [{ product: String, quantity: Number }],
    total: Number,
    createdAt: { type: Date, default: Date.now }
  });
  
  orderSchema.index({ 'items.product': 1 });  // 多键索引
  orderSchema.index({ userId: 1, createdAt: -1 });  // 复合索引
  
  const Order = mongoose.model('Order', orderSchema);
  
  console.log('\n订单索引:', await Order.getIndexes());
}

// ===== 2. 聚合管道示例 =====
async function aggregationExamples() {
  console.log('\n=== 聚合管道示例 ===');
  
  const orderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    amount: Number,
    status: String,
    category: String,
    createdAt: { type: Date, default: Date.now }
  });
  
  const Order = mongoose.model('Order2', orderSchema);
  
  // 插入测试数据
  await Order.deleteMany({});
  await Order.insertMany([
    { userId: new mongoose.Types.ObjectId(), amount: 100, status: 'completed', category: '电子产品' },
    { userId: new mongoose.Types.ObjectId(), amount: 200, status: 'completed', category: '电子产品' },
    { userId: new mongoose.Types.ObjectId(), amount: 50, status: 'pending', category: '图书' },
    { userId: new mongoose.Types.ObjectId(), amount: 300, status: 'completed', category: '服装' },
    { userId: new mongoose.Types.ObjectId(), amount: 150, status: 'pending', category: '电子产品' }
  ]);
  
  // 按分类统计销售额
  const salesByCategory = await Order.aggregate([
    { $match: { status: 'completed' } },
    { $group: {
        _id: '$category',
        totalSales: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        count: { $sum: 1 }
    }},
    { $sort: { totalSales: -1 } }
  ]);
  
  console.log('按分类统计:', salesByCategory);
  
  // 按月统计
  const salesByMonth = await Order.aggregate([
    { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: '$amount' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  console.log('按月统计:', salesByMonth);
}

// ===== 3. 事务示例 =====
async function transactionExamples() {
  console.log('\n=== 事务示例 ===');
  
  // 定义模型
  const accountSchema = new mongoose.Schema({
    name: String,
    balance: { type: Number, default: 0 }
  });
  
  const Account = mongoose.model('Account', accountSchema);
  
  // 清理并创建测试账户
  await Account.deleteMany({});
  await Account.create([
    { name: '张三', balance: 1000 },
    { name: '李四', balance: 1000 }
  ]);
  
  // 转账函数
  async function transfer(fromName, toName, amount) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const fromAccount = await Account.findOne({ name: fromName }).session(session);
      const toAccount = await Account.findOne({ name: toName }).session(session);
      
      if (fromAccount.balance < amount) {
        throw new Error('余额不足');
      }
      
      fromAccount.balance -= amount;
      toAccount.balance += amount;
      
      await fromAccount.save({ session });
      await toAccount.save({ session });
      
      await session.commitTransaction();
      console.log(`✅ 转账成功: ${fromName} -> ${toName}: ${amount}`);
      
    } catch (err) {
      await session.abortTransaction();
      console.log(`❌ 转账失败: ${err.message}`);
    } finally {
      session.endSession();
    }
  }
  
  // 执行转账
  await transfer('张三', '李四', 300);
  
  // 查看结果
  const accounts = await Account.find().sort({ name: 1 });
  console.log('账户余额:', accounts.map(a => `${a.name}: ${a.balance}`));
}

// ===== 4. 性能优化示例 =====
async function performanceExamples() {
  console.log('\n=== 性能优化示例 ===');
  
  // 创建测试集合
  const logSchema = new mongoose.Schema({
    level: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  });
  
  logSchema.index({ level: 1, timestamp: -1 });
  logSchema.index({ timestamp: -1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });  // TTL 索引
  
  const Log = mongoose.model('Log', logSchema);
  
  // 插入大量数据
  console.log('插入测试数据...');
  const logs = Array.from({ length: 1000 }, (_, i) => ({
    level: ['info', 'warn', 'error'][i % 3],
    message: `Log message ${i}`
  }));
  await Log.insertMany(logs);
  console.log('✅ 插入完成');
  
  // 使用 explain 分析查询
  const explain = await Log.find({ level: 'error' }).explain();
  console.log('查询计划:', explain[0].queryPlanner.indexUsed);
  
  // 统计查询
  const count = await Log.countDocuments({ level: 'error' });
  console.log('Error 日志数量:', count);
}

// 运行所有示例
async function run() {
  await connectDB();
  
  await indexExamples();
  await aggregationExamples();
  await transactionExamples();
  await performanceExamples();
  
  console.log('\n✅ 所有示例执行完成');
  process.exit(0);
}

run().catch(console.error);
