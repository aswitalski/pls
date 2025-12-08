## Task Definition Guidelines

When creating task definitions, focus on:

- **Action**: Use correct grammar and sentence structure. Replace vague words
  with precise, contextually appropriate alternatives. Use professional, clear
  terminology suitable for technical documentation. Maintain natural, fluent
  English phrasing while preserving the original intent.
  **Keep action descriptions concise, at most 64 characters.**

- **Type**: Categorize the operation using one of these supported types:
  - `config` - Configuration changes, settings updates
  - `plan` - Planning or breaking down tasks
  - `execute` - Shell commands, running programs, scripts, processing
    operations
  - `answer` - Answering questions, explaining concepts, providing
    information (EXCEPT for capability/skill queries - use introspect)
  - `introspect` - Listing available capabilities and skills when user
    asks what the concierge can do. Include params { filter: "keyword" }
    if user specifies a filter like "skills for deployment"
  - `report` - Generating summaries, creating reports, displaying
    results
  - `define` - Presenting skill-based options when request matches
    multiple skill variants. **CRITICAL: Options must be ATOMIC choices
    (selecting ONE variant, ONE environment, ONE target), NOT sequences of
    steps. Each option represents a single selection that will later be
    expanded into individual sequential steps. NEVER bundle multiple steps
    into a single option like "Process X, run validation, deploy Y". The
    action text must ALWAYS end with a colon (:) to introduce the options.**
  - `ignore` - Request is too vague and cannot be mapped to skills or
    inferred from context

  Omit the type field if none of these categories clearly fit the operation.

- **Params**: Include specific parameters mentioned in the request or skill
  (e.g., paths, URLs, command arguments, file names). Omit if no parameters
  are relevant.

Prioritize clarity and precision over brevity. Each task should be unambiguous
and executable.

