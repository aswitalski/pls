### Name
Export Report

### Description
Export reports to various formats with quality settings.

Key parameters (MUST be provided by user):
- FILE: The report file to export (required, cannot be guessed)

Modifier parameters (can be offered as options if unclear):
- QUALITY: Export quality - draft, standard, or high
- DESTINATION: Output location (defaults to ./output)

When FILE is missing, create an IGNORE task - never offer options for key params.
When FILE is present but QUALITY is unclear, create a DEFINE task.

### Aliases
- export file
- generate report
- save report

### Steps
- Export the report with specified settings

### Execution
- reporter export <FILE> --quality <QUALITY> --dest <DESTINATION=./output>
