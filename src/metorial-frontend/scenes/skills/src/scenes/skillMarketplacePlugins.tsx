import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeaderSection } from '@metorial/layout';
import {
  type Skill,
  type SkillMarketplacePlugin,
  type SkillPlugin,
  useAllSkillMarketplacePlugins,
  useAllSkillPlugins,
  useAllSkills,
  useCreateSkillMarketplacePlugin,
  useCreateSkillPlugin,
  useCreateSkillPluginSkill,
  useDeleteSkillMarketplacePlugin,
  useDeleteSkillPlugin,
  useDeleteSkillPluginSkill,
  useSkillMarketplace,
  useUpdateSkillPlugin
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Input,
  Menu,
  Panel,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import {
  RiAddLine,
  RiDraggable,
  RiMore2Line as RiMoreVerticalLine,
  RiPuzzle2Line
} from '@remixicon/react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

type EmbeddedPluginSkill = SkillPlugin['skills'][number];

let Tree = styled.div`
  display: flex;
  flex-direction: column;
`;

let TreeRow = styled.div<{ $dropTarget?: boolean; $dragging?: boolean }>`
  min-height: 38px;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${({ $dropTarget }) =>
    $dropTarget ? theme.colors.blue200 : theme.colors.background};
  border: 1px solid
    ${({ $dropTarget }) => ($dropTarget ? theme.colors.blue600 : 'transparent')};
  border-radius: 8px;
  opacity: ${({ $dragging }) => ($dragging ? 0.45 : 1)};
  transition: 120ms ease;
`;

let MarketplaceRow = styled(TreeRow)`
  min-height: 36px;
  margin-left: -4px;
  padding: 2px 0 2px 4px;
  border: 0;
  background: ${({ $dropTarget }) => ($dropTarget ? theme.colors.blue200 : 'transparent')};
  outline: ${({ $dropTarget }) =>
    $dropTarget ? `1px solid ${theme.colors.blue600}` : 'none'};
`;

let Branches = styled.div`
  padding: 2px 0;
`;

let PluginBranch = styled.div`
  position: relative;
  margin-left: 14px;
  padding-left: 16px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-left: 1px solid ${theme.colors.gray400};
  }

  &:last-child::before {
    bottom: calc(100% - 19px);
  }
`;

let BranchConnector = styled.div`
  position: absolute;
  left: 0;
  top: 19px;
  width: 16px;
  border-top: 1px solid ${theme.colors.gray400};
`;

let SkillBranches = styled.div`
  margin-left: 20px;
  padding-left: 16px;
`;

let SkillRowWrap = styled.div`
  position: relative;
  padding-top: 2px;

  &::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 21px;
    width: 16px;
    border-top: 1px solid ${theme.colors.gray400};
  }

  &::after {
    content: '';
    position: absolute;
    left: -16px;
    top: 0;
    bottom: 0;
    border-left: 1px solid ${theme.colors.gray400};
  }

  &:last-child::after {
    bottom: calc(100% - 21px);
  }
`;

let RowMain = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
`;

let RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let RootActions = styled(RowActions)`
  flex-wrap: wrap;
  justify-content: flex-end;
`;

let SkillLink = styled.a`
  color: inherit;
  text-decoration: none;
  min-width: 0;
  flex: 1;
  border-radius: 6px;

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue600};
    outline-offset: 2px;
  }
`;

let DragHandle = styled.button`
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  color: ${theme.colors.gray700};
  background: transparent;
  cursor: grab;

  &:hover {
    background: ${theme.colors.gray300};
  }

  &:active {
    cursor: grabbing;
  }
`;

let EmptyState = styled.div`
  padding: 10px 8px 12px 58px;
`;

let PickerStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let PickerScroll = styled.div`
  max-height: calc(100vh - 205px);
  overflow: auto;
  padding-right: 2px;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let normalizeName = (value: string | null | undefined) => value?.trim().toLowerCase();

