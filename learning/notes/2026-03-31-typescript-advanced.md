# TypeScript 进阶学习笔记

> 📅 学习日期：2026-03-31
> 🦞 子龙虾出品

## 📌 今天学什么？

TypeScript 进阶核心：
1. 泛型（Generics）
2. 装饰器（Decorators）
3. 类型守卫（Type Guards）
4. 工具类型（Utility Types）
5. 高级类型技巧

---

## 1. 泛型（Generics）

### 什么是泛型？
让函数、类、接口能够处理**多种类型**，而不是单一类型。

### 基本语法
```typescript
// 没有泛型：只能处理一种类型
function identity(arg: number): number {
  return arg;
}

// 有泛型：可以处理任意类型
function identity<T>(arg: T): T {
  return arg;
}

// 使用
const num = identity<number>(42);      // 明确指定类型
const str = identity("hello");         // 自动推断
const bool = identity(true);           // 自动推断
```

### 泛型函数
```typescript
// 多个泛型参数
function pair<T, U>(first: T, second: U): [T, U] {
  return [first, second];
}

const p = pair("age", 25);  // [string, number]

// 约束泛型
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length > b.length ? a : b;
}

longest("hello", "hi");        // OK
longest([1, 2], [1, 2, 3]);   // OK
longest(1, 2);                 // ❌ Error: number 没有 length
```

### 泛型接口
```typescript
interface Response<T> {
  data: T;
  status: number;
  message: string;
}

interface User {
  id: number;
  name: string;
}

const resp: Response<User> = {
  data: { id: 1, name: "大鱼" },
  status: 200,
  message: "成功"
};
```

### 泛型类
```typescript
class Stack<T> {
  private items: T[] = [];
  
  push(item: T): void {
    this.items.push(item);
  }
  
  pop(): T | undefined {
    return this.items.pop();
  }
  
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);

const strStack = new Stack<string>();
strStack.push("hello");
strStack.push("world");
```

### 泛型工具函数
```typescript
// 提取对象的某个属性
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "大鱼", age: 25, email: "dayu@example.com" };

const name = getProperty(user, "name");    // string
const age = getProperty(user, "age");     // number
getProperty(user, "xxx");                 // ❌ Error
```

---

## 2. 装饰器（Decorators）

### 什么是装饰器？
装饰器是一种特殊类型的声明，可以附加到类、方法、属性或参数上，修改其行为。

> ⚠️ 需要在 `tsconfig.json` 中启用：
> ```json
> {
>   "experimentalDecorators": true,
>   "emitDecoratorMetadata": true
> }
> ```

### 类装饰器
```typescript
// 简单装饰器
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@sealed
class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

// 装饰器工厂（可以传参数）
function logger(prefix: string) {
  return function(constructor: Function) {
    console.log(`${prefix} - 类 ${constructor.name} 被定义`);
  };
}

@logger("INFO")
@logger("APP")
class App {
  name = "MyApp";
}

// 输出:
// INFO - 类 App 被定义
// APP - 类 App 被定义
```

### 方法装饰器
```typescript
function readonly(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  descriptor.writable = false;
}

class User {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  @readonly
  greet() {
    return `你好，我是 ${this.name}`;
  }
}

const user = new User("大鱼");
user.greet = () => "hack";  // ❌ Error: Cannot assign to read only property
```

### 属性装饰器
```typescript
// 记录属性访问
function log(target: any, propertyKey: string) {
  let value = target[propertyKey];
  
  const getter = () => {
    console.log(`读取 ${propertyKey}: ${value}`);
    return value;
  };
  
  const setter = (newVal: any) => {
    console.log(`设置 ${propertyKey}: ${newVal}`);
    value = newVal;
  };
  
  Object.defineProperty(target, propertyKey, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true
  });
}

class User {
  @log
  name = "大鱼";
}

const user = new User();
console.log(user.name);   // 读取 name: 大鱼
user.name = "小虾";       // 设置 name: 小虾
console.log(user.name);   // 读取 name: 小虾
```

### 参数装饰器
```typescript
function required(
  target: any,
  propertyKey: string,
  parameterIndex: number
) {
  console.log(`${propertyKey} 的第 ${parameterIndex} 个参数是必填的`);
}

class UserService {
  greet(@required name: string, @required age: number) {
    console.log(`${name}, ${age}岁`);
  }
}
```

### 装饰器组合
```typescript
// 多个装饰器从下往上执行
@Component({
  selector: 'app-user',
  template: '<h1>{{ name }}</h1>'
})
@Logger("USER")
class UserComponent {
  name = "大鱼";
}

// 执行顺序: Logger → Component (从下往上)
// 实际输出顺序: Component → Logger (从上往下打印)
```

---

## 3. 类型守卫（Type Guards）

### 什么是类型守卫？
在运行时缩小类型范围，确保代码安全。

### typeof 类型守卫
```typescript
function padLeft(value: string | number, padding: string | number) {
  if (typeof padding === "number") {
    // TypeScript 知道这里是 number
    return " ".repeat(padding) + value;
  }
  if (typeof padding === "string") {
    // TypeScript 知道这里是 string
    return padding + value;
  }
  throw new Error("padding 必须是 string 或 number");
}
```

### instanceof 类型守卫
```typescript
class Dog {
  bark() { console.log("汪汪！"); }
}

class Cat {
  meow() { console.log("喵喵！"); }
}

function speak(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark();   // TypeScript 知道是 Dog
  } else {
    animal.meow();   // TypeScript 知道是 Cat
  }
}
```

