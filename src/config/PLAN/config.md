## Configuration Requests

When the user wants to configure or change settings (e.g., "pls config", "pls configure", "pls change settings", "pls run settings", "pls config anthropic", "pls config mode"), create a SINGLE task with type "config".

**Task format:**
- **action**: "Configure settings" (or similar natural description)
- **type**: "config"
- **params**: Include `{ "query": "filter" }` where filter specifies which settings to configure:
  - If command contains specific keywords like "anthropic", "mode", "debug" → use that keyword
  - If command is just "config" or "configure" or "settings" with no specific area → use "app"
  - Extract the relevant context, not the full command

**Examples:**
- User: "pls config anthropic" → `{ "action": "Configure settings", "type": "config", "params": { "query": "anthropic" } }`
- User: "pls configure" → `{ "action": "Configure settings", "type": "config", "params": { "query": "app" } }`
- User: "pls run settings" → `{ "action": "Configure settings", "type": "config", "params": { "query": "app" } }`
- User: "pls config mode" → `{ "action": "Configure settings", "type": "config", "params": { "query": "mode" } }`
- User: "pls change debug settings" → `{ "action": "Configure settings", "type": "config", "params": { "query": "mode" } }`

The CONFIG tool will handle determining which specific config keys to show based on the query.

