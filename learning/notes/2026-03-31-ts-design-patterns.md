# TypeScript 设计模式与类型体操

> 📅 学习日期：2026-03-31（第3轮深化）
> 🦞 子龙虾出品

## 📌 深化内容

1. 常见设计模式 TypeScript 实现
2. 类型体操（Type Challenges）
3. 声明文件与模块扩展
4. 条件类型进阶
5. 实战：类型安全的 API 客户端

---

## 1. 单例模式

```typescript
class Database {
  private static instance: Database;
  
  private constructor() {
    // 私有构造函数
  }
  
  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
  
  query(sql: string): void {
    console.log('执行 SQL:', sql);
  }
}

// 使用
const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2);  // true
```

---

## 2. 工厂模式

```typescript
// 产品接口
interface Notification {
  send(message: string): void;
}

// 具体产品
class EmailNotification implements Notification {
  send(message: string): void {
    console.log('📧 邮件:', message);
  }
}

class SMSNotification implements Notification {
  send(message: string): void {
    console.log('📱 短信:', message);
  }
}

class PushNotification implements Notification {
  send(message: string): void {
    console.log('🔔 推送:', message);
  }
}

// 工厂
type NotificationType = 'email' | 'sms' | 'push';

class NotificationFactory {
  static create(type: NotificationType): Notification {
    switch (type) {
      case 'email':
        return new EmailNotification();
      case 'sms':
        return new SMSNotification();
      case 'push':
        return new PushNotification();
      default:
        throw new Error(`未知类型: ${type}`);
    }
  }
}

// 使用
const notifier = NotificationFactory.create('email');
notifier.send('Hello');
```

---

## 3. 观察者模式

```typescript
// 主题
interface Subject<T> {
  subscribe(observer: Observer<T>): void;
  unsubscribe(observer: Observer<T>): void;
  notify(data: T): void;
}

// 观察者
interface Observer<T> {
  update(data: T): void;
}

// 具体实现
class EventEmitter<T> implements Subject<T> {
  private observers: Observer<T>[] = [];
  
  subscribe(observer: Observer<T>): void {
    this.observers.push(observer);
  }
  
  unsubscribe(observer: Observer<T>): void {
    this.observers = this.observers.filter(o => o !== observer);
  }
  
  notify(data: T): void {
    this.observers.forEach(o => o.update(data));
  }
}

// 使用
interface UserEvent {
  type: 'login' | 'logout';
  userId: string;
  timestamp: Date;
}

const emitter = new EventEmitter<UserEvent>();

emitter.subscribe({
  update: (event) => console.log('Observer 1:', event)
});

emitter.subscribe({
  update: (event) => console.log('Observer 2:', event)
});

emitter.notify({
  type: 'login',
  userId: '123',
  timestamp: new Date()
});
```

---

## 4. 类型守卫与守卫类

```typescript
// 类型守卫
type Primitive = string | number | boolean | null | undefined;

function isPrimitive(value: unknown): value is Primitive {
  return ['string', 'number', 'boolean', 'undefined', 'null'].includes(typeof value);
}

// 可辨识联合类型 + 守卫
interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: string;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

function isSuccess<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

function handleResponse<T>(response: ApiResponse<T>) {
  if (isSuccess(response)) {
    console.log('数据:', response.data);
  } else {
    console.log('错误:', response.error);
  }
}
```

---

## 5. 类型体操（Type Challenges）

### 实现 PickByType

```typescript
// 从对象类型中挑选特定类型的属性
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K]
};

interface User {
  name: string;
  age: number;
  active: boolean;
  email: string;
}

type StringProps = PickByType<User, string>;
// { name: string; email: string; }

type NumberProps = PickByType<User, number>;
// { age: number; }
```

### 实现 RequiredBy

```typescript
// 使特定属性变为必填
type RequiredBy<T, K extends keyof T> = 
  Omit<T, K> & Required<Pick<T, K>>;

interface User {
  name?: string;
  age?: number;
  email?: string;
}

type UserWithRequiredName = RequiredBy<User, 'name'>;
// { name: string; age?: number; email?: string; }
```

### 实现 DeepPartial

```typescript
// 深度可选
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface Config {
  database: {
    host: string;
    port: number;
  };
  cache: {
    redis: {
      host: string;
      port: number;
    };
  };
}

type PartialConfig = DeepPartial<Config>;
// 所有嵌套属性都变为可选
```

### 实现 DeepReadonly

```typescript
// 深度只读
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type ImmutableConfig = DeepReadonly<Config>;
// 所有属性都变为只读，包括嵌套
```

### 实现 UnwrapPromise

```typescript
// 提取 Promise 的结果类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>;  // string
type B = UnwrapPromise<number>;          // number
type C = UnwrapPromise<Promise<Promise<number>>>;  // number（自动展开）
```

