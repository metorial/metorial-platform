import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillParticipantType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';

export let v1SkillParticipantPresenter = Presenter.create(skillParticipantType)
  .presenter(async ({ skillParticipant }, opts) => ({
    object: 'skill.participant',
    id: skillParticipant.id,
    skill_id: skillParticipant.skillId,
    roles: skillParticipant.roles,
    actor: await presentDocumentParticipantActor(skillParticipant.actor, opts),
    created_at: skillParticipant.createdAt,
    updated_at: skillParticipant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      skill_id: v.string(),
      roles: v.array(v.enumOf(['creator', 'editor', 'viewer', 'user', 'forker'])),
      actor: documentParticipantActorSchema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
