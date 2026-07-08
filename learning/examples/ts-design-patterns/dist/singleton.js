"use strict";
// ==================== 单例模式 ====================
// 确保一个类只有一个实例，并提供全局访问点
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = exports.Singleton = exports.Database = void 0;
class Database {
    // 私有构造函数，防止外部 new
    constructor(host, port) {
        this.host = host;
        this.port = port;
        console.log(`[Database] 连接到 ${host}:${port}`);
    }
    // 获取单例实例
    static getInstance(host = 'localhost', port = 27017) {
        if (!Database.instance) {
            Database.instance = new Database(host, port);
        }
        return Database.instance;
    }
    query(sql) {
        console.log(`[DB] 执行: ${sql}`);
        return `结果集 for: ${sql}`;
    }
}
exports.Database = Database;
// 测试
const db1 = Database.getInstance('127.0.0.1', 27017);
const db2 = Database.getInstance('127.0.0.1', 27017);
const db3 = Database.getInstance(); // 忽略参数，返回同一实例
console.log('db1 === db2:', db1 === db2); // true
console.log('db2 === db3:', db2 === db3); // true
db1.query('SELECT * FROM users');
db2.query('SELECT * FROM orders');
// ==================== 泛型单例 ====================
class Singleton {
    constructor() { }
    static getInstance(key) {
        if (!Singleton.instances.has(key)) {
            Singleton.instances.set(key, new this());
        }
        return Singleton.instances.get(key);
    }
}
exports.Singleton = Singleton;
Singleton.instances = new Map();
class ConfigService extends Singleton {
    constructor() {
        super();
        console.log('[ConfigService] 初始化');
    }
    get(key) {
        return `value_for_${key}`;
    }
}
exports.ConfigService = ConfigService;
const config1 = ConfigService.getInstance('config');
const config2 = ConfigService.getInstance('config');
console.log('config1 === config2:', config1 === config2);
//# sourceMappingURL=singleton.js.map