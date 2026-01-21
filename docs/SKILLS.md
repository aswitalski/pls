## Skills

Skills are domain-specific workflows that teach the `pls` concierge about
project-specific commands and operations. Skills are defined in markdown files
stored in `~/.pls/skills/` and loaded dynamically at runtime.

### Skill File Format

Each skill is a markdown file containing structured sections that define its
behavior. Skills have three required sections (Description, Steps, Execution)
and three optional sections (Name, Aliases, Config).

#### Required Sections

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
Backup files to remote storage. Supports local (quick sync to NAS) and cloud
(encrypted upload to S3) destinations. The encryption step is only needed for
cloud backups.
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
- Scan source directory for changes
- Compress modified files
- Transfer to destination
- Verify backup integrity
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
2. **Labeled commands**: `Run: rsync -avz`
3. **Skill references**: `[ Other Skill Name ]`

**Example**:
```markdown
### Execution
- find ~/documents -newer .last-backup
- tar -czf backup.tar.gz ~/documents
- rsync -avz backup.tar.gz remote:/backups/
- sha256sum -c backup.tar.gz.sha256
```

#### Optional Sections

##### Name

Display name for the skill. If omitted, derived from the filename.

**Purpose**:
- Provides a human-readable name for the skill
- Used in skill references: `[ Skill Name ]`
- Must match exactly when cross-referencing between skills
- If not provided, the filename is converted to Title Case (e.g., `deploy-app.md`
  becomes "Deploy App")

**Example**:
```markdown
### Name
Backup Files
```

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
- backup my files
- create a backup
- archive to cloud
- save files to remote
```

##### Config

Configuration schema defining required properties.

**Purpose**:
- YAML structure specifying configuration requirements
- Properties are typed: `string`, `boolean`, or `number`
- Supports nested structures using indentation
- Creates config paths like `server.staging.host`
- Values stored in `~/.plsrc`
- User will be prompted for missing values before execution

**Example**:
```yaml
### Config
server:
  staging:
    host: string
    enabled: boolean
  prod:
    host: string
backup:
  compress: boolean
  threads: number
```

This creates the following config properties:
- `server.staging.host` and `server.prod.host` (hostnames)
- `server.staging.enabled` (true/false)
- `backup.compress` (true/false) and `backup.threads` (number)

### Advanced Features

#### Placeholders

Placeholders reference configuration values and support two formats:

##### Strict Placeholders

Format: `{server.staging.host}` (all lowercase path components)

**Behavior**:
- References a specific value from `~/.plsrc`
- Use when specific variant is known

**Example**:
```markdown
### Execution
- ssh {server.staging.host}
- ./run-checks.sh
```

##### Variant Placeholders

Format: `{server.ENV.host}` (uppercase ENV keyword)

**Behavior**:
- Matches user requests ("deploy staging", "deploy prod") to the appropriate
  variant
- Looks up the corresponding config value
- Use when skill supports multiple variants

**Example**:
```markdown
### Config
server:
  staging:
    host: string
  prod:
    host: string

### Execution
- ssh {server.ENV.host}
- ./run-checks.sh
```

When user says "deploy staging", `pls` matches "staging" to the `staging`
variant and uses the value from `server.staging.host` in the config.

#### Skill Composition

Skills can reference other skills to build complex workflows from simple
building blocks.

**Reference Format**: `[ Skill Name ]` in Execution section

**How it works**:
- Skill references are expanded automatically during planning
- The referenced skill's commands are included in the execution
- Circular references (skills that reference each other) are prevented
- Config requirements from referenced skills are included

**Example**:

**Skill: Connect To Server**
```markdown
### Name
Connect To Server

### Config
server:
  staging:
    host: string
  prod:
    host: string

### Steps
- Establish SSH connection

### Execution
- ssh {server.ENV.host}
```

**Skill: Run Migration**
```markdown
### Name
Run Migration

### Steps
- Connect to target server
- Execute migration script

### Execution
- [ Connect To Server ]
- ./migrate.sh --apply
```

**Expanded Execution** (when user runs "migrate staging"):
```
- ssh staging.example.com    # Expanded from [ Connect To Server ]
- ./migrate.sh --apply
```

#### Configuration Management

Configuration values are stored in `~/.plsrc` and checked before execution.

**How it works**:
- `pls` checks which config values the skill needs
- If any are missing, user will be prompted to provide them
- Values are saved to `~/.plsrc` for future use
- Once all values are available, execution proceeds

**Example**:

When user runs `pls migrate staging`:

1. `pls` matches user's request to the "Run Migration" skill
2. Recognizes "staging" as the variant to use
3. Expands the `[ Connect To Server ]` reference
4. Checks if `server.staging.host` exists in `~/.plsrc`
5. If missing, prompts user: "Server Staging host"
6. User enters: `staging.example.com` (saved to `~/.plsrc`)
7. Executes: `ssh staging.example.com`
8. Executes: `./migrate.sh --apply`

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
- Reference other skills using: `[ Skill Name ]`
- Referenced skills are included during planning
- Circular references (A calls B, B calls A) are prevented
- Config from referenced skills is included automatically

### Complete Example

```markdown
### Name
Sync Database

### Description
Synchronize database between environments. Supports staging and prod
environments. The backup step is skipped if recent backup exists.

### Aliases
- sync database to staging
- sync db to prod
- replicate database

### Config
database:
  staging:
    host: string
    port: number
  prod:
    host: string
    port: number
sync:
  timeout: number
  compress: boolean

### Steps
- Connect to source database
- Create backup snapshot
- Transfer data to target
- Verify sync completed

### Execution
- pg_dump -h {database.ENV.host} -p {database.ENV.port} > backup.sql
- gzip backup.sql
- psql -h {database.ENV.host} -f backup.sql.gz
- ./verify-sync.sh {database.ENV.host} --timeout={sync.timeout}
```

### Built-in Capabilities

The `pls` concierge includes six built-in capabilities that handle core
operations:

- **Answer** - Answer questions and provide information
- **Configure** - Manage configuration properties interactively
- **Execute** - Run shell commands and process operations
- **Introspect** - List available capabilities and user skills
- **Schedule** - Break down requests into actionable execution steps
- **Validate** - Validate execution plans before running them

These capabilities are always available and work alongside user-defined skills.

### Creating User Skills

To create a skill:

1. Create a markdown file in `~/.pls/skills/`
2. Add required sections: Description, Steps, Execution
3. Add optional sections as needed: Name, Aliases, Config
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
