# pls

Your personal command-line concierge. Ask politely, and it gets things done.

## Installation

```bash
npm install -g prompt-language-shell
```

## Setup

On first run, `pls` walks you through a quick setup. Your settings will be saved to `~/.plsrc`.

## Usage

Type `pls` followed by your request in natural language:

```bash
pls change dir to ~
```

Your command will be interpreted and organized into a list of tasks:

```
> pls change dir to ~
  - Change directory to the home folder
```

You can provide multiple requests at once:

```
> pls install deps, run tests and deploy
  - Install dependencies
  - Run tests
  - Deploy to server
```

Run `pls` without arguments to see the welcome screen.

## Configuration

Your configuration is stored in `~/.plsrc` as a YAML file. Supported settings:

- `anthropic.key` - Your API key
- `anthropic.model` - The model to use

## Skills

You can extend `pls` with custom workflows by creating markdown files in `~/.pls/skills/`. Skills define domain-specific operations, parameters, and steps that guide both planning and execution of tasks.

Your skills are referenced when planning requests, enabling `pls` to understand specific workflows, create and execute structured plans tailored to your environment.

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture.
