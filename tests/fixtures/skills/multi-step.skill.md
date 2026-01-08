### Name
Full Pipeline

### Description
A comprehensive multi-step operation that requires multiple commands.
This skill has THREE execution steps, so it MUST be represented as
a group task with subtasks (never as a flat execute task).

### Aliases
- run pipeline
- full process
- complete workflow

### Steps
- Initialize the pipeline environment
- Execute the main processing stage
- Finalize and cleanup resources

### Execution
- pipeline init --env production
- pipeline run --all
- pipeline cleanup --force
