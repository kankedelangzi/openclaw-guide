// ==================== TypeScript 设计模式实战入口 ====================
import { Database } from './singleton';
import { NotificationFactory } from './factory';
import { EventEmitter } from './observer';
import { UserService, UserRepository } from './repository';
import './type-challenges'; // 直接运行类型测试

console.log('🦞 TypeScript 设计模式实战\n');

async function main() {
  // ==================== 单例模式 ====================
  console.log('=== 1. 单例模式 ===');
  const db = Database.getInstance('localhost', 27017);
  db.query('SELECT * FROM users');
  console.log();

  // ==================== 工厂模式 ====================
  console.log('=== 2. 工厂模式 ===');
  const types: Array<'email' | 'sms' | 'push'> = ['email', 'sms', 'push'];
  types.forEach(type => {
    const notifier = NotificationFactory.create(type);
    notifier.send('工厂模式发送测试');
  });
  console.log();

  // ==================== 观察者模式 ====================
  console.log('=== 3. 观察者模式 ===');
  const emitter = new EventEmitter<{ count: number }>({ count: 0 });
  
  emitter.subscribe({
    update: (data) => console.log(`[订阅者A] 收到数据: count = ${data.count}`)
  });
  
  emitter.subscribe({
    update: (data) => console.log(`[订阅者B] 收到数据: count = ${data.count}`)
  });
  
  emitter.update({ count: 1 });
  emitter.update({ count: 2 });
  console.log();

  // ==================== 仓储模式 ====================
  console.log('=== 4. 仓储模式 ===');
  const repo = new UserRepository();
  const service = new UserService(repo);
  
  const user1 = await service.register('大鱼', 'dayu@163.com', 25);
  const user2 = await service.register('小虾', 'xiaoxia@163.com', 17);
  
  console.log(`注册用户: ${user1.name}, ${user2.name}`);
  
  const adults = await service.getAdultUsers();
  console.log(`成年用户 (${adults.length}):`, adults.map(u => u.name).join(', '));
  console.log();

  console.log('✅ 所有设计模式测试完成！');
}

main().catch(console.error);
