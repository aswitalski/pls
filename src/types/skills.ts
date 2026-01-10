/**
 * Type definitions for the structured skill system
 */

/**
 * Parsed skill definition from markdown file
 */
export interface SkillDefinition {
  /** Unique skill key (from filename without extension, e.g., "deploy-app") */
  key: string;
  /** Display name (from ### Name section if present, otherwise derived from key) */
  name: string;
  /** Skill description (from ### Description section) */
  description: string;
  /** Example commands/aliases (from ### Aliases section) */
  aliases?: string[];
  /** Configuration schema (from ### Config section, parsed YAML) */
  config?: ConfigSchema;
  /** Logical workflow steps (from ### Steps section) */
  steps: string[];
  /** Executable commands (from ### Execution section) */
  execution: string[];
  /** Whether the skill passes validation */
  isValid: boolean;
  /** Validation error message if skill is invalid */
  validationError?: string;
  /** Whether the skill is incomplete (valid but needs more documentation) */
  isIncomplete?: boolean;
}

/**
 * Configuration value types
 */
export type ConfigValue = 'string' | 'boolean' | 'number';

/**
 * Configuration schema defining required properties
 * Nested structure matching YAML format
 * Allows arbitrary nesting of objects with leaf nodes being ConfigValue types
 */
export type ConfigSchema = {
  [key: string]: ConfigValue | ConfigSchema;
};

/**
 * Parsed placeholder information
 */
export interface PlaceholderInfo {
  /** Original placeholder string (e.g., "{opera.VARIANT.repo}") */
  original: string;
  /** Path components */
  path: string[];
  /** True if contains VARIANT keyword requiring LLM matching */
  hasVariant: boolean;
  /** Index of VARIANT in path (if hasVariant is true) */
  variantIndex?: number;
}

/**
 * Configuration requirement extracted from execution commands
 */
export interface ConfigRequirement {
  /** Full config path (e.g., "opera.gx.repo") */
  path: string;
  /** Expected type */
  type: ConfigValue;
  /** Human-readable description for prompting (optional, can be generated via VALIDATE tool) */
  description?: string;
}

/**
 * Skill reference information
 */
export interface SkillReference {
  /** Original reference string (e.g., "[Navigate To Opera Build]") */
  original: string;
  /** Referenced skill name */
  skillName: string;
  /** Position in execution array */
  position: number;
}

/**
 * Result of config validation
 */
export interface ConfigValidationResult {
  /** Whether all required config is present */
  valid: boolean;
  /** Missing config requirements */
  missing: ConfigRequirement[];
}

/**
 * Execution line types
 */
export type ExecutionLine =
  | { type: 'command'; command: string }
  | { type: 'reference'; skillName: string };

/**
 * Result of loading skills for prompt construction
 * Single source of truth for both LLM prompts and debug display
 */
export interface SkillsForPrompt {
  /** Formatted skills section exactly as sent to LLM */
  formatted: string;
  /** Parsed definitions for app logic (validation, matching) */
  definitions: SkillDefinition[];
}
