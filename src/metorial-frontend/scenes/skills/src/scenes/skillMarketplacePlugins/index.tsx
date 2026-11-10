import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type PointerSensorProps,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeaderSection } from '@metorial/layout';
import {
  type Skill,
  type SkillMarketplacePlugin,
  type SkillPlugin,
  useAllSkillMarketplacePlugins,
  useCreateSkillMarketplacePlugin,
  useCreateSkillPlugin,
  useCreateSkillPluginSkill,
  useDeleteSkillMarketplacePlugin,
  useDeleteSkillPlugin,
  useDeleteSkillPluginSkill,
  useSkillMarketplace
} from '@metorial/state';
import { Button, Input, type MenuItem, Text, confirm, theme, toast } from '@metorial/ui';
import { RiAddLine, RiPuzzle2Line, RiStackLine } from '@remixicon/react';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import PQueue from 'p-queue';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  BulkBar,
  DragPreview,
  type DropState,
  ListSkeleton,
  ListStack,
  PluginGroup,
  SkillRow,
  StandaloneSection
} from './components';
import {
  type AddSkillsDestinationOption,
  showAddSkillsPanel,
  showPluginForm,
  showPluginPickerPanel
} from './dialogs';
import {
  type MarketplaceFilter,
  type MoveDestination,
  type SkillEntry,
  asOptimisticStandaloneMarketplacePlugin,
  buildMarketplaceView,
  buildSkillIndex,
  getMoveSkillInput,
  getPlugin,
  isCollapsedMarketplacePlugin,
  marketplaceCanCreatePlugins,
  moveSkillOptimistically,
  moveSkillToStandaloneOptimistically,
  pluginCanDelete,
  pluginCanUpdate,
  removeMarketplacePluginsOptimistically,
  removeSkillOptimistically,
  shouldDeleteSourcePluginAfterMove,
  sortMarketplacePluginHierarchy
} from './hierarchy';

export {
  getMoveSkillInput,
  isCollapsedMarketplacePlugin,
  moveSkillOptimistically,
  moveSkillToStandaloneOptimistically,
  shouldDeleteSourcePluginAfterMove,
  sortMarketplacePluginHierarchy
} from './hierarchy';

let addConcurrency = 4;
let flashDurationMs = 2_000;
let standaloneKey = 'standalone';

class SkillPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    let target = props.event.target;
    let isDragHandle =
      target instanceof Element && Boolean(target.closest('[data-skill-drag-handle]'));

    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: { distance: isDragHandle ? 4 : 12 }
      }
    });
  }
}

let collisionDetection: CollisionDetection = args => {
  let hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

let Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
`;

let ToolbarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let SearchField = styled.div`
  flex: 1 1 240px;
  min-width: 0;
`;

let ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let FilterCount = styled.span`
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  color: ${theme.colors.gray600};
`;

let EmptyCard = styled.div`
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  border: 1px dashed ${theme.colors.gray450};
  border-radius: 10px;
`;

let EmptyIcon = styled.span`
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray250};

  svg {
    width: 22px;
    height: 22px;
  }
`;

let EmptyActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

let Errors = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:not(:empty) {
    margin-top: 12px;
  }
`;

let toggleKey = (set: ReadonlySet<string>, key: string, on: boolean) => {
  let next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
};

let withKeys = (set: ReadonlySet<string>, keys: string[], on: boolean) =>
  keys.reduce((next, key) => toggleKey(next, key, on), set);

let skillCount = (count: number) => `${count} ${count === 1 ? 'skill' : 'skills'}`;

export let SkillMarketplacePluginsScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  getSkillPath?: (skillId: string) => string;
  showHeader?: boolean;
  showImportPlugin?: boolean;
  onChange?: () => void;
}) => {
  let navigate = useNavigate();
  let marketplace = useSkillMarketplace(p.instanceId, p.skillMarketplaceId);
  let marketplacePlugins = useAllSkillMarketplacePlugins(p.instanceId, p.skillMarketplaceId, {
    order: 'asc',
    status: ['active']
  });
  let addMarketplacePlugin = useCreateSkillMarketplacePlugin();
  let removeMarketplacePlugin = useDeleteSkillMarketplacePlugin();
  let deletePlugin = useDeleteSkillPlugin();
  let createPlugin = useCreateSkillPlugin();
  let addPluginSkill = useCreateSkillPluginSkill();
  let removePluginSkill = useDeleteSkillPluginSkill();

  let [optimistic, setOptimistic] = useState<SkillMarketplacePlugin[] | null>(null);
  let [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());
  let [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  let [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  let [flashIds, setFlashIds] = useState<ReadonlySet<string>>(() => new Set());
  let [search, setSearch] = useState('');
  let [filter, setFilter] = useState<MarketplaceFilter>('all');
  let [activeDrag, setActiveDrag] = useState<{ leadId: string; skillIds: string[] } | null>(
    null
  );
  let activeOperationsRef = useRef(0);
  let queueRef = useRef<PQueue | null>(null);
  queueRef.current ??= new PQueue({ concurrency: 1 });

  let displayed = useMemo(
    () => sortMarketplacePluginHierarchy(optimistic ?? marketplacePlugins.data ?? []),
    [optimistic, marketplacePlugins.data]
  );
  let index = useMemo(() => buildSkillIndex(displayed), [displayed]);
  let view = useMemo(
    () => buildMarketplaceView(displayed, { search, filter }),
    [displayed, search, filter]
  );
  let selectedIds = useMemo(
    () => [...selected].filter(id => index.get(id)?.canMove && !pendingKeys.has(id)),
    [selected, index, pendingKeys]
  );
  let canCreatePlugins = marketplace.data
    ? marketplaceCanCreatePlugins(marketplace.data)
    : false;
  let searching = search.trim().length > 0;
  let writablePlugins = displayed.flatMap(item => {
    let plugin = getPlugin(item);
    return plugin && pluginCanUpdate(plugin) && !isCollapsedMarketplacePlugin(item)
      ? [plugin]
      : [];
  });

  useEffect(() => {
    if (!selectedIds.length) return;

    let onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(new Set());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds.length]);

  let refresh = async () => {
    await marketplacePlugins.refetch();
  };

  let flash = (skillIds: string[]) => {
    setFlashIds(new Set(skillIds));
    setTimeout(() => setFlashIds(new Set()), flashDurationMs);
  };

  let runOperation = async (operation: {
    next: SkillMarketplacePlugin[];
    keys: string[];
    tasks: (() => Promise<boolean>)[];
  }) => {
    activeOperationsRef.current++;
    setOptimistic(operation.next);
    setPendingKeys(current => withKeys(current, operation.keys, true));

    let results = await queueRef.current!.addAll(operation.tasks);
    setPendingKeys(current => withKeys(current, operation.keys, false));
    if (results.some(Boolean)) p.onChange?.();

    activeOperationsRef.current--;
    if (activeOperationsRef.current === 0) {
      await refresh();
      if (activeOperationsRef.current === 0) setOptimistic(null);
    }

    return results.every(Boolean);
  };

  let cleanupEmptySourcePlugin = async (sourceItem: SkillMarketplacePlugin) => {
    if (!shouldDeleteSourcePluginAfterMove(sourceItem) || !p.instanceId) return;

    let plugin = getPlugin(sourceItem)!;
    if (pluginCanDelete(plugin)) {
      await deletePlugin.mutate({ instanceId: p.instanceId, skillPluginId: plugin.id });
      return;
    }

    if (canCreatePlugins && p.skillMarketplaceId) {
      await removeMarketplacePlugin.mutate({
        instanceId: p.instanceId,
        skillMarketplaceId: p.skillMarketplaceId,
        skillMarketplacePluginId: sourceItem.id
      });
    }
  };

  let moveToPlugin = async (entry: SkillEntry, pluginId: string) => {
    if (!p.instanceId) return false;

    let [created] = await addPluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: pluginId,
      ...getMoveSkillInput(entry.skill)
    });
    if (!created) return false;

    let [removed] = await removePluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: entry.plugin.id,
      skillPluginSkillId: entry.skill.id
    });
    if (!removed) {
      await removePluginSkill.mutate({
        instanceId: p.instanceId,
        skillPluginId: pluginId,
        skillPluginSkillId: created.id
      });
      return false;
    }

    await cleanupEmptySourcePlugin(entry.item);
    return true;
  };

  let moveToStandalone = async (entry: SkillEntry) => {
    if (!p.instanceId || !p.skillMarketplaceId) return false;

    let [plugin] = await createPlugin.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      name: entry.skill.skill.clientName || entry.skill.skill.name,
      description: entry.skill.skill.clientDescription ?? undefined
    });
    if (!plugin) return false;

    let rollback = () =>
      deletePlugin.mutate({ instanceId: p.instanceId!, skillPluginId: plugin.id });

    let [membership] = await addPluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: plugin.id,
      ...getMoveSkillInput(entry.skill)
    });
    if (!membership) {
      await rollback();
      return false;
    }

    let [removed] = await removePluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: entry.plugin.id,
      skillPluginSkillId: entry.skill.id
    });
    if (!removed) {
      await rollback();
      return false;
    }

    await cleanupEmptySourcePlugin(entry.item);
    return true;
  };

  let planMoves = (skillIds: string[], destination: MoveDestination) => {
    let next = displayed;
    let tasks: (() => Promise<boolean>)[] = [];
    let keys: string[] = [];

    for (let skillId of skillIds) {
      let entry = index.get(skillId);
      if (!entry?.canMove || pendingKeys.has(skillId)) continue;

      if (destination.type === 'standalone') {
        if (entry.standalone || !canCreatePlugins || !p.skillMarketplaceId) continue;

        next = moveSkillToStandaloneOptimistically(
          next,
          entry.plugin.id,
          entry.skill,
          asOptimisticStandaloneMarketplacePlugin({
            sourcePlugin: entry.plugin as SkillPlugin,
            skill: entry.skill,
            skillMarketplaceId: p.skillMarketplaceId
          }),
          canCreatePlugins
        );
        tasks.push(() => moveToStandalone(entry));
      } else {
        if (entry.plugin.id === destination.pluginId) continue;

        let target = next.find(item => item.skillPlugin?.id === destination.pluginId);
        let targetPlugin = target && getPlugin(target);
        if (
          !targetPlugin ||
          !pluginCanUpdate(targetPlugin) ||
          targetPlugin.skills.some(skill => skill.skillId === skillId)
        ) {
          continue;
        }

        next = moveSkillOptimistically(
          next,
          entry.plugin.id,
          destination.pluginId,
          entry.skill,
          canCreatePlugins
        );
        tasks.push(() => moveToPlugin(entry, destination.pluginId));
      }

      keys.push(skillId);
    }

    return { next, tasks, keys };
  };

  let getDestinationName = (destination: MoveDestination) =>
    destination.type === 'standalone'
      ? 'Standalone Skills'
      : (writablePlugins.find(plugin => plugin.id === destination.pluginId)?.name ??
        'the plugin');

  let moveSkills = async (skillIds: string[], destination: MoveDestination) => {
    let plan = planMoves(skillIds, destination);
    if (!plan.tasks.length) return;

    setSelected(current => withKeys(current, plan.keys, false));
    if (destination.type === 'plugin') {
      setCollapsed(current => toggleKey(current, destination.pluginId, false));
    }

    let moved = await runOperation(plan);
    if (moved && plan.keys.length > 1) {
      toast.success(
        `Moved ${skillCount(plan.keys.length)} to ${getDestinationName(destination)}.`
      );
    }
  };

  let removeEntries = (entries: SkillEntry[]) => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    let instanceId = p.instanceId;
    let skillMarketplaceId = p.skillMarketplaceId;
    let removable = entries.filter(entry =>
      entry.standalone ? canCreatePlugins : entry.canMove
    );
    if (!removable.length) return;

    let next = displayed;
    let tasks: (() => Promise<boolean>)[] = [];
    for (let entry of removable) {
      if (entry.standalone) {
        next = removeMarketplacePluginsOptimistically(next, [entry.item.id]);
        tasks.push(async () => {
          let [removed] = await removeMarketplacePlugin.mutate({
            instanceId,
            skillMarketplaceId,
            skillMarketplacePluginId: entry.item.id
          });
          return Boolean(removed);
        });
      } else {
        next = removeSkillOptimistically(next, entry.plugin.id, entry.skill);
        tasks.push(async () => {
          let [removed] = await removePluginSkill.mutate({
            instanceId,
            skillPluginId: entry.plugin.id,
            skillPluginSkillId: entry.skill.id
          });
          return Boolean(removed);
        });
      }
    }

    let keys = removable.map(entry => entry.skill.skillId);
    setSelected(current => withKeys(current, keys, false));
    void runOperation({ next, keys, tasks });
  };

  let confirmRemoveEntry = (entry: SkillEntry) =>
    confirm({
      title: entry.standalone
        ? `Remove ${entry.skill.skill.name} from the marketplace?`
        : `Remove ${entry.skill.skill.name} from ${entry.plugin.name}?`,
      description: entry.standalone
        ? 'The skill stops being listed in this marketplace. The skill itself is not deleted.'
        : 'The skill is removed from this plugin. The skill itself is not deleted.',
      confirmText: 'Remove',
      onConfirm: () => removeEntries([entry])
    });

  let confirmRemoveSelected = () => {
    let entries = selectedIds.flatMap(id => index.get(id) ?? []);

    confirm({
      title: `Remove ${skillCount(entries.length)}?`,
      description:
        'Standalone skills stop being listed in this marketplace and skills in plugins are removed from their plugin. The skills themselves are not deleted.',
      confirmText: 'Remove',
      onConfirm: () => removeEntries(entries)
    });
  };

  let confirmRemovePlugin = (item: SkillMarketplacePlugin) =>
    confirm({
      title: `Remove ${item.skillPlugin?.name ?? item.identifier} from the marketplace?`,
      description:
        'The plugin and its skills stop being listed in this marketplace. Nothing is deleted.',
      confirmText: 'Remove',
      onConfirm: () => {
        if (!p.instanceId || !p.skillMarketplaceId) return;

        let instanceId = p.instanceId;
        let skillMarketplaceId = p.skillMarketplaceId;
        void runOperation({
          next: removeMarketplacePluginsOptimistically(displayed, [item.id]),
          keys: [`plugin:${item.skillPlugin?.id}`],
          tasks: [
            async () => {
              let [removed] = await removeMarketplacePlugin.mutate({
                instanceId,
                skillMarketplaceId,
                skillMarketplacePluginId: item.id
              });
              return Boolean(removed);
            }
          ]
        });
      }
    });

  let confirmSplitPlugin = (item: SkillMarketplacePlugin) => {
    let plugin = getPlugin(item);
    if (!plugin) return;

    confirm({
      title: `Split ${plugin.name} into standalone skills?`,
      description: `Each of its ${skillCount(plugin.skills.length)} is listed on its own, and the empty plugin is removed from this marketplace. The plugin itself is not deleted.`,
      confirmText: 'Split Plugin',
      onConfirm: () => {
        if (!p.instanceId || !p.skillMarketplaceId) return;

        let instanceId = p.instanceId;
        let skillMarketplaceId = p.skillMarketplaceId;
        let plan = planMoves(
          plugin.skills.map(skill => skill.skillId),
          { type: 'standalone' }
        );
        void runOperation({
          next: removeMarketplacePluginsOptimistically(plan.next, [item.id]),
          keys: [...plan.keys, `plugin:${plugin.id}`],
          tasks: [
            ...plan.tasks,
            async () => {
              let [removed] = await removeMarketplacePlugin.mutate({
                instanceId,
                skillMarketplaceId,
                skillMarketplacePluginId: item.id
              });
              return Boolean(removed);
            }
          ]
        });
      }
    });
  };

  let addSkill = async (skill: Skill, destination: MoveDestination) => {
    if (!p.instanceId || !p.skillMarketplaceId) return false;

    let input = {
      skillId: skill.id,
      clientName: skill.clientName ?? skill.name,
      clientDescription: skill.clientDescription ?? skill.description ?? undefined,
      clientMetadata: skill.clientMetadata ?? undefined,
      license: skill.license ?? undefined,
      compatibility: skill.compatibility ?? undefined
    };

    if (destination.type === 'plugin') {
      let [added] = await addPluginSkill.mutate({
        instanceId: p.instanceId,
        skillPluginId: destination.pluginId,
        ...input
      });
      return Boolean(added);
    }

    let [plugin] = await createPlugin.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      name: skill.clientName || skill.name,
      description: skill.clientDescription ?? undefined
    });
    if (!plugin) return false;

    let [membership] = await addPluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: plugin.id,
      ...input
    });
    if (!membership) {
      await deletePlugin.mutate({ instanceId: p.instanceId, skillPluginId: plugin.id });
      return false;
    }

    return true;
  };

  let openAddSkills = (initialDestination?: string) => {
    if (!p.instanceId) return;

    let destinations: AddSkillsDestinationOption[] = [
      ...(canCreatePlugins ? [{ id: 'standalone', label: 'Standalone (no plugin)' }] : []),
      ...writablePlugins.map(plugin => ({ id: plugin.id, label: plugin.name }))
    ];
    if (!destinations.length) return;

    showAddSkillsPanel({
      instanceId: p.instanceId,
      linkedSkillIds: [...index.keys()],
      destinations,
      initialDestination: initialDestination ?? destinations[0].id,
      onAdd: async (skills, destination) => {
        let queue = new PQueue({ concurrency: addConcurrency });
        let results = await queue.addAll(
          skills.map(skill => async () => ({
            skill,
            added: await addSkill(skill, destination)
          }))
        );
        let addedIds = results.filter(result => result.added).map(result => result.skill.id);
        if (!addedIds.length) return false;

        await refresh();
        p.onChange?.();
        flash(addedIds);
        setCollapsed(current =>
          toggleKey(
            current,
            destination.type === 'plugin' ? destination.pluginId : standaloneKey,
            false
          )
        );
        if (addedIds.length > 1) {
          toast.success(
            `Added ${skillCount(addedIds.length)} to ${getDestinationName(destination)}.`
          );
        }

        return addedIds.length === skills.length;
      }
    });
  };

  let openNewPlugin = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showPluginForm({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      onChanged: async () => {
        await refresh();
        p.onChange?.();
      }
    });
  };

  let openEditPlugin = (plugin: SkillPlugin) => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showPluginForm({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      plugin,
      onChanged: async () => {
        await refresh();
        p.onChange?.();
      }
    });
  };

  let openImportPlugin = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    let instanceId = p.instanceId;
    let skillMarketplaceId = p.skillMarketplaceId;
    showPluginPickerPanel({
      instanceId,
      excludePluginIds: displayed.flatMap(item =>
        item.skillPlugin ? [item.skillPlugin.id] : []
      ),
      onSelect: async plugin => {
        let [added] = await addMarketplacePlugin.mutate({
          instanceId,
          skillMarketplaceId,
          skillPluginId: plugin.id
        });
        if (!added) return false;

        await refresh();
        p.onChange?.();
        return true;
      }
    });
  };

  let getMoveMenuItems = (skillIds: string[], current?: SkillEntry): MenuItem[] => {
    let standaloneItem: MenuItem[] =
      canCreatePlugins && !current?.standalone
        ? [
            {
              id: 'standalone',
              label: 'Standalone Skills',
              onClick: () => void moveSkills(skillIds, { type: 'standalone' })
            }
          ]
        : [];
    let pluginItems: MenuItem[] = writablePlugins
      .filter(
        plugin =>
          plugin.id !== current?.plugin.id &&
          !(current && plugin.skills.some(skill => skill.skillId === current.skill.skillId))
      )
      .map(plugin => ({
        id: plugin.id,
        label: plugin.name,
        onClick: () => void moveSkills(skillIds, { type: 'plugin', pluginId: plugin.id })
      }));

    return [
      ...standaloneItem,
      ...(standaloneItem.length && pluginItems.length ? [{ type: 'separator' as const }] : []),
      ...pluginItems
    ];
  };

  let getSkillMenuItems = (entry: SkillEntry): MenuItem[] => {
    let skillPath = p.getSkillPath?.(entry.skill.skillId);
    let moveItems = entry.canMove ? getMoveMenuItems([entry.skill.skillId], entry) : [];
    let canRemove = entry.standalone ? canCreatePlugins && entry.canMove : entry.canMove;

    let items: MenuItem[] = [
      ...(skillPath
        ? [
            {
              id: 'open',
              label: 'Open Skill',
              onClick: () => navigate(skillPath!)
            }
          ]
        : []),
      ...(moveItems.length
        ? [
            {
              type: 'submenu' as const,
              label: 'Move To',
              items: moveItems
            }
          ]
        : [])
    ];

    if (canRemove) {
      items.push(...(items.length ? [{ type: 'separator' as const }] : []), {
        id: 'remove',
        label: entry.standalone ? 'Remove from Marketplace' : 'Remove from Plugin',
        onClick: () => confirmRemoveEntry(entry)
      });
    }

    return items;
  };

  let getPluginMenuItems = (item: SkillMarketplacePlugin): MenuItem[] => {
    let plugin = getPlugin(item)!;
    let canUpdate = pluginCanUpdate(plugin);
    let items: MenuItem[] = [
      ...(canUpdate
        ? [
            {
              id: 'edit',
              label: 'Edit Plugin',
              onClick: () => openEditPlugin(plugin as SkillPlugin)
            }
          ]
        : []),
      ...(canUpdate && canCreatePlugins && plugin.skills.length > 0
        ? [
            {
              id: 'split',
              label: 'Split into Standalone Skills',
              onClick: () => confirmSplitPlugin(item)
            }
          ]
        : [])
    ];

    if (canCreatePlugins) {
      items.push(...(items.length ? [{ type: 'separator' as const }] : []), {
        id: 'remove',
        label: 'Remove from Marketplace',
        onClick: () => confirmRemovePlugin(item)
      });
    }

    return items;
  };

  let getDropState = (destination: MoveDestination): DropState => {
    if (!activeDrag) return 'idle';

    let entries = activeDrag.skillIds.flatMap(id => index.get(id) ?? []);
    if (destination.type === 'standalone') {
      if (!canCreatePlugins) return 'blocked';
      return entries.some(entry => !entry.standalone) ? 'available' : 'idle';
    }

    let target = displayed.find(item => item.skillPlugin?.id === destination.pluginId);
    let targetPlugin = target && getPlugin(target);
    if (!targetPlugin || !pluginCanUpdate(targetPlugin)) return 'blocked';

    let movable = entries.some(
      entry =>
        entry.plugin.id !== destination.pluginId &&
        !targetPlugin.skills.some(skill => skill.skillId === entry.skill.skillId)
    );
    return movable ? 'available' : 'idle';
  };

  let onDragStart = (event: DragStartEvent) => {
    let leadId = event.active.data.current?.skillId as string | undefined;
    if (!leadId) return;

    let skillIds = selected.has(leadId)
      ? [leadId, ...selectedIds.filter(id => id !== leadId)]
      : [leadId];
    setActiveDrag({ leadId, skillIds });
  };

  let onDragEnd = (event: DragEndEvent) => {
    let destination = event.over?.data.current?.destination as MoveDestination | undefined;
    let skillIds = activeDrag?.skillIds ?? [];
    setActiveDrag(null);

    if (destination) void moveSkills(skillIds, destination);
  };

  let sensors = useSensors(useSensor(SkillPointerSensor), useSensor(KeyboardSensor));

  let isOpen = (key: string) => searching || !collapsed.has(key);
  let allKeys = [...view.groups.map(group => group.plugin.id), standaloneKey];
  let allOpen = allKeys.every(key => !collapsed.has(key));

  let renderSkillRow = (entry: SkillEntry, indent: boolean) => {
    let skillId = entry.skill.skillId;

    return (
      <SkillRow
        key={skillId}
        entry={entry}
        href={p.getSkillPath?.(skillId)}
        selected={selected.has(skillId)}
        selectionActive={selectedIds.length > 0}
        pending={pendingKeys.has(skillId)}
        dimmed={Boolean(activeDrag?.skillIds.includes(skillId))}
        flash={flashIds.has(skillId)}
        indent={indent}
        dragDisabled={!entry.canMove}
        menuItems={getSkillMenuItems(entry)}
        onSelectedChange={checked =>
          setSelected(current => toggleKey(current, skillId, checked))
        }
      />
    );
  };

  return renderWithLoader(
    { marketplace, marketplacePlugins },
    { loading: () => <ListSkeleton /> }
  )(() => {
    let totalItems = view.counts.plugins + view.counts.standalone;
    let leadEntry = activeDrag ? index.get(activeDrag.leadId) : undefined;
    let showStandalone =
      filter !== 'plugins' &&
      (view.standalone.length > 0 ||
        (!searching && (view.counts.standalone > 0 || canCreatePlugins)));
    let nothingVisible = !view.groups.length && !showStandalone;
    let canAddSkills = canCreatePlugins || writablePlugins.length > 0;

    let toolbar = (
      <Toolbar>
        <ToolbarRow>
          <SearchField>
            <Input
              label="Search skills and plugins"
              hideLabel
              size="2"
              type="search"
              placeholder="Search skills and plugins..."
              value={search}
              onInput={setSearch}
            />
          </SearchField>

          <ToolbarActions>
            {canCreatePlugins && (
              <Button
                size="2"
                variant="outline"
                iconLeft={<RiPuzzle2Line />}
                onClick={openNewPlugin}
                menu={
                  p.showImportPlugin === false
                    ? undefined
                    : [{ label: 'Import Existing Plugin', onClick: openImportPlugin }]
                }
              >
                New Plugin
              </Button>
            )}

            {canAddSkills && (
              <Button size="2" iconLeft={<RiAddLine />} onClick={() => openAddSkills()}>
                Add Skills
              </Button>
            )}
          </ToolbarActions>
        </ToolbarRow>
      </Toolbar>
    );

    let list = !totalItems ? (
      <EmptyCard>
        <EmptyIcon>
          <RiStackLine />
        </EmptyIcon>
        <Text size="3" weight="strong">
          No skills in this marketplace yet
        </Text>
        <Text size="2" color="gray600">
          Add skills to list them here, or create a plugin to group related skills.
        </Text>
        {canAddSkills && (
          <EmptyActions>
            {canCreatePlugins && (
              <Button size="2" variant="outline" onClick={openNewPlugin}>
                New Plugin
              </Button>
            )}
            <Button size="2" iconLeft={<RiAddLine />} onClick={() => openAddSkills()}>
              Add Skills
            </Button>
          </EmptyActions>
        )}
      </EmptyCard>
    ) : nothingVisible ? (
      <EmptyCard>
        <Text size="3" weight="strong">
          {searching ? `Nothing matches "${search.trim()}"` : 'Nothing to show'}
        </Text>
        <Text size="2" color="gray600">
          Try a different search or filter.
        </Text>
        <EmptyActions>
          <Button
            size="2"
            variant="outline"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </EmptyActions>
      </EmptyCard>
    ) : (
      <LayoutGroup>
        <ListStack>
          {view.groups.map(group => {
            let canUpdate = pluginCanUpdate(group.plugin);

            return (
              <PluginGroup
                key={group.plugin.id}
                view={group}
                open={isOpen(group.plugin.id)}
                drop={getDropState({ type: 'plugin', pluginId: group.plugin.id })}
                dragActive={Boolean(activeDrag)}
                pending={pendingKeys.has(`plugin:${group.plugin.id}`)}
                canUpdate={canUpdate}
                menuItems={getPluginMenuItems(group.item)}
                onToggle={() =>
                  setCollapsed(current =>
                    toggleKey(current, group.plugin.id, !current.has(group.plugin.id))
                  )
                }
                onAddSkills={canUpdate ? () => openAddSkills(group.plugin.id) : undefined}
              >
                {group.skills.map(skill => renderSkillRow(index.get(skill.skillId)!, true))}
              </PluginGroup>
            );
          })}

          {showStandalone && (
            <StandaloneSection
              visibleCount={view.standalone.length}
              open={isOpen(standaloneKey)}
              drop={getDropState({ type: 'standalone' })}
              emptyMessage={
                canCreatePlugins
                  ? 'Drag a skill here to list it without a plugin.'
                  : 'No standalone skills.'
              }
              onToggle={() =>
                setCollapsed(current =>
                  toggleKey(current, standaloneKey, !current.has(standaloneKey))
                )
              }
            >
              {view.standalone.map(entry => renderSkillRow(entry, false))}
            </StandaloneSection>
          )}
        </ListStack>
      </LayoutGroup>
    );

    let body = (
      <MotionConfig reducedMotion="user">
        {toolbar}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragCancel={() => setActiveDrag(null)}
          onDragEnd={onDragEnd}
        >
          {list}

          <DragOverlay dropAnimation={null}>
            {leadEntry && activeDrag && (
              <DragPreview entry={leadEntry} count={activeDrag.skillIds.length} />
            )}
          </DragOverlay>
        </DndContext>

        <BulkBar
          count={selectedIds.length}
          moveItems={getMoveMenuItems(selectedIds)}
          canRemove
          onRemove={confirmRemoveSelected}
          onClear={() => setSelected(new Set())}
        />

        <Errors>
          <addMarketplacePlugin.RenderError />
          <removeMarketplacePlugin.RenderError />
          <createPlugin.RenderError />
          <addPluginSkill.RenderError />
          <removePluginSkill.RenderError />
          <deletePlugin.RenderError />
        </Errors>
      </MotionConfig>
    );

    if (p.showHeader === false) return body;

    return (
      <PageHeaderSection
        title="Plugins and Skills"
        description="Group related skills into plugins, or list skills on their own."
      >
        {body}
      </PageHeaderSection>
    );
  });
};
