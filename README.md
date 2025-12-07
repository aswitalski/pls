# pls

Your personal command-line concierge. Ask politely, and it gets things done.

> **Note:** This project is in early preview. Features and APIs will change.
> See [roadmap](#roadmap).

## Installation

```bash
npm install -g prompt-language-shell
```

## Setup

On first run, `pls` walks you through a quick setup.
Your settings will be saved to `~/.plsrc`.

## Usage

Type `pls` followed by your request in natural language.

To see what `pls` can do, start by listing available capabilities:

```
$ pls list skills

Here's what I can help with:

  - Introspect - list available capabilities and skills
  - Config - manage and configure system settings
  - Answer - respond to questions and provide information
  - Execute - run shell commands and process operations
  ```

Skills are custom workflows you can define to teach `pls` about your specific
projects and commands. Once defined, you can use them naturally:

```
$ pls build project

Here's my plan.

  - Navigate to project directory
  - Compile source code
```

You can provide multiple requests at once:

```
$ pls install deps, run tests and build

Here's what I'll do.

  - Install dependencies
  - Run tests
  - Build the project
```

When `pls` needs clarification, it will present options to choose from:

```
$ pls deploy

Let me clarify.

  → Choose which environment to deploy to:
    - Deploy to staging
    - Deploy to production
```

Run `pls` without arguments to see the welcome screen.

## How It Works

When you make a request, `pls` interprets your intent and creates a structured
plan breaking down the work into individual tasks. You'll see this plan
displayed in your terminal before anything executes.

After reviewing the plan, you can confirm to proceed or cancel if something
doesn't look right. Once confirmed, `pls` executes each task sequentially and
shows real-time progress and results.

If you've defined custom skills, `pls` uses them to understand your
project-specific workflows and translate high-level requests into the exact
commands your environment requires.

## Configuration

Your configuration is stored in `~/.plsrc` as a YAML file. Supported settings:

- `anthropic.key` - Your API key
- `anthropic.model` - The model to use

## Skills

Skills let you teach `pls` about your project-specific workflows. Create
markdown files in `~/.pls/skills/` to define custom operations that `pls` can
understand and execute.

For complete documentation, see [docs/SKILLS.md](./docs/SKILLS.md).

### Structure

Each skill file uses a simple markdown format:

- **Name**: What you call this workflow (e.g., "Build Project")
- **Description**: What it does and any variants or options
- **Steps**: What needs to happen, in order
- **Execution** (optional): The actual shell commands to run

### Example

Here's a skill that builds different project variants:

```markdown
### Name
Build Project

### Description
Build a project in different configurations:
- dev (debug build with source maps)
- prod (optimized build)
- test (with test coverage)

### Steps
- Navigate to the project directory
- Install dependencies if needed
- Run the {ENV} build script
- Generate build artifacts

### Execution
- cd ~/projects/next
- npm install
- npm run build:{ENV}
- cp -r dist/ builds/{ENV}/
```

With this skill defined, you can use natural language like:
```
$ pls build project for production
$ pls build dev environment
$ pls build with testing enabled
```
The `{ENV}` placeholder gets replaced with the variant you specify.
Instead of remembering the exact commands and paths for each environment, just
tell `pls` what you want in plain English. The Execution section ensures the right commands run every time.

### Keep It Short

Skills also work with concise commands. Once you've taught `pls` about your
workflow, you can use minimal phrasing:

```
$ pls build prod
$ pls build dev
$ pls build test
```

## Roadmap

- **0.7** - Comprehend skill, simplified prompts, better debugging
- **0.8** - Sequential and interlaced skill execution
- **0.9** - Learn skill, codebase refinement, complex dependency handling
- **1.0** - Production release

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture.