export let isCollapsedMarketplacePlugin = (item: SkillMarketplacePlugin) => {
  let plugin = item.skillPlugin;
  if (!plugin || plugin.skills.length !== 1) return false;

  let pluginNames = [plugin.name, item.identifier].map(normalizeName).filter(Boolean);
  let skill = plugin.skills[0].skill;
  let skillNames = [skill.name, skill.clientName, skill.slug]
    .map(normalizeName)
    .filter(Boolean);

  return skillNames.some(name => pluginNames.includes(name));
};

export let getMoveSkillInput = (skill: EmbeddedPluginSkill) => ({
  skillId: skill.skillId,
  identifier: skill.identifier,
  clientName: skill.clientName,
  clientDescription: skill.clientDescription,
  clientMetadata: skill.clientMetadata,
  license: skill.license,
  compatibility: skill.compatibility,
  skillConfigurationId: skill.skillConfigurationId
});

export let shouldDeleteSourcePluginAfterMove = (
  item: SkillMarketplacePlugin | undefined
): item is SkillMarketplacePlugin & { skillPlugin: SkillPlugin } =>
  item?.skillPlugin?.skills.length === 1;

export let moveSkillOptimistically = (
  items: SkillMarketplacePlugin[],
  sourcePluginId: string,
  destinationPluginId: string,
  skill: EmbeddedPluginSkill
) =>
  items.flatMap(item => {
    let plugin = item.skillPlugin;
    if (!plugin) return [item];

    if (plugin.id === sourcePluginId) {
      if (plugin.skills.length === 1) return [];
      return [
        {
          ...item,
          skillPlugin: {
            ...plugin,
            skills: plugin.skills.filter(current => current.id !== skill.id)
          }
        }
      ];
    }

    if (plugin.id === destinationPluginId) {
      return [
        {
          ...item,
          skillPlugin: { ...plugin, skills: [...plugin.skills, skill] }
        }
      ];
    }

    return [item];
  });

let compareNames = (
  aName: string | null | undefined,
  bName: string | null | undefined,
  aId: string,
  bId: string
) => {
  let byName = (aName ?? '').localeCompare(bName ?? '', undefined, {
    sensitivity: 'base',
    numeric: true
  });
  return byName || aId.localeCompare(bId);
};

export let sortMarketplacePluginHierarchy = (items: SkillMarketplacePlugin[]) =>
  items
    .map(item => ({
      ...item,
      skillPlugin: item.skillPlugin
        ? {
            ...item.skillPlugin,
            skills: [...item.skillPlugin.skills].sort((a, b) =>
              compareNames(a.skill.name, b.skill.name, a.id, b.id)
            )
          }
        : null
    }))
    .sort((a, b) => {
      let aIsStandalone = isCollapsedMarketplacePlugin(a);
      let bIsStandalone = isCollapsedMarketplacePlugin(b);
      if (aIsStandalone !== bIsStandalone) return aIsStandalone ? -1 : 1;

      let aName = aIsStandalone
        ? a.skillPlugin!.skills[0].skill.name
        : (a.skillPlugin?.name ?? a.identifier);
      let bName = bIsStandalone
        ? b.skillPlugin!.skills[0].skill.name
        : (b.skillPlugin?.name ?? b.identifier);
      return compareNames(aName, bName, a.id, b.id);
    });

let getNewSkillInput = (skill: Skill) => ({
  skillId: skill.id,
  clientName: skill.clientName ?? skill.name,
  clientDescription: skill.clientDescription ?? skill.description ?? undefined,
  clientMetadata: skill.clientMetadata ?? undefined,
  license: skill.license ?? undefined,
  compatibility: skill.compatibility ?? undefined
});

