### Name

Setup

### Description

Sets up a development or production environment with necessary
dependencies, configurations, and tools. Handles installation of
packages, configuration of settings, and initialization of
services.

### Aliases

- setup environment
- initialize project
- configure system
- prepare workspace

### Config

```yaml
setup:
  environment: string
  packages: string
  configPath: string
```

### Steps

- Install required packages
- Configure environment settings
- Initialize services
- Verify setup completion

### Execution

- install {setup.packages} packages for {setup.environment}
- configure settings from {setup.configPath}
- initialize required services
- verify setup is complete for {setup.environment}
