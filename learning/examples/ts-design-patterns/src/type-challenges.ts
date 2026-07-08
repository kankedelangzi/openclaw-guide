// ==================== 类型体操（Type Challenges）================
// 练习 TypeScript 高级类型技巧

// ============== 挑战 1: Merge ==============
// 将两个类型合并，后者覆盖前者
type Merge<F, S> = {
  [K in keyof F | keyof S]: K extends keyof S ? S[K] : K extends keyof F ? F[K] : never
};

interface A { a: number; b: string; }
interface B { b: number; c: boolean; }

type Merged = Merge<A, B>;
// 结果: { a: number; b: number; c: boolean; }

// ============== 挑战 2: OptionalKeys ==============
// 提取可选属性
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T];

interface User {
  id: string;
  name: string;
  age?: number;
  email?: string;
}

type Keys = OptionalKeys<User>; // "age" | "email"

// ============== 挑战 3: RequiredKeys ==============
// 提取必填属性
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

type ReqKeys = RequiredKeys<User>; // "id" | "name"

// ============== 挑战 4: ObjectToTuple ==============
// 将对象转为元组类型 [key, value][]
type ObjectToTuple<T> = {
  [K in keyof T]: [K, T[K]]
}[keyof T];

type Tuple = ObjectToTuple<{ name: string; age: number }>;
// ["name", string] | ["age", number]

// ============== 挑战 5: Currying ==============
// 函数柯里化
// 简单柯里化测试（类型演示）
function curriedAdd(a: number): (b: number) => (c: number) => number {
  return (b: number) => (c: number) => a + b + c;
}

const step1 = curriedAdd(1);
const step2 = step1(2);
const result = step2(3); // 6
console.log('curry(1)(2)(3) =', result);

// ============== 挑战 6: Replace ==============
// 替换字符串中的子串
type Replace<
  S extends string, 
  From extends string, 
  To extends string
> = S extends `${infer Prefix}${From}${infer Suffix}`
  ? `${Prefix}${To}${Suffix}`
  : S;

type R1 = Replace<'hello world', 'world', 'typescript'>; // 'hello typescript'
type R2 = Replace<'foobar', 'bar', 'foo'>; // 'foofoo'

// ============== 挑战 7: DeepRequired ==============
// 深度必填（递归移除可选标记）
type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? DeepRequired<T[K]> : T[K]
};

// 测试
type NestedPartial = {
  database?: {
    host?: string;
    port?: number;
  };
};

type NestedRequired = DeepRequired<NestedPartial>;
// { database: { host: string; port: number; } }

// 手动测试 Merge
type MergedAB = Merge<A, B>; // { a: number; b: number; c: boolean; }

// ============== 挑战 8: Branch ==============
// 类型安全的条件分支
type Branch<T, Cond> = T extends Cond ? true : false;

type B1 = Branch<'a' | 'b', 'a' | 'b' | 'c'>; // boolean（联合类型需要分配律）
type B2 = Branch<'a', 'a'>; // true

// 更安全的版本
type IsExact<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;

type IE1 = IsExact<'a' | 'b', 'a' | 'b' | 'c'>; // false
type IE2 = IsExact<'a', 'a'>; // true

// ============== 挑战 9: Tagged Union ==============
// 带标签的联合类型（可辨识联合）
type Square = { kind: 'square'; size: number };
type Circle = { kind: 'circle'; radius: number };
type Triangle = { kind: 'triangle'; base: number; height: number };

type Shape = Square | Circle | Triangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'square': return shape.size ** 2;
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'triangle': return (shape.base * shape.height) / 2;
  }
}

const s: Shape = { kind: 'square', size: 10 };
console.log(`正方形面积: ${area(s)}`);

// ============== 挑战 10: Promise Chain Types ==============
// 链式 Promise 的类型推断
type Awaited<T> = T extends Promise<infer U>
  ? U extends Promise<infer V>
    ? Awaited<V>
    : U
  : T;

async function fetchUser() {
  return { id: 1, name: '大鱼' };
}

async function fetchPosts(userId: number) {
  return [{ id: 1, title: 'Hello' }];
}

type UserType = Awaited<ReturnType<typeof fetchUser>>;
// { id: number; name: string }

// 手动实现链式调用类型
async function chainExample() {
  const user = await fetchUser();
  const posts = await fetchPosts(user.id);
  return { user, posts };
}

// 运行时测试
console.log('\n=== 类型体操测试 ===');
console.log('area(square):', area({ kind: 'square', size: 10 }));
console.log('area(circle):', area({ kind: 'circle', radius: 5 }));

export { Merge, OptionalKeys, RequiredKeys, ObjectToTuple, DeepRequired, IsExact };
