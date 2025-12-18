### Name

Analyze

### Description

Analyzes code, data, or system metrics to identify issues,
patterns, or optimization opportunities. Supports different
analysis types including code quality, performance profiling, and
security scanning.

### Aliases

- analyze code
- run analysis
- check code quality
- profile performance

### Config

```yaml
analyze:
  target: string
  type: string
  outputFormat: string
```

### Steps

- Scan target for analysis
- Process and evaluate data
- Generate analysis report
- Display findings

### Execution

- scan {analyze.target} for {analyze.type} analysis
- process and evaluate collected data
- generate analysis report in {analyze.outputFormat}
- display analysis findings
