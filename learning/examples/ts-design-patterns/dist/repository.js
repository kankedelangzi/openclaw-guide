"use strict";
// ==================== 仓储模式（Repository Pattern）================
// 将数据访问逻辑封装在仓储层，业务层不直接接触数据库
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = exports.UserRepository = void 0;
// 模拟数据库（内存存储）
class InMemoryStore {
    constructor() {
        this.data = new Map();
    }
    set(id, entity) {
        this.data.set(id, entity);
    }
    get(id) {
        return this.data.get(id);
    }
    delete(id) {
        return this.data.delete(id);
    }
    values() {
        return Array.from(this.data.values());
    }
    filter(predicate) {
        return this.values().filter(predicate);
    }
}
// 用户仓储实现
class UserRepository {
    constructor() {
        this.store = new InMemoryStore();
        this.idCounter = 1;
    }
    generateId() {
        return `user_${String(this.idCounter++).padStart(4, '0')}`;
    }
    async findById(id) {
        return this.store.get(id) ?? null;
    }
    async findAll(filter) {
        if (!filter)
            return this.store.values();
        return this.store.filter(item => Object.entries(filter).every(([key, value]) => item[key] === value));
    }
    async create(data) {
        const now = new Date();
        const user = {
            id: this.generateId(),
            ...data,
            createdAt: now,
            updatedAt: now
        };
        this.store.set(user.id, user);
        console.log(`[UserRepo] 创建用户: ${user.id}`);
        return user;
    }
    async update(id, data) {
        const existing = this.store.get(id);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...data,
            id: existing.id, // 防止 id 被修改
            createdAt: existing.createdAt,
            updatedAt: new Date()
        };
        this.store.set(id, updated);
        console.log(`[UserRepo] 更新用户: ${id}`);
        return updated;
    }
    async delete(id) {
        const existed = this.store.delete(id);
        if (existed)
            console.log(`[UserRepo] 删除用户: ${id}`);
        return existed;
    }
}
exports.UserRepository = UserRepository;
// 业务服务（使用仓储，不直接接触数据库）
class UserService {
    constructor(repo) {
        this.repo = repo;
    }
    async register(name, email, age) {
        // 业务验证
        const existing = await this.repo.findAll({ email });
        if (existing.length > 0) {
            throw new Error(`邮箱 ${email} 已被注册`);
        }
        return this.repo.create({ name, email, age });
    }
    async getUser(id) {
        const user = await this.repo.findById(id);
        if (!user)
            throw new Error(`用户 ${id} 不存在`);
        return user;
    }
    async updateName(id, name) {
        const updated = await this.repo.update(id, { name });
        if (!updated)
            throw new Error(`用户 ${id} 不存在`);
        return updated;
    }
    async getAdultUsers() {
        const all = await this.repo.findAll();
        return all.filter(u => u.age !== undefined && u.age >= 18);
    }
}
exports.UserService = UserService;
// 测试
async function main() {
    console.log('=== 仓储模式 ===');
    const repo = new UserRepository();
    const service = new UserService(repo);
    // 注册用户
    const user1 = await service.register('大鱼', 'dayu@example.com', 25);
    const user2 = await service.register('小虾', 'xiaoxia@example.com', 17);
    // 获取用户
    const fetched = await service.getUser(user1.id);
    console.log(`获取用户: ${fetched.name}, ${fetched.email}`);
    // 更新用户
    const updated = await service.updateName(user1.id, '大鱼Plus');
    console.log(`更新后: ${updated.name}`);
    // 成年用户
    const adults = await service.getAdultUsers();
    console.log(`成年用户: ${adults.map(u => u.name).join(', ')}`);
    // 删除用户
    await repo.delete(user2.id);
    console.log(`剩余用户数: ${(await repo.findAll()).length}`);
}
main().catch(console.error);
//# sourceMappingURL=repository.js.map