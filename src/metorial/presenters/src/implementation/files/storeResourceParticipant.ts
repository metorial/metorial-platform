import { v } from '@lowerdeck/validation';
import type { PresenterContext } from '@metorial/presenter';
import type { StoreResourceParticipantPresentationRecord } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

let storeParticipantRoles = [
  'creator',
  'owner',
  'editor',
  'viewer',
  'user',
  'forker'
] as const;

export let storeParticipantRolesSchema = v.array(v.enumOf([...storeParticipantRoles]), {
  description: 'Roles the participant holds.'
});

export let storeParticipantSurfaceSchema = v.object(
  {
    id: v.string({ description: 'Unique ID.' }),
    roles: storeParticipantRolesSchema,
    actor: documentParticipantActorSchema,
    last_active_at: v.nullable(v.date({ description: 'When this identity was last active.' })),
    created_at: v.date({ description: 'Creation time.' })
  },
  { description: 'Identity linked to a store participant.' }
);

export type StoreParticipantSurface = Awaited<
  ReturnType<typeof presentStoreResourceParticipantSurfaces>
>[number];

export let presentStoreResourceParticipantSurfaces = async (
  participant: StoreResourceParticipantPresentationRecord,
  opts: PresenterContext
) =>
  await Promise.all(
    participant.actors.map(async actor => ({
      id: actor.id,
      roles: actor.roles,
      actor: await presentDocumentParticipantActor(actor.resourceActor, opts),
      last_active_at: actor.lastActiveAt,
      created_at: actor.createdAt
    }))
  );
