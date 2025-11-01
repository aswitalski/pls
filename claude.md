# please-ask-ai

## Project Vision

A command line tool similar to Claude Code that allows users to run natural language commands prefixed with "pls" (meaning "Please do something"). The tool interprets developer tasks and automates complex workflows.

## Core Concept

Users can issue commands in natural English like:
```bash
pls build fresh GX
pls create branch for OAI-XXYYY task
pls tell me how many days left in a year
```

The CLI should:
1. Determine the type of action
2. Identify steps needed
3. Show a plan for user confirmation
4. Execute with progress tracking
5. Handle errors intelligently

## Technology Stack

- **Language**: TypeScript (ES2024)
- **Runtime**: Node.js 18+ with tsx
- **UI Framework**: React + Ink (terminal UI like Claude Code)
- **AI Model**: Phi-3.5 Mini (3.8B) via Ollama
- **Package Manager**: npm
- **Package Name**: please-ask-ai

## Configuration System

### Config File Structure

Configuration stored in `~/.pls/` directory:
- `default.json` - Default configuration
- `dev.json`, `private.json`, etc. - Environment-specific configs
- Users can switch configs with: `pls use private config`

### Config Schema

```json
{
  "import": ["private.json", "fun.json"],
  "projects": [
    {
      "name": "gx",
      "type": "browser",
      "directory": "/some/path",
      "supports": ["build", "test", "deploy"]
    }
  ],
  "actions": [
    {
      "name": "build",
      "aliases": ["build", "run build", "compile"],
      "command": "ninja -j 32 -C ./chromium/src/out/Release opera",
      "params": {}
    }
  ]
}
```

## Example Workflows

### "Build fresh GX"

Steps the tool should execute:
1. Go to GX project folder
2. Check current branch
3. Check for uncommitted changes
4. If changes exist, suggest commit or stash
5. Once git status is clean, checkout master branch
6. Pull latest changes
7. Checkout defined subrepositories
8. Generate the project
9. Run build command
10. Notify on build error or completion

### "Create branch for OAI-XXYYY task"

1. Check REST API for task title and description
2. Suggest actions based on task details
3. Allow user to select actions
4. Hand off to Claude Code with context
5. Claude Code analyzes project (based on claude.md)
6. Suggests development plan
7. Continues normal flow

## Multiple Commands

The CLI should accept multiple commands:
```bash
pls build fresh GX, create branch for OAI-XXYYY task
```

It should:
- Perform each action sequentially or in parallel (where safe)
- Show suggestions as checkboxes for user confirmation
- Allow users to tick/untick actions before execution

## User Interface

### Interactive Elements

- **Navigation**: Arrow keys (up/down) to navigate options
- **Selection**: Checkboxes for multi-select
- **Progress Display**: Bullet points with faded text for completed tasks
- **Plan Confirmation**: Show numbered options (1. 2. 3.) before execution

### Progress Tracking

```
✓ Checked current branch (master)
✓ Verified no uncommitted changes
→ Pulling latest changes...
  Building project...
  Running tests...
```

Completed tasks should appear in faded/dimmed text.

## AI Integration

### Local Model: Phi-3.5 Mini

- **Model**: phi3.5:3.8b via Ollama
- **Size**: ~2.3GB (4-bit quantized)
- **Purpose**: Understand commands and map to predefined actions
- **Fallback**: Use regex/pattern matching for simple commands

### Command Understanding

The LLM should:
1. Parse natural language input
2. Map to defined actions in config
3. Identify required parameters
4. Ask for clarification when ambiguous

### Ambiguity Handling

When the command is unclear:
- Show what was understood
- Present sub-bullet points for clarification
- Examples:
  - ✓ First command understood
  - ? Not sure about second command (show options)
  - ✗ Third command not recognized (ask for input)

## Claude Code Integration

### Handoff Process

When a task requires code development:
1. `pls` prepares context and plan
2. Passes data to Claude Code via stdin/API
3. Claude Code receives:
   - Task description
   - Project context (from claude.md)
   - Suggested plan
4. Claude Code analyzes and continues development

### Context Passing

The tool should pass:
- Task details from REST API (if applicable)
- Current git state
- Project configuration
- User selections/preferences

## Background Execution

The tool should:
- Run long commands in background
- Stream output in real-time
- Interpret errors intelligently
- Notify on completion or failure

## Development Setup

### Installation

```bash
npm install        # Install dependencies
npm run dev        # Creates global symlink (npm link)
pls tell me <q>    # Now works globally
```

### Version Detection

When running:
- From symlink (dev): Shows "(dev)"
- From installed package: Shows "v0.0.1"

## Current Implementation Status

### ✓ Phase 1 - Basic "pls tell me" (COMPLETE)

- ✓ Project structure with TypeScript + React/Ink
- ✓ Basic LLM integration with Ollama
- ✓ Simple Q&A interface
- ✓ Version detection (dev vs production)

### 🔄 Phase 2 - Config System (NEXT)

- [ ] Load config from ~/.pls/default.json
- [ ] Support config imports
- [ ] Project and action definitions
- [ ] Config switching (`pls use <config>`)

### 📋 Phase 3 - Workflow Engine

- [ ] Action execution from config
- [ ] Git workflow automation
- [ ] Progress tracking UI
- [ ] Background command execution
- [ ] Error interpretation

### 🎯 Phase 4 - Advanced Features

- [ ] Multiple command parsing
- [ ] Interactive plan confirmation
- [ ] REST API integration
- [ ] Claude Code handoff
- [ ] Workflow plugins

## Git Workflows

Common git operations the tool should handle:
- Branch management (create, switch, delete)
- Commit automation with smart messages
- Cherry-picking between repositories
- Stash management
- Submodule updates
- Backporting to stable channels

## Browser Build Workflows

Specific to browser development:
- Build on master branch for different browsers
- Backport/cherry-pick changes between repos
- Handle stable channels in different repositories
- Take changes from filesystem or remote repository

## Error Handling

The tool should intelligently handle:
- Git errors (merge conflicts, dirty working tree)
- Build errors (compile failures, missing dependencies)
- Network errors (failed pulls, API unavailable)
- Config errors (missing projects, invalid actions)
- Ollama errors (model not found, service not running)

## Future Extensibility

Design considerations:
- Plugin system for custom actions
- Workflow templates
- Team sharing of configs
- Action history and replay
- Performance metrics and insights

## Publishing

- **Package name**: please-ask-ai
- **npm registry**: Public
- **Open source**: MIT License
- **Repository**: https://github.com/aswitalski/pls

---

**Note**: This is a living document. As the project evolves, update this file to reflect new features, architectural decisions, and usage patterns.
