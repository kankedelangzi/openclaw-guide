# Redis / GraphQL 学习笔记

**日期：** 2026-03-31  
**学习类型：** 新学习  
**状态：** ✅ 完成

---

## 一、Redis 缓存策略

### 1.1 核心概念

Redis 是基于内存的键值存储数据库，常用作缓存层。

### 1.2 缓存模式

**Cache-Aside（旁路缓存，最常用）：**
- 读：先查缓存 → 命中返回；未命中查DB → 写入缓存 → 返回
- 写：先写DB → 删除缓存（而非直接更新缓存，避免数据不一致）

```js
// Node.js + Redis 实现 Cache-Aside 模式
const client = createClient();
await client.connect();

// 读操作
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  const cached = await client.get(cacheKey);
  if (cached) {
    console.log('✅ 缓存命中');
    return JSON.parse(cached);
  }
  const user = await db.findUser(userId); // 模拟DB查询
  await client.setEx(cacheKey, 3600, JSON.stringify(user)); // TTL=1小时
  return user;
}

// 写操作
async function updateUser(userId, data) {
  await db.updateUser(userId, data);
  await client.del(`user:${userId}`); // 删除缓存
}
```

### 1.3 缓存淘汰策略

| 策略 | 说明 |
|------|------|
| LRU | 最近最少使用 |
| LFU | 最不经常使用 |
| TTL | 定时过期 |
| Random | 随机淘汰 |

### 1.4 缓存三大问题

| 问题 | 解决方案 |
|------|------|
| 缓存穿透 | 布隆过滤器 / 空值缓存 |
| 缓存击穿 | 互斥锁 / 永不过期+异步重建 |
| 缓存雪崩 | 随机TTL + 多级缓存 + 持久化 |

### 1.5 Redis 数据结构选择

| 结构 | 适用场景 |
|------|------|
| String | 简单值、session、计数器 |
| Hash | 对象存储（用户信息） |
| List | 队列、最新消息列表 |
| Set | 标签、好友关系 |
| Sorted Set | 排行榜、实时热搜 |

---

## 二、GraphQL API 设计

### 2.1 核心概念

- 单一端点（通常 `/graphql`）
- 客户端声明所需字段（Query）
- 支持嵌套查询，减少请求次数

### 2.2 类型定义示例

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: String!
}

type Query {
  user(id: ID!): User
  posts(limit: Int, offset: Int): [Post!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
  createPost(title: String!, content: String!, authorId: ID!): Post!
}
```

### 2.3 Node.js + Apollo Server 实战

```js
const { ApolloServer, gql } = require('apollo-server');

const typeDefs = gql`
  type Book {
    title: String
    author: String
  }
  type Query {
    books: [Book]
  }
`;

const books = [
  { title: 'Node.js实战', author: '大鱼' },
  { title: 'GraphQL指南', author: '子龙虾' }
];

const resolvers = {
  Query: {
    books: () => books
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen().then(({ url }) => {
  console.log(`🚀 GraphQL Server ready at ${url}`);
});
```

### 2.4 前端查询示例

```graphql
# 查询所有书籍（仅需title字段）
query {
  books {
    title
  }
}

# 查询用户及其文章
query {
  user(id: "1") {
    name
    posts {
      title
    }
  }
}
```

---

## 三、Redis + GraphQL 缓存实战

```js
// 缓存GraphQL查询结果，避免重复查询DB
const queryCache = new Map();

async function queryWithCache(cacheKey, ttlSeconds, resolverFn) {
  const cached = await client.get(`gql:${cacheKey}`);
  if (cached) {
    return JSON.parse(cached);
  }
  const result = await resolverFn();
  await client.setEx(`gql:${cacheKey}`, ttlSeconds, JSON.stringify(result));
  return result;
}

// 使用示例
async function getBooksWithCache() {
  return queryWithCache('books:list', 300, async () => {
    // 模拟DB查询
    return books;
  });
}
```

---

## 四、总结对比

| 特性 | REST | GraphQL |
|------|------|---------|
| 端点 | 多个 | 单一 |
| 数据获取 | 服务端决定 | 客户端声明 |
| 请求次数 | 多次 | 一次 |
| 缓存 | HTTP缓存 | 复杂（需自定义） |
| 适用场景 | 简单CRUD | 复杂嵌套数据 |

---

**学习状态：** ✅ 完成  
**下一步：** 继续深化实战项目，或复习薄弱环节