let PluginPickerPanel = (p: {
  instanceId: string;
  excludePluginIds: string[];
  close: () => void;
  onSelect: (plugin: SkillPlugin) => Promise<void> | void;
}) => {
  let [search, setSearch] = useState('');
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let plugins = useAllSkillPlugins(p.instanceId, { order: 'asc', status: ['active'] });
  let excluded = useMemo(() => new Set(p.excludePluginIds), [p.excludePluginIds]);

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>Import Skill</Panel.Title>
          <Panel.Description>
            Choose an existing plugin to add to this marketplace.
          </Panel.Description>
        </div>
      </Panel.Header>
      <Panel.Content>
        <PickerStack>
          <Input
            label="Search plugins"
            hideLabel
            placeholder="Search plugins..."
            value={search}
            onInput={setSearch}
          />
          <PickerScroll>
            {renderWithLoader({ plugins })(({ plugins }) => {
              let needle = normalizeName(search) ?? '';
              let items = plugins.data.filter(
                plugin =>
                  !excluded.has(plugin.id) &&
                  (!needle ||
                    [plugin.name, plugin.slug, plugin.description].some(value =>
                      normalizeName(value)?.includes(needle)
                    ))
              );
              if (!items.length)
                return (
                  <Text size="2" color="gray600">
                    No available plugins match your search.
                  </Text>
                );
              return (
                <ItemGrid.Root width="270px">
                  {items.map(plugin => (
                    <ItemGrid.Item
                      key={plugin.id}
                      title={plugin.name}
                      height={100}
                      onClick={async () => {
                        if (selectedId) return;
                        setSelectedId(plugin.id);
                        await p.onSelect(plugin);
                        p.close();
                      }}
                      disabled={selectedId !== null && selectedId !== plugin.id}
                      loading={selectedId === plugin.id}
                    />
                  ))}
                </ItemGrid.Root>
              );
            })}
          </PickerScroll>
        </PickerStack>
      </Panel.Content>
    </>
  );
};

let SkillPickerPanel = (p: {
  instanceId: string;
  linkedSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<void> | void;
}) => {
  let [search, setSearch] = useState('');
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let skills = useAllSkills(p.instanceId, { order: 'asc', status: ['active'] });
  let linked = useMemo(() => new Set(p.linkedSkillIds), [p.linkedSkillIds]);

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>Add Skill</Panel.Title>
          <Panel.Description>Choose a skill to add to this marketplace.</Panel.Description>
        </div>
      </Panel.Header>
      <Panel.Content>
        <PickerStack>
          <Input
            label="Search skills"
            hideLabel
            placeholder="Search skills..."
            value={search}
            onInput={setSearch}
          />
          <PickerScroll>
            {renderWithLoader({ skills })(({ skills }) => {
              let needle = normalizeName(search) ?? '';
              let items = skills.data.filter(
                skill =>
                  !linked.has(skill.id) &&
                  (!needle ||
                    [skill.name, skill.clientName, skill.slug].some(value =>
                      normalizeName(value)?.includes(needle)
                    ))
              );
              if (!items.length)
                return (
                  <Text size="2" color="gray600">
                    No available skills match your search.
                  </Text>
                );
              return (
                <ItemGrid.Root width="270px">
                  {items.map(skill => (
                    <ItemGrid.Item
                      key={skill.id}
                      title={skill.name}
                      height={100}
                      onClick={async () => {
                        if (selectedId) return;
                        setSelectedId(skill.id);
                        await p.onSelect(skill);
                        p.close();
                      }}
                      disabled={selectedId !== null && selectedId !== skill.id}
                      loading={selectedId === skill.id}
                    />
                  ))}
                </ItemGrid.Root>
              );
            })}
          </PickerScroll>
        </PickerStack>
      </Panel.Content>
    </>
  );
};

