import type { SkillDestinationItem } from '@metorial-cargo/db';

export type SyncTask =
  | {
      type: 'skill';
      action: 'set' | 'delete';
      skillPluginId: string;
      skillId: string;
    }
  | {
      type: 'plugin';
      action: 'set' | 'delete';
      skillPluginId: string;
    }
  | {
      type: 'marketplace';
      action: 'set';
      skillMarketplaceId: string;
    };

type SkillItemInputStrict = {
  skillPlugin: { id: string } | null;
  skillMarketplace: { id: string } | null;
  skill: { id: string } | null;
};

type SkillItemInput = Partial<SkillItemInputStrict>;

let getItemId = (item: SkillItemInput) => {
  if (item.skill) {
    if (!item.skillPlugin) throw new Error('Skill item must have skillPlugin');
    return `skill:${item.skill.id}:${item.skillPlugin.id}`;
  }
  if (item.skillPlugin) return `plugin:${item.skillPlugin.id}`;
  if (item.skillMarketplace) return `marketplace:${item.skillMarketplace.id}`;
  throw new Error('Invalid item');
};

let getTask = (item: SkillItemInput, action: 'set' | 'delete'): SyncTask => {
  if (item.skill) {
    if (!item.skillPlugin) throw new Error('Skill item must have skillPlugin');
    return {
      type: 'skill',
      action,
      skillId: item.skill.id,
      skillPluginId: item.skillPlugin.id
    };
  }

  if (item.skillPlugin) {
    return {
      type: 'plugin',
      action,
      skillPluginId: item.skillPlugin.id
    };
  }

  if (item.skillMarketplace) {
    if (action === 'delete') throw new Error('Cannot delete marketplace');

    return {
      type: 'marketplace',
      action,
      skillMarketplaceId: item.skillMarketplace.id
    };
  }

  throw new Error('Invalid item');
};

let orderTasks = (tasks: SyncTask[]) => {
  /**
   * ORDER:
   * 1. Delete skills
   * 2. Delete plugins
   * 3. Set skills
   * 4. Set plugins
   * 5. Set marketplace
   */

  let skillDeletes = tasks.filter(t => t.type === 'skill' && t.action === 'delete');
  let pluginDeletes = tasks.filter(t => t.type === 'plugin' && t.action === 'delete');
  let skillSets = tasks.filter(t => t.type === 'skill' && t.action === 'set');
  let pluginSets = tasks.filter(t => t.type === 'plugin' && t.action === 'set');
  let marketplaceSets = tasks.filter(t => t.type === 'marketplace' && t.action === 'set');

  return [...skillDeletes, ...pluginDeletes, ...skillSets, ...pluginSets, ...marketplaceSets];
};

export let createTaskManager = (
  initialItems: (SkillDestinationItem & SkillItemInputStrict)[]
) => {
  let tasks: SyncTask[] = [];

  let initialItemsMap = new Map(initialItems.map(i => [getItemId(i), i]));
  let itemsToDelete = new Set(initialItemsMap.keys());

  let keepItem = (item: SkillItemInput) => {
    let id = getItemId(item);
    itemsToDelete.delete(id);
  };

  let addOrUpdateItem = (item: SkillItemInput) => {
    keepItem(item);
    tasks.push(getTask(item, 'set'));
  };

  let deleteItem = (item: SkillItemInput) => {
    let id = getItemId(item);
    if (!initialItemsMap.has(id)) throw new Error('Cannot delete item that does not exist');
    itemsToDelete.delete(id);
  };

  let getTasks = () => {
    let deleteTasks = [...itemsToDelete].map(id => {
      let item = initialItemsMap.get(id);
      if (!item) throw new Error('Item to delete not found');
      return getTask(item, 'delete');
    });

    return orderTasks([...tasks, ...deleteTasks]);
  };

  return {
    addOrUpdateItem,
    deleteItem,
    keepItem,
    getTasks
  };
};
