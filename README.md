# please-ask-ai

> Ask your computer politely to perform actions on your behalf.

A command-line tool that understands natural language and executes tasks intelligently. Whether you're a developer automating workflows or anyone looking to streamline repetitive tasks, `pls` makes it easy.

## Features

- **Natural Language**: Communicate with your computer in plain English
- **AI-Powered**: Uses local AI models for privacy and speed
- **Configurable**: Define custom actions and workflows
- **Interactive**: Beautiful terminal UI with progress tracking
- **Extensible**: Plugin system for custom automations

## Quick Start

### Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Ollama** - [Download here](https://ollama.ai/)
3. **Phi-3.5 model** - Install with: `ollama pull phi3.5:3.8b`

### Installation

```bash
# Install from npm (when published)
npm install -g please-ask-ai

# Or install from source for development
git clone https://github.com/aswitalski/pls.git
cd pls
npm install
npm run dev  # Creates global symlink
```

### First Command

```bash
pls tell me how many days left in a year
```

## Usage

### Basic Questions

Ask your computer anything:

```bash
pls tell me <your question>
```

Examples:
```bash
pls tell me how much money I earn daily at $100 hourly rate
pls tell me what is the current time in Tokyo
pls tell me how to reverse a string in Python
```

### Future Capabilities

The tool is designed to handle complex workflows like:

```bash
# Developer workflows
pls build fresh project
pls create branch for feature-xyz
pls run tests and commit changes

# General automation
pls organize my downloads folder
pls backup important files
pls check system status
```

## Configuration

Create `~/.pls/default.json` to define custom projects and actions:

```json
{
  "projects": [
    {
      "name": "my-app",
      "directory": "/path/to/project",
      "type": "web",
      "supports": ["build", "test", "deploy"]
    }
  ],
  "actions": [
    {
      "name": "build",
      "aliases": ["build", "compile"],
      "command": "npm run build",
      "params": {}
    }
  ]
}
```

### Multiple Configurations

Create environment-specific configs:

```bash
# Switch configurations
pls use dev config
pls use private config
```

Files: `~/.pls/dev.json`, `~/.pls/private.json`, etc.

## How It Works

1. You type a command in natural language
2. Local AI model (Phi-3.5 Mini) interprets your intent
3. Matches command to configured actions
4. Shows you a plan and asks for confirmation
5. Executes with real-time progress tracking
6. Intelligently handles errors and provides feedback

## Privacy & Performance

- **100% Local**: AI runs on your machine via Ollama
- **No Cloud**: Your data never leaves your computer
- **Fast**: Small model (2.3GB) optimized for speed
- **Offline**: Works without internet connection

## Development

```bash
# Install dependencies
npm install

# Link for global development
npm run dev

# Build TypeScript
npm run build

# Unlink
npm run unlink
```

## Roadmap

- [x] Basic Q&A with local AI
- [ ] Config system for custom workflows
- [ ] Interactive plan confirmation
- [ ] Background task execution
- [ ] Git workflow automation
- [ ] REST API integration
- [ ] Plugin system
- [ ] Team config sharing

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

## License

MIT License - see LICENSE file for details.

## Support

- Issues: [GitHub Issues](https://github.com/aswitalski/pls/issues)
- Documentation: [Wiki](https://github.com/aswitalski/pls/wiki)
- Community: [Discussions](https://github.com/aswitalski/pls/discussions)

---

**Note**: This is an early version. With proper configuration, this tool can be adapted to automate virtually any command-line workflow, not just development tasks.
