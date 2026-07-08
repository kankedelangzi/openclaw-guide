"use strict";
// ==================== 工厂模式 ====================
// 定义创建对象的接口，让子类决定实例化哪个类
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacFactory = exports.WindowsFactory = exports.NotificationFactory = void 0;
// 具体产品
class EmailNotification {
    constructor() {
        this.type = 'email';
    }
    send(message) {
        console.log(`[Email] 📧 发送邮件: ${message}`);
        return true;
    }
}
class SMSNotification {
    constructor() {
        this.type = 'sms';
    }
    send(message) {
        console.log(`[SMS] 📱 发送短信: ${message}`);
        return true;
    }
}
class PushNotification {
    constructor() {
        this.type = 'push';
    }
    send(message) {
        console.log(`[Push] 🔔 发送推送: ${message}`);
        return true;
    }
}
class NotificationFactory {
    // 简单工厂
    static create(type) {
        switch (type) {
            case 'email': return new EmailNotification();
            case 'sms': return new SMSNotification();
            case 'push': return new PushNotification();
            default:
                throw new Error(`未知通知类型: ${type}`);
        }
    }
    // 工厂方法（支持依赖注入）
    static createAll() {
        return [
            new EmailNotification(),
            new SMSNotification(),
            new PushNotification()
        ];
    }
}
exports.NotificationFactory = NotificationFactory;
// Windows 风格
class WindowsButton {
    render() { return '[ Windows Button ]'; }
}
class WindowsInput {
    render() { return '< Windows Input />'; }
}
// Mac 风格
class MacButton {
    render() { return '[ Mac Button ]'; }
}
class MacInput {
    render() { return '< Mac Input />'; }
}
class WindowsFactory {
    createButton() { return new WindowsButton(); }
    createInput() { return new WindowsInput(); }
}
exports.WindowsFactory = WindowsFactory;
class MacFactory {
    createButton() { return new MacButton(); }
    createInput() { return new MacInput(); }
}
exports.MacFactory = MacFactory;
// 客户端代码
function renderUI(factory) {
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
//# sourceMappingURL=factory.js.map