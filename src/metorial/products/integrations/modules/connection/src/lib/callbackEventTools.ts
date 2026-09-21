import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db, type Session, type SessionProvider, type Tenant } from '@metorial-subspace/db';
import {
  callbackEventService,
  type CallbackEventWithDetails,
  type CallbackEventWithRelations
} from '@metorial-subspace/module-callback';
import { sessionAsToolOwner } from './connectionStatusTool';
import { buildSyntheticTool, type SyntheticProviderTool } from './syntheticTool';

export let LIST_CALLBACK_EVENTS_TOOL_KEY = 'metorial_list_callback_events';
export let GET_CALLBACK_EVENT_TOOL_KEY = 'metorial_get_callback_event';
export let MARK_CALLBACK_EVENTS_READ_TOOL_KEY = 'metorial_mark_callback_events_read';

let CALLBACK_EVENT_TOOL_KEYS = new Set([
  LIST_CALLBACK_EVENTS_TOOL_KEY,
  GET_CALLBACK_EVENT_TOOL_KEY,
  MARK_CALLBACK_EVENTS_READ_TOOL_KEY
]);

export let isCallbackEventTool = (toolId: string) => CALLBACK_EVENT_TOOL_KEYS.has(toolId);

let LIST_LIMIT_DEFAULT = 25;
let LIST_LIMIT_MAX = 100;

let listInputValidator = v.object({
  after: v.optional(v.string()),
  callback_id: v.optional(v.string()),
  provider_trigger_key: v.optional(v.string()),
  unread_only: v.optional(v.boolean()),
  limit: v.optional(v.number({ modifiers: [v.integer(), v.positive()] }))
});

let getInputValidator = v.object({
  callback_event_id: v.string()
});

let markReadInputValidator = v.object({
  callback_event_ids: v.array(v.string())
});

let presentCallbackEvent = (event: CallbackEventWithRelations) => ({
  id: event.id,
  status: event.status,
  source: event.source,
  provider_trigger_key: event.providerTriggerKey,
  mapped_type: event.mappedType,
  mapped_id: event.mappedId,
  callback: {
    id: event.callback.id,
    name: event.callback.name,
    provider: { id: event.callback.provider.id, name: event.callback.provider.name }
  },
  occurred_at: event.occurredAt,
  read_at: event.readAt,
  created_at: event.createdAt
});

let presentCallbackEventWithDetails = (event: CallbackEventWithDetails) => ({
  ...presentCallbackEvent(event),
  payload: event.details?.payload ?? null,
  processing: event.details
    ? { status: event.details.status, error: event.details.error }
    : null,
  webhook: event.details?.webhook
    ? {
        id: event.details.webhook.id,
        status: event.details.webhook.status,
        received_at: event.details.webhook.receivedAt,
        request: event.details.webhook.request
      }
    : null
});

let validateInput = <T>(
  validator: { validate: (value: unknown) => any },
  input: unknown
): T => {
  let result = validator.validate(input ?? {});
  if (!result.success) {
    throw new ServiceError(
      badRequestError({
        code: 'invalid_tool_input',
        message: 'Invalid tool input',
        errors: result.errors
      })
    );
  }
  return result.value as T;
};

export type CallbackEventToolScope = {
  integrationProviderIds: string[];
};

let integrationProviderScopeSelect = {
  integrationProvider: { select: { id: true } },
  integration: { select: { enableCallbackTools: true } }
} as const;

export let resolveCallbackEventToolScope = async (
  providers: Array<Pick<SessionProvider, 'fromTemplateProviderOid'>>
): Promise<CallbackEventToolScope | null> => {
  let templateProviderOids = providers
    .map(provider => provider.fromTemplateProviderOid)
    .filter((oid): oid is bigint => oid !== null);
  if (!templateProviderOids.length) return null;

  let templateProviders = await db.sessionTemplateProvider.findMany({
    where: { oid: { in: templateProviderOids } },
    select: {
      integrationInstanceProvider: { select: integrationProviderScopeSelect },
      integrationInstanceGroupProvider: { select: integrationProviderScopeSelect }
    }
  });

  let integrationProviderIds = new Set<string>();
  for (let templateProvider of templateProviders) {
    let source =
      templateProvider.integrationInstanceProvider ??
      templateProvider.integrationInstanceGroupProvider;
    if (source?.integration.enableCallbackTools) {
      integrationProviderIds.add(source.integrationProvider.id);
    }
  }

  if (!integrationProviderIds.size) return null;

  return { integrationProviderIds: [...integrationProviderIds] };
};

