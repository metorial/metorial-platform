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
  'typoglycemia',
  'ascii_smuggling',
  'exfil_channel',
  'hidden_content',
  'cross_tool_reference',
  'addressed_to_agent',
  'secret_in_arguments',
  'tool_poisoning',
  'tool_shadowing',
  'tool_rug_pull',
  'injection_followed_by_sink'
] as const);

export let protoGuardSeverityValidator = v.enumOf([
  'low',
  'medium',
  'high',
  'critical'
] as const);
