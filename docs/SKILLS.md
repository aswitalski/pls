## Skills

Skills are domain-specific workflows that teach the `pls` concierge about
project-specific commands and operations. Skills are defined in markdown files
stored in `~/.pls/skills/` and loaded dynamically at runtime.

### Skill File Format

Each skill is a markdown file containing structured sections that define its
behavior. Skills have four required sections (Name, Description, Steps,
Execution) and two optional sections (Aliases, Config).

#### Required Sections

##### Name

Unique identifier for the skill used throughout the system.

**Purpose**:
- Serves as the skill's canonical name
- Used in skill references: `[Skill Name]`
- Must match exactly when cross-referencing between skills

**Example**:
```markdown
### Name
Build Project
```

##### Description

Explains what the skill does and provides guidance for matching user requests.

**Purpose**:
- Documents the skill's purpose for humans and the LLM
- Describes variants, conditions, and special cases
- Guides when to skip optional steps
- Helps LLM understand when this skill applies

**Example**:
```markdown
### Description
Build a project in different configurations. Supports dev (debug build with
source maps) and prod (optimized build) configurations. The generation script
is only needed for major changes.
```

##### Steps

Human-readable description of the workflow.

**Purpose**:
- Bullet list of logical workflow steps
- Written for human understanding and documentation
- Must have the same number of items as Execution section
- Used by LLM to understand workflow at a high level

**Example**:
```markdown
### Steps
- Navigate to the project directory
- Install dependencies if needed
- Run the build script
- Generate build artifacts
```

##### Execution

Actual commands that implement the workflow.

**Purpose**:
- Bullet list of commands to execute
- Must have the same number of items as Steps section
- Each line becomes one task in the execution plan
- Supports three command syntaxes

**Command Syntaxes**:

1. **Direct commands**: `python3 ./script.py --flag`
2. **Labeled commands**: `Run: npm install`
3. **Skill references**: `[Other Skill Name]`

**Example**:
```markdown
### Execution
- cd ~/projects/myapp
- npm install
- npm run build
- cp -r dist/ builds/
```

#### Optional Sections

##### Aliases

Natural language triggers that help match user requests to this skill.

**Purpose**:
- Bullet list of example commands that invoke this skill
- Improves skill discovery from natural language
- Multiple aliases can map to the same skill
- Not used during execution, only for matching

**Example**:
```markdown
### Aliases
- build for production
- compile the project
- build from source
- generate and build
```

##### Config

Configuration schema defining required properties.

**Purpose**:
- YAML structure specifying configuration requirements
- Properties are typed: `string`, `boolean`, or `number`
- Supports nested structures using indentation
- Creates config paths like `product.dev.path`
- Values stored in `~/.plsrc`
- User will be prompted for missing values before execution

**Example**:
```yaml
### Config
product:
  dev:
    path: string
    enabled: boolean
  prod:
    path: string
build:
  parallel: boolean
  threads: number
```

This creates the following config properties:
- `product.dev.path` and `product.prod.path` (paths)
- `product.dev.enabled` (true/false)
- `build.parallel` (true/false) and `build.threads` (number)

### Advanced Features

#### Placeholders

Placeholders reference configuration values and support two formats:

##### Strict Placeholders

Format: `{product.dev.path}` (all lowercase path components)

**Behavior**:
- References a specific value from `~/.plsrc`
- Use when specific variant is known

**Example**:
```markdown
### Execution
- cd {product.dev.path}
- make build
```

##### Variant Placeholders

Format: `{product.VARIANT.path}` (uppercase VARIANT keyword)

**Behavior**:
- Matches user requests ("build dev", "build prod") to the appropriate variant
- Looks up the corresponding config value
- Use when skill supports multiple variants

**Example**:
```markdown
### Config
product:
  dev:
    path: string
  prod:
    path: string

### Execution
- cd {product.VARIANT.path}
- make build
```

When user says "build dev", `pls` matches "dev" to the `dev` variant and uses
the value from `product.dev.path` in the config.

#### Skill Composition

