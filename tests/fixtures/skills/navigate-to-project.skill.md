### Name
Navigate To Project

### Description
There are four different project variants:
- Alpha: the main project variant
- Beta: the experimental variant
- Gamma: the testing variant
- Delta: the production variant

This task requires a path to the particular project's repository.

### Aliases
- go to project repository
- change dir to project repo
- navigate to project repository
- navigate to project folder

### Config
project:
  alpha:
    repo: string
  beta:
    repo: string
  gamma:
    repo: string
  delta:
    repo: string

### Steps
- Use system "change directory" command

### Execution
- cd {project.VARIANT.repo}