### 实现 UnionToTuple

```typescript
// 将联合类型转为元组
type UnionToTuple<T> = 
  (T extends any ? (t: T) => T : never) extends (t: infer U) => U
    ? UnionToTuple<Exclude<T, U>>
    : [];

type Tuple = UnionToTuple<'a' | 'b' | 'c'>;  // ['a', 'b', 'c']
```

---

## 6. 声明文件与模块扩展

### 模块扩展

```typescript
// 为第三方库添加类型
declare module 'express' {
  interface Request {
    userId?: string;
    authToken?: string;
  }
}

// 使用
app.use((req, res, next) => {
  console.log(req.userId);  // 现在有类型提示
  next();
});
```

### 函数重载

```typescript
// 重载签名
function parse(input: string): string;
function parse(input: string, radix: number): number;
function parse(input: string, radix?: number): string | number {
  if (radix !== undefined) {
    return parseInt(input, radix);
  }
  return input.trim();
}

parse('  hello  ');      // string
parse('42', 10);         // number
```

---

## 7. 实战：类型安全的 API 客户端

```typescript
// API 客户端类型定义

// 请求类型
interface RequestOptions<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: T;
  headers?: Record<string, string>;
}

// 响应类型
interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// API 客户端类
class ApiClient {
  constructor(private baseUrl: string) {}
  
  async request<T, R>(options: RequestOptions<T>): Promise<ApiResult<R>> {
    try {
      const response = await fetch(`${this.baseUrl}${options.path}`, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
  
  get<R>(path: string): Promise<ApiResult<R>> {
    return this.request({ method: 'GET', path });
  }
  
  post<T, R>(path: string, body: T): Promise<ApiResult<R>> {
    return this.request({ method: 'POST', path, body });
  }
  
  put<T, R>(path: string, body: T): Promise<ApiResult<R>> {
    return this.request({ method: 'PUT', path, body });
  }
  
  delete<R>(path: string): Promise<ApiResult<R>> {
    return this.request({ method: 'DELETE', path });
  }
}

// 使用
const api = new ApiClient('https://api.example.com');

interface User {
  id: number;
  name: string;
  email: string;
}

// GET 请求
const getUser = async (id: number) => {
  const result = await api.get<User>(`/users/${id}`);
  if (result.success && result.data) {
    console.log(result.data.name);
  }
};

// POST 请求
const createUser = async (name: string, email: string) => {
  const result = await api.post<{ name: string; email: string }, User>(
    '/users',
    { name, email }
  );
  return result;
};
```

---

## 📚 总结

TypeScript 深化核心：
1. **设计模式** - 单例、工厂、观察者
2. **类型守卫** - 类型保护、可辨识联合
3. **类型体操** - 工具类型、条件类型
4. **模块扩展** - 声明文件、类型增强
5. **实战应用** - 类型安全的 API 客户端

---
---

## 📌 Phase 7-2 深化：设计模式实战代码（2026-03-31 晚）

> 新增：完整可运行的设计模式示例
> 位置：`examples/ts-design-patterns/src/`

### 新增文件清单
- `src/singleton.ts` — 单例模式 + 泛型单例基类
- `src/factory.ts` — 简单工厂 + 抽象工厂
- `src/observer.ts` — 泛型观察者 + TypedEvent 装饰器风格
- `src/repository.ts` — 仓储模式（UserRepository + UserService）
- `src/type-challenges.ts` — 类型体操（Merge/OptionalKeys/Curry等）
- `src/index.ts` — 入口文件，串联所有模式

### 核心新增代码片段

#### 泛型单例基类
```typescript
class Singleton<T> {
  private static instances = new Map<string, unknown>();
  
  static getInstance<T>(this: new () => T, key: string): T {
    if (!Singleton.instances.has(key)) {
      Singleton.instances.set(key, new this());
    }
    return Singleton.instances.get(key) as T;
  }
}

class ConfigService extends Singleton<ConfigService> {
  get(key: string) { return `value_for_${key}`; }
}
```

#### 泛型观察者（带取消订阅）
```typescript
class EventEmitter<T> implements Subject<T> {
  private observers = new Set<Observer<T>>();
  
  subscribe(observer: Observer<T>): () => void {
    this.observers.add(observer);
    return () => this.unsubscribe(observer); // 返回取消函数
  }
  
  update(data: T): void {
    this.data = data;
    this.notify();
  }
}
```

#### 类型体操：Merge
```typescript
type Merge<F, S> = {
  [K in keyof F | keyof S]: K extends keyof S ? S[K] : K extends keyof F ? F[K] : never
};

type Result = Merge<{ a: number }, { b: string }>; // { a: number; b: string }
```

---
🦞 *学无止境，继续加油！*
