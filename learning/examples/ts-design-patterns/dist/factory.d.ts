interface Notification {
    send(message: string): boolean;
    readonly type: string;
}
type NotificationType = 'email' | 'sms' | 'push';
declare class NotificationFactory {
    static create(type: NotificationType): Notification;
    static createAll(): Notification[];
}
interface Button {
    render(): string;
}
interface Input {
    render(): string;
}
interface UIFactory {
    createButton(): Button;
    createInput(): Input;
}
declare class WindowsFactory implements UIFactory {
    createButton(): Button;
    createInput(): Input;
}
declare class MacFactory implements UIFactory {
    createButton(): Button;
    createInput(): Input;
}
export { Notification, NotificationFactory, UIFactory, WindowsFactory, MacFactory };
//# sourceMappingURL=factory.d.ts.map