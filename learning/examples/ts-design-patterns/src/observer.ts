// ==================== 观察者模式 ====================
// 定义对象间的一对多依赖关系，当一个对象改变时，所有依赖它的对象都会收到通知

// 泛型观察者接口
interface Observer<T> {
  update(data: T): void;
}

// 泛型主题接口
interface Subject<T> {
  subscribe(observer: Observer<T>): () => void; // 返回取消订阅函数
  unsubscribe(observer: Observer<T>): void;
  notify(): void;
}

// 事件类型
interface UserEvent {
  type: 'login' | 'logout' | 'update';
  userId: string;
  timestamp: Date;
  payload?: Record<string, unknown>;
}

// 泛型事件发射器实现
class EventEmitter<T> implements Subject<T> {
  private observers: Set<Observer<T>> = new Set();
  protected data: T;
  
  constructor(initialData: T) {
    this.data = initialData;
  }
  
  subscribe(observer: Observer<T>): () => void {
    this.observers.add(observer);
    // 返回取消订阅函数
    return () => this.unsubscribe(observer);
  }
  
  unsubscribe(observer: Observer<T>): void {
    this.observers.delete(observer);
  }
  
  notify(): void {
    this.observers.forEach(observer => observer.update(this.data));
  }
  
  // 更新数据并通知（类似 React useState）
  update(newData: T): void {
    this.data = newData;
    this.notify();
  }
  
  getObserverCount(): number {
    return this.observers.size;
  }
}

// 具体观察者实现
class LoggerObserver implements Observer<UserEvent> {
  update(event: UserEvent): void {
    console.log(`[Logger] ${event.type.toUpperCase()} - 用户 ${event.userId} 在 ${event.timestamp.toISOString()}`);
  }
}

class AnalyticsObserver implements Observer<UserEvent> {
  private events: UserEvent[] = [];
  
  update(event: UserEvent): void {
    this.events.push(event);
    console.log(`[Analytics] 收到事件，已记录 ${this.events.length} 个事件`);
  }
  
  getEvents(): UserEvent[] {
    return this.events;
  }
}

// ==================== 装饰器风格的观察者 ====================
type EventHandler<T> = (data: T) => void;

class TypedEvent<T> {
  private handlers = new Set<EventHandler<T>>();
  
  on(handler: EventHandler<T>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler); // 取消订阅
  }
  
  off(handler: EventHandler<T>): void {
    this.handlers.delete(handler);
  }
  
  emit(data: T): void {
    this.handlers.forEach(handler => handler(data));
  }
  
  get handlerCount(): number {
    return this.handlers.size;
  }
}

// 测试
console.log('=== 泛型观察者模式 ===');
const userEvents = new EventEmitter<UserEvent>({
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
const clickEvent = new TypedEvent<{ x: number; y: number }>();

const unsub1 = clickEvent.on(({ x, y }) => console.log(`[Handler1] 点击坐标: ${x}, ${y}`));
clickEvent.on(({ x, y }) => console.log(`[Handler2] 点击坐标: ${x}, ${y}`));

clickEvent.emit({ x: 100, y: 200 });
unsub1(); // 取消第一个处理器
clickEvent.emit({ x: 300, y: 400 });

export { EventEmitter, TypedEvent, Observer, Subject, UserEvent };
