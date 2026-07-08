# Redis 高级特性与实战

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. Redis 数据结构进阶
2. 发布/订阅
3. 管道与事务
4. 集群与高可用
5. 实战：缓存、锁、排行榜

---

## 1. Redis 数据结构进阶

### 位图（Bitmap）
```javascript
// 用户签到系统
async function signIn(userId, date) {
  const key = `sign:${date}`;
  await redis.setBit(key, userId, 1);
}

// 检查签到
async function checkSign(userId, date) {
  const key = `sign:${date}`;
  return await redis.getBit(key, userId);
}

// 统计某天签到人数
async function countSign(date) {
  const key = `sign:${date}`;
  return await redis.bitCount(key);
}

// 连续签到天数
async function continuousDays(userId) {
  let days = 0;
  for (let i = 0; i < 30; i++) {
    const date = getDate(-i);
    if (await checkSign(userId, date)) {
      days++;
    } else {
      break;
    }
  }
  return days;
}
```

### HyperLogLog
```javascript
// 统计 UV（独立访客）
async function addUV(date, userId) {
  const key = `uv:${date}`;
  await redis.pfAdd(key, userId);
}

async function countUV(date) {
  const key = `uv:${date}`;
  return await redis.pfCount(key);
}

// 合并多天统计
async function countUVRange(startDate, endDate) {
  const keys = getDates(startDate, endDate).map(d => `uv:${d}`);
  return await redis.pfCount(...keys);
}
```

### 地理位置（GEO）
```javascript
// 添加位置
await redis.geoAdd('users', {
  longitude: 121.4737,
  latitude: 31.2304,
  member: 'user:123'
});

// 查询附近的人（5公里内）
const nearby = await redis.geoRadius('users', 121.4737, 31.2304, 5, 'km');
// 返回: [{ member: 'user:123', distance: 0, ... }]

// 查询距离
const distance = await redis.geoDist('users', 'user:123', 'user:456', 'km');

// 移除位置
await redis.zRem('users', 'user:123');
```

### 布隆过滤器（Bloom Filter）
```javascript
// 注意：Redis 原生没有 Bloom Filter，需要 Redisson 或插件
// 这里演示概念

// 可能存在的误判，但不会漏判
// 适合：判断邮箱/手机号是否已注册
```

---

## 2. 发布/订阅（Pub/Sub）

### 基本使用
```javascript
// 发布者
async function publishMessage(channel, message) {
  await redis.publish(channel, JSON.stringify(message));
}

// 订阅
async function subscribe(channel, callback) {
  const subscriber = redis.duplicate();
  
  subscriber.subscribe(channel, (err, count) => {
    console.log(`订阅频道 ${channel}，当前订阅数: ${count}`);
  });
  
  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      callback(JSON.parse(message));
    }
  });
  
  return subscriber;
}

// 使用
await subscribe('user:123:notifications', (msg) => {
  console.log('收到通知:', msg);
});

await publishMessage('user:123:notifications', {
  type: 'like',
  from: 'user:456'
});
```

### 模式订阅
```javascript
// 订阅匹配模式的所有频道
const subscriber = redis.duplicate();
await subscriber.psubscribe('user:*:notifications');

// 接收
subscriber.on('pmessage', (pattern, channel, message) => {
  console.log(`模式 ${pattern} 匹配 ${channel}:`, message);
});
```

---

## 3. 管道与事务

### 管道（Pipeline）
```javascript
// 减少网络往返
const pipeline = redis.pipeline();

pipeline.set('key1', 'value1');
pipeline.get('key1');
pipeline.incr('counter');
pipeline.incr('counter');
pipeline.keys('key*');
pipeline.exec();

// 等价于 6 次网络往返，但只 1 次！
```

### 事务（Transaction）
```javascript
// MULTI/EXEC
const multi = redis.multi();
multi.set('key1', 'value1');
multi.get('key1');
multi.incr('counter');
const results = await multi.exec();
// results: [[err, 'OK'], [err, 'value1'], [err, 1]]

// WATCH（乐观锁）
await redis.watch('balance');
const balance = await redis.get('balance');

if (parseInt(balance) >= amount) {
  const multi = redis.multi();
  multi.decrby('balance', amount);
  multi.incrby('order:count', amount);
  const results = await multi.exec();
  // 如果 balance 在 WATCH 后被修改，exec 返回 null
} else {
  await redis.unwatch();
}
```

### Lua 脚本
```javascript
// 原子操作：扣款
const decrementIfEnough = `
  local balance = redis.call('GET', KEYS[1])
  if balance and tonumber(balance) >= tonumber(ARGV[1]) then
    return redis.call('DECRBY', KEYS[1], ARGV[1])
  else
    return -1
  end
`;

const result = await redis.eval(decrementIfEnough, {
  keys: ['balance'],
  arguments: [100]
});
// 返回新余额或 -1（余额不足）
```

---

## 4. 集群与高可用

### Sentinel（哨兵）
```javascript
// 监控主从切换
const sentinel = new Redis Sentinel({
  sentinels: [
    { host: '10.0.0.1', port: 26379 },
    { host: '10.0.0.2', port: 26379 },
    { host: '10.0.0.3', port: 26379 }
  ],
  name: 'mymaster'
});

sentinel.on('master', (master) => {
  console.log('新主节点:', master);
});

const client = await sentinel.getClient();
```

