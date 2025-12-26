import { z } from 'zod';

import type { ScheduledTask } from './types.js';
import { Origin, TaskType } from './types.js';

/**
 * Zod schema for TaskType enum values.
 * Validates that task types match the expected enum values.
 */
export const TaskTypeSchema = z.enum([
  TaskType.Config,
  TaskType.Schedule,
  TaskType.Execute,
  TaskType.Answer,
  TaskType.Introspect,
  TaskType.Report,
  TaskType.Define,
  TaskType.Ignore,
  TaskType.Select,
  TaskType.Discard,
  TaskType.Group,
]);

/**
 * Zod schema for Origin enum values.
 * Validates capability origin types.
 */
export const OriginSchema = z.enum([
  Origin.BuiltIn,
  Origin.UserProvided,
  Origin.Indirect,
]);

/**
 * Zod schema for base Task type.
 * Validates task structure with required action and type fields.
 */
export const TaskSchema = z.object({
  action: z.string().min(1),
  type: TaskTypeSchema,
  params: z.record(z.string(), z.unknown()).optional(),
  config: z.array(z.string()).optional(),
});

/**
 * Zod schema for recursive ScheduledTask type.
 * Uses z.lazy for self-referential subtasks validation.
 */
export const ScheduledTaskSchema: z.ZodType<ScheduledTask> = z.object({
  action: z.string().min(1),
  type: TaskTypeSchema,
  params: z.record(z.string(), z.unknown()).optional(),
  config: z.array(z.string()).optional(),
  subtasks: z.lazy(() => ScheduledTaskSchema.array()).optional(),
});

/**
 * Zod schema for ExecuteCommand type.
 * Validates shell command execution parameters.
 */
export const ExecuteCommandSchema = z.object({
  description: z.string().min(1),
  command: z.string().min(1),
  workdir: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  critical: z.boolean().optional(),
});

/**
 * Zod schema for Capability type.
 * Validates skill and capability definitions.
 */
export const CapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  origin: OriginSchema,
  isIncomplete: z.boolean().optional(),
});

/**
 * Zod schema for ComponentDefinition type.
 * Flexible schema for debug component validation.
 * Accepts both stateless and stateful component structures.
 */
export const ComponentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  props: z.record(z.string(), z.unknown()),
  state: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

/**
 * Zod schema for CommandResult type.
 * Validates LLM responses from execute, answer, and schedule tools.
 */
export const CommandResultSchema = z.object({
  message: z.string(),
  summary: z.string().optional(),
  tasks: z.array(ScheduledTaskSchema),
  answer: z.string().optional(),
  commands: z.array(ExecuteCommandSchema).optional(),
  debug: z.array(ComponentDefinitionSchema).optional(),
});

/**
 * Zod schema for IntrospectResult type.
 * Validates LLM responses from introspect tool.
 */
export const IntrospectResultSchema = z.object({
  message: z.string(),
  capabilities: z.array(CapabilitySchema),
  debug: z.array(ComponentDefinitionSchema).optional(),
});
