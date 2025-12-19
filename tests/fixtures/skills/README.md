# Test Skill Fixtures

This directory contains generic skill markdown files used for testing the
schedule tool's ability to organize commands with skills appended to the
system instructions.

## Purpose

These skills simulate real user skills that would normally be stored in
`~/.pls/skills/`. In production, the system loads skills from that
directory and appends them to the schedule tool instructions. In tests,
we load these fixture skills and append them the same way.

## Test Workflow

1. Load skill markdown files from this directory
2. Concatenate them with separators (`---`)
3. Append to base schedule instructions: `instructions + skills`
4. Send command + enhanced instructions to schedule tool
5. Verify the tool correctly organizes tasks based on available skills

## Skill Types

### Basic Skills
Simple, single-purpose operations:
- `create-file.skill.md` - Create files
- `list-files.skill.md` - List directory contents
- `search.skill.md` - Search for files/content
- `clean.skill.md` - Remove files/directories

### Advanced Skills
Complex, multi-step workflows:
- `backup.skill.md` - Backup files with verification
- `deploy.skill.md` - Deploy applications
- `analyze.skill.md` - Analyze code/data
- `setup.skill.md` - Setup environments

## Usage in Tests

```typescript
// Load skills from fixtures
const skills = loadAllSkills(); // Loads all .skill.md files

// Get base schedule instructions
const baseInstructions = toolRegistry.getInstructions('schedule');

// Append skills (same as production)
const enhancedInstructions =
  baseInstructions + '\n\n## Available Skills\n' + skills;

// Test schedule tool with enhanced instructions
const result = await service.processWithTool(
  'backup and deploy',
  'schedule',
  enhancedInstructions
);
```

This approach ensures tests accurately reflect how the schedule tool
behaves in production when users have skills configured.
