// 用户 CRUD 操作示例

const User = require('./models/User');

async function userOperations() {
  console.log('=== 用户 CRUD 操作 ===\n');

  // ===== C: 创建 =====
  console.log('📝 创建用户...');
  
  // 创建单个用户
  const user1 = new User({
    username: 'dayu',
    email: 'dayu@example.com',
    age: 25,
    hobbies: ['编程', '钓鱼']
  });
  await user1.save();
  console.log('✅ 用户已创建:', user1.username);

  // 批量创建
  const users = await User.insertMany([
    { username: 'zhangsan', email: 'zhangsan@example.com', age: 20, hobbies: ['游戏'] },
    { username: 'lisi', email: 'lisi@example.com', age: 22, hobbies: ['运动'] },
    { username: 'wangwu', email: 'wangwu@example.com', age: 35, hobbies: ['读书', '音乐'] }
  ]);
  console.log(`✅ 批量创建了 ${users.length} 个用户`);

  // ===== R: 读取 =====
  console.log('\n📖 读取用户...');

  // 查询所有
  const allUsers = await User.find();
  console.log(`总用户数: ${allUsers.length}`);

  // 条件查询 - 成年人
  const adults = await User.find({ age: { $gte: 18 } });
  console.log(`成年人数量: ${adults.length}`);

  // 精确查询
  const dayu = await User.findOne({ username: 'dayu' });
  console.log(`大鱼的信息: ${dayu.email}, 年龄 ${dayu.age}`);

  // 字段选择
  const names = await User.find({}, 'username age');
  console.log('用户名和年龄:', names);

  // 排序分页
  const sorted = await User.find()
    .sort({ age: -1 })  // 按年龄降序
    .skip(0)
    .limit(2);
  console.log('年龄最大的2个用户:', sorted.map(u => u.username));

  // ===== U: 更新 =====
  console.log('\n✏️ 更新用户...');

  // 更新单个
  await User.updateOne(
    { username: 'dayu' },
    { $set: { age: 26 } }
  );
  console.log('✅ 大鱼年龄已更新为 26');

  // 使用 findOneAndUpdate
  const updated = await User.findOneAndUpdate(
    { username: 'zhangsan' },
    { $inc: { age: 1 } },  // 年龄 +1
    { new: true }
  );
  console.log(`✅ 张三年龄更新后: ${updated.age}`);

  // 批量更新
  const result = await User.updateMany(
    { age: { $lt: 18 } },
    { $set: { status: 'inactive' } }
  );
  console.log(`✅ 批量更新了 ${result.modifiedCount} 个未成年用户状态`);

  // ===== D: 删除 =====
  console.log('\n🗑️ 删除用户...');

  // 删除单个
  await User.deleteOne({ username: 'wangwu' });
  console.log('✅ 王五已删除');

  // 批量删除
  const deleteResult = await User.deleteMany({ status: 'banned' });
  console.log(`✅ 批量删除了 ${deleteResult.deletedCount} 个被封禁用户`);

  // ===== 清理 =====
  console.log('\n🧹 清理测试数据...');
  await User.deleteMany({});
  console.log('✅ 清理完成');
}

// 执行
userOperations()
  .then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
  });
