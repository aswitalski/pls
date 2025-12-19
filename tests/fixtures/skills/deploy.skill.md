### Name

Deploy

### Description

Deploys an application to a specified environment. Supports
multiple deployment strategies including blue-green, rolling, and
direct deployment. Handles pre-deployment checks and
post-deployment verification.

### Aliases

- deploy application
- deploy to production
- deploy to staging
- push to server

### Config

```yaml
deploy:
  environment: string
  strategy: string
  server: string
```

### Steps

- Run pre-deployment checks
- Build application
- Deploy to environment
- Run post-deployment verification

### Execution

- run pre-deployment checks for {deploy.environment}
- build application for deployment
- deploy to {deploy.environment} using {deploy.strategy}
- verify deployment on {deploy.server}
