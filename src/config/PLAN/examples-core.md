## Examples

### Incorrect Examples: Duplicate Tasks

These examples show common mistakes that create semantic duplicates:

- "explain Lehman's terms in Lehman's terms" →
  - WRONG: Two tasks with actions "Explain what Lehman's terms are in simple
    language" and "Describe Lehman's terms using easy-to-understand words"
  - CORRECT: One task with action "Explain Lehman's terms in simple language"

- "show and display files" →
  - WRONG: Two tasks with actions "Show the files" and "Display the files"
  - CORRECT: One task with action "Show the files"

- "check and verify disk space" →
  - WRONG: Two tasks with actions "Check the disk space" and "Verify the disk
    space"
  - CORRECT: One task with action "Check the disk space"

- "list directory contents completely" →
  - WRONG: Two tasks with actions "List the directory contents" and "Show all
    items"
  - CORRECT: One task with action "List all directory contents"

- "install and set up dependencies" →
  - WRONG: Two tasks with actions "Install dependencies" and "Set up
    dependencies"
  - CORRECT: One task with action "Install dependencies"

- "delete apps and remove all apps unused in a year" →
  - WRONG: Two tasks with actions "Delete unused applications" and "Remove apps
    not used in the past year"
  - CORRECT: One task with action "Delete all applications unused in the past
    year"

### Correct Examples: Single Task

Simple requests should remain as single tasks:

- "change dir to ~" → One task with action "Change directory to the home
  folder", type "execute", params { path: "~" }
- "install deps" → One task with action "Install dependencies", type "execute"
- "make new file called test.txt" → One task with action "Create a new file
  called test.txt", type "execute", params { filename: "test.txt" }
- "show me files here" → One task with action "Show the files in the current
  directory", type "execute"
- "explain quantum physics simply" → One task with action "Explain quantum
  physics in simple terms", type "answer"
- "check disk space thoroughly" → One task with action "Check the disk space
  thoroughly", type "execute"

### Correct Examples: Multiple Tasks

Only split when tasks are truly distinct operations:

- "install deps, run tests" → Two tasks with actions "Install
  dependencies" (type: execute) and "Run tests" (type: execute)
- "create file; add content" → Two tasks with actions "Create a file" (type:
  execute) and "Add content" (type: execute)
- "process data and deploy" → Two tasks with actions "Process the data"
  (type: execute) and "Deploy" (type: execute)

### Correct Examples: Complex Questions

Split only when multiple distinct queries or operations are needed:

- "tell me weather in Wro, is it over 70 deg" → Two tasks:
  1. Action "Show the weather in Wrocław" (type: answer, params
     { city: "Wrocław" })
  2. Action "Check if the temperature is above 70 degrees" (type:
     answer)
- "pls what is 7th prime and how many are to 1000" → Two tasks:
  1. Action "Find the 7th prime number" (type: answer)
  2. Action "Count how many prime numbers are below 1000" (type: answer)
- "check disk space and warn if below 10%" → Two tasks:
  1. Action "Check the disk space" (type: execute)
  2. Action "Show a warning if it is below 10%" (type: report)
- "find config file and show its contents" → Two tasks:
  1. Action "Find the config file" (type: execute)
  2. Action "Show its contents" (type: report)


### Correct Examples: Requests Without Matching Skills

- "lint" with NO lint skill → One task: type "ignore", action "Ignore
  unknown 'lint' request"
- "format" with NO format skill → One task: type "ignore", action "Ignore
  unknown 'format' request"
- "process" with NO process skill → One task: type "ignore", action "Ignore
  unknown 'process' request"
- "do stuff" with NO skills → One task: type "ignore", action "Ignore
  unknown 'do stuff' request"
