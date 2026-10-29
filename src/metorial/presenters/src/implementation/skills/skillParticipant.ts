import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillParticipantType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import {
  isStoreResourceParticipantRecord,
  presentStoreResourceParticipantSurfaces,
  storeParticipantSurfaceSchema,
  type StoreParticipantSurface
} from '../files/storeResourceParticipant';

export let v1SkillParticipantPresenter = Presenter.create(skillParticipantType)
  .presenter(async ({ skillParticipant }, opts) => {
    if (isStoreResourceParticipantRecord(skillParticipant)) {
      return {
        object: 'skill.participant' as const,
        id: skillParticipant.id,
        skill_id: skillParticipant.skill.id,
        roles: skillParticipant.roles,
        actor: await presentDocumentParticipantActor(
          skillParticipant.primaryResourceActor,
          opts
        ),
        surfaces: await presentStoreResourceParticipantSurfaces(skillParticipant, opts),
        last_active_at: skillParticipant.lastActiveAt,
        created_at: skillParticipant.createdAt,
        updated_at: skillParticipant.updatedAt
      };
    }

    return {
      object: 'skill.participant' as const,
      id: skillParticipant.id,
      skill_id: skillParticipant.skill.id,
      roles: skillParticipant.roles,
      actor: await presentDocumentParticipantActor(skillParticipant.resourceActor, opts),
      surfaces: null as StoreParticipantSurface[] | null,
      last_active_at: null as Date | null,
      created_at: skillParticipant.createdAt,
      updated_at: skillParticipant.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('skill.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      skill_id: v.string(),
      roles: v.array(v.enumOf(['creator', 'editor', 'viewer', 'user', 'forker'])),
      actor: documentParticipantActorSchema,
      surfaces: v.nullable(v.array(storeParticipantSurfaceSchema)),
      last_active_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
