interface Observer<T> {
    update(data: T): void;
}
interface Subject<T> {
    subscribe(observer: Observer<T>): () => void;
    unsubscribe(observer: Observer<T>): void;
    notify(): void;
}
interface UserEvent {
    type: 'login' | 'logout' | 'update';
    userId: string;
    timestamp: Date;
    payload?: Record<string, unknown>;
}
declare class EventEmitter<T> implements Subject<T> {
    private observers;
    protected data: T;
    constructor(initialData: T);
    subscribe(observer: Observer<T>): () => void;
    unsubscribe(observer: Observer<T>): void;
    notify(): void;
    update(newData: T): void;
    getObserverCount(): number;
}
type EventHandler<T> = (data: T) => void;
declare class TypedEvent<T> {
    private handlers;
    on(handler: EventHandler<T>): () => void;
    off(handler: EventHandler<T>): void;
    emit(data: T): void;
    get handlerCount(): number;
}
export { EventEmitter, TypedEvent, Observer, Subject, UserEvent };
//# sourceMappingURL=observer.d.ts.map