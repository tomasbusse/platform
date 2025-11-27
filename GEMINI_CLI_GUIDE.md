# Gemini CLI - Usage Guide for VS Code

## ✅ Installation Complete!
Gemini CLI (v0.17.1) is now installed and configured on your system with **Gemini 2.5 Pro** (the latest and most advanced model available).

## 🚀 Using Gemini CLI in VS Code

### 1. **Open Integrated Terminal in VS Code**
- Press `` Ctrl+` `` (or `Cmd+` on Mac)
- Or: Terminal → New Terminal from the menu

### 2. **Basic Commands**

#### Interactive Mode (Most Common)
```bash
gemini
```
This launches an interactive session where you can chat with Gemini AI about your code.

#### Ask a Single Question
```bash
gemini "How do I optimize this React component?"
```

#### Ask and Continue Interacting
```bash
gemini -i "Review my code and suggest improvements"
```

#### Work with Files
```bash
gemini "Explain what this file does" < src/App.tsx
```

### 3. **Useful Options**

- **Auto-approve edits**: `gemini --approval-mode auto_edit`
- **Choose a model**: `gemini --model gemini-pro`
- **Resume previous session**: `gemini --resume latest`
- **List all sessions**: `gemini --list-sessions`
- **YOLO mode** (auto-approve everything): `gemini --yolo`

### 4. **Common Use Cases**

#### Debug Code
```bash
gemini "Help me debug this error: [paste error]"
```

#### Generate Code
```bash
gemini "Create a React component for a user profile card"
```

#### Refactor Code
```bash
gemini "Refactor this function to be more efficient" < myfile.ts
```

#### Code Review
```bash
gemini "Review this file for best practices and suggest improvements" < src/components/LoginForm.tsx
```

### 5. **VS Code Integration Tips**

1. **Terminal Shortcuts**: Set up keyboard shortcuts in VS Code to quickly open terminal
2. **Multiple Terminals**: You can run Gemini CLI in one terminal while keeping your dev server in another
3. **Session Management**: Use `--resume` to continue previous conversations
4. **Extensions**: Gemini CLI also supports MCP servers - run `gemini mcp` to manage them

### 6. **Environment Configuration**

Your API key is now stored in:
- **Environment variable**: `GEMINI_API_KEY` (in ~/.zshrc)
- **Settings file**: `~/.gemini/settings.json`

To reload the environment in a new terminal:
```bash
source ~/.zshrc
```

### 7. **Advanced Features**

#### Manage Extensions
```bash
gemini extensions list
```

#### Sandbox Mode (Safe Testing)
```bash
gemini --sandbox
```

#### JSON Output (for scripting)
```bash
gemini --output-format json "What is React?"
```

## 📚 Resources

- Official Docs: https://geminicli.com/docs
- Get Help: `gemini --help`
- Version: `gemini --version`

## 🎯 Quick Start Examples

Try these commands in your VS Code terminal:

```bash
# Start interactive session
gemini

# Ask about your project
export GEMINI_API_KEY="AIzaSyCyna7BzoOcd61rUmPViJKJbMTtHsEaSwk" && gemini "Analyze my project structure"

# Get help with a specific file
export GEMINI_API_KEY="AIzaSyCyna7BzoOcd61rUmPViJKJbMTtHsEaSwk" && gemini "Explain what this file does" < src/App.tsx
```

---

**Note**: After installing, you may need to restart VS Code or open a new terminal for the environment variables to be fully loaded.
