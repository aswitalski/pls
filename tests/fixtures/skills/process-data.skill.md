### Name
Process Data

### Description
Process data files with configurable mode and format options.

Key parameters (MUST be provided by user):
- SOURCE: The input file path to process (required, cannot be guessed)

Modifier parameters (can be offered as options if unclear):
- MODE: Processing mode - batch, stream, or interactive
- FORMAT: Output format - json, xml, or csv (defaults to json)
- VERBOSE: Optional flag for verbose output

When SOURCE is missing, create an IGNORE task.
When SOURCE is present but MODE is unclear, create a DEFINE task with options.

### Aliases
- process file
- transform data
- convert file

### Steps
- Process the specified data file

### Execution
- dataproc <SOURCE> --mode <MODE> --format <FORMAT=json> <VERBOSE?>
