### Name

Backup

### Description

Creates a backup of specified files or directories. This skill
handles different backup scenarios including incremental backups,
full backups, and verification of backup integrity.

### Aliases

- backup files
- create backup
- backup directory
- save backup

### Config

```yaml
backup:
  source: string
  destination: string
  incremental: boolean
```

### Steps

- Verify source exists
- Create backup directory
- Copy files to destination
- Verify backup integrity

### Execution

- verify source at {backup.source} exists
- create backup directory at {backup.destination}
- copy files from {backup.source} to {backup.destination}
- verify backup integrity at {backup.destination}
