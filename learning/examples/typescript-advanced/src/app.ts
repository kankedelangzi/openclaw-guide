// ==================== 1. 泛型示例 ====================

// 泛型函数
function identity<T>(arg: T): T {
  return arg;
}

console.log("=== 泛型函数 ===");
console.log(identity<number>(42));
console.log(identity("hello"));
console.log(identity(true));

// 泛型接口
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

console.log("\n=== 泛型接口 ===");
console.log(resp);

// 泛型类
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
  
  size(): number {
    return this.items.length;
  }
}

console.log("\n=== 泛型类 ===");
const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
numStack.push(3);
console.log("Pop:", numStack.pop());
console.log("Peek:", numStack.peek());
console.log("Size:", numStack.size());

// 泛型约束
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

console.log("\n=== 泛型约束 ===");
const user = { name: "大鱼", age: 25, email: "dayu@example.com" };
console.log("name:", getProperty(user, "name"));
console.log("age:", getProperty(user, "age"));

// ==================== 2. 类型守卫示例 ====================

console.log("\n=== 类型守卫 ===");

// typeof
function padLeft(value: string | number, padding: string | number) {
  if (typeof padding === "number") {
    return " ".repeat(padding) + value;
  }
  return padding + value;
}
console.log(padLeft("hello", 5));
console.log(padLeft("hello", ">>>"));

// instanceof
class Dog {
  bark() { console.log("汪汪！"); }
}

class Cat {
  meow() { console.log("喵喵！"); }
}

function speak(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark();
  } else {
    animal.meow();
  }
}

speak(new Dog());
speak(new Cat());

// 自定义类型守卫
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
    pet.swim();
  } else {
    pet.fly();
  }
}

move({ swim: () => console.log("鱼在游泳") });
move({ fly: () => console.log("鸟在飞") });

// 可辨识联合类型
interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  side: number;
}

type Shape = Circle | Square;

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
  }
}

console.log("\n=== 可辨识联合类型 ===");
console.log("Circle area:", area({ kind: "circle", radius: 5 }));
console.log("Square area:", area({ kind: "square", side: 4 }));

// ==================== 3. 工具类型示例 ====================

console.log("\n=== 工具类型 ===");

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial - 所有属性变可选
function updateUser(id: number, updates: Partial<User>) {
  console.log("更新用户", id, updates);
}
updateUser(1, { name: "新名字" });

// Pick - 选取属性
type UserPreview = Pick<User, "id" | "name">;
const preview: UserPreview = { id: 1, name: "大鱼" };
console.log("Preview:", preview);

// Omit - 排除属性
type UserWithoutPassword = Omit<User, "password">;
const userWithoutPwd: UserWithoutPassword = { id: 1, name: "大鱼", email: "dayu@example.com" };
console.log("Without password:", userWithoutPwd);

// Record
type Role = "admin" | "user" | "guest";
const permissions: Record<Role, string[]> = {
  admin: ["read", "write", "delete"],
  user: ["read", "write"],
  guest: ["read"]
};
console.log("Permissions:", permissions);

// ReturnType
function createUser() {
  return { id: 1, name: "大鱼" };
}
type CreatedUser = ReturnType<typeof createUser>;
console.log("Created user type:", typeof {} as CreatedUser);

// ==================== 4. 装饰器示例 ====================

console.log("\n=== 装饰器 ===");

// 类装饰器
function Logger(prefix: string) {
  return function(constructor: Function) {
    console.log(`${prefix} - 类 ${constructor.name} 被定义`);
  };
}

// 方法装饰器
function readonly(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  descriptor.writable = false;
}

@Logger("INFO")
class UserService {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  @readonly
  greet() {
    return `你好，我是 ${this.name}`;
  }
}

const service = new UserService("大鱼");
console.log(service.greet());
// service.greet = () => "hack"; // ❌ Error: Cannot assign to read only property

// ==================== 5. 高级类型示例 ====================

console.log("\n=== 高级类型 ===");

// 条件类型
type IsString<T> = T extends string ? "yes" : "no";
type A = IsString<string>;   // "yes"
type B = IsString<number>;    // "no"
console.log("IsString<string>:", A);
console.log("IsString<number>:", B);

// 映射类型
type Optional<T> = {
  [K in keyof T]?: T[K];
};

type Frozen<T> = {
  readonly [K in keyof T]: T[K];
};

interface Config {
  apiUrl: string;
  timeout: number;
}

type OptionalConfig = Optional<Config>;
const optConfig: OptionalConfig = { apiUrl: "http://api.com" }; // timeout 可选

type FrozenConfig = Frozen<Config>;
const frozenConfig: FrozenConfig = { apiUrl: "http://api.com", timeout: 5000 };
// frozenConfig.timeout = 1000; // ❌ Error

console.log("Optional config (timeout optional):", optConfig);

// 模板字面量类型
type Direction = "top" | "bottom" | "left" | "right";
type EventName = `on${Capitalize<Direction>}Click`;
// "onTopClick" | "onBottomClick" | "onLeftClick" | "onRightClick"
const event: EventName = "onTopClick";
console.log("Event name:", event);

console.log("\n✅ 所有示例执行完成！");
