import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let contentModes = ['basic', 'shape', 'full'] as const;

export type ContentMode = (typeof contentModes)[number];

export let contentRoles = [
  'prompt',
  'response',
  'tool_input',
  'tool_output',
  'system_prompt',
  'raw_request',
  'raw_response',
  'error_message',
  'diff',
  'path'
] as const;

export type ContentRole = (typeof contentRoles)[number];

export let contentStates = ['present', 'redacted_by_client', 'length_only'] as const;

export type ContentState = (typeof contentStates)[number];

let contentModeSchema = v.enumOf(contentModes);

export let contentPolicySchema = v.object({
  defaultMode: contentModeSchema,

  roles: v.optional(
    v.object({
      prompt: v.optional(contentModeSchema),
      response: v.optional(contentModeSchema),
      tool_input: v.optional(contentModeSchema),
      tool_output: v.optional(contentModeSchema),
      system_prompt: v.optional(contentModeSchema),
      raw_request: v.optional(contentModeSchema),
      raw_response: v.optional(contentModeSchema),
      error_message: v.optional(contentModeSchema),
      diff: v.optional(contentModeSchema),
      path: v.optional(contentModeSchema)
    })
  )
});

export type ContentPolicy = ValidationTypeValue<typeof contentPolicySchema>;

export let defaultContentPolicy: ContentPolicy = { defaultMode: 'basic' };
