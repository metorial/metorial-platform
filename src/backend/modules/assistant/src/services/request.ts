import { Service } from '@lowerdeck/service';
import { createAssistantRequestDeltasConnection } from '@metorial-platform-systems/synthesis-client';
import { type Instance, type Organization } from '@metorial/db';
import {
  enrichSynthesisActors,
  ensureSynthesisActor,
  ensureSynthesisScope,
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

class AssistantRequestServiceImpl {
  private ensureScope(
    d: {
      organization: Organization;
      instance: Instance;
      conversation: {
        id: string;
      };
    } & AssistantActorInput
  ) {
    if (d.instance.organizationOid !== d.organization.oid) {
      throw new Error('Assistant request scope is invalid');
    }

    if (d.actor && d.actor.organizationOid !== d.organization.oid) {
      throw new Error('Assistant request scope is invalid');
    }
  }

  async getAssistantRequestById(
    d: {
      organization: Organization;
      instance: Instance;
      requestId: string;
    } & AssistantActorInput
  ) {
    let scope = await ensureSynthesisScope({
      instance: d.instance
    });
    let actor = await ensureSynthesisActor({
      scope,
      ...getAssistantActorInput(d)
    });
    let request = await synthesis.request.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      requestId: d.requestId
    });

    return await enrichRequest({
      scope,
      instance: d.instance,
      request
    });
  }

  async lookupAssistantRequestById(d: { requestId: string }) {
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
  }

  async createAssistantRequest(
    d: {
      organization: Organization;
      instance: Instance;
      conversation: {
        id: string;
      };
      input: {
        message: AssistantInputMessage;
        parentMessageId?: string;
        modelId?: string;
      };
    } & AssistantActorInput
  ) {
    this.ensureScope(d);

    let scope = await ensureSynthesisScope({
      instance: d.instance
    });
    let actor = await ensureSynthesisActor({
      scope,
      ...getAssistantActorInput(d)
    });
    let result = await synthesis.request.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: actor.id,
      conversationId: d.conversation.id,
      message: d.input.message,
      parentMessageId: d.input.parentMessageId,
      modelId: d.input.modelId
    });

    return {
      request: await enrichRequest({
        scope,
        instance: d.instance,
        request: result.request
      }),
      item: await enrichMessage({
        scope,
        instance: d.instance,
        message: result.message
      })
    };
  }

  async listenToAssistantRequestDeltas(
    d: {
      organization: Organization;
      instance: Instance;
      requestId: string;
      signal?: AbortSignal;
      onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onDone?: (message: {
        status: 'completed' | 'cancelled' | 'failed';
      }) => void | Promise<void>;
    } & AssistantActorInput
  ) {
    let request = await this.getAssistantRequestById(d);
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
      let nextError = error instanceof Error ? error : new Error('Assistant stream failed');
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
                status: 'completed' | 'cancelled' | 'failed';
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
}

export let assistantRequestService = Service.create(
  'assistantRequestService',
  () => new AssistantRequestServiceImpl()
).build();
