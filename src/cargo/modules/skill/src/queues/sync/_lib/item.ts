import type { Prisma } from '@metorial-cargo/db';
import type { SyncTask } from './task';

export let getSyncTaskItemKey = (task: SyncTask) => {
  if (task.type === 'skill') return `skill:${task.skillId}:${task.skillPluginId}`;
  if (task.type === 'plugin') return `plugin:${task.skillPluginId}`;
  return `marketplace:${task.skillMarketplaceId}`;
};

export let getSyncItemKey = (item: {
  skill?: { id: string } | null;
  skillPlugin?: { id: string } | null;
  skillMarketplace?: { id: string } | null;
}) => {
  if (item.skill) {
    if (!item.skillPlugin) throw new Error('Skill item must have skillPlugin');
    return `skill:${item.skill.id}:${item.skillPlugin.id}`;
  }

  if (item.skillPlugin) return `plugin:${item.skillPlugin.id}`;
  if (item.skillMarketplace) return `marketplace:${item.skillMarketplace.id}`;
  throw new Error('Invalid item');
};

export let getSyncTaskItemWhere = (
  task: SyncTask
): Prisma.SkillDestinationItemWhereInput => {
  if (task.type === 'skill') {
    return {
      skill: { id: task.skillId },
      skillPlugin: { id: task.skillPluginId }
    };
  }

  if (task.type === 'plugin') {
    return {
      skillPlugin: { id: task.skillPluginId },
      skillOid: null
    };
  }

  return {
    skillMarketplace: { id: task.skillMarketplaceId },
    skillPluginOid: null,
    skillOid: null
  };
};
