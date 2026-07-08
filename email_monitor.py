#!/usr/bin/env python3
"""
163邮箱监控脚本 - 子龙虾 🦞
每10分钟检查一次新邮件，有新邮件则通知大鱼
"""

import imaplib
import email
from email.header import decode_header
import time
import json
import os
import sys

# 邮箱配置
EMAIL = "13220707709@163.com"
PASSWORD = "PWZVn3AQVSKePhGM"
IMAP_SERVER = "imap.163.com"
IMAP_PORT = 993

# 状态文件
STATE_FILE = "/root/.openclaw/workspace/email_monitor_state.json"

def decode_str(s):
    """解码邮件字符串"""
    if s is None:
        return ""
    decoded_parts = decode_header(s)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            charset = charset or 'utf-8'
            try:
                result.append(part.decode(charset, errors='replace'))
            except:
                result.append(part.decode('utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)

def get_email_date(msg):
    """获取邮件日期"""
    date_str = msg.get('Date', '')
    return date_str

def format_email_info(msg, num):
    """格式化邮件信息"""
    subject = decode_str(msg.get('Subject', '(无主题)'))
    sender = decode_str(msg.get('From', '未知'))
    date = get_email_date(msg)
    return f"{num}. 【{subject}】来自 {sender} - {date}"

def load_state():
    """加载上次检查状态"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"last_seen_ids": []}

def save_state(state):
    """保存状态"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def check_and_notify():
    """检查邮件并通知"""
    try:
        # 连接邮箱
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(EMAIL, PASSWORD)
        mail.select("INBOX")

        # 搜索未读邮件
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 搜索失败")
            mail.logout()
            return False

        unread_ids = messages[0].split()
        total_unread = len(unread_ids)
        
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 检查到 {total_unread} 封未读邮件")

        if total_unread == 0:
            mail.logout()
            return False

        # 加载状态
        state = load_state()
        last_seen = set(state.get("last_seen_ids", []))

        # 获取最新5封的详情
        new_emails = []
        check_ids = unread_ids[-5:] if len(unread_ids) > 5 else unread_ids
        
        for uid in check_ids:
            uid_str = uid.decode()
            if uid_str in last_seen:
                continue
            
            # 获取邮件详情
            status, msg_data = mail.fetch(uid, "(RFC822)")
            if status != "OK":
                continue
            
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            new_emails.append(msg)

        mail.logout()

        # 如果有新邮件，发送通知
        if new_emails:
            # 更新已见ID（只保留最新的5个）
            all_new_ids = [uid.decode() for uid in check_ids]
            state["last_seen_ids"] = all_new_ids
            save_state(state)

            # 构造通知
            notification = f"📧 你有 {total_unread} 封新邮件！\n\n"
            for i, msg in enumerate(new_emails, 1):
                notification += format_email_info(msg, i) + "\n"
            
            if total_unread > 5:
                notification += f"\n...还有 {total_unread - 5} 封更早的邮件未显示"
            
            print(f"发送通知给大鱼:\n{notification}")
            return notification
        
        return None

    except Exception as e:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 错误: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("=" * 50)
    print("🦞 子龙虾邮件监控助手启动！")
    print(f"📧 监控邮箱: {EMAIL}")
    print(f"⏰ 检查间隔: 10分钟")
    print("=" * 50)
    
    while True:
        notification = check_and_notify()
        if notification:
            # 打印通知内容（由主agent发送）
            print(f"\n{'='*40}")
            print("需要发送通知:")
            print(notification)
            print(f"{'='*40}\n")
        
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 等待10分钟后继续...")
        time.sleep(600)  # 10分钟

if __name__ == "__main__":
    main()