export let buildCallbackEventTools = (session: Session): SyntheticProviderTool[] => {
  let sessionProvider = sessionAsToolOwner(session);

  return [
    buildSyntheticTool({
      sessionProvider,
      idSuffix: LIST_CALLBACK_EVENTS_TOOL_KEY,
      key: LIST_CALLBACK_EVENTS_TOOL_KEY,
      name: 'Metorial: list callback events',
      description: [
        'Lists the webhook and trigger events (callback events) that Metorial has received and stored for the callbacks of the providers linked to this connection, newest first.',
        'Use this to find incoming events to act on. By default only unread events are returned; pass unread_only=false to include events that were already marked as read.',
        `Use ${GET_CALLBACK_EVENT_TOOL_KEY} to load the full payload of an event, and ${MARK_CALLBACK_EVENTS_READ_TOOL_KEY} once an event has been handled.`
      ].join('\n\n'),
      inputJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          after: {
            type: 'string',
            description: 'The next_cursor from a previous response to fetch the next page.'
          },
          callback_id: {
            type: 'string',
            description: 'Only return events recorded for this callback.'
          },
          provider_trigger_key: {
            type: 'string',
            description:
              'Only return events produced by this provider trigger key, e.g. "repository.pushed".'
          },
          unread_only: {
            type: 'boolean',
            default: true,
            description: 'When true (default), only events that have not been marked as read.'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: LIST_LIMIT_MAX,
            default: LIST_LIMIT_DEFAULT,
            description: 'Maximum number of events to return.'
          }
        }
      },
      metadata: { metorialCallbackEvents: true }
    }),

    buildSyntheticTool({
      sessionProvider,
      idSuffix: GET_CALLBACK_EVENT_TOOL_KEY,
      key: GET_CALLBACK_EVENT_TOOL_KEY,
      name: 'Metorial: get callback event',
      description: [
        'Returns a single callback event including the payload the provider produced for it and, if it came in via webhook, the inbound HTTP request.',
        `Use this after ${LIST_CALLBACK_EVENTS_TOOL_KEY} to inspect an event before acting on it.`
      ].join('\n\n'),
      inputJsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['callback_event_id'],
        properties: {
          callback_event_id: {
            type: 'string',
            description: 'The id of the callback event to load.'
          }
        }
      },
      metadata: { metorialCallbackEvents: true }
    }),

    buildSyntheticTool({
      sessionProvider,
      idSuffix: MARK_CALLBACK_EVENTS_READ_TOOL_KEY,
      key: MARK_CALLBACK_EVENTS_READ_TOOL_KEY,
      name: 'Metorial: mark callback events as read',
      description: [
        'Marks one or more callback events as read so they no longer show up as unread in Metorial.',
        'Call this once you have acted on an event. Events that are already read or do not belong to the providers linked to this connection are ignored; the response lists the ids that were actually marked.'
      ].join('\n\n'),
      inputJsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['callback_event_ids'],
        properties: {
          callback_event_ids: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
            description: 'Ids of the callback events to mark as read.'
          }
        }
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      tags: { readOnly: false, destructive: false },
      metadata: { metorialCallbackEvents: true }
    })
  ];
};

export let runCallbackEventTool = async (d: {
  toolKey: string;
  arguments: unknown;
  tenant: Tenant;
  session: Session;
  scope: CallbackEventToolScope;
}): Promise<Record<string, any>> => {
  let environment = await db.environment.findUniqueOrThrow({
    where: { oid: d.session.environmentOid }
  });
  let scope = {
    tenant: d.tenant,
    environment,
    integrationProviderIds: d.scope.integrationProviderIds
  };

  switch (d.toolKey) {
    case LIST_CALLBACK_EVENTS_TOOL_KEY: {
      let input = validateInput<{
        after?: string;
        callback_id?: string;
        provider_trigger_key?: string;
        unread_only?: boolean;
        limit?: number;
      }>(listInputValidator, d.arguments);

      let paginator = await callbackEventService.listCallbackEventsInternal({
        ...scope,
        callbackIds: input.callback_id ? [input.callback_id] : undefined,
        providerTriggerKeys: input.provider_trigger_key
          ? [input.provider_trigger_key]
          : undefined,
        unread: input.unread_only ?? true
      });
      let list = await paginator.run({
        after: input.after,
        limit: Math.min(input.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX),
        order: 'desc'
      });

      return {
        events: list.items.map(presentCallbackEvent),
        has_more: list.pagination.hasNextPage,
        next_cursor: list.pagination.hasNextPage ? (list.items.at(-1)?.id ?? null) : null
      };
    }

    case GET_CALLBACK_EVENT_TOOL_KEY: {
      let input = validateInput<{ callback_event_id: string }>(getInputValidator, d.arguments);

      let event = await callbackEventService.getCallbackEventByIdInternal({
        ...scope,
        callbackEventId: input.callback_event_id
      });

      return { event: presentCallbackEventWithDetails(event) };
    }

    case MARK_CALLBACK_EVENTS_READ_TOOL_KEY: {
      let input = validateInput<{ callback_event_ids: string[] }>(
        markReadInputValidator,
        d.arguments
      );

      let { markedIds } = await callbackEventService.markCallbackEventsReadInternal({
        ...scope,
        callbackEventIds: input.callback_event_ids
      });

      return {
        marked_read_ids: markedIds,
        skipped_ids: input.callback_event_ids.filter(id => !markedIds.includes(id))
      };
    }

    default:
      throw new ServiceError(badRequestError({ message: `Unknown tool ${d.toolKey}` }));
  }
};
