---
name: my-first-skill
description: A demonstration skill showing the SKILL.md format and structure. Use when learning how Skills system works or when testing skill creation.
metadata:
  openclaw:
    emoji: "🎯"
    requires:
      bins: ["echo"]
    install:
      - id: "brew"
        kind: "brew"
        formula: "hello"
        bins: ["hello"]
---

# My First Skill

This is a demonstration skill for learning the OpenClaw Skills system.

## When to use

- Testing Skills functionality
- Learning SKILL.md format
- Understanding skill triggering

## What this skill does

Simply prints a greeting message and demonstrates basic skill structure.

## Example usage

```bash
hello
# Output: Hello, World! from My First Skill!
```

## Core concepts demonstrated

1. **Frontmatter**: YAML metadata at the top
2. **Description**: Determines when skill triggers
3. **Body**: Markdown instructions for the AI
4. **Scripts**: Optional executable code
5. **References**: Optional documentation
