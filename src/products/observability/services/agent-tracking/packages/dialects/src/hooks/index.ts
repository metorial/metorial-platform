import { withHookContext } from '../context';
import { readFields, withCoerced } from '../fields';
import type { HookDialect, Mapped } from '../types';
import { nativeLabel } from '../values';
import { createCompatibleHookDialect } from './compatible';

export let claudeCodeHooks = createCompatibleHookDialect({
  id: 'claude-code.hooks.v1',
  adapter: 'claude-code',
  client: 'claude-code'
});

export let codexHooks = createCompatibleHookDialect({
  id: 'codex.hooks.v1',
  adapter: 'codex',
  client: 'codex'
});

export let genericHooksId = 'generic.hooks.v1';

export let createGenericHooks = (client: string): HookDialect => ({
  id: genericHooksId,
  adapter: 'generic',
  client,

  map: (context, payload): Mapped[] => {
    let fields = readFields(payload, 'payload.');

    let event =
      nativeLabel(fields.str('hook_event_name', 'hookEventName', 'event_name', 'event')) ??
      'unknown';

    let sessionId = fields.str('session_id', 'sessionId', 'conversation_id', 'conversationId');
    let email = fields.str('user_email', 'userEmail');

    let mapped: Mapped[] = [
      {
        source: { adapter: 'generic', dialect: genericHooksId, channel: 'hook' },
        draft: {
          kind: 'event',
          type: 'unmapped',
          identity: [sessionId ?? '', event, context.identityHint].join('|'),
          signalName: event,
          occurredAt: context.occurredAt ?? null,
          client: { family: client },
          ...(email ? { actor: { user: { email }, identity_source: 'client_claim' } } : {}),
          ctx: {
            sessionId,
            parentSessionId: fields.str(
              'parent_conversation_id',
              'parentConversationId',
              'parentID'
            ),
            generationId: fields.str('generation_id', 'generationId')
          },
          data: { native_name: event },
          coerced: fields.coerced
        }
      }
    ];

    return withCoerced(withHookContext(mapped, fields, event), fields);
  }
});

let hookDialectsByClient: Record<string, HookDialect> = {
  'claude-code': claudeCodeHooks,
  codex: codexHooks
};

let knownDialectFor = (client: string): HookDialect | undefined =>
  Object.hasOwn(hookDialectsByClient, client) ? hookDialectsByClient[client] : undefined;

export let hookDialectFor = (client: string): HookDialect =>
  knownDialectFor(client) ?? createGenericHooks(client);

export let hookDialectById = (client: string, id: string): HookDialect | null => {
  let known = knownDialectFor(client);

  if (known && known.id == id) return known;
  if (id == genericHooksId) return createGenericHooks(client);

  return null;
};
