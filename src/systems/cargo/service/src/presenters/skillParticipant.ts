import type { Skill, SkillParticipant, TenantActor } from '../../prisma/generated/client';
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
