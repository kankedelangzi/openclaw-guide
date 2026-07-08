declare class Database {
    readonly host: string;
    readonly port: number;
    private static instance;
    private constructor();
    static getInstance(host?: string, port?: number): Database;
    query(sql: string): string;
}
declare class Singleton<T> {
    private static instances;
    protected constructor();
    static getInstance<T>(this: new () => T, key: string): T;
}
declare class ConfigService extends Singleton<ConfigService> {
    constructor();
    get(key: string): string;
}
export { Database, Singleton, ConfigService };
//# sourceMappingURL=singleton.d.ts.map