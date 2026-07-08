// ==================== 仓储模式（Repository Pattern）================
// 将数据访问逻辑封装在仓储层，业务层不直接接触数据库

// 实体接口
interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// 用户实体
interface User extends Entity {
  name: string;
  email: string;
  age?: number;
}

// 仓储接口（定义数据访问契约）
interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

// 模拟数据库（内存存储）
class InMemoryStore<T extends Entity> {
  protected data = new Map<string, T>();
  
  set(id: string, entity: T): void {
    this.data.set(id, entity);
  }
  
  get(id: string): T | undefined {
    return this.data.get(id);
  }
  
  delete(id: string): boolean {
    return this.data.delete(id);
  }
  
  values(): T[] {
    return Array.from(this.data.values());
  }
  
  filter(predicate: (item: T) => boolean): T[] {
    return this.values().filter(predicate);
  }
}

// 用户仓储实现
class UserRepository implements Repository<User> {
  private store = new InMemoryStore<User>();
  private idCounter = 1;
  
  private generateId(): string {
    return `user_${String(this.idCounter++).padStart(4, '0')}`;
  }
  
  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }
  
  async findAll(filter?: Partial<User>): Promise<User[]> {
    if (!filter) return this.store.values();
    return this.store.filter(item => 
      Object.entries(filter).every(([key, value]) => 
        item[key as keyof User] === value
      )
    );
  }
  
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const user: User = {
      id: this.generateId(),
      ...data,
      createdAt: now,
      updatedAt: now
    };
    this.store.set(user.id, user);
    console.log(`[UserRepo] 创建用户: ${user.id}`);
    return user;
  }
  
  async update(id: string, data: Partial<User>): Promise<User | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    
    const updated: User = {
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
  
  async delete(id: string): Promise<boolean> {
    const existed = this.store.delete(id);
    if (existed) console.log(`[UserRepo] 删除用户: ${id}`);
    return existed;
  }
}

// 业务服务（使用仓储，不直接接触数据库）
class UserService {
  constructor(private repo: Repository<User>) {}
  
  async register(name: string, email: string, age?: number): Promise<User> {
    // 业务验证
    const existing = await this.repo.findAll({ email });
    if (existing.length > 0) {
      throw new Error(`邮箱 ${email} 已被注册`);
    }
    
    return this.repo.create({ name, email, age });
  }
  
  async getUser(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new Error(`用户 ${id} 不存在`);
    return user;
  }
  
  async updateName(id: string, name: string): Promise<User> {
    const updated = await this.repo.update(id, { name });
    if (!updated) throw new Error(`用户 ${id} 不存在`);
    return updated;
  }
  
  async getAdultUsers(): Promise<User[]> {
    const all = await this.repo.findAll();
    return all.filter(u => u.age !== undefined && u.age >= 18);
  }
}

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

export { Repository, UserRepository, UserService, User, Entity };
