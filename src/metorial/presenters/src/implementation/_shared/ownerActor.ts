import { v } from '@lowerdeck/validation';
import type { IntegrationResourceSource } from '@metorial/db';
import {
  ownerActorPresentation,
  type PresentableOwnerActor
} from '@metorial/module-resource-actor';

export type RawSubspaceOwnerActor = PresentableOwnerActor & {
  name: string;
  instanceConsumer: { consumer: { id: string } } | null;
};

export let presentOwnerActor = (actor: PresentableOwnerActor | null | undefined) => {
  if (!actor) return null;

  let owner = actor[ownerActorPresentation];
  if (!owner) throw new Error('Resource owners must be hydrated before presentation.');

  return {
    type: owner.type,
    name: owner.name,
    image_url: owner.imageUrl,
    email: owner.email,
    ...(owner.organizationMemberId
      ? { organization_member: { id: owner.organizationMemberId } }
      : {}),
    ...(owner.consumer
      ? {
          consumer: {
            id: owner.consumer.id,
            profile_id: owner.consumer.profileId,
            portal_id: owner.consumer.portalId
          }
        }
      : {})
  };
};

export let ownerActorSchema = v.nullable(
  v.object(
    {
      type: v.enumOf(['person', 'agent', 'consumer', 'organization_member'], {
        description: 'Type of the owning actor.'
      }),
      name: v.nullable(v.string({ description: 'Display name of the owning actor.' })),
      image_url: v.nullable(
        v.string({ description: 'Avatar image URL of the owning actor, if available.' })
      ),
      email: v.nullable(
        v.string({ description: 'Email address of the owning actor, if available.' })
      ),
      organization_member: v.optional(
        v.object(
          {
            id: v.string({
              description: 'Identifier of the organization member who owns the resource.'
            })
          },
          { description: 'Organization member associated with this owner.' }
        )
      ),
      consumer: v.optional(
        v.object(
          {
            id: v.string({ description: 'Identifier of the owning consumer.' }),
            profile_id: v.string({
              description: 'Identifier of the owning consumer profile.'
            }),
            portal_id: v.nullable(
              v.string({ description: 'Identifier of the consumer profile’s portal, if any.' })
            )
          },
          { description: 'Consumer and profile associated with this owner.' }
        )
      )
    },
    { description: 'The actor that owns this resource, if any.' }
  )
);

export type ResourceAccessSource = IntegrationResourceSource | null;

export let presentResourceSource = (source?: string | null): ResourceAccessSource =>
  source === 'explorer' ? source : null;

export let resourceAccessSchema = v.object(
  {
    source: v.nullable(
      v.enumOf(['explorer'], {
        description:
          'Integration resource source, or null when the resource is not from Explorer.'
      })
    ),
    type: v.enumOf(['public', 'owner_locked'], {
      description:
        'Whether usage is public or locked to the owner under the project ownership rules.'
    }),
    visibility: v.enumOf(['anyone', 'owner'], {
      description:
        'Whether visibility is unrestricted or limited to the owner under the project ownership rules.'
    }),
    owner: ownerActorSchema
  },
  { description: 'Resource ownership and access settings.' }
);
