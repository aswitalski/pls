### Correct Examples: Skill-Based Requests

Examples showing proper use of skills and disambiguation:

- "process" with process skill requiring {TARGET} parameter (Alpha, Beta, Gamma,
  Delta) → One task: type "define", action "Clarify which target to process:",
  params { options: ["Process Alpha", "Process Beta", "Process Gamma", "Process
  Delta"] }. NOTE: If variants have descriptions, format as "Process Alpha, the
  legacy version" NOT "Process Alpha (the legacy version)"
- "process Alpha" with same process skill → Three tasks extracted from skill
  steps, each with params: { skill: "Process Data", target: "Alpha" }:
  - "Navigate to the Alpha target's root directory"
  - "Execute the Alpha target generation script"
  - "Run the Alpha processing pipeline"
- "process all" with same process skill → Twelve tasks (3 steps × 4 targets)
- "deploy" with deploy skill (staging, production, canary) → One task: type
  "define", action "Clarify which environment to deploy to:", params
  { options: ["Deploy to staging environment", "Deploy to production
  environment", "Deploy to canary environment"] }
- "deploy all" with deploy skill (staging, production) → Two tasks: one for
  staging deployment, one for production deployment
- "backup and restore" with backup and restore skills → Create tasks from
  backup skill + restore skill
- "backup photos and verify" with backup skill (has {TYPE} parameter) but NO
  verify skill → Two tasks from backup skill (with {TYPE}=photos) + one
  "ignore" type for unknown "verify"
- "analyze data and generate report" with analyze skill but NO generate skill →
  Tasks from analyze skill + one "ignore" type for unknown "generate"

### INCORRECT Examples: Sequence-Based Define Options

These examples show the WRONG way to use "define" type - bundling sequences
instead of atomic choices:

- "process alpha, verify, process beta" with process skill for targets Alpha
  and Beta →
  - WRONG: One task type "define" with options ["Process Alpha, run
    verification, process Beta", "Process Alpha, skip verification, process
    Beta"]
  - CORRECT: Multiple sequential tasks: "Process Alpha", "Run verification",
    "Process Beta" (no define needed - these are distinct sequential
    operations)

- "deploy" with deploy skill (staging, production) →
  - WRONG: One task type "define" with options ["Deploy to staging then
    production", "Deploy to production only"]
  - CORRECT: One task type "define" with options ["Deploy to staging", "Deploy
    to production"] (atomic environment choices)

- "process and validate" with process skill ({TARGET} parameter: Alpha, Beta) →
  - WRONG: One task type "define" with options ["Process Alpha and run
    validation", "Process Beta and run validation"]
  - CORRECT: One task type "define" to choose target ["Process Alpha",
    "Process Beta"], then once selected, expand into separate sequential tasks
    for process steps + validation step