### 自定义类型守卫
```typescript
interface Fish {
  swim(): void;
}

interface Bird {
  fly(): void;
}

function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined;
}

function move(pet: Fish | Bird) {
  if (isFish(pet)) {
    pet.swim();   // TypeScript 知道是 Fish
  } else {
    pet.fly();    // TypeScript 知道是 Bird
  }
}

// 另一种写法
function isFishAlt(pet: Fish | Bird): pet is Fish {
  return "swim" in pet;
}
```

### 可辨识联合类型（Discriminated Unions）
```typescript
interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  side: number;
}

interface Rectangle {
  kind: "rectangle";
  width: number;
  height: number;
}

type Shape = Circle | Square | Rectangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    case "rectangle":
      return shape.width * shape.height;
    default:
      // never 确保所有情况都被处理
      const _exhaustive: never = shape;
      throw new Error("未知形状");
  }
}
```

### in 操作符
```typescript
interface A {
  a(): void;
}

interface B {
  b(): void;
}

function fn(x: A | B) {
  if ("a" in x) {
    x.a();   // A
  } else {
    x.b();   // B
  }
}
```

---

## 4. 工具类型（Utility Types）

TypeScript 内置的工具类型，让你不用重复造轮子。

### Partial<T> - 所有属性变可选
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// 部分更新
function updateUser(id: number, updates: Partial<User>) {
  // updates 的所有属性都是可选的
}

updateUser(1, { name: "新名字" });  // 只更新 name
updateUser(1, {});                   // 什么都可以不传
```

### Required<T> - 所有属性变必填
```typescript
interface User {
  name?: string;
  age?: number;
}

const user: Required<User> = {
  name: "大鱼",
  age: 25
};
```

### Readonly<T> - 所有属性变只读
```typescript
interface User {
  name: string;
}

const user: Readonly<User> = {
  name: "大鱼"
};

user.name = "小虾";  // ❌ Error: Cannot assign to 'name'
```

### Pick<T, K> - 选取部分属性
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string; }
```

### Omit<T, K> - 排除部分属性
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type UserWithoutPassword = Omit<User, "password">;
// { id: number; name: string; email: string; }
```

### Record<K, V> - 创建键值对类型
```typescript
type Role = "admin" | "user" | "guest";
type Permissions = "read" | "write" | "delete";

// 每个角色对应的权限
const permissions: Record<Role, Permissions[]> = {
  admin: ["read", "write", "delete"],
  user: ["read", "write"],
  guest: ["read"]
};
```

### Exclude<T, U> - 排除类型
```typescript
type T0 = Exclude<"a" | "b" | "c", "a">;        // "b" | "c"
type T1 = Exclude<string | number | boolean, string | boolean>;  // number
```

### Extract<T, U> - 提取类型
```typescript
type T0 = Extract<"a" | "b" | "c", "a" | "f">;   // "a"
type T1 = Extract<string | number | boolean, string>;  // string
```

### NonNullable<T> - 排除 null 和 undefined
```typescript
type T0 = NonNullable<string | null | undefined>;  // string
type T1 = NonNullable<number[] | null | undefined>; // number[]
```

### ReturnType<T> - 获取函数返回值类型
```typescript
function createUser() {
  return { id: 1, name: "大鱼", age: 25 };
}

type User = ReturnType<typeof createUser>;
// { id: number; name: string; age: number; }
```

### Parameters<T> - 获取函数参数类型
```typescript
function greet(name: string, age: number): string {
  return `Hello, ${name}, age ${age}`;
}

type GreetParams = Parameters<typeof greet>;
// [name: string, age: number]

const [name, age] = ["大鱼", 25] as GreetParams;
```

### Awaited<T> - 获取 Promise 的结果类型
```typescript
type T0 = Awaited<Promise<string>>;              // string
type T1 = Awaited<Promise<Promise<number>>>;      // number
```

---

## 5. 高级类型技巧

### 条件类型
```typescript
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<string>;   // "yes"
type B = IsString<number>;    // "no"

// 提取元素类型
type ElementType<T> = T extends Array<infer U> ? U : never;

type A = ElementType<string[]>;  // string
type B = ElementType<number[]>;  // number
type C = ElementType<boolean>;  // never
```

### 映射类型
```typescript
// 所有属性变为可选并加上 ? 前缀
type Optional<T> = {
  [K in keyof T]?: T[K];
};

// 所有属性变为只读
type Frozen<T> = {
  readonly [K in keyof T]: T[K];
};

// 所有属性变为必填
type Required<T> = {
  [K in keyof T]-?: T[K];  // -? 移除可选
};

// 给所有属性加上前缀
type WithPrefix<T, P extends string> = {
  [K in keyof T as `prefix_${K & string}`]: T[K];
};
```

### 模板字面量类型
```typescript
type Direction = "top" | "bottom" | "left" | "right";

type EventName = `on${Capitalize<Direction>}Click`;
// "onTopClick" | "onBottomClick" | "onLeftClick" | "onRightClick"

// 提取路径参数
type Route = "/users/:id/posts/:postId";

type Params<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | Params<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
    ? Param
    : never;

type RouteParams = Params<Route>;  // "id" | "postId"
```

### 递归类型
```typescript
// JSON 类型
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };
type JSONObject = { [key: string]: JSONValue };

// 深度只读
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

interface User {
  name: string;
  address: {
    city: string;
  };
}

const user: DeepReadonly<User> = {
  name: "大鱼",
  address: {
    city: "上海"
  }
};

user.name = "小虾";            // ❌ Error
user.address.city = "北京";    // ❌ Error
```

---

## 📚 总结

TypeScript 进阶三板斧：
1. **泛型** - 类型参数化，代码复用
2. **装饰器** - 声明式修改类和方法
3. **类型守卫** - 运行时类型检查
4. **工具类型** - 内置的瑞士军刀

**下一步：** Node.js 实战项目（待办事项 API）

---
🦞 *学无止境，继续加油！*
