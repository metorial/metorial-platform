import type { SkillAgentRecord } from '@metorial-cargo/module-skill';

export let skillAgentPresenter = (skillAgent: SkillAgentRecord) => ({
  object: 'cargo#skillAgent',
  id: skillAgent.id,
  skillId: skillAgent.skill.id,
  name: skillAgent.name,
  description: skillAgent.description,
  slug: skillAgent.slug,
  status: skillAgent.status,
  storeId: skillAgent.skill.store.id,
  storeItemId: skillAgent.storeItem?.id,
  path: skillAgent.storeItem?.path,
  documentId: skillAgent.document.id,
  archivedAt: skillAgent.archivedAt,
  createdAt: skillAgent.createdAt,
  updatedAt: skillAgent.updatedAt
});
