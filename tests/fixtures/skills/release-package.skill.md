### Name
Release Package

### Description
Release a package to a specific channel. Available channels:
- stable: The stable release channel
- beta: The beta testing channel
- nightly: Nightly builds channel

This is a MULTI-STEP skill that MUST use group structure.
When channel is unclear, create a DEFINE task with options.

### Aliases
- release to channel
- publish package
- ship release

### Config
channel:
  stable:
    repo: string
  beta:
    repo: string
  nightly:
    repo: string

### Steps
- Build the release package
- Sign the package artifacts
- Upload to the release channel

### Execution
- make release
- gpg --sign dist/*.pkg
- upload --repo {channel.VARIANT.repo} dist/*.pkg
