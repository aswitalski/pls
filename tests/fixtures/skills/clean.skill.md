### Name

Clean

### Description

Removes temporary files, build artifacts, or specified directories.

### Aliases

- clean
- remove files
- delete directory
- clear cache

### Config

```yaml
clean:
  target: string
  recursive: boolean
```

### Steps

- Verify target path
- Remove files or directories

### Execution

- verify target exists at {clean.target}
- remove {clean.target} (recursive: {clean.recursive})
