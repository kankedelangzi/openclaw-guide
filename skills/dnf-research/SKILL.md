# 游戏伤害研究技能

## ⚠️ 版本锁定
- DNF：只研究 70版本末期
- 向僵尸开炮：当前版本机制

## 🎯 当前聚焦：剑魂 + 狂战士

**研究目标：**
- 狂战士：固伤流代表，暴走/出血/异界套装加成
- 剑魂：百分比流代表，武器精通/破极兵刃/异界套装加成

## 📚 知识库（按需加载）

| 文件 | 内容 |
|------|------|
| `INDEX.md` | 任务优先级 + 文件列表 |
| `FORMULA.md` | 70版本伤害公式 |
| `BONUS.md` | 加成系统总览（参考） |
| `BERSERKER.md` | 狂战士知识库 |
| `ASHURA.md` | 阿修罗知识库（参考） |

## 🔄 加载规则

1. **每次运行只加载 INDEX.md + 当前任务相关的小文件**
2. 任务完成后，将新知识更新到对应小文件
3. 当某个小文件超过 5KB 时，压缩/归档旧内容

## 📁 工作目录
- 本地：`/root/.openclaw/workspace/game-damage-research`
- GitHub：`git@github.com:kankedelangzi/game.git`

## 输出要求
- 格式：`.html` 文件，深色主题（`#1a1a2e` 背景，`#e94560` 高亮）
- 每次只深化一个章节

## 完成后执行
```bash
cd /root/.openclaw/workspace/game-damage-research && git add notes/ && git commit -m "feat: 70版本深化" && git push origin main
```

## 邮件汇报
发送纯文本到 `308035773@qq.com`，主题：`游戏伤害研究进度汇报 - 70版本深化`

SMTP：`smtp.163.com:465`，账号 `13220707709@163.com`，密码 `PWZVn3AQVSKePhGM`