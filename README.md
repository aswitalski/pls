# pls

Your personal command-line concierge. Ask politely, and it gets things done.

## Installation

```bash
npm install -g prompt-language-shell
```

## Setup

Before using `pls`, you need to configure your Claude API key:

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Create the configuration directory and file:

```bash
mkdir -p ~/.pls
echo "CLAUDE_API_KEY=sk-ant-your-api-key-here" > ~/.pls/.env
```

Replace `sk-ant-your-api-key-here` with your actual API key.

## Usage

Simply type `pls` followed by your request in natural language:

```bash
pls change dir to ~
```

The tool will:

- Display your original command
- Process it to grammatically correct and clarify it
- Show the interpreted task

Example output:

```
> pls change dir to ~
  - change directory to the home folder
```

You can provide multiple tasks separated by commas (`,`), semicolons (`;`), or the word "and":

```bash
pls install deps, run tests and deploy
```

Example output:

```
> pls install deps, run tests and deploy
  - install dependencies
  - run tests
  - deploy to server
```

Run `pls` without arguments to see the welcome screen.

## Configuration

Configuration is stored in `~/.pls/.env`. Currently supported:

- `CLAUDE_API_KEY` - Your Anthropic API key (required)

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture.
