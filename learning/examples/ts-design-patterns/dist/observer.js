"use strict";
// ==================== 观察者模式 ====================
// 定义对象间的一对多依赖关系，当一个对象改变时，所有依赖它的对象都会收到通知
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedEvent = exports.EventEmitter = void 0;
// 泛型事件发射器实现
class EventEmitter {
    constructor(initialData) {
        this.observers = new Set();
        this.data = initialData;
    }
    subscribe(observer) {
        this.observers.add(observer);
        // 返回取消订阅函数
        return () => this.unsubscribe(observer);
    }
    unsubscribe(observer) {
        this.observers.delete(observer);
    }
    notify() {
        this.observers.forEach(observer => observer.update(this.data));
    }
    // 更新数据并通知（类似 React useState）
    update(newData) {
        this.data = newData;
        this.notify();
    }
    getObserverCount() {
        return this.observers.size;
    }
}
exports.EventEmitter = EventEmitter;
// 具体观察者实现
class LoggerObserver {
    update(event) {
        console.log(`[Logger] ${event.type.toUpperCase()} - 用户 ${event.userId} 在 ${event.timestamp.toISOString()}`);
    }
}
class AnalyticsObserver {
    constructor() {
        this.events = [];
    }
    update(event) {
        this.events.push(event);
        console.log(`[Analytics] 收到事件，已记录 ${this.events.length} 个事件`);
    }
    getEvents() {
        return this.events;
    }
}
class TypedEvent {
    constructor() {
        this.handlers = new Set();
    }
    on(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler); // 取消订阅
    }
    off(handler) {
        this.handlers.delete(handler);
    }
    emit(data) {
        this.handlers.forEach(handler => handler(data));
    }
    get handlerCount() {
        return this.handlers.size;
    }
}
exports.TypedEvent = TypedEvent;
// 测试
console.log('=== 泛型观察者模式 ===');
const userEvents = new EventEmitter({
    type: 'login',
    userId: 'system',
    timestamp: new Date()
});
const logger = new LoggerObserver();
const analytics = new AnalyticsObserver();
// 订阅（获得取消订阅函数）
const unsubLogger = userEvents.subscribe(logger);
userEvents.subscribe(analytics);
console.log(`观察者数量: ${userEvents.getObserverCount()}`);
// 触发事件
userEvents.update({
    type: 'login',
    userId: 'user_001',
    timestamp: new Date()
});
userEvents.update({
    type: 'logout',
    userId: 'user_001',
    timestamp: new Date()
});
// 取消订阅
unsubLogger();
console.log(`取消订阅后: ${userEvents.getObserverCount()}`);
console.log('\n=== 装饰器风格 TypedEvent ===');
const clickEvent = new TypedEvent();
const unsub1 = clickEvent.on(({ x, y }) => console.log(`[Handler1] 点击坐标: ${x}, ${y}`));
clickEvent.on(({ x, y }) => console.log(`[Handler2] 点击坐标: ${x}, ${y}`));
clickEvent.emit({ x: 100, y: 200 });
unsub1(); // 取消第一个处理器
clickEvent.emit({ x: 300, y: 400 });
//# sourceMappingURL=observer.js.map