### Name
Deploy App

### Description
Deploy a project variant to a specific environment. There are three
project variants:
- Alpha: the main development variant
- Beta: the testing variant
- Gamma: the production variant

And three deployment environments:
- Development: the dev environment
- Staging: the staging environment
- Production: the production environment

### Aliases
- deploy app
- push app
- release app

### Config
project:
  alpha:
    repo: string
    version: string
  beta:
    repo: string
    version: string
  gamma:
    repo: string
    version: string
environment:
  development:
    url: string
    token: string
  staging:
    url: string
    token: string
  production:
    url: string
    token: string

### Steps
- Navigate to the variant repository
- Check out the variant version
- Deploy to the environment URL using the environment token

### Execution
- cd {project.VARIANT.repo}
- git checkout {project.VARIANT.version}
- deploy --url {environment.ENV.url} --token {environment.ENV.token}