Skills can reference other skills to build complex workflows from simple
building blocks.

**Reference Format**: `[Skill Name]` in Execution section

**How it works**:
- Skill references are expanded automatically during planning
- The referenced skill's commands are included in the execution
- Circular references (skills that reference each other) are prevented
- Config requirements from referenced skills are included

**Example**:

**Skill: Navigate To Product**
```markdown
### Name
Navigate To Product

### Config
product:
  dev:
    path: string
  prod:
    path: string

### Steps
- Change to product directory

### Execution
- cd {product.VARIANT.path}
```

**Skill: Build Product**
```markdown
### Name
Build Product

### Steps
- Navigate to product
- Compile source

### Execution
- [Navigate To Product]
- make build
```

**Expanded Execution** (when user runs "build dev"):
```
- cd /path/to/dev    # Expanded from [Navigate To Product]
- make build
```

#### Configuration Management

Configuration values are stored in `~/.plsrc` and checked before execution.

**How it works**:
- `pls` checks which config values the skill needs
- If any are missing, user will be prompted to provide them
- Values are saved to `~/.plsrc` for future use
- Once all values are available, execution proceeds

**Example**:

When user runs `pls build dev`:

1. `pls` matches user's request to the "Build Product" skill
2. Recognizes "dev" as the variant to use
3. Expands the `[Navigate To Product]` reference
4. Checks if `product.dev.path` exists in `~/.plsrc`
5. If missing, prompts user: "Product Dev path"
6. User enters: `/data/projects/dev` (saved to `~/.plsrc`)
7. Executes: `cd /data/projects/dev`
8. Executes: `make build`

### Section Relationships

#### Steps ↔ Execution Alignment

The Steps and Execution sections must match:
- Both must have the same number of items
- Each Step describes what the corresponding Execution command does
- Steps explain the workflow, Execution defines the commands
- Different counts will cause an error

#### Config ↔ Execution Integration

Config and Execution work together:
- Config section defines what values are needed
- Execution section uses placeholders to reference those values
- Missing values trigger interactive prompts
- All config is checked before execution starts

#### Name ↔ Execution References

Skills compose through Name references:
- Reference other skills using: `[Skill Name]`
- Referenced skills are included during planning
- Circular references (A calls B, B calls A) are prevented
- Config from referenced skills is included automatically

### Complete Example

```markdown
### Name
Deploy Application

### Description
Deploy application to different environments. Supports dev and prod
environments. The build step is skipped if artifacts already exist.

### Aliases
- deploy to production
- deploy to dev
- push to prod

### Config
app:
  dev:
    path: string
    url: string
  prod:
    path: string
    url: string
deployment:
  timeout: number
  parallel: boolean

### Steps
- Navigate to application directory
- Build application if needed
- Run deployment script
- Verify deployment succeeded

### Execution
- cd {app.VARIANT.path}
- npm run build:VARIANT
- ./deploy.sh {app.VARIANT.url} --timeout={deployment.timeout}
- curl -f {app.VARIANT.url}/health || exit 1
```

### Built-in Capabilities

The `pls` concierge includes six built-in capabilities that handle core
operations:

- **Answer** - Answer questions and provide information
- **Config** - Manage configuration properties interactively
- **Execute** - Run shell commands and process operations
- **Introspect** - List available capabilities and user skills
- **Plan** - Break down requests into actionable execution steps
- **Validate** - Validate execution plans before running them

These capabilities are always available and work alongside user-defined skills.

### Creating User Skills

To create a skill:

1. Create a markdown file in `~/.pls/skills/`
2. Add required sections: Name, Description, Steps, Execution
3. Add optional sections as needed: Aliases, Config
4. Test the skill by using natural language that matches the Description or
   Aliases

**Example file**: `~/.pls/skills/my-workflow.md`

```markdown
### Name
My Custom Workflow

### Description
A custom workflow for my project.

### Steps
- Do something
- Do something else

### Execution
- echo "Step 1"
- echo "Step 2"
```

Then run: `pls run my workflow`

`pls` will recognize the request and execute the commands.
