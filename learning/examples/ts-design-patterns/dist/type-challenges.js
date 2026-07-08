"use strict";
// ==================== 类型体操（Type Challenges）================
// 练习 TypeScript 高级类型技巧
Object.defineProperty(exports, "__esModule", { value: true });
// ["name", string] | ["age", number]
// ============== 挑战 5: Currying ==============
// 函数柯里化
// 简单柯里化测试（类型演示）
function curriedAdd(a) {
    return (b) => (c) => a + b + c;
}
const step1 = curriedAdd(1);
const step2 = step1(2);
const result = step2(3); // 6
console.log('curry(1)(2)(3) =', result);
function area(shape) {
    switch (shape.kind) {
        case 'square': return shape.size ** 2;
        case 'circle': return Math.PI * shape.radius ** 2;
        case 'triangle': return (shape.base * shape.height) / 2;
    }
}
const s = { kind: 'square', size: 10 };
console.log(`正方形面积: ${area(s)}`);
async function fetchUser() {
    return { id: 1, name: '大鱼' };
}
async function fetchPosts(userId) {
    return [{ id: 1, title: 'Hello' }];
}
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
//# sourceMappingURL=type-challenges.js.map