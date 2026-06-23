import type { Skill, SkillParticipant, TenantActor } from '@metorial-cargo/db';
import { actorPresenter } from './actor';

export let skillParticipantPresenter = (
  participant: SkillParticipant & {
    skill: Skill;
    tenantActor: TenantActor;
  }
) => ({
  object: 'cargo#skillParticipant',
  id: participant.id,
  skillId: participant.skill.id,
  roles: participant.roles,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt,
  updatedAt: participant.updatedAt
});
