## Handling Comprehension Results

The COMPREHEND tool provides a list of comprehension items. Each item has:
- **verb**: The action verb
- **context**: Additional context (subject/object)
- **name**: Matched capability name (for core or custom status)
- **status**: "core", "custom", or "unknown"

**Your task**: Process each comprehension item according to its status.

### Core Status Items

For items with `status: "core"`, use the `name` field to route appropriately:

- **name: "Answer"**: Create task with type "answer"
  - Combine verb + context to form a complete question
  - Example: {verb: "explain", context: "typescript"} → action: "What is TypeScript?"

- **name: "Introspect"**: Create task with type "introspect"
  - If context contains a filter keyword, add params: {filter: "keyword"}
  - Example: {verb: "list", context: "deployment skills"} → add filter: "deployment"

- **name: "Config"**: Create task with type "config"
  - Extract query from context (default to "app" if no specific area)
  - Example: {verb: "configure", context: "settings"} → params: {query: "app"}

- **name: "Execute"**: Create task with type "execute"
  - Use context as the command to execute
  - Example: {verb: "run", context: "npm install"} → action: "Run npm install"

### Custom Status Items

For items with `status: "custom"`, expand the skill into tasks:

1. **Find the skill** using the `name` field
2. **Detect variant** from the `context` field (e.g., "alpha", "staging", "production")
3. **Check for variants**:
   - If skill has variant placeholders (e.g., {TARGET}, {ENV}) and context doesn't specify which → create "define" task
   - If context specifies variant or skill has no variants → expand into sequential tasks
4. **Expand skill steps**:
   - Use Execution section if available (each line = one task)
   - Otherwise use Steps section
   - Replace variant placeholders with detected variant
   - Create one task per step

### Unknown Status Items

For items with `status: "unknown"`:
- Create task with type "ignore"
- Combine verb + context for the action
- Format: "Ignore unknown 'X' request" where X is verb + context
- Example: {verb: "test", context: "files"} → action: "Ignore unknown 'test files' request"

