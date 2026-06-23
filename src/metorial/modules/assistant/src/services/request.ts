import { createAssistantRequestDeltasConnection } from '@metorial-platform-systems/synthesis-client';
import { type Instance, type Organization } from '@metorial/db';
import { assertAssistantScope } from '../lib/assertAssistantScope';
import { createSynthesisService, getSynthesisServicePayload } from '../lib/synthesisService';
import {
  enrichSynthesisActors,
  getAssistantActorInput,
  getSynthesisLiveEndpoint,
  resolveMetorialInstanceBySynthesisScope,
  synthesis,
  type AssistantActorInput,
  type AssistantInputMessage,
  type EnrichedAssistantActor,
  type SynthesisScope
} from '../synthesis';
import { enrichMessage } from './message';

export type AgentRunWireMessage = any;
type SynthesisRequest = Awaited<ReturnType<typeof synthesis.request.get>>;

export type AssistantRequestWithRelations = SynthesisRequest & {
  actor: EnrichedAssistantActor | null;
};

let enrichRequest = async (d: {
  scope: SynthesisScope;
  instance: Instance;
  request: SynthesisRequest;
}): Promise<AssistantRequestWithRelations> => {
  if (!d.request.actorId) {
    return {
      ...d.request,
      actor: null
    };
  }

  let [actor] = await enrichSynthesisActors({
    instance: d.instance,
    actors: [
      await synthesis.actor.get({
        tenantId: d.scope.tenantId,
        actorId: d.request.actorId
      })
    ]
  });

  return {
    ...d.request,
    actor: actor ?? null
  };
};

export let assistantRequestService = createSynthesisService(
  'assistantRequestService',
  synthesis.request,
  ['get', 'create'],
  () => {
    let service = {
      get: async (
        d: {
          organization: Organization;
          instance: Instance;
          requestId: string;
        } & AssistantActorInput
      ) => {
        assertAssistantScope(d);

        let { context, payload } = await getSynthesisServicePayload({
          instance: d.instance,
          ...getAssistantActorInput(d),
          requestId: d.requestId
        });

        return await enrichRequest({
          scope: context.scope,
          instance: d.instance,
          request: await synthesis.request.get(
            payload as Parameters<typeof synthesis.request.get>[0]
          )
        });
      },

      lookup: async (d: { requestId: string }) => {
        let lookup = await synthesis.request.lookup({
          requestId: d.requestId
        });
        let instance = await resolveMetorialInstanceBySynthesisScope({
          tenantIdentifier: lookup.tenant.identifier,
          environmentIdentifier: lookup.environment.identifier
        });
        let lookupActor =
          lookup.request.actorId != null
            ? await synthesis.actor.get({
                tenantId: lookup.tenant.id,
                actorId: lookup.request.actorId
              })
            : null;

        return {
          request: lookup.request,
          organization: instance.organization,
          instance,
          actorId:
            lookupActor?.organizationActorId ??
            lookupActor?.consumerId ??
            lookup.request.actorId ??
            null
        };
      },

      create: async (
        d: {
          organization: Organization;
          instance: Instance;
          conversationId: string;
          message: AssistantInputMessage;
          parentMessageId?: string;
          modelId?: string;
        } & AssistantActorInput
      ) => {
        assertAssistantScope(d);

        let { context, payload } = await getSynthesisServicePayload({
          instance: d.instance,
          ...getAssistantActorInput(d),
          conversationId: d.conversationId,
          message: d.message,
          parentMessageId: d.parentMessageId,
          modelId: d.modelId
        });
        let result = await synthesis.request.create(
          payload as Parameters<typeof synthesis.request.create>[0]
        );

        return {
          request: await enrichRequest({
            scope: context.scope,
            instance: d.instance,
            request: result.request
          }),
          item: await enrichMessage({
            scope: context.scope,
            instance: d.instance,
            message: result.message
          })
        };
      },

      respondToHandoffs: async (
        d: {
          organization: Organization;
          instance: Instance;
          conversationId: string;
          messageId: string;
          responses: Array<{
            toolCallId: string;
            output: unknown;
          }>;
        } & AssistantActorInput
      ) => {
        assertAssistantScope(d);

        let { context, payload } = await getSynthesisServicePayload({
          instance: d.instance,
          ...getAssistantActorInput(d),
          conversationId: d.conversationId,
          messageId: d.messageId,
          responses: d.responses
        });
        let message = await synthesis.request.respondToHandoffs(
          payload as Parameters<typeof synthesis.request.respondToHandoffs>[0]
        );

        return await enrichMessage({
          scope: context.scope,
          instance: d.instance,
          message
        });
      },

      listenToDeltas: async (
        d: {
          organization: Organization;
          instance: Instance;
          requestId: string;
          signal?: AbortSignal;
          onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
          onError?: (error: Error) => void | Promise<void>;
          onDone?: (message: {
            status: 'completed' | 'waiting_for_user' | 'cancelled' | 'failed';
          }) => void | Promise<void>;
        } & AssistantActorInput
      ) => {
        let request = await service.get(d);
        let connection = createAssistantRequestDeltasConnection(
          {
            liveEndpoint: getSynthesisLiveEndpoint()
          },
          {
            assistantRequestId: request.id
          }
        );
        let finished = false;

        let close = () => {
          if (finished) return;
          finished = true;
          connection.close();
        };

        let emitError = async (error: unknown) => {
          if (finished) return;
          let nextError =
            error instanceof Error ? error : new Error('Assistant stream failed');
          if (d.onError) {
            await d.onError(nextError);
          }
          close();
        };

        let onAbort = () => {
          close();
        };

        d.signal?.addEventListener('abort', onAbort, { once: true });

        connection.addEventListener('snapshot', (event: Event) => {
          void (async () => {
            try {
              await d.onMessage(
                JSON.parse((event as MessageEvent<string>).data) as AgentRunWireMessage
              );
            } catch (error) {
              await emitError(error);
            }
          })();
        });

        connection.addEventListener('delta', (event: Event) => {
          void (async () => {
            try {
              await d.onMessage(
                JSON.parse((event as MessageEvent<string>).data) as AgentRunWireMessage
              );
            } catch (error) {
              await emitError(error);
            }
          })();
        });

        connection.addEventListener('done', (event: Event) => {
          void (async () => {
            try {
              if (d.onDone) {
                await d.onDone(
                  JSON.parse((event as MessageEvent<string>).data) as {
                    status: 'completed' | 'waiting_for_user' | 'cancelled' | 'failed';
                  }
                );
              }
            } finally {
              close();
            }
          })();
        });

        connection.addEventListener('error', (event: Event) => {
          void (async () => {
            let payload = (event as MessageEvent<string>).data;
            if (typeof payload == 'string' && payload) {
              try {
                let parsed = JSON.parse(payload) as { message?: string };
                await emitError(new Error(parsed.message ?? 'Assistant stream failed'));
                return;
              } catch {
                await emitError(new Error(payload));
                return;
              }
            }

            await emitError(new Error('Assistant stream connection failed'));
          })();
        });

        return async () => {
          d.signal?.removeEventListener('abort', onAbort);
          close();
        };
      }
    };

    return service;
  }
);
