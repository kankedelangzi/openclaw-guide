type Merge<F, S> = {
    [K in keyof F | keyof S]: K extends keyof S ? S[K] : K extends keyof F ? F[K] : never;
};
type OptionalKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
type ObjectToTuple<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T];
type DeepRequired<T> = {
    [K in keyof T]-?: T[K] extends object ? DeepRequired<T[K]> : T[K];
};
type IsExact<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false;
export { Merge, OptionalKeys, RequiredKeys, ObjectToTuple, DeepRequired, IsExact };
//# sourceMappingURL=type-challenges.d.ts.map