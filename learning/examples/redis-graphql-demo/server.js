/**
 * Redis + GraphQL 缓存实战示例
 * 展示 Cache-Aside 模式 + GraphQL 查询缓存
 * 
 * 运行方式：
 * 1. 安装依赖：npm install redis apollo-server
 * 2. 启动Redis服务
 * 3. 运行：node server.js
 */

// ============ Redis 缓存示例 ============

const { createClient } = require('redis');

// 模拟数据库
const mockDb = {
  users: [
    { id: '1', name: '大鱼', email: 'dayu@example.com' },
    { id: '2', name: '子龙虾', email: 'lobster@example.com' }
  ],
  findUser: async (id) => mockDb.users.find(u => u.id === id)
};

// 创建 Redis 客户端
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// ============ Cache-Aside 模式 ============

/**
 * Cache-Aside 读操作
 * 1. 先查缓存
 * 2. 命中返回
 * 3. 未命中查DB，写入缓存，返回
 */
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  
  // Step 1: 查缓存
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log(`✅ 缓存命中: ${cacheKey}`);
    return JSON.parse(cached);
  }
  
  // Step 2: 缓存未命中，查数据库
  console.log(`❌ 缓存未命中，查DB: ${cacheKey}`);
  const user = await mockDb.findUser(userId);
  
  if (user) {
    // Step 3: 写入缓存，TTL=1小时
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));
  }
  
  return user;
}

/**
 * Cache-Aside 写操作
 * 1. 先更新数据库
 * 2. 删除缓存（而非更新，避免数据不一致）
 */
async function updateUser(userId, updates) {
  // 实际应用中这里会更新数据库
  console.log(`📝 更新数据库: user:${userId}`, updates);
  
  // 删除缓存
  await redisClient.del(`user:${userId}`);
  console.log(`🗑️  删除缓存: user:${userId}`);
}

// ============ GraphQL 查询缓存 ============

const queryCache = new Map();

/**
 * GraphQL 查询结果缓存
 * 使用 Redis 存储，TTL=5分钟
 */
async function queryWithCache(cacheKey, ttlSeconds, resolverFn) {
  const redisKey = `gql:${cacheKey}`;
  
  const cached = await redisClient.get(redisKey);
  if (cached) {
    console.log(`✅ GraphQL缓存命中: ${cacheKey}`);
    return JSON.parse(cached);
  }
  
  const result = await resolverFn();
  await redisClient.setEx(redisKey, ttlSeconds, JSON.stringify(result));
  console.log(`💾 GraphQL查询结果已缓存: ${cacheKey}`);
  
  return result;
}

// ============ 测试运行 ============

async function main() {
  await redisClient.connect();
  console.log('🔌 Redis已连接\n');
  
  // 测试 Cache-Aside
  console.log('--- Cache-Aside 测试 ---');
  
  // 第一次查询（缓存未命中）
  const user1 = await getUser('1');
  console.log('查询结果:', user1);
  console.log();
  
  // 第二次查询（缓存命中）
  const user2 = await getUser('1');
  console.log('查询结果:', user2);
  console.log();
  
  // 更新用户（删除缓存）
  await updateUser('1', { name: '大鱼（更新）' });
  console.log();
  
  // 更新后再次查询（缓存未命中）
  const user3 = await getUser('1');
  console.log('更新后查询:', user3);
  
  await redisClient.quit();
  console.log('\n👋 测试完成');
}

main().catch(console.error);
