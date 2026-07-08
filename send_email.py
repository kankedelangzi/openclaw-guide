#!/usr/bin/env python3
"""
发送邮件报告 - 使用SMTP 465端口（SSL加密）
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
import sys

# 邮箱配置
SMTP_SERVER = "smtp.163.com"
SMTP_PORT = 465
EMAIL = "13220707709@163.com"
PASSWORD = "PWZVn3AQVSKePhGM"
TO_EMAIL = "308035773@qq.com"

def send_report(subject, body, attachment_path=None):
    """发送HTML邮件报告"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL
    msg["To"] = TO_EMAIL
    
    # HTML内容
    html_body = f"""
    <html>
    <head>
    <style>
    body {{ font-family: 'Microsoft YaHei', sans-serif; background: #1a1a2e; color: #eee; line-height: 1.8; padding: 20px; }}
    .container {{ max-width: 800px; margin: 0 auto; }}
    h1 {{ color: #e94560; }}
    h2 {{ color: #0f0f23; background: #16213e; padding: 10px 15px; border-left: 4px solid #e94560; }}
    table {{ width: 100%; border-collapse: collapse; margin: 15px 0; background: #16213e; }}
    th, td {{ padding: 12px 15px; text-align: left; border: 1px solid #0f0f23; }}
    th {{ background: #e94560; color: white; }}
    .highlight {{ background: #2d2d5a; }}
    .success {{ color: #2ecc71; }}
    .note {{ background: #2d2d5a; padding: 10px 15px; border-radius: 5px; margin: 15px 0; }}
    </style>
    </head>
    <body>
    <div class="container">
    {body}
    </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html_body, "html"))
    
    # 添加附件（如果有）
    if attachment_path and os.path.exists(attachment_path):
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename={os.path.basename(attachment_path)}")
            msg.attach(part)
    
    try:
        # 使用SSL连接
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(EMAIL, PASSWORD)
        server.sendmail(EMAIL, [TO_EMAIL], msg.as_string())
        server.quit()
        print(f"✅ 邮件已发送至 {TO_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ 邮件发送失败: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python3 send_email.py <subject> <body_file_or_text> [attachment_path]")
        sys.exit(1)
    
    subject = sys.argv[1]
    body_arg = sys.argv[2]
    attachment = sys.argv[3] if len(sys.argv) > 3 else None
    
    # 如果body_arg是文件路径，读取文件内容
    if os.path.exists(body_arg):
        with open(body_arg, "r", encoding="utf-8") as f:
            body = f.read()
    else:
        body = body_arg
    
    send_report(subject, body, attachment)