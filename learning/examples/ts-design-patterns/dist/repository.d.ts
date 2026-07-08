interface Entity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
interface User extends Entity {
    name: string;
    email: string;
    age?: number;
}
interface Repository<T extends Entity> {
    findById(id: string): Promise<T | null>;
    findAll(filter?: Partial<T>): Promise<T[]>;
    create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
}
declare class UserRepository implements Repository<User> {
    private store;
    private idCounter;
    private generateId;
    findById(id: string): Promise<User | null>;
    findAll(filter?: Partial<User>): Promise<User[]>;
    create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
    update(id: string, data: Partial<User>): Promise<User | null>;
    delete(id: string): Promise<boolean>;
}
declare class UserService {
    private repo;
    constructor(repo: Repository<User>);
    register(name: string, email: string, age?: number): Promise<User>;
    getUser(id: string): Promise<User>;
    updateName(id: string, name: string): Promise<User>;
    getAdultUsers(): Promise<User[]>;
}
export { Repository, UserRepository, UserService, User, Entity };
//# sourceMappingURL=repository.d.ts.map