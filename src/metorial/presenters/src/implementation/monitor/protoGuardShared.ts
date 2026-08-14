import { v } from '@lowerdeck/validation';

export let protoGuardIssueTypeValidator = v.enumOf([
  'instruction_override',
  'role_hijack',
  'jailbreak_persona',
  'prompt_exfiltration',
  'tool_call_forgery',
  'format_break',
  'instruction_block',
  'unicode_smuggling',
  'encoded_payload',
  'typoglycemia'
] as const);

export let protoGuardSeverityValidator = v.enumOf([
  'low',
  'medium',
  'high',
  'critical'
] as const);
