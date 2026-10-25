import { v } from '@lowerdeck/validation';
import { db, getImageUrl } from '@metorial/db';

export type RawOwnerActor = {
  id: string;
  type: 'person' | 'agent' | 'consumer';
  name?: string | null;
  instanceConsumer?: { consumer: { id: string } } | null;
  consumerActor?: { consumer: { id: string } } | null;
};

export type RawSubspaceOwnerActor = {
  id: string;
  type: 'person' | 'agent' | 'consumer';
  name: string;
  instanceConsumer: { consumer: { id: string } } | null;
};

type ConsumerOwnerDetails = {
  name: string;
  consumerProfileId: string;
  imageUrl: string | null;
  portalId: string | null;
};

let OWNER_DETAILS_CACHE_TTL_MS = 30_000;
let ownerDetailsCache = new Map<
  string,
  { expiresAt: number; value: Promise<ConsumerOwnerDetails | null> }
>();

let loadConsumerOwnerDetails = async (actorId: string) => {
  let consumerActor = await db.consumerActor.findUnique({
    where: { id: actorId },
    select: {
      consumer: {
        select: {
          name: true,
          email: true,
          user: { select: { id: true, name: true, email: true, image: true } }
        }
      },
      consumerProfile: {
        select: {
          id: true,
          name: true,
          surface: { select: { portal: { select: { id: true } } } }
        }
      }
    }
  });
  if (!consumerActor) return null;

  let user = consumerActor.consumer.user;

  return {
    name: consumerActor.consumerProfile.name || consumerActor.consumer.name,
    consumerProfileId: consumerActor.consumerProfile.id,
    imageUrl: user ? await getImageUrl(user) : null,
    portalId: consumerActor.consumerProfile.surface.portal?.id ?? null
  } satisfies ConsumerOwnerDetails;
};

let getConsumerOwnerDetails = (actorId: string) => {
  let now = Date.now();
  let cached = ownerDetailsCache.get(actorId);
  if (cached && cached.expiresAt > now) return cached.value;

  let value = loadConsumerOwnerDetails(actorId).catch(() => null);
  ownerDetailsCache.set(actorId, { expiresAt: now + OWNER_DETAILS_CACHE_TTL_MS, value });
  if (ownerDetailsCache.size > 5_000) {
    for (let [key, entry] of ownerDetailsCache) {
      if (entry.expiresAt <= now) ownerDetailsCache.delete(key);
    }
  }

  return value;
};

export let presentOwnerActor = async (ownerActor: RawOwnerActor | null | undefined) => {
  if (!ownerActor) return null;

  let details =
    ownerActor.type === 'consumer' ? await getConsumerOwnerDetails(ownerActor.id) : null;

  return {
    id: ownerActor.id,
    type: ownerActor.type,
    name: details?.name ?? ownerActor.name ?? null,
    image_url: details?.imageUrl ?? null,
    consumer_id:
      ownerActor.instanceConsumer?.consumer.id ??
      ownerActor.consumerActor?.consumer.id ??
      null,
    consumer_profile_id: details?.consumerProfileId ?? null,
    portal_id: details?.portalId ?? null
  };
};

export let ownerActorSchema = v.nullable(
  v.object(
    {
      id: v.string({
        name: 'id',
        description: 'Identifier of the identity actor that owns this resource.',
        examples: ['iac_6wQpLk2mZa8nYx4b']
      }),
      type: v.enumOf(['person', 'agent', 'consumer'], {
        name: 'type',
        description: 'Type of the owning actor.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name of the owning actor.',
          examples: ['Jane Doe']
        })
      ),
      image_url: v.nullable(
        v.string({
          name: 'image_url',
          description: 'Avatar image URL of the owning actor, if available.'
        })
      ),
      consumer_id: v.nullable(
        v.string({
          name: 'consumer_id',
          description:
            'Identifier of the consumer that owns the actor when its type is consumer.',
          examples: ['con_8kLmNp3qRs7tUv1w']
        })
      ),
      consumer_profile_id: v.nullable(
        v.string({
          name: 'consumer_profile_id',
          description:
            'Identifier of the consumer profile (account) that owns the actor when its type is consumer.'
        })
      ),
      portal_id: v.nullable(
        v.string({
          name: 'portal_id',
          description: 'Identifier of the portal the owning consumer belongs to, if any.'
        })
      )
    },
    {
      name: 'owner_actor',
      description: 'The identity actor that owns this resource, if any.'
    }
  )
);

export let isOwnerLockedSchema = v.boolean({
  name: 'is_owner_locked',
  description:
    'Whether this resource is locked to its owner. Locked resources can only be used by their owner, regardless of project settings.'
});

export let isOwnerOnlyVisibleSchema = v.boolean({
  name: 'is_owner_only_visible',
  description:
    'Whether this resource is only visible to its owner. Only enforced for projects with ownership enforcement enabled.'
});
