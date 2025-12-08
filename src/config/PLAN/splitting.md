## Multiple Tasks

When the user provides multiple tasks separated by commas, semicolons, or the
word "and", or when the user asks a complex question that requires multiple
steps to answer:

1. Identify each individual task or step
2. Break complex questions into separate, simpler task definitions
3. Create a task definition for each distinct operation
4. **For each operation, independently check if it matches a skill:**
   - If operation matches a skill → extract skill steps
   - If operation does NOT match a skill → create "ignore" type task
   - **CRITICAL: Do NOT infer context or create generic execute tasks for
     unmatched operations**
   - Even if an unmatched operation appears after a matched skill, treat it
     independently
   - Do NOT create tasks like "Verify the processed X" or "Check X results"
     for unmatched operations
   - The ONLY valid types for unmatched operations are "ignore" or "answer"
     (for information requests)
   - Example: "process files and validate" where only "process" has a skill
     → Create tasks from process skill + create "ignore" type for "validate"
   - Example: "deploy service and monitor" where only "deploy" has a skill
     → Create tasks from deploy skill + create "ignore" type for "monitor"

When breaking down complex questions:

- Split compound questions into individual queries
- Separate conditional checks into distinct tasks
- Keep each task simple and focused on one operation

Before finalizing the task list, perform strict validation:

1. Each task is semantically unique (no duplicates with different words)
2. Each task provides distinct value
3. Overlapping tasks are merged or removed
4. When uncertain whether to split, default to a single task
5. Executing the tasks will not result in duplicate work

Critical validation check: After creating the task list, examine each pair of
tasks and ask "Would these perform the same operation?" If yes, they are
duplicates and must be merged or removed. Pay special attention to synonym
verbs (delete, remove, erase) and equivalent noun phrases (unused apps,
applications not used).

## Avoiding Duplicates

Each task must be semantically unique and provide distinct value. Before
finalizing multiple tasks, verify there are no duplicates.

Rules for preventing duplicates:

1. Modifiers are not separate tasks. Adverbs and adjectives that modify how
   to perform a task are part of the task description, not separate tasks.
   - "explain X in simple terms" = ONE task (not "explain X" + "use simple
     terms")
   - "describe X in detail" = ONE task (not "describe X" + "make it
     detailed")
   - "list X completely" = ONE task (not "list X" + "be complete")

2. Synonymous verbs are duplicates. Different verbs meaning the same thing
   with the same object are duplicates. Keep only one or merge them.
   - "explain X" + "describe X" = DUPLICATE (choose one)
   - "show X" + "display X" = DUPLICATE (choose one)
   - "check X" + "verify X" = DUPLICATE (choose one)
   - "list X" + "enumerate X" = DUPLICATE (choose one)
   - "delete X" + "remove X" = DUPLICATE (choose one)
   - "erase X" + "remove X" = DUPLICATE (choose one)
   - "create X" + "make X" = DUPLICATE (choose one)
   - "find X" + "locate X" = DUPLICATE (choose one)

3. Tautological patterns stay single. When a request uses a phrase that
   already describes how to do something, do not split it.
   - "explain Lehman's terms in Lehman's terms" = ONE task (the phrase
     already means "in simple language")
   - "describe it simply in simple words" = ONE task (redundant modifiers)
   - "show clearly and display obviously" = ONE task (redundant verbs)

4. Redundant operations are duplicates. If two alleged tasks would perform
   the same operation, they are duplicates.
   - "install and set up dependencies" = ONE task (setup is part of install)
   - "check and verify disk space" = ONE task (verify means check)
   - "list and show all files" = ONE task (list and show are the same)

## When to Split and When NOT to Split

Keep as a single task when:

- Single operation with modifiers: "explain X in detail" (one action)
- Tautological phrasing: "do X in terms of X" (one action)
- Redundant verb pairs: "check and verify X" (same operation)
- Compound modifiers: "quickly and efficiently process X" (one action)
- Implicit single operation: "install dependencies" even if it involves
  multiple steps internally

Split into multiple tasks when:

- Distinct sequential operations: "install deps, run tests" (two separate
  commands)
- Action with conditional: "check disk space and warn if below 10%" (check,
  then conditional action)
- Different subjects: "explain X and demonstrate Y" (two different things)
- Truly separate steps: "create file and add content to it" (two distinct
  operations)

## Final Validation

Before finalizing the task list, perform this final check:

1. Compare each task against every other task
2. Ask for each pair: "Do these describe the same operation using different
   words?"
3. Check specifically for:
   - Synonym verbs (delete/remove, show/display, create/make, find/locate)
   - Equivalent noun phrases (apps/applications, unused/not used,
     files/documents)
   - Same operation with different modifiers
4. If any pair is semantically identical, merge them or keep only one
5. If in doubt about whether tasks are duplicates, they probably are - merge
   them

Only finalize after confirming no semantic duplicates exist.

