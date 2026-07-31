import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { AssistantMessageSerializedContent } from '@metorial-platform-systems/synthesis-client';
import {
  db,
  type Consumer,
  type Instance,
  type OrganizationActor,
  type Prisma
} from '@metorial/db';
import {
  ensureInternalActor,
  ensureInternalScope,
  synthesis as internalSynthesis,
  type InternalScope
} from '@metorial/internal-clients';
import { env } from './env';

export let synthesis = internalSynthesis;
export type SynthesisScope = InternalScope;

type SynthesisActor = Awaited<ReturnType<typeof synthesis.actor.get>>;

let organizationActorInclude = {
  organization: true,
  member: true,
  teams: {
    include: {
      team: true
    }
  }
} as const;

let consumerInclude = {
  organizationMember: true,
  instanceConsumers: {
    include: {
      consumer: true
    }
  },
  profiles: {
    include: {
      consumer: {
        include: {
          instanceConsumers: {
            include: {
              consumer: true
            }
          }
        }
      },
      organizationMember: true,
      surface: true
    }
  }
} satisfies Prisma.ConsumerInclude;

type EnrichedOrganizationActor = Prisma.OrganizationActorGetPayload<{
  include: typeof organizationActorInclude;
}>;

type EnrichedConsumer = Prisma.ConsumerGetPayload<{
  include: typeof consumerInclude;
}>;

type EnrichedConsumerProfile = EnrichedConsumer['profiles'][number];

export type EnrichedAssistantActor = {
  name: string;
  organizationActor: EnrichedOrganizationActor | null;
  consumer: EnrichedConsumer | null;
  consumerProfile: EnrichedConsumerProfile | null;
  synthesisActor: SynthesisActor;
};

export type AssistantActorInput =
  | {
      actor: OrganizationActor;
      consumer?: undefined;
    }
  | {
      actor?: undefined;
      consumer: Consumer;
    };

export let getAssistantActorInput = (d: AssistantActorInput): AssistantActorInput =>
  d.consumer
    ? {
        consumer: d.consumer
      }
    : {
        actor: d.actor
      };

export let getSynthesisLiveEndpoint = () => {
  let url = new URL(env.service.SYNTHESIS_API_URL);

  if (url.pathname.endsWith('/metorial-synthesis')) {
    url.pathname = url.pathname.slice(0, -'/metorial-synthesis'.length) || '/';
  }

  return url.toString().replace(/\/$/, '');
};

export let ensureSynthesisScope = async (d: { instance: Instance }) => {
  return (await ensureInternalScope({
    service: 'synthesis',
    owner: {
      type: 'instance',
      instance: d.instance
    }
  })) satisfies SynthesisScope;
};

export let ensureSynthesisActor = async (
  d: {
    scope: Pick<SynthesisScope, 'tenantId'>;
  } & AssistantActorInput
) => {
  if (d.consumer) {
    return await ensureInternalActor({
      service: 'synthesis',
      tenantId: d.scope.tenantId,
      actor: {
        type: 'consumer',
        consumer: d.consumer
      }
    });
  }

  return await ensureInternalActor({
    service: 'synthesis',
    tenantId: d.scope.tenantId,
    actor: {
      type: 'organizationActor',
      organizationActor: d.actor
    }
  });
};

export let getSynthesisActorsByIds = async (d: {
  scope: Pick<SynthesisScope, 'tenantId'>;
  actorIds: Array<string | null | undefined>;
}) => {
  let actorIds = Array.from(
    new Set(d.actorIds.filter((actorId): actorId is string => !!actorId))
  );
  if (!actorIds.length) return new Map<string, SynthesisActor>();

  let actors = await Promise.all(
    actorIds.map(
      async actorId =>
        [
          actorId,
          await synthesis.actor.get({
            tenantId: d.scope.tenantId,
            actorId
          })
        ] as const
    )
  );

  return new Map<string, SynthesisActor>(actors);
};

export let enrichSynthesisActors = async (d: {
  instance: Instance;
  actors: SynthesisActor[];
}): Promise<EnrichedAssistantActor[]> => {
  if (!d.actors.length) {
    return [];
  }

  let organizationActorIds = Array.from(
    new Set(
      d.actors.flatMap(actor => (actor.organizationActorId ? [actor.organizationActorId] : []))
    )
  );
  let consumerIds = Array.from(
    new Set(
      d.actors.flatMap(actor =>
        !actor.organizationActorId && actor.consumerId ? [actor.consumerId] : []
      )
    )
  );

  let organizationActors = await db.organizationActor.findMany({
    where: {
      organizationOid: d.instance.organizationOid,
      id: {
        in: organizationActorIds
      }
    },
    include: organizationActorInclude
  });

  let consumers = await db.consumer.findMany({
    where: {
      OR: [
        {
          id: {
            in: consumerIds
          },
          instanceConsumers: {
            some: {
              instanceOid: d.instance.oid
            }
          }
        },
        {
          instanceConsumers: {
            some: {
              instanceOid: d.instance.oid,
              id: {
                in: consumerIds
              }
            }
          }
        }
      ]
    },
    include: {
      ...consumerInclude,
      profiles: {
        ...consumerInclude.profiles,
        where: {
          instanceOid: d.instance.oid,
          status: 'active'
        }
      }
    }
  });

  let organizationActorById = new Map(
    organizationActors.map(organizationActor => [organizationActor.id, organizationActor])
  );
  let consumerById = new Map(
    consumers.flatMap(consumer => [
      [consumer.id, consumer] as const,
      ...consumer.instanceConsumers.map(
        instanceConsumer => [instanceConsumer.id, consumer] as const
      )
    ])
  );

  return d.actors.map(actor => {
    let organizationActor = actor.organizationActorId
      ? (organizationActorById.get(actor.organizationActorId) ?? null)
      : null;
    let consumer =
      !organizationActor && actor.consumerId
        ? (consumerById.get(actor.consumerId) ?? null)
        : null;

    return {
      name: organizationActor?.name ?? consumer?.name ?? actor.name,
      organizationActor,
      consumer,
      consumerProfile: consumer?.profiles[0] ?? null,
      synthesisActor: actor
    };
  });
};

export let resolveMetorialInstanceBySynthesisScope = async (d: {
  tenantIdentifier: string;
  environmentIdentifier: string;
}) => {
  let instance = await db.instance.findFirst({
    where: {
      internalEnvironmentIdentifier: d.environmentIdentifier,
      project: {
        internalTenantIdentifier: d.tenantIdentifier
      }
    },
    include: {
      organization: true,
      project: true
    }
  });
  if (!instance) {
    throw new ServiceError(
      notFoundError('instance', `${d.tenantIdentifier}:${d.environmentIdentifier}`)
    );
  }

  return instance;
};

export let getMetorialActorId = (actor?: {
  organizationActorId?: string | null;
  consumerId?: string | null;
  id?: string | null;
}) => actor?.organizationActorId ?? actor?.consumerId ?? actor?.id ?? null;

type SynthesisRequestCreateInput = Parameters<typeof synthesis.request.create>[0];
type SynthesisMessageGetOutput = Awaited<ReturnType<typeof synthesis.message.get>>;

export type AssistantInputMessage = SynthesisRequestCreateInput['message'];
export type AssistantState = SynthesisMessageGetOutput['state'];
export type AssistantSerializedMessage = AssistantMessageSerializedContent;
