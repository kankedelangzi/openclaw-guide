#!/bin/bash
# 合并指定目录下的所有markdown文件

SOURCE_DIR="${1}"
OUTPUT_FILE="${2}"

if [ -z "$SOURCE_DIR" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "用法: bash merge_markdown.sh <源目录> <输出文件>"
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "错误: 目录不存在: $SOURCE_DIR"
    exit 1
fi

# 清空或创建输出文件
> "$OUTPUT_FILE"

# 遍历目录下的md文件
count=0
for file in "$SOURCE_DIR"/*.md; do
    if [ -f "$file" ]; then
        echo "===== $(basename "$file") =====" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo -e "\n\n" >> "$OUTPUT_FILE"
        count=$((count + 1))
    fi
done

echo "完成: 合并了 $count 个文件 -> $OUTPUT_FILE"
