// ==================== 工厂模式 ====================
// 定义创建对象的接口，让子类决定实例化哪个类

// 产品接口
interface Notification {
  send(message: string): boolean;
  readonly type: string;
}

// 具体产品
class EmailNotification implements Notification {
  readonly type = 'email';
  
  send(message: string): boolean {
    console.log(`[Email] 📧 发送邮件: ${message}`);
    return true;
  }
}

class SMSNotification implements Notification {
  readonly type = 'sms';
  
  send(message: string): boolean {
    console.log(`[SMS] 📱 发送短信: ${message}`);
    return true;
  }
}

class PushNotification implements Notification {
  readonly type = 'push';
  
  send(message: string): boolean {
    console.log(`[Push] 🔔 发送推送: ${message}`);
    return true;
  }
}

// 泛型工厂
type NotificationType = 'email' | 'sms' | 'push';

class NotificationFactory {
  // 简单工厂
  static create(type: NotificationType): Notification {
    switch (type) {
      case 'email': return new EmailNotification();
      case 'sms': return new SMSNotification();
      case 'push': return new PushNotification();
      default:
        throw new Error(`未知通知类型: ${type}`);
    }
  }
  
  // 工厂方法（支持依赖注入）
  static createAll(): Notification[] {
    return [
      new EmailNotification(),
      new SMSNotification(),
      new PushNotification()
    ];
  }
}

// ==================== 抽象工厂 ====================
interface Button {
  render(): string;
}

interface Input {
  render(): string;
}

// Windows 风格
class WindowsButton implements Button {
  render(): string { return '[ Windows Button ]'; }
}

class WindowsInput implements Input {
  render(): string { return '< Windows Input />'; }
}

// Mac 风格
class MacButton implements Button {
  render(): string { return '[ Mac Button ]'; }
}

class MacInput implements Input {
  render(): string { return '< Mac Input />'; }
}

// 抽象工厂
interface UIFactory {
  createButton(): Button;
  createInput(): Input;
}

class WindowsFactory implements UIFactory {
  createButton(): Button { return new WindowsButton(); }
  createInput(): Input { return new WindowsInput(); }
}

class MacFactory implements UIFactory {
  createButton(): Button { return new MacButton(); }
  createInput(): Input { return new MacInput(); }
}

// 客户端代码
function renderUI(factory: UIFactory) {
  console.log(factory.createButton().render());
  console.log(factory.createInput().render());
}

// 测试
console.log('=== 简单工厂 ===');
const email = NotificationFactory.create('email');
email.send('工厂模式测试');

console.log('\n=== 抽象工厂 ===');
renderUI(new WindowsFactory());
renderUI(new MacFactory());

export { Notification, NotificationFactory, UIFactory, WindowsFactory, MacFactory };
