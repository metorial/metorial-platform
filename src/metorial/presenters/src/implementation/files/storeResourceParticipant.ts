import { v } from '@lowerdeck/validation';
import type { PresenterContext } from '@metorial/presenter';
import type { StoreResourceParticipantPresentationRecord } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

let storeParticipantRoles = ['creator', 'editor', 'viewer', 'user', 'forker'] as const;
let storeParticipantPermissions = ['content_read', 'content_write'] as const;

export let storeParticipantRolesSchema = v.array(v.enumOf([...storeParticipantRoles]));

export let storeParticipantSurfaceSchema = v.object({
  id: v.string(),
  roles: storeParticipantRolesSchema,
  actor: documentParticipantActorSchema,
  last_active_at: v.nullable(v.date()),
  created_at: v.date()
});

export let isStoreResourceParticipantRecord = (
  record: object
): record is StoreResourceParticipantPresentationRecord => 'primaryResourceActor' in record;

export let getStoreResourceParticipantPermissions = (
  participant: StoreResourceParticipantPresentationRecord
) =>
  storeParticipantPermissions.filter(permission =>
    participant.actors.some(actor => actor.permissions.includes(permission))
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
