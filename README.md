# pls

Your personal command-line concierge. Ask politely, and it gets things done.

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
  - Configure - manage and configure system settings
  - Answer - respond to questions and provide information
  - Execute - run shell commands and process operations
```

Skills are custom workflows you can define to teach `pls` about your specific
projects and commands. Once defined, you can use them naturally:

```
$ pls convert video.mp4

Here's my plan.

  - Compress video.mp4 with H.264 codec
```

You can provide multiple requests at once:

```
$ pls backup photos, compress and upload

Here's what I'll do.

  - Copy photos to backup folder
  - Create zip archive
  - Upload to cloud storage
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
plan breaking down the work into individual tasks. You'll see this schedule
displayed in your terminal before anything executes.

After reviewing the schedule, you can confirm to proceed or cancel if something
doesn't look right. Once confirmed, `pls` executes each task sequentially and
shows real-time progress and results.

If you've defined custom skills, `pls` uses them to understand your
project-specific workflows and translate high-level requests into the exact
commands your environment requires.

## Configuration

Your configuration is stored in `~/.plsrc` as a YAML file:

```yaml
# Mandatory
anthropic:
  key: sk-ant-...
  model: claude-...

# Optional
settings:
  memory: 1024 # Child process memory limit (MB)
  debug: none # none | info | verbose

# Custom
project:
  path: ~/projects/app
```

Skills can define their own configuration properties via a `Config` section. When
a skill requires config values that don't exist, `pls` prompts you to provide
them before execution. See [Skills](#skills) for details.

## Reference

### Debug Mode
Press `Shift+Tab` during execution to cycle through debug levels
(none → info → verbose).
Logs are saved to `~/.pls/logs/` when debug is `info` or `verbose`.

### Data Locations
```
~/.plsrc              # Configuration
~/.pls/skills/        # Custom skills
~/.pls/logs/          # Debug logs
```

## Skills

Skills let you teach `pls` about your project-specific workflows. Create
markdown files in `~/.pls/skills/` to define custom operations that
`pls` can understand and execute.

### Creating Skills

The easiest way to create a new skill is with the guided walkthrough:

```
$ pls learn

Creating a new skill...

Skill name (e.g., "Deploy Project"):
> Build Frontend

Description (min 20 characters):
> Build the frontend application using npm

Step 1 - What does this step do?
> Install dependencies

How should this step be executed?
> shell command

Enter the shell command:
> npm install

Add another step?
> yes

...
```

The walkthrough guides you through defining:
- **Name**: A unique name for the skill
- **Description**: What the skill does (min 20 characters)
- **Aliases**: Example commands that invoke the skill (optional)
- **Config**: Configuration properties needed (optional)
- **Steps**: Each step with either a shell command or reference to another skill

Skills are saved to `~/.pls/skills/` as markdown files. File names use
kebab-case (e.g., "Build Frontend" becomes `build-frontend.md`).

For complete documentation, see [docs/SKILLS.md](./docs/SKILLS.md).

### Structure

Each skill file uses a simple markdown format:

- **Name**: What you call this workflow (e.g., "Build Project")
- **Description**: What it does and any variants or options
- **Steps**: What needs to happen, in order
- **Execution**: The actual shell commands to run

### Example

Here's a skill for building a product from source:

```markdown
### Name
Build Product

### Description
Build a product from source. Handles the full compilation pipeline.

The company maintains two product lines:
- Stable: the flagship product
- Beta: the experimental product

If the user says "just compile" or "recompile", dependency installation and
tests MUST be skipped. Tests MUST also be skipped if the user says "without
tests". Deployment MUST only run if the user explicitly asks. Compile and
package steps are MANDATORY.

### Steps
- Navigate to the project directory
- Install build dependencies
- Run the test suite
- Compile source code
- Package build artifacts
- Deploy to server

### Execution
- [ Navigate To Project ]
- ./configure && make deps
- make test
- make build
- make package
- ./scripts/deploy.sh
```

The `[ Navigate To Project ]` reference invokes another skill by name. When `pls`
plans this workflow, it expands the reference inline, inserting that skill's
execution steps at this position. This lets you compose complex workflows from
simpler, reusable skills. Here's what that skill might look like:

```markdown
### Name
Navigate To Project

### Description
The company maintains two product lines:
- Stable: the flagship product
- Beta: the experimental product

### Aliases
- go to project
- navigate to repo

### Config
project:
  stable:
    path: string
  beta:
    path: string

### Steps
- Navigate to project directory

### Execution
- cd {project.PRODUCT.path}
```

The `{project.PRODUCT.path}` placeholder uses config values from `~/.plsrc`. The
PRODUCT is matched from user intent (e.g., "build stable" resolves to
`project.stable.path`).

The Description tells `pls` when to skip optional steps. This lets you say:

```
$ pls build stable

  - Navigate to the Stable directory
  - Install build dependencies
  - Run the test suite
  - Compile source code
  - Package build artifacts
```

Here "stable" matches the PRODUCT, so `pls` looks up `project.stable.path` in your
config. All steps run except deploy (not requested). When iterating quickly:

```
$ pls just recompile experimental

  - Navigate to the Beta directory
  - Compile source code
  - Package build artifacts
```

Now "experimental" resolves to `project.beta.path`. And when you're ready to ship:

```
$ pls build and deploy main

  - Navigate to the Stable directory
  - Install build dependencies
  - Run the test suite
  - Compile source code
  - Package build artifacts
  - Deploy to server
```

The same skill handles all cases based on your intent, something an alias or
script can't do. Skills are fully dynamic: you can add new variants, change step
conditions, or introduce new options anytime by editing the markdown file - no
code changes required.

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines and architecture.
