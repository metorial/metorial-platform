import type { ContentInput } from '@mtsrc/agent-tracking-content';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { withHookContext } from '../context';
import { readFields, withCoerced, type FieldReader } from '../fields';
import { classifyTool, parseMcpToolName, type ToolRef } from '../tools';
import type { HookContext, HookDialect, Mapped } from '../types';
import { errorFromStatus, nativeLabel, own, type ErrorClass } from '../values';

let maxHookEventLength = 64;

let startTypes: Record<string, string> = {
  startup: 'fresh',
  clear: 'fresh',
  resume: 'resume',
  compact: 'continue',
  fork: 'fork'
};

let stopFailureClasses: Record<string, ErrorClass> = {
  rate_limit: 'rate_limit',
  overloaded: 'overloaded',
  authentication_failed: 'auth',
  oauth_org_not_allowed: 'auth',
  account_on_hold: 'auth',
  billing_error: 'auth',
  cloud_credential_error: 'auth',
  invalid_request: 'invalid_request',
  model_not_found: 'invalid_request',
  max_output_tokens: 'invalid_request',
  server_error: 'server',
  unknown: 'unknown'
};

let unmappedCategories: Record<string, string> = {
  Notification: 'ui',
  MessageDisplay: 'ui',
  Setup: 'startup',
  InstructionsLoaded: 'memory',
  CwdChanged: 'diagnostic',
  DirectoryAdded: 'diagnostic',
  FileChanged: 'diagnostic',
  WorktreeCreate: 'diagnostic',
  WorktreeRemove: 'diagnostic',
  TaskCreated: 'diagnostic',
  TaskCompleted: 'diagnostic',
  TeammateIdle: 'diagnostic',
  Elicitation: 'diagnostic',
  ElicitationResult: 'diagnostic',
  PostToolBatch: 'diagnostic',
  PreModelSwitch: 'diagnostic',
  PreModelRequest: 'diagnostic',
  PostModelRequest: 'diagnostic'
};

export type CompatibleHookOptions = {
  id: string;
  adapter: string;
  client: string;
};

type HookState = {
  fields: FieldReader;
  event: string;
  context: HookContext;
  options: CompatibleHookOptions;
};

let eventNameOf = (fields: FieldReader) => {
  let raw = fields.str('hook_event_name', 'hookEventName', 'event_name', 'event');

  if (!raw) return undefined;

  return raw.length > maxHookEventLength ? raw.slice(0, maxHookEventLength) : raw;
};

let identityOf = (state: HookState, suffix = '') => {
  let { fields, event, context } = state;

  return [
    fields.str('session_id', 'sessionId') ?? '',
    event,
    fields.str('tool_use_id', 'toolUseId', 'call_id') ?? '',
    context.identityHint,
    suffix
  ].join('|');
};

let toolOf = (fields: FieldReader): ToolRef | undefined => {
  let name = fields.str('tool_name', 'toolName');
  if (!name) return undefined;

  let server = fields.obj('mcp_server');
  let serverName = typeof server?.name == 'string' ? server.name : undefined;

  let explicit = serverName
    ? { mcpServer: serverName, mcpTool: parseMcpToolName(name)?.tool ?? name }
    : {};

  return classifyTool(name, explicit);
};

let baseDraft = (
  state: HookState,
  type: string,
  extra: Partial<RecordDraft> = {}
): RecordDraft => {
  let { fields, context } = state;

  let sessionId = fields.str('session_id', 'sessionId');
  let agentId = fields.str('agent_id', 'agentId');
  let turnId = fields.str('turn_id', 'turnId', 'prompt_id', 'promptId');

  let model = fields.str('model');

  return {
    kind: 'event',
    type,
    identity: identityOf(state),
    signalName: state.event,
    occurredAt: context.occurredAt ?? null,
    client: { family: state.options.client },
    ctx: {
      sessionId,
      previousSessionId: fields.str(
        'previous_session_id',
        'previousSessionId',
        'forked_from_id'
      ),
      turnId,
      generationId: fields.str('generation_id', 'generationId'),
      toolCallId: fields.str('tool_use_id', 'toolUseId', 'call_id'),
      ...(agentId ? { agent: { id: agentId } } : {})
    },
    data: model && type == 'session.start' ? { model } : {},
    coerced: fields.coerced,
    ...extra
  };
};

