# Structured Skill System Implementation

## Overview

The structured skill system provides deterministic execution despite LLM indeterminism through a layered architecture:

1. **LLM Layer**: Matches natural language to skills and variants
2. **Structured Layer**: Executes exact commands with strict config lookup
3. **Validation Layer**: Enforces required config before execution

## Components Implemented

### 1. Type Definitions (`src/types/skills.ts`)

Core types for the skill system:
- `SkillDefinition`: Parsed skill structure
- `ConfigSchema`: YAML configuration structure
- `PlaceholderInfo`: Parsed placeholder data
- `ConfigRequirement`: Missing config tracking
- `SkillReference`: Skill cross-reference info
- `ConfigValidationResult`: Validation results

### 2. Skill Parser (`src/services/skill-parser.ts`)

Parses markdown skill files into structured definitions:
- `parseSkillMarkdown()`: Extract sections from markdown
- `generateConfigPaths()`: Generate all config paths from schema
- `getConfigType()`: Get type for specific config path

**Features:**
- Validates required sections (Name, Description, Steps)
- Validates Steps/Execution count match
- Parses YAML config schemas
- Extracts bullet lists (Aliases, Steps, Execution)

**Tests:** 14 tests in `tests/skill-parser.test.ts`

### 3. Placeholder Resolver (`src/services/placeholder-resolver.ts`)

Handles parameter placeholders in execution commands:
- `parsePlaceholder()`: Parse `{path.to.property}` format
- `extractPlaceholders()`: Extract all placeholders from text
- `resolveVariant()`: Replace VARIANT with actual variant name
- `resolveFromConfig()`: Lookup value in config
- `replacePlaceholders()`: Replace all placeholders with values
- `getRequiredConfigPaths()`: Extract config requirements

**Features:**
- Distinguishes strict (`{product.alpha.path}`) from variant
  (`{product.VARIANT.path}`) placeholders
- Supports two-phase resolution: LLM matches variant, then config lookup
- Handles multiple placeholders in one command

**Tests:** 27 tests in `tests/placeholder-resolver.test.ts`

### 4. Skill Expander (`src/services/skill-expander.ts`)

Handles recursive skill references:
- `parseSkillReference()`: Parse `[Skill Name]` format
- `expandSkillReferences()`: Recursively expand skill references
- `getReferencedSkills()`: Get all skills referenced (including nested)
- `validateNoCycles()`: Detect circular references

**Features:**
- Recursively expands `[Skill Name]` references
- Detects circular references and throws error
- Supports unlimited nesting depth
- Enables skill composition

**Tests:** 20 tests in `tests/skill-expander.test.ts`

### 5. Config Validator (`src/services/config-validator.ts`)

Validates config requirements before execution:
- `validateSkillConfig()`: Check all config requirements
- Internal helpers for config loading and path checking

**Features:**
- Expands skill references to get full execution commands
- Extracts placeholders and resolves variants
- Checks which paths exist in `~/.plsrc`
- Returns missing config with types and descriptions
- Generates human-readable descriptions from paths

**Tests:** 12 tests in `tests/config-validator.test.ts`

### 6. Skills Service (`src/services/skills.ts`)

Extended to support structured skills:
- `loadSkillDefinitions()`: Load and parse all skills
- `createSkillLookup()`: Create skill lookup function

## Test Coverage

Total: **73 tests** across 4 test files

- Skill Parser: 14 tests
- Placeholder Resolver: 27 tests
- Skill Expander: 20 tests
- Config Validator: 12 tests

All tests passing ✓

## Placeholder Types

### Strict Placeholders

Format: `{section.variant.property}` (all lowercase)

Example: `{product.alpha.path}`

Resolution:
1. Direct lookup in ~/.plsrc at path `product.alpha.path`
2. No LLM interpretation
3. Deterministic

### Variant Placeholders

Format: `{section.VARIANT.property}` (uppercase VARIANT keyword)

