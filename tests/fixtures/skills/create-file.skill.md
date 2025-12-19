### Name

Create File

### Description

Creates a new file with specified content at a given location.

### Aliases

- create file
- make file
- new file
- write file

### Config

```yaml
file:
  path: string
  content: string
```

### Steps

- Create file at specified path
- Write content to file

### Execution

- create file at {file.path}
- write content to {file.path}: {file.content}
