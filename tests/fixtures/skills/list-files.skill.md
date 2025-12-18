### Name

List Files

### Description

Lists files and directories in a specified location with optional
filtering.

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
- Filter by pattern if specified

### Execution

- read directory contents at {list.directory}
- filter results by pattern: {list.pattern}
