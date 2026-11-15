export let sentinel = 'SENTINEL-7f3a9c';

export let hookTime = new Date('2026-06-15T11:59:00.000Z');

let common = {
  session_id: 'sess-123',
  transcript_path: `/Users/dev/.claude/projects/${sentinel}/transcript.jsonl`,
  cwd: `/Users/dev/code/${sentinel}`,
  permission_mode: 'default'
};

export let claudeHookPayloads: Record<string, Record<string, unknown>> = {
  SessionStart: {
    ...common,
    hook_event_name: 'SessionStart',
    source: 'startup',
    model: 'claude-sonnet-4-5'
  },
  SessionEnd: { ...common, hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' },
  UserPromptSubmit: {
    ...common,
    hook_event_name: 'UserPromptSubmit',
    prompt: `please fix ${sentinel}`,
    prompt_id: 'prompt-9'
  },
  UserPromptExpansion: {
    ...common,
    hook_event_name: 'UserPromptExpansion',
    command_name: 'review',
    command_source: 'project',
    command_args: sentinel
  },
  PreToolUse: {
    ...common,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_use_id: 'toolu_01',
    tool_input: { command: `cat ${sentinel}.txt`, description: sentinel }
  },
  PermissionRequest: {
    ...common,
    hook_event_name: 'PermissionRequest',
    tool_name: 'Edit',
    tool_use_id: 'toolu_02',
    tool_input: { file_path: `/x/${sentinel}.ts`, old_string: sentinel, new_string: sentinel }
  },
  PermissionDenied: {
    ...common,
    hook_event_name: 'PermissionDenied',
    tool_name: 'Bash',
    tool_use_id: 'toolu_03',
    tool_input: { command: `rm -rf ${sentinel}` },
    reason: `denied ${sentinel}`
  },
  PostToolUse: {
    ...common,
    hook_event_name: 'PostToolUse',
    tool_name: 'Read',
    tool_use_id: 'toolu_04',
    tool_input: { file_path: `/x/${sentinel}.ts` },
    tool_response: { content: sentinel },
    duration_ms: 42
  },
  PostToolUseFailure: {
    ...common,
    hook_event_name: 'PostToolUseFailure',
    tool_name: 'Bash',
    tool_use_id: 'toolu_05',
    tool_input: { command: 'false' },
    error: `exit 1: ${sentinel}`,
    is_interrupt: false,
    duration_ms: '17'
  },
  Stop: {
    ...common,
    hook_event_name: 'Stop',
    turn_id: 'turn-3',
    last_assistant_message: `done ${sentinel}`,
    stop_hook_active: false
  },
  StopFailure: {
    ...common,
    hook_event_name: 'StopFailure',
    error: 'rate_limit',
    error_details: `429 ${sentinel}`,
    last_assistant_message: sentinel
  },
  Interrupt: { ...common, hook_event_name: 'Interrupt' },
  SubagentStart: {
    ...common,
    hook_event_name: 'SubagentStart',
    agent_id: 'agent-1',
    agent_type: 'Explore'
  },
  SubagentStop: {
    ...common,
    hook_event_name: 'SubagentStop',
    agent_id: 'agent-1',
    agent_type: 'Explore',
    last_assistant_message: `found ${sentinel}`,
    agent_transcript_path: `/x/${sentinel}`
  },
  PreCompact: {
    ...common,
    hook_event_name: 'PreCompact',
    trigger: 'auto',
    custom_instructions: sentinel
  },
  PostCompact: {
    ...common,
    hook_event_name: 'PostCompact',
    trigger: 'manual',
    summary: sentinel
  },
  PostModelSwitch: {
    ...common,
    hook_event_name: 'PostModelSwitch',
    from_model: 'claude-sonnet-4-5',
    to_model: 'claude-opus-4-1',
    source: 'user'
  },
  ConfigChange: {
    ...common,
    hook_event_name: 'ConfigChange',
    source: 'user_settings',
    file_path: sentinel
  },
  Notification: { ...common, hook_event_name: 'Notification', message: sentinel },
  FileChanged: { ...common, hook_event_name: 'FileChanged', file_path: `/x/${sentinel}` },
  SomethingNew: { ...common, hook_event_name: 'SomethingNew', payload: sentinel }
};
