---
name: 文件整理
description: 文件整理技能，当用户要求合并文件、统计文件、重命名文件、清理文件时使用此技能。适用于整理笔记、代码、文档等场景。
---

# 文件整理技能

## 功能列表

1. **合并Markdown文件** - 把多个md文件合并为一个
2. **统计目录** - 统计文件数量、大小
3. **批量重命名** - 按规则重命名文件
4. **清理重复文件** - 找出并处理重复文件

## 使用方法

### 合并笔记任务

```bash
bash /root/.openclaw/workspace/skills/文件整理/scripts/merge_markdown.sh <源目录> <输出文件>
```

示例：
```bash
bash /root/.openclaw/workspace/skills/文件整理/scripts/merge_markdown.sh /workspace/learning/notes/ /workspace/learning/notes_summary.md
```

### 统计目录任务

```bash
bash /root/.openclaw/workspace/skills/文件整理/scripts/count_files.sh <目录> <文件类型>
```

示例：
```bash
bash /root/.openclaw/workspace/skills/文件整理/scripts/count_files.sh /workspace/learning/notes/ md
```

### 执行流程

1. 接收用户的整理任务
2. 选择对应的脚本
3. 使用exec工具执行脚本
4. 返回执行结果

## 注意事项

- 删除操作需要先确认
- 覆盖文件需要先备份
- 保持原文件的时间戳
