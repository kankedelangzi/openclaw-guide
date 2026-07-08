#!/bin/bash
# 统计目录下的文件数量

SOURCE_DIR="${1}"
FILE_TYPE="${2:-md}"

if [ -z "$SOURCE_DIR" ]; then
    echo "用法: bash count_files.sh <目录> [文件类型]"
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "错误: 目录不存在: $SOURCE_DIR"
    exit 1
fi

count=$(find "$SOURCE_DIR" -maxdepth 1 -type f -name "*.$FILE_TYPE" | wc -l)
total_size=$(find "$SOURCE_DIR" -maxdepth 1 -type f -name "*.$FILE_TYPE" -exec du -b {} + | awk '{sum+=$1} END {print sum}')

echo "目录: $SOURCE_DIR"
echo "文件类型: *.$FILE_TYPE"
echo "文件数量: $count"
echo "总大小: $total_size bytes ($(echo "scale=2; $total_size/1024" | bc) KB)"
