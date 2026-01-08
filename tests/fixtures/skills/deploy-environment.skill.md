### Name
Deploy Environment

### Description
Deploy to different environments. Available environments:
- staging: The staging/test environment
- production: The live production environment
- development: Local development environment

When the target environment is unclear from the user's request,
create a DEFINE task with options - NEVER use placeholder values
like UNKNOWN or leave the variant unresolved.

### Aliases
- deploy to environment
- push to env
- release to

### Config
env:
  staging:
    url: string
    key: string
  production:
    url: string
    key: string
  development:
    url: string
    key: string

### Steps
- Deploy application to the target environment

### Execution
- deployer push --target {env.VARIANT.url} --auth {env.VARIANT.key}