Example: `{product.VARIANT.path}`

Resolution:
1. Planning phase: LLM matches user intent ("alpha", "variant A") to variant
   name (`alpha`)
2. Replace VARIANT: `{product.VARIANT.path}` → `{product.alpha.path}`
3. Execution phase: Strict config lookup at `product.alpha.path`

This achieves controlled indeterminism: LLM picks variant, then deterministic
lookup.

## Skill Reference Resolution

Format: `[Skill Name]` in Execution section

Example: `[Navigate To Product]`

Resolution:
1. Planning phase: Recursively load referenced skill's execution steps
2. Inject steps inline at reference position
3. Inherit referenced skill's config requirements

Example expansion:

```
Skill: Build Product
Execution:
  - [Navigate To Product]
  - make build

Expands to:
  - cd {product.VARIANT.path}  (from Navigate To Product)
  - make build
```

## Config Validation Workflow

When skill is matched during planning:

1. Extract all config paths from Execution section
2. Recursively expand skill references
3. Replace VARIANT with LLM-matched variant name
4. Check if required properties exist in ~/.plsrc
5. If missing: Create CONFIG task before execution tasks
6. CONFIG task prompts for all missing properties
7. User provides values, saved to ~/.plsrc
8. Execution proceeds with fully resolved config

## Example: User runs `pls process alpha`

### Step 1: Match skill
- PLAN matches "process" to "Process Product" skill
- PLAN extracts "alpha" and matches to variant `alpha`

### Step 2: Process execution
```
Skill execution:
  - [Navigate To Product]
  - operation {product.VARIANT.settings}
```

Expand reference:
```
  - cd {product.VARIANT.path}
  - operation {product.VARIANT.settings}
```

Replace VARIANT with `alpha`:
```
  - cd {product.alpha.path}
  - operation {product.alpha.settings}
```

### Step 3: Validate config
Required paths:
- `product.alpha.path`
- `product.alpha.settings`

Check ~/.plsrc:
- `product.alpha.path`: missing ✗
- `product.alpha.settings`: missing ✗

### Step 4: Create CONFIG task
Missing:
1. `product.alpha.path` (string) - "Product Alpha Path"
2. `product.alpha.settings` (string) - "Product Alpha Settings"

### Step 5: User provides config
User enters:
- Path: `/data/projects/alpha`
- Settings: `--verbose --parallel`

Saved to ~/.plsrc:
```yaml
product:
  alpha:
    path: /data/projects/alpha
    settings: --verbose --parallel
```

### Step 6: Execute with resolved values
```
cd /data/projects/alpha
operation --verbose --parallel
```

## Next Steps

1. **Update PLAN tool instructions:**
   - Document config validation workflow
   - Explain placeholder resolution
   - Describe skill reference expansion

2. **Integrate with CONFIG tool:**
   - Add support for skill-based config prompting
   - Generate CONFIG tasks from validation results
   - Handle multi-property config requirements

3. **Add execution-time placeholder resolution:**
   - Replace placeholders with config values during execution
   - Handle missing config gracefully

4. **Write integration tests:**
   - End-to-end skill parsing → validation → execution
   - Real skill files from ~/.pls/skills/
   - Config lifecycle testing

## Architecture Benefits

1. **Determinism through layers:**
   - LLM handles natural language matching
   - Structured system handles exact execution
   - Config validation enforces requirements

2. **Skill composition:**
   - Skills reference other skills
   - Build complex workflows from simple skills
   - Promotes reusability

3. **Type safety:**
   - Config schemas define types
   - Validation ensures correct types
   - TypeScript types throughout

4. **Circular reference protection:**
   - Detects cycles during expansion
   - Prevents infinite loops
   - Clear error messages

5. **Flexible variant matching:**
   - LLM matches natural language to variants
   - "GX", "gamers browser", "browser for gamers" → `gx`
   - Once matched, execution is deterministic