let toolFactKey = (fields: FieldReader) => {
  let id = fields.str('tool_use_id', 'toolUseId', 'call_id');

  return id ? `tool:{session_key}:${id}` : null;
};

let withData = (draft: RecordDraft, data: Record<string, unknown>): RecordDraft => ({
  ...draft,
  data: { ...draft.data, ...data }
});

let contentOf = (role: ContentInput['role'], value: unknown, hints?: ContentInput['hints']) =>
  value === undefined || value === null ? [] : [{ role, value, hints } as ContentInput];

let unmapped = (state: HookState): RecordDraft => {
  let category = own(unmappedCategories, state.event);

  return withData(baseDraft(state, 'unmapped'), {
    native_name: state.event,
    ...(category ? { category } : {})
  });
};

let mapEvent = (state: HookState): RecordDraft[] => {
  let { fields, event } = state;

  switch (event) {
    case 'SessionStart': {
      let source = nativeLabel(fields.str('source'));
      let startType = own(startTypes, source);

      return [
        withData(baseDraft(state, 'session.start'), {
          ...(startType ? { start_type: startType } : {}),
          ...(source && !startType ? { native: { source } } : {})
        })
      ];
    }

    case 'SessionEnd':
      return [
        withData(baseDraft(state, 'session.end'), {
          ...(nativeLabel(fields.str('reason'))
            ? { reason: nativeLabel(fields.str('reason')) }
            : {})
        })
      ];

    case 'UserPromptSubmit': {
      let prompt = fields.str('prompt');

      return [
        withData(
          { ...baseDraft(state, 'prompt.submitted'), content: contentOf('prompt', prompt) },
          prompt ? { length_chars: prompt.length } : {}
        )
      ];
    }

    case 'UserPromptExpansion': {
      let name = nativeLabel(fields.str('command_name'));
      let source = nativeLabel(fields.str('command_source'));

      return [
        withData(baseDraft(state, 'command.invoked'), {
          ...(name ? { name } : {}),
          ...(source ? { source } : {})
        })
      ];
    }

    case 'PreToolUse': {
      let tool = toolOf(fields);

      return [
        withData(
          {
            ...baseDraft(state, 'tool.requested'),
            role: 'supplemental',
            factKey: toolFactKey(fields),
            content: contentOf('tool_input', fields.raw('tool_input', 'toolInput'), {
              tool: tool?.name
            })
          },
          { ...(tool ? { tool } : {}) }
        )
      ];
    }

    case 'PermissionRequest':
    case 'PermissionDenied': {
      let tool = toolOf(fields);
      let denied = event == 'PermissionDenied';

      return [
        withData(
          {
            ...baseDraft(state, 'tool.decision'),
            factKey: toolFactKey(fields),
            content: [
              ...contentOf('tool_input', fields.raw('tool_input', 'toolInput'), {
                tool: tool?.name
              }),
              ...contentOf('error_message', denied ? fields.str('reason') : undefined)
            ]
          },
          {
            ...(tool ? { tool } : {}),
            decision: {
              value: denied ? 'deny' : 'ask',
              source: 'unknown',
              scope: 'none',
              automatic: false
            }
          }
        )
      ];
    }

    case 'PostToolUse':
    case 'PostToolUseFailure': {
      let tool = toolOf(fields);
      let failed = event == 'PostToolUseFailure';
      let interrupted = fields.bool('is_interrupt', 'isInterrupt') === true;
      let duration = fields.count('duration_ms', 'durationMs');

      return [
        withData(
          {
            ...baseDraft(state, 'tool.call'),
            factKey: toolFactKey(fields),
            durationMs: duration,
            content: [
              ...contentOf('tool_input', fields.raw('tool_input', 'toolInput'), {
                tool: tool?.name
              }),
              ...contentOf('tool_output', fields.raw('tool_response', 'toolResponse'), {
                tool: tool?.name
              }),
              ...contentOf('error_message', failed ? fields.raw('error') : undefined)
            ]
          },
          {
            ...(tool ? { tool } : {}),
            outcome: failed ? (interrupted ? 'cancelled' : 'error') : 'ok',
            ...(failed && !interrupted ? { error: { class: 'tool' } } : {}),
            ...(duration !== undefined ? { duration_ms: duration } : {})
          }
        )
      ];
    }

    case 'Stop': {
      let message = fields.str('last_assistant_message', 'lastAssistantMessage');
      let turnId = fields.str('turn_id', 'turnId', 'prompt_id', 'promptId');

      let turn = withData(
        {
          ...baseDraft(state, 'turn.completed'),
          factKey: turnId ? `turn:{session_key}:${turnId}` : null
        },
        { outcome: 'ok' }
      );

      if (message === undefined) return [turn];

      return [
        turn,
        withData(
          {
            ...baseDraft(state, 'message.assistant'),
            identity: identityOf(state, 'message'),
            content: contentOf('response', message)
          },
          { length_chars: message.length, final: true }
        )
      ];
    }

    case 'StopFailure': {
      let native = nativeLabel(fields.str('error'));
      let errorClass = own(stopFailureClasses, native) ?? 'unknown';

      return [
        withData(
          {
            ...baseDraft(state, 'turn.completed'),
            content: [
              ...contentOf('error_message', fields.raw('error_details', 'errorDetails')),
              ...contentOf('response', fields.str('last_assistant_message'))
            ]
          },
          {
            outcome: 'error',
            error: { ...errorFromStatus(undefined, native, errorClass), class: errorClass }
          }
        )
      ];
    }

    case 'Interrupt':
      return [withData(baseDraft(state, 'turn.completed'), { outcome: 'cancelled' })];

    case 'SubagentStart':
    case 'SubagentStop': {
      let agentId = fields.str('agent_id', 'agentId');
      let agentType = nativeLabel(fields.str('agent_type', 'agentType'));
      let stop = event == 'SubagentStop';

      return [
        withData(
          {
            ...baseDraft(state, stop ? 'agent.end' : 'agent.start'),
            factKey: agentId ? `agent:{session_key}:${agentId}` : null,
            content: stop
              ? contentOf(
                  'response',
                  fields.str('last_assistant_message', 'lastAssistantMessage')
                )
              : []
          },
          {
            ...(agentType ? { name: agentType, type: agentType } : {}),
            ...(stop ? { status: 'completed' } : {})
          }
        )
      ];
    }

    case 'PreCompact':
    case 'PostCompact': {
      let trigger = nativeLabel(fields.str('trigger'));
      let done = event == 'PostCompact';

      return [
        withData(
          {
            ...baseDraft(state, 'context.compaction'),
            role: done ? 'primary' : 'supplemental'
          },
          {
            ...(trigger ? { trigger } : {}),
            outcome: done ? 'ok' : 'started'
          }
        )
      ];
    }

    case 'PostModelSwitch': {
      let from = nativeLabel(fields.str('from_model'));
      let to = nativeLabel(fields.str('to_model'));
      let trigger = nativeLabel(fields.str('source'));

      return [
        withData(baseDraft(state, 'settings.changed'), {
          setting: 'model',
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(trigger ? { trigger } : {})
        })
      ];
    }

    case 'ConfigChange': {
      let trigger = nativeLabel(fields.str('source'));

      return [
        withData(baseDraft(state, 'settings.changed'), {
          setting: 'config',
          ...(trigger ? { trigger } : {})
        })
      ];
    }

    default:
      return [unmapped(state)];
  }
};

export let createCompatibleHookDialect = (options: CompatibleHookOptions): HookDialect => ({
  id: options.id,
  adapter: options.adapter,
  client: options.client,

  map: (context, payload): Mapped[] => {
    let fields = readFields(payload, 'payload.');
    let event = eventNameOf(fields) ?? 'unknown';

    let state: HookState = { fields, event, context, options };

    let mapped: Mapped[] = mapEvent(state).map(draft => ({
      source: { adapter: options.adapter, dialect: options.id, channel: 'hook' },
      draft
    }));

    return withCoerced(withHookContext(mapped, fields, event), fields);
  }
});
