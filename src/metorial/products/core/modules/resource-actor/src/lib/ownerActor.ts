import { db, getImageUrl } from '@metorial/db';

export type OwnerActorPresentation = {
  type: 'person' | 'agent' | 'consumer' | 'organization_member';
  name: string | null;
  imageUrl: string | null;
  email: string | null;
  organizationMemberId?: string;
  consumer?: { id: string; profileId: string; portalId: string | null };
};

export let ownerActorPresentation = Symbol('ownerActorPresentation');

export type PresentableOwnerActor = {
  id: string;
  type: OwnerActorPresentation['type'];
  name?: string | null;
  [ownerActorPresentation]?: OwnerActorPresentation;
};

let jsonFields = new Set([
  'metadata',
  'privateMetadata',
  'value',
  'configuration',
  'toolFilter',
  'inputJsonSchema',
  'outputJsonSchema',
  'specification'
]);

export let hydrateResourceOwners = async <T>(resources: T): Promise<T> => {
  let actors = new Map<string, PresentableOwnerActor[]>();
  let visited = new WeakSet<object>();

  let collect = (value: unknown) => {
    if (!value || typeof value !== 'object' || value instanceof Date || visited.has(value))
      return;
    visited.add(value);

    if (value instanceof Map) {
      for (let entry of value.values()) collect(entry);
      return;
    }

    for (let [key, child] of Object.entries(value)) {
      if (jsonFields.has(key)) continue;

      if (
        (key === 'ownerActor' || key === 'identityActor') &&
        child &&
        typeof child === 'object' &&
        'id' in child &&
        'type' in child
      ) {
        let actor = child as PresentableOwnerActor;
        let copies = actors.get(actor.id) ?? [];
        copies.push(actor);
        actors.set(actor.id, copies);
      } else {
        collect(child);
      }
    }
  };

  collect(resources);

  let consumerActorIds = [...actors]
    .filter(([, copies]) =>
      copies.some(actor => actor.type === 'consumer' || actor.type === 'organization_member')
    )
    .map(([id]) => id);
  let consumerActors = consumerActorIds.length
    ? await db.consumerActor.findMany({
        where: { id: { in: consumerActorIds } },
        select: {
          id: true,
          consumer: {
            select: {
              id: true,
              name: true,
              email: true,
              user: { select: { id: true, name: true, email: true, image: true } }
            }
          },
          consumerProfile: {
            select: {
              id: true,
              name: true,
              email: true,
              organizationMember: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true, email: true, image: true } }
                }
              },
              surface: { select: { portal: { select: { id: true } } } }
            }
          }
        }
      })
    : [];
  let consumersById = new Map(consumerActors.map(actor => [actor.id, actor]));
  let imagesByUserId = new Map<string, Promise<string>>();

  await Promise.all(
    [...actors].map(async ([id, copies]) => {
      let actor = copies[0]!;
      let consumerActor = consumersById.get(id);
      let profile = consumerActor?.consumerProfile;
      let member = profile?.organizationMember;
      let user = member?.user ?? consumerActor?.consumer.user;

      if (user && !imagesByUserId.has(user.id)) imagesByUserId.set(user.id, getImageUrl(user));

      let details: OwnerActorPresentation = {
        type: member ? 'organization_member' : actor.type,
        name:
          member?.user.name ??
          profile?.name ??
          consumerActor?.consumer.name ??
          actor.name ??
          null,
        imageUrl: user ? await imagesByUserId.get(user.id)! : null,
        email: member?.user.email ?? profile?.email ?? consumerActor?.consumer.email ?? null,
        ...(member ? { organizationMemberId: member.id } : {}),
        ...(consumerActor && !member
          ? {
              consumer: {
                id: consumerActor.consumer.id,
                profileId: consumerActor.consumerProfile.id,
                portalId: consumerActor.consumerProfile.surface.portal?.id ?? null
              }
            }
          : {})
      };

      for (let copy of copies) copy[ownerActorPresentation] = details;
    })
  );

  return resources;
};