let showPluginPickerPanel = (p: Omit<Parameters<typeof PluginPickerPanel>[0], 'close'>) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <PluginPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let showSkillPickerPanel = (p: Omit<Parameters<typeof SkillPickerPanel>[0], 'close'>) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <SkillPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let PluginForm = (p: {
  instanceId: string;
  skillMarketplaceId: string;
  plugin?: SkillPlugin;
  close: () => void;
  onChanged: () => Promise<void>;
}) => {
  let createPlugin = useCreateSkillPlugin();
  let updatePlugin = useUpdateSkillPlugin();
  let addMarketplacePlugin = useCreateSkillMarketplacePlugin();
  let form = useForm({
    initialValues: { name: p.plugin?.name ?? '', description: p.plugin?.description ?? '' },
    onSubmit: async values => {
      if (p.plugin) {
        let [updated] = await updatePlugin.mutate({
          instanceId: p.instanceId,
          skillPluginId: p.plugin.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
        if (!updated) return;
      } else {
        let [plugin] = await createPlugin.mutate({
          instanceId: p.instanceId,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
        if (!plugin) return;
        let [added] = await addMarketplacePlugin.mutate({
          instanceId: p.instanceId,
          skillMarketplaceId: p.skillMarketplaceId,
          skillPluginId: plugin.id
        });
        if (!added) return;
      }
      await p.onChanged();
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });
  let loading =
    createPlugin.isLoading || updatePlugin.isLoading || addMarketplacePlugin.isLoading;
  return (
    <form onSubmit={form.handleSubmit}>
      <FormStack>
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />
        <Input
          label="Description"
          as="textarea"
          minRows={3}
          {...form.getFieldProps('description')}
        />
        <form.RenderError field="description" />
        <Dialog.Actions>
          <Button type="button" variant="soft" onClick={p.close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {p.plugin ? 'Save' : 'Create Plugin'}
          </Button>
        </Dialog.Actions>
        <createPlugin.RenderError />
        <updatePlugin.RenderError />
        <addMarketplacePlugin.RenderError />
      </FormStack>
    </form>
  );
};

let showPluginForm = (p: Omit<Parameters<typeof PluginForm>[0], 'close'>) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>{p.plugin ? 'Edit Plugin' : 'Add Plugin'}</Dialog.Title>
      <Dialog.Description>
        {p.plugin
          ? 'Update the plugin name and description.'
          : 'Create a plugin and add it to this marketplace.'}
      </Dialog.Description>
      <PluginForm {...p} close={close} />
    </Dialog.Wrapper>
  ));

let PluginMenu = (p: {
  plugin: SkillPlugin;
  disabled: boolean;
  onAddSkill: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) => (
  <Menu
    items={[
      { label: 'Add Skill', onClick: p.onAddSkill },
      { label: 'Edit Plugin', onClick: p.onEdit },
      { label: 'Remove from Marketplace', onClick: p.onRemove }
    ]}
  >
    <Button
      aria-label={`${p.plugin.name} options`}
      title="Plugin options"
      size="1"
      variant="ghost"
      iconRight={<RiMoreVerticalLine />}
      disabled={p.disabled}
    />
  </Menu>
);

let SkillRow = (p: {
  skill: EmbeddedPluginSkill;
  pluginId: string;
  href?: string;
  disabled: boolean;
  combined?: boolean;
  dropTarget?: boolean;
  actions?: React.ReactNode;
}) => {
  let drag = useDraggable({
    id: `skill:${p.skill.id}`,
    disabled: p.disabled,
    data: { pluginId: p.pluginId, skill: p.skill }
  });
  let content = (
    <RowMain>
      <Text size="2" weight="strong">
        {p.skill.skill.name}
      </Text>
    </RowMain>
  );
  return (
    <TreeRow ref={drag.setNodeRef} $dragging={drag.isDragging} $dropTarget={p.dropTarget}>
      <DragHandle
        ref={drag.setActivatorNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        disabled={p.disabled}
        aria-label={`Move ${p.skill.skill.name}`}
      >
        <RiDraggable size={17} />
      </DragHandle>
      {p.href ? <SkillLink href={p.href}>{content}</SkillLink> : content}
      {p.combined && (
        <Badge size="1" color="purple">
          Single Skill
        </Badge>
      )}
      {p.actions}
    </TreeRow>
  );
};

let MarketplaceHeader = (p: {
  marketplaceId: string;
  name: string;
  disabled: boolean;
  actions: React.ReactNode;
}) => {
  let drop = useDroppable({
    id: `marketplace:${p.marketplaceId}`,
    disabled: p.disabled,
    data: { createStandalonePlugin: true }
  });

  return (
    <MarketplaceRow ref={drop.setNodeRef} $dropTarget={drop.isOver}>
      <RowMain>
        <Text size="2" weight="strong">
          {p.name}
        </Text>
      </RowMain>
      {p.actions}
    </MarketplaceRow>
  );
};

let PluginTreeItem = (p: {
  item: SkillMarketplacePlugin;
  getSkillPath?: (skillId: string) => string;
  actionsDisabled: boolean;
  dragDisabled: boolean;
  onAddSkill: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  let plugin = p.item.skillPlugin!;
  let drop = useDroppable({
    id: `plugin:${plugin.id}`,
    disabled: p.dragDisabled,
    data: { pluginId: plugin.id }
  });
  let menu = (
    <PluginMenu
      plugin={plugin}
      disabled={p.actionsDisabled}
      onAddSkill={p.onAddSkill}
      onEdit={p.onEdit}
      onRemove={p.onRemove}
    />
  );
  let collapsed = isCollapsedMarketplacePlugin(p.item);
  return (
    <PluginBranch ref={drop.setNodeRef}>
      <BranchConnector />
      {collapsed ? (
        <SkillRow
          skill={plugin.skills[0]}
          pluginId={plugin.id}
          href={p.getSkillPath?.(plugin.skills[0].skillId)}
          disabled={p.dragDisabled}
          combined
          dropTarget={drop.isOver}
          actions={menu}
        />
      ) : (
        <>
          <TreeRow $dropTarget={drop.isOver}>
            <RowMain>
              <Text size="2" weight="strong">
                {plugin.name}
              </Text>
            </RowMain>
            <Badge size="1" color="gray">
              {p.item.identifier}
            </Badge>
            {menu}
          </TreeRow>
          {plugin.skills.length > 0 && (
            <SkillBranches>
              {plugin.skills.map(skill => (
                <SkillRowWrap key={skill.id}>
                  <SkillRow
                    skill={skill}
                    pluginId={plugin.id}
                    href={p.getSkillPath?.(skill.skillId)}
                    disabled={p.dragDisabled}
                  />
                </SkillRowWrap>
              ))}
            </SkillBranches>
          )}
        </>
      )}
    </PluginBranch>
  );
};

export let SkillMarketplacePluginsScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  getSkillPluginPath?: (skillPluginId: string) => string;
  getSkillPath?: (skillId: string) => string;
}) => {
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
  let [movingSkill, setMovingSkill] = useState<EmbeddedPluginSkill | null>(null);
  let [movePending, setMovePending] = useState(false);
  let [optimisticPlugins, setOptimisticPlugins] = useState<SkillMarketplacePlugin[] | null>(
    null
  );
  let displayedPlugins = useMemo(
    () => sortMarketplacePluginHierarchy(optimisticPlugins ?? marketplacePlugins.data ?? []),
    [optimisticPlugins, marketplacePlugins.data]
  );

  let linkedPluginIds = useMemo(
    () =>
      marketplacePlugins.data?.flatMap(item =>
        item.skillPlugin ? [item.skillPlugin.id] : []
      ) ?? [],
    [marketplacePlugins.data]
  );
  let linkedSkillIds = useMemo(
    () =>
      marketplacePlugins.data?.flatMap(
        item => item.skillPlugin?.skills.map(skill => skill.skillId) ?? []
      ) ?? [],
    [marketplacePlugins.data]
  );
  let refresh = async () => {
    await marketplacePlugins.refetch();
    await marketplace.refetch();
  };
  let actionsDisabled =
    movePending ||
    createPlugin.isLoading ||
    addMarketplacePlugin.isLoading ||
    addPluginSkill.isLoading ||
    removePluginSkill.isLoading ||
    deletePlugin.isLoading ||
    removeMarketplacePlugin.isLoading;

  let addExistingPlugin = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;
    showPluginPickerPanel({
      instanceId: p.instanceId,
      excludePluginIds: linkedPluginIds,
      onSelect: async plugin => {
        let [added] = await addMarketplacePlugin.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          skillPluginId: plugin.id
        });
        if (added) await refresh();
      }
    });
  };
  let addSkillToPlugin = (plugin: SkillPlugin) => {
    if (!p.instanceId) return;
    showSkillPickerPanel({
      instanceId: p.instanceId,
      linkedSkillIds,
      onSelect: async skill => {
        let [added] = await addPluginSkill.mutate({
          instanceId: p.instanceId!,
          skillPluginId: plugin.id,
          ...getNewSkillInput(skill)
        });
        if (added) await refresh();
      }
    });
  };
  let addSingleSkill = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;
    showSkillPickerPanel({
      instanceId: p.instanceId,
      linkedSkillIds,
      onSelect: async skill => {
        let [plugin] = await createPlugin.mutate({
          instanceId: p.instanceId!,
          name: skill.name,
          description: skill.description ?? undefined
        });
        if (!plugin) return;
        let [membership] = await addPluginSkill.mutate({
          instanceId: p.instanceId!,
          skillPluginId: plugin.id,
          ...getNewSkillInput(skill)
        });
        if (!membership) return;
        let [added] = await addMarketplacePlugin.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          skillPluginId: plugin.id
        });
        if (added) await refresh();
      }
    });
  };
  let removePlugin = (item: SkillMarketplacePlugin) =>
    confirm({
      title: `Remove ${item.skillPlugin?.name ?? item.identifier}?`,
      description:
        'Remove this plugin from the marketplace? The plugin and its skills will not be deleted.',
      confirmText: 'Remove',
      onConfirm: async () => {
        if (!p.instanceId || !p.skillMarketplaceId) return;
        let [removed] = await removeMarketplacePlugin.mutate({
          instanceId: p.instanceId,
          skillMarketplaceId: p.skillMarketplaceId,
          skillMarketplacePluginId: item.id
        });
        if (removed) await refresh();
      }
    });

  let onDragStart = (event: DragStartEvent) =>
    setMovingSkill(event.active.data.current?.skill ?? null);

  let moveSkillToStandalonePlugin = async (p2: {
    sourceItem: SkillMarketplacePlugin;
    skill: EmbeddedPluginSkill;
  }) => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    setMovePending(true);

    let sourcePluginId = p2.sourceItem.skillPlugin!.id;
    let [plugin] = await createPlugin.mutate({
      instanceId: p.instanceId,
      name: p2.skill.skill.name,
      description: p2.skill.skill.description ?? undefined
    });
    if (!plugin) return;

    let [membership] = await addPluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: plugin.id,
      ...getMoveSkillInput(p2.skill)
    });
    if (!membership) {
      await deletePlugin.mutate({ instanceId: p.instanceId, skillPluginId: plugin.id });
      return;
    }

    let [marketplaceMembership] = await addMarketplacePlugin.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      skillPluginId: plugin.id
    });
    if (!marketplaceMembership) {
      await deletePlugin.mutate({ instanceId: p.instanceId, skillPluginId: plugin.id });
      return;
    }

    let rollbackStandalonePlugin = async () => {
      await removeMarketplacePlugin.mutate({
        instanceId: p.instanceId!,
        skillMarketplaceId: p.skillMarketplaceId!,
        skillMarketplacePluginId: marketplaceMembership.id
      });
      await deletePlugin.mutate({
        instanceId: p.instanceId!,
        skillPluginId: plugin.id
      });
    };
    let [removed] = await removePluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: sourcePluginId,
      skillPluginSkillId: p2.skill.id
    });
    if (!removed) {
      await rollbackStandalonePlugin();
      await refresh();
      return;
    }

    if (shouldDeleteSourcePluginAfterMove(p2.sourceItem)) {
      let [sourceMarketplaceMembershipRemoved] = await removeMarketplacePlugin.mutate({
        instanceId: p.instanceId,
        skillMarketplaceId: p.skillMarketplaceId,
        skillMarketplacePluginId: p2.sourceItem.id
      });
      if (!sourceMarketplaceMembershipRemoved) {
        await addPluginSkill.mutate({
          instanceId: p.instanceId,
          skillPluginId: sourcePluginId,
          ...getMoveSkillInput(p2.skill)
        });
        await rollbackStandalonePlugin();
        await refresh();
        return;
      }

      let [sourcePluginDeleted] = await deletePlugin.mutate({
        instanceId: p.instanceId,
        skillPluginId: sourcePluginId
      });
      if (!sourcePluginDeleted) {
        await addPluginSkill.mutate({
          instanceId: p.instanceId,
          skillPluginId: sourcePluginId,
          ...getMoveSkillInput(p2.skill)
        });
        await addMarketplacePlugin.mutate({
          instanceId: p.instanceId,
          skillMarketplaceId: p.skillMarketplaceId,
          skillPluginId: sourcePluginId
        });
        await rollbackStandalonePlugin();
        await refresh();
        return;
      }
    }

    await refresh();
  };

  let onDragEnd = async (event: DragEndEvent) => {
    let data = event.active.data.current as
      | { pluginId?: string; skill?: EmbeddedPluginSkill }
      | undefined;
    let destinationId = event.over?.data.current?.pluginId as string | undefined;
    let createStandalonePlugin = Boolean(event.over?.data.current?.createStandalonePlugin);
    setMovingSkill(null);
    if (
      !p.instanceId ||
      !data?.pluginId ||
      !data.skill ||
      (!destinationId && !createStandalonePlugin)
    )
      return;
    let sourceItem = marketplacePlugins.data?.find(
      item => item.skillPlugin?.id === data.pluginId
    );
    if (!sourceItem?.skillPlugin) return;

    if (createStandalonePlugin) {
      if (isCollapsedMarketplacePlugin(sourceItem)) return;
      try {
        await moveSkillToStandalonePlugin({ sourceItem, skill: data.skill });
      } finally {
        setOptimisticPlugins(null);
        setMovePending(false);
      }
      return;
    }

    if (!destinationId || destinationId === data.pluginId) return;
    let destination = marketplacePlugins.data?.find(
      item => item.skillPlugin?.id === destinationId
    )?.skillPlugin;
    if (
      !destination ||
      destination.skills.some(skill => skill.skillId === data.skill!.skillId)
    )
      return;
    setOptimisticPlugins(
      moveSkillOptimistically(
        marketplacePlugins.data ?? [],
        data.pluginId,
        destinationId,
        data.skill
      )
    );
    setMovePending(true);
    try {
      let [created] = await addPluginSkill.mutate({
        instanceId: p.instanceId,
        skillPluginId: destinationId,
        ...getMoveSkillInput(data.skill)
      });
      if (!created) return;
      let [removed] = await removePluginSkill.mutate({
        instanceId: p.instanceId,
        skillPluginId: data.pluginId,
        skillPluginSkillId: data.skill.id
      });
      if (!removed) {
        await removePluginSkill.mutate({
          instanceId: p.instanceId,
          skillPluginId: destinationId,
          skillPluginSkillId: created.id
        });
        await refresh();
        return;
      }

      if (shouldDeleteSourcePluginAfterMove(sourceItem)) {
        let [marketplaceMembershipRemoved] = await removeMarketplacePlugin.mutate({
          instanceId: p.instanceId,
          skillMarketplaceId: p.skillMarketplaceId!,
          skillMarketplacePluginId: sourceItem.id
        });

        if (!marketplaceMembershipRemoved) {
          await addPluginSkill.mutate({
            instanceId: p.instanceId,
            skillPluginId: data.pluginId,
            ...getMoveSkillInput(data.skill)
          });
          await removePluginSkill.mutate({
            instanceId: p.instanceId,
            skillPluginId: destinationId,
            skillPluginSkillId: created.id
          });
          await refresh();
          return;
        }

        let [pluginDeleted] = await deletePlugin.mutate({
          instanceId: p.instanceId,
          skillPluginId: data.pluginId
        });

        if (!pluginDeleted) {
          await addPluginSkill.mutate({
            instanceId: p.instanceId,
            skillPluginId: data.pluginId,
            ...getMoveSkillInput(data.skill)
          });
          await addMarketplacePlugin.mutate({
            instanceId: p.instanceId,
            skillMarketplaceId: p.skillMarketplaceId!,
            skillPluginId: data.pluginId
          });
          await removePluginSkill.mutate({
            instanceId: p.instanceId,
            skillPluginId: destinationId,
            skillPluginSkillId: created.id
          });
          await refresh();
          return;
        }
      }
      await refresh();
    } finally {
      setOptimisticPlugins(null);
      setMovePending(false);
    }
  };

  let sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
  return renderWithLoader({ marketplace, marketplacePlugins })(
    ({ marketplace, marketplacePlugins }) => (
      <PageHeaderSection
        title="Plugins and Skills"
        description="Add and manage plugins and skills for this marketplace. Use plugins to group related skills together, or add individual skills directly to the marketplace."
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragCancel={() => setMovingSkill(null)}
          onDragEnd={onDragEnd}
        >
          <Tree>
            <MarketplaceHeader
              marketplaceId={marketplace.data.id}
              name={marketplace.data.name}
              disabled={actionsDisabled}
              actions={
                <RootActions>
                  <Button
                    size="2"
                    variant="outline"
                    iconLeft={<RiAddLine />}
                    onClick={addSingleSkill}
                    disabled={actionsDisabled}
                  >
                    Add Skill
                  </Button>
                  <Button
                    size="2"
                    iconLeft={<RiPuzzle2Line />}
                    disabled={actionsDisabled}
                    onClick={() =>
                      p.instanceId &&
                      p.skillMarketplaceId &&
                      showPluginForm({
                        instanceId: p.instanceId,
                        skillMarketplaceId: p.skillMarketplaceId,
                        onChanged: refresh
                      })
                    }
                    menu={[{ label: 'Import Skill', onClick: addExistingPlugin }]}
                  >
                    Add Plugin
                  </Button>
                </RootActions>
              }
            />
            {displayedPlugins.length ? (
              <Branches>
                {displayedPlugins
                  .filter(item => item.skillPlugin)
                  .map(item => (
                    <PluginTreeItem
                      key={item.id}
                      item={item}
                      getSkillPath={p.getSkillPath}
                      actionsDisabled={actionsDisabled}
                      dragDisabled={movePending}
                      onAddSkill={() => addSkillToPlugin(item.skillPlugin!)}
                      onEdit={() =>
                        p.instanceId &&
                        p.skillMarketplaceId &&
                        showPluginForm({
                          instanceId: p.instanceId,
                          skillMarketplaceId: p.skillMarketplaceId,
                          plugin: item.skillPlugin!,
                          onChanged: refresh
                        })
                      }
                      onRemove={() => removePlugin(item)}
                    />
                  ))}
              </Branches>
            ) : (
              <EmptyState>
                <Text color="gray600" size="2">
                  This marketplace does not include any plugins yet.
                </Text>
              </EmptyState>
            )}
          </Tree>
          <DragOverlay>
            {movingSkill && (
              <TreeRow>
                <RiDraggable />
                <Text size="2" weight="strong">
                  {movingSkill.skill.name}
                </Text>
              </TreeRow>
            )}
          </DragOverlay>
        </DndContext>
        <addMarketplacePlugin.RenderError />
        <removeMarketplacePlugin.RenderError />
        <createPlugin.RenderError />
        <addPluginSkill.RenderError />
        <removePluginSkill.RenderError />
        <deletePlugin.RenderError />
      </PageHeaderSection>
    )
  );
};