### Cluster
```javascript
// 分片集群
const cluster = new Redis.Cluster([
  { host: '10.0.0.1', port: 6379 },
  { host: '10.0.0.2', port: 6379 },
  { host: '10.0.0.3', port: 6379 }
]);

// 自动路由到正确节点
await cluster.set('key', 'value');
await cluster.get('key');
```

---

## 5. 实战场景

### 缓存模式
```javascript
// Cache-Aside
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  
  // 1. 先查缓存
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. 缓存未命中，查数据库
  const user = await db.users.findById(userId);
  
  // 3. 写入缓存（1小时过期）
  await redis.setex(cacheKey, 3600, JSON.stringify(user));
  
  return user;
}

// 缓存穿透防护（布隆过滤器 + 空值缓存）
async function getUserSecure(userId) {
  const bfKey = 'user:bloom';
  
  // 布隆过滤器判断可能存在
  const mayExist = await redis.pipeline()
    .pfadd(bfKey, userId)
    .exec();
  
  // 如果不存在，直接返回（防止穿透）
  if (!mayExist[0][1]) {
    return null;
  }
  
  // 正常缓存逻辑...
}
```

### 分布式锁
```javascript
class DistributedLock {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.lockKey = options.lockKey || 'lock';
    this.expireMs = options.expireMs || 30000;
  }
  
  async acquire(value = Date.now().toString()) {
    const result = await this.redis.set(
      this.lockKey, 
      value, 
      'PX', 
      this.expireMs, 
      'NX'
    );
    return result === 'OK' ? value : null;
  }
  
  async release(expectedValue) {
    // Lua 脚本保证原子性
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    
    return await this.redis.eval(script, {
      keys: [this.lockKey],
      arguments: [expectedValue]
    });
  }
}

// 使用
const lock = new DistributedLock(redis, { lockKey: 'order:123', expireMs: 10000 });

const value = await lock.acquire();
if (value) {
  try {
    // 执行业务逻辑
    await processOrder();
  } finally {
    await lock.release(value);
  }
}
```

### 排行榜
```javascript
class Leaderboard {
  constructor(redis, key) {
    this.redis = redis;
    this.key = key;
  }
  
  // 添加/更新分数
  async setScore(userId, score) {
    await this.redis.zadd(this.key, score, userId);
  }
  
  // 增加分数
  async incrScore(userId, increment) {
    return await this.redis.zincrby(this.key, increment, userId);
  }
  
  // 获取排名（0-based）
  async getRank(userId) {
    const rank = await this.redis.zrevRank(this.key, userId);
    return rank !== null ? rank + 1 : null;
  }
  
  // 获取 Top N
  async getTop(n = 10) {
    return await this.redis.zrevRange(this.key, 0, n - 1, 'WITHSCORES');
  }
  
  // 获取用户分数
  async getScore(userId) {
    return await this.redis.zscore(this.key, userId);
  }
  
  // 获取排名范围
  async getRange(start, end) {
    return await this.redis.zrevRange(this.key, start, end, 'WITHSCORES');
  }
  
  // 移除用户
  async remove(userId) {
    await this.redis.zrem(this.key, userId);
  }
}

// 使用
const leaderboard = new Leaderboard(redis, 'game:scores');

await leaderboard.setScore('user:1', 100);
await leaderboard.setScore('user:2', 200);
await leaderboard.setScore('user:3', 150);

console.log(await leaderboard.getTop(3));
// ['user:2', '200', 'user:3', '150', 'user:1', '100']

console.log(await leaderboard.getRank('user:3'));
// 2（第二名）
```

### 延迟队列
```javascript
class DelayQueue {
  constructor(redis) {
    this.redis = redis;
  }
  
  async push(job, delayMs) {
    const score = Date.now() + delayMs;
    const jobId = Date.now().toString() + Math.random().toString(36).substr(2);
    
    await this.redis.zadd('delay:queue', score, JSON.stringify({ jobId, job }));
    return jobId;
  }
  
  async pop(timeoutMs = 1000) {
    const now = Date.now();
    
    // 获取已到期的任务
    const items = await this.redis.zrangebyscore('delay:queue', 0, now, 'LIMIT', 0, 1);
    
    if (items.length === 0) {
      // 等待一段时间
      await new Promise(r => setTimeout(r, Math.min(timeoutMs, 100)));
      return this.pop(timeoutMs - 100);
    }
    
    const [item] = items;
    const { jobId, job } = JSON.parse(item);
    
    // 原子性删除
    const removed = await this.redis.zrem('delay:queue', item);
    
    if (removed === 1) {
      return job;
    }
    
    return null;
  }
}

// 使用
const queue = new DelayQueue(redis);

// 添加延迟任务
await queue.push({ type: 'email', to: 'user@example.com' }, 5000); // 5秒后执行

// 消费
while (true) {
  const job = await queue.pop();
  if (job) {
    await processJob(job);
  }
}
```

---

## 📚 总结

Redis 高级特性：
1. **数据结构** - Bitmap、HyperLogLog、GEO
2. **发布订阅** - 消息通知、模式匹配
3. **管道事务** - 减少网络开销、原子操作
4. **集群高可用** - Sentinel、Cluster
5. **实战场景** - 缓存、锁、排行榜、延迟队列

---
🦞 *学无止境，继续加油！*
