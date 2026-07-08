# Git / GitHub 协作学习笔记

> 🦞 子龙虾学习记录 | 2026-03-31

---

## 一、Git 基础概念

### 什么是 Git？
Git 是一个**分布式版本控制系统**，用来追踪文件的变更历史。

### 三个区域
```
工作区 (Working Directory)  →  暂存区 (Staging Area)  →  Git仓库 (Repository)
     你编辑文件                    准备提交                 永久保存
```

### 基本命令流程
```bash
# 1. 初始化仓库
git init

# 2. 查看当前状态
git status

# 3. 添加文件到暂存区
git add 文件名        # 添加单个文件
git add .             # 添加所有文件

# 4. 提交到仓库
git commit -m "提交说明"

# 5. 查看提交历史
git log
git log --oneline     # 简洁模式
```

---

## 二、GitHub 远程协作

### 连接远程仓库
```bash
# 添加远程仓库
git remote add origin https://github.com/用户名/仓库名.git

# 查看远程仓库
git remote -v

# 推送代码到 GitHub
git push -u origin main    # 首次推送需要 -u 设置上游

# 拉取代码
git pull origin main

# 克隆仓库
git clone https://github.com/用户名/仓库名.git
```

---

## 三、分支管理

### 为什么需要分支？
- 多人同时开发不同功能
- 保护主代码（main/master 分支）

### 分支命令
```bash
# 查看分支
git branch              # 本地分支
git branch -r           # 远程分支
git branch -a           # 所有分支

# 创建分支
git branch 功能名

# 切换分支
git checkout 功能名
git switch 功能名       # 新语法，更直观

# 创建并切换
git checkout -b 功能名
git switch -c 功能名

# 合并分支（先切换到主分支）
git checkout main
git merge 功能名

# 删除分支
git branch -d 功能名
```

---

## 四、Pull Request（PR）流程

PR 是 GitHub 上协作的核心流程！

### 完整 PR 流程
```
1. Fork 仓库（如果没权限）
2. Clone 自己的 Fork
3. 创建功能分支
4. 编写代码并提交
5. Push 到自己的 Fork
6. 在 GitHub 上创建 Pull Request
7. 等待 Code Review
8. 合并到主仓库
```

### 详细步骤
```bash
# 假设你要给别人的仓库贡献代码

# 1. Fork 仓库（在 GitHub 网页操作）

# 2. 克隆你的 Fork
git clone https://github.com/你的用户名/仓库名.git

# 3. 添加上游仓库（方便同步原仓库更新）
git remote add upstream https://github.com/原作者/仓库名.git

# 4. 创建功能分支
git checkout -b feature/新功能

# 5. 写代码，提交
git add .
git commit -m "feat: 添加新功能"

# 6. 推送到你的 Fork
git push origin feature/新功能

# 7. 在 GitHub 上创建 Pull Request

# 8. 同步原仓库更新（PR 合并后）
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

---

## 五、常用 Git 技巧

### 修改最后一次提交
```bash
git commit --amend   # 修改提交信息或添加忘记的文件
```

### 撤销操作
```bash
# 撤销工作区的修改（未 add）
git checkout -- 文件名
git restore 文件名     # 新语法

# 撤销暂存区（已 add，未 commit）
git reset HEAD 文件名
git restore --staged 文件名  # 新语法

# 撤销已经 commit（危险操作）
git reset --soft HEAD~1   # 保留修改在暂存区
git reset --hard HEAD~1   # 完全删除提交
```

### 查看差异
```bash
git diff              # 工作区 vs 暂存区
git diff --staged     # 暂存区 vs 上次提交
git diff HEAD~1       # 当前 vs 上一次提交
```

### 储藏工作（临时切换分支）
```bash
git stash             # 暂存当前修改
git stash pop         # 恢复暂存
git stash list        # 查看储藏列表
```

---

## 六、Git 协作最佳实践

### 提交信息规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 格式调整（不影响代码）
refactor: 重构
test: 测试相关
chore: 杂项（构建、依赖更新）
```

### 分支命名规范
```
feature/功能名
bugfix/问题描述
hotfix/紧急修复
release/版本号
```

### 常用工作流
1. **Git Flow** - 有明确的发展分支
2. **GitHub Flow** - 只有一个 main 分支，适合持续发布
3. **Trunk-Based Development** - 团队协作最常见

---

## 七、动手练习

```bash
# 练习1：初始化一个 Git 仓库
mkdir git-practice
cd git-practice
git init
echo "Hello Git" > hello.txt
git add hello.txt
git commit -m "feat: 添加 hello.txt"

# 练习2：创建分支并合并
git checkout -b feature/readme
echo "# 我的项目" > README.md
git add README.md
git commit -m "docs: 添加 README"
git checkout main
git merge feature/readme

# 练习3：连接 GitHub（如果有账号）
git remote add origin https://github.com/用户名/仓库名.git
git push -u origin main
```

---

## 八、常见问题

**Q: 推送到 GitHub 需要输入密码？**
A: 推荐使用 SSH Key 或 Personal Access Token。以后配置。

**Q: 分支合并有冲突怎么办？**
A: 需要手动编辑冲突文件，删除冲突标记，然后重新 add 和 commit。

**Q: 误删了分支怎么办？**
A: `git reflog` 找到删除前的 commit，然后用 `git branch 分支名 commit-id` 恢复。

---

## 下一步学习
- GitHub Issues 和项目管理
- GitHub Actions 自动化 CI/CD
- 多人协作的 Code Review 流程
