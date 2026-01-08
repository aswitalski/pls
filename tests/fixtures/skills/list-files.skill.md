### Name

List Files

### Description

Lists files and directories in a specified location and filters them
by pattern.

### Aliases

- list files
- show files
- display directory
- ls

### Config

```yaml
list:
  directory: string
  pattern: string
```

### Steps

- Read directory contents
- Filter results by pattern

### Execution

- read directory contents at {list.directory}
- filter results by pattern: {list.pattern}
