#!/bin/bash

# 要安装的技能列表（前50个）
skills=(
  "self-improving-agent"
  "find-skills"
  "summarize"
  "agent-browser"
  "ontology"
  "self-improving-proactive-agent"
  "gog"
  "github"
  "skill-vetter"
  "proactive-agent"
  "weather"
  "admapix"
  "nano-banana-pro"
  "obsidian"
  "baidu-search"
  "nano-pdf"
  "multi-search-engine"
  "humanizer"
  "sonoscli"
  "notion"
  "api-gateway"
  "codeconductor-ai"
  "openai-whisper"
  "auto-updater-skill"
  "free-ride-unlimited-free-ai"
  "agent-browser-clawdbot"
  "mcporter"
  "skill-creator"
  "automation-workflows"
  "video-generator-seedance"
  "brave-search"
  "word-docx"
  "tavily-search"
  "excel-xlsx"
  "stock-analysis"
  "elite-longterm-memory"
  "football-automated-value-betting"
  "humanize-ai-text"
  "youtube-watcher"
  "desktop-control"
  "imap-smtp-email"
  "byterover"
  "clawdbot-documentation-expert"
  "himalaya"
  "video-frames"
  "slack"
  "molt-speak"
  "browser-use"
  "trello"
  "news-summary"
)

success_count=0
failed_count=0
skipped_count=0
success_list=()
failed_list=()
skipped_list=()

echo "开始批量安装技能..."
echo "========================"

for skill in "${skills[@]}"; do
  echo ""
  echo "[$((success_count + failed_count + skipped_count + 1))/50] 正在安装: $skill"
  
  output=$(skillhub install "$skill" 2>&1)
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    if echo "$output" | grep -q "already installed\|已安装"; then
      echo "  → 已安装，跳过"
      skipped_list+=("$skill")
      ((skipped_count++))
    else
      echo "  ✓ 安装成功"
      success_list+=("$skill")
      ((success_count++))
    fi
  else
    echo "  ✗ 安装失败"
    echo "    错误: $output"
    failed_list+=("$skill: $output")
    ((failed_count++))
  fi
done

echo ""
echo "========================"
echo "安装完成！"
echo "成功: $success_count"
echo "失败: $failed_count"
echo "跳过(已安装): $skipped_count"
echo ""

# 输出结果到文件
{
  echo "# SkillHub 批量安装结果"
  echo ""
  echo "## 统计"
  echo "- 成功安装: $success_count 个"
  echo "- 安装失败: $failed_count 个"
  echo "- 跳过(已安装): $skipped_count 个"
  echo "- 总计: 50 个"
  echo ""
  echo "## 成功安装的技能"
  for skill in "${success_list[@]}"; do
    echo "- $skill"
  done
  echo ""
  echo "## 安装失败的技能"
  for item in "${failed_list[@]}"; do
    echo "- $item"
  done
  echo ""
  echo "## 已安装跳过的技能"
  for skill in "${skipped_list[@]}"; do
    echo "- $skill"
  done
} > /root/.openclaw/workspace/skillhub-install-results.md

echo "结果已保存到 /root/.openclaw/workspace/skillhub-install-results.md"
