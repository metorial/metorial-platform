import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type PointerSensorProps,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
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
  useSkillMarketplace,
  useSkillPlugins,
  useSkills,
  useUpdateSkillPlugin
} from '@metorial/state';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Input,
  Menu,
  Panel,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useSearchFilter } from '@metorial/use-search-filter';
import {
  RiAddLine,
  RiDraggable,
  RiMore2Line as RiMoreVerticalLine,
  RiPuzzle2Line
} from '@remixicon/react';
import PQueue from 'p-queue';
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

type EmbeddedPluginSkill = SkillPlugin['skills'][number];

class SkillPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    let target = props.event.target;
    let isDragHandle =
      target instanceof Element && Boolean(target.closest('[data-skill-drag-handle]'));

    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: { distance: isDragHandle ? 6 : 20 }
      }
    });
  }
}

let Tree = styled.div`
  display: flex;
  flex-direction: column;
`;

let TreeRow = styled.div<{ $dropTarget?: boolean; $dragging?: boolean; $muted?: boolean }>`
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
  opacity: ${({ $dragging, $muted }) => ($dragging ? 0.45 : $muted ? 0.5 : 1)};
  color: ${({ $muted }) => ($muted ? theme.colors.gray600 : 'inherit')};
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

let SkillLink = styled(Link)`
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

let dragGutterIconStyle = {
  width: 17,
  height: 17,
  display: 'block',
  flexShrink: 0,
  color: theme.colors.gray700
} as const;

let DragGutterIcon = () => <RiDraggable size={17} style={dragGutterIconStyle} />;

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
  padding-top: 5px;
`;

let PickerStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let PickerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
`;

let PickerCheckbox = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  width: 24px;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let normalizeName = (value: string | null | undefined) => value?.trim().toLowerCase();

let paginationOpts = { hidePaginationWhenUnavailable: true };

let marketplaceCanCreatePlugins = (marketplace: {
  status: string;
  canCreatePlugins?: boolean;
}) => marketplace.canCreatePlugins ?? marketplace.status == 'active';

let pluginCanUpdate = (plugin: { status: string; canUpdate?: boolean }) =>
  plugin.canUpdate ?? plugin.status == 'active';

let pluginCanDelete = (plugin: { status: string; canDelete?: boolean }) =>
  plugin.canDelete === true;

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
  Boolean(item && isCollapsedMarketplacePlugin(item));

export let moveSkillOptimistically = (
  items: SkillMarketplacePlugin[],
  sourcePluginId: string,
  destinationPluginId: string,
  skill: EmbeddedPluginSkill,
  removeEmptySource = true
) =>
  items.flatMap(item => {
    let plugin = item.skillPlugin;
    if (!plugin) return [item];

    if (plugin.id === sourcePluginId) {
      if (
        plugin.skills.length === 1 &&
        removeEmptySource &&
        isCollapsedMarketplacePlugin(item)
      ) {
        return [];
      }
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

export let moveSkillToStandaloneOptimistically = (
  items: SkillMarketplacePlugin[],
  sourcePluginId: string,
  skill: EmbeddedPluginSkill,
  standalonePlugin: SkillMarketplacePlugin,
  removeEmptySource = true
) => [
  ...items.flatMap(item => {
    let plugin = item.skillPlugin;
    if (!plugin || plugin.id !== sourcePluginId) return [item];
    if (
      plugin.skills.length === 1 &&
      removeEmptySource &&
      isCollapsedMarketplacePlugin(item)
    ) {
      return [];
    }

    return [
      {
        ...item,
        skillPlugin: {
          ...plugin,
          skills: plugin.skills.filter(current => current.id !== skill.id)
        }
      }
    ];
  }),
  standalonePlugin
];

let asStandaloneMarketplacePlugin = (d: {
  plugin: SkillPlugin;
  skill: EmbeddedPluginSkill;
  skillMarketplaceId: string;
}): SkillMarketplacePlugin => ({
  object: 'skill.marketplace_plugin',
  id: `optimistic:${d.plugin.id}`,
  status: 'active',
  identifier: d.plugin.slug,
  skillConfigurationId: d.plugin.skillConfigurationId,
  skillMarketplaceId: d.skillMarketplaceId,
  skillPlugin: {
    ...d.plugin,
    skills: [d.skill]
  },
  createdAt: d.plugin.createdAt,
  updatedAt: d.plugin.updatedAt
});

let asOptimisticStandaloneMarketplacePlugin = (d: {
  sourcePlugin: SkillPlugin;
  skill: EmbeddedPluginSkill;
  skillMarketplaceId: string;
}) =>
  asStandaloneMarketplacePlugin({
    plugin: {
      ...d.sourcePlugin,
      id: `optimistic-plugin:${d.skill.id}`,
      name: d.skill.skill.name,
      slug: d.skill.skill.slug,
      description: d.skill.skill.description,
      skills: [d.skill]
    },
    skill: d.skill,
    skillMarketplaceId: d.skillMarketplaceId
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
      let aName = isCollapsedMarketplacePlugin(a)
        ? a.skillPlugin!.skills[0].skill.name
        : (a.skillPlugin?.name ?? a.identifier);
      let bName = isCollapsedMarketplacePlugin(b)
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

let addSelectedItems = async <T,>(items: T[], onSelect: (item: T) => Promise<boolean>) => {
  let queue = new PQueue({ concurrency: 10 });
  let results = await queue.addAll(items.map(item => () => onSelect(item)));
  return results.every(Boolean);
};

let PluginPickerResults = (p: {
  plugins: ReturnType<typeof useSkillPlugins>;
  excluded: Set<string>;
  selectedIds: Set<string>;
  search: string;
  isAdding: boolean;
  onToggle: (plugin: SkillPlugin, checked: boolean) => void;
}) =>
  renderWithPagination(
    p.plugins,
    paginationOpts
  )(plugins => {
    let items = plugins.data.items.filter(plugin => !p.excluded.has(plugin.id));

    if (!items.length)
      return (
        <Text size="2" color="gray600">
          {p.search.trim()
            ? 'No available plugins match your search.'
            : 'No additional plugins to add to this marketplace.'}
        </Text>
      );

    return (
      <Table
        headers={['Name', 'Identifier']}
        data={items.map(plugin => ({
          data: [
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PickerCheckbox key={plugin.id} onClick={event => event.stopPropagation()}>
                <Checkbox
                  label={`Select ${plugin.name}`}
                  hideLabel
                  checked={p.selectedIds.has(plugin.id)}
                  disabled={p.isAdding}
                  onCheckedChange={checked => p.onToggle(plugin, checked)}
                />
              </PickerCheckbox>

              <span>{plugin.name}</span>
            </div>,
            plugin.slug
          ],
          onClick: () => !p.isAdding && p.onToggle(plugin, !p.selectedIds.has(plugin.id))
        }))}
      />
    );
  });

let PluginPickerPanel = (p: {
  instanceId: string;
  excludePluginIds: string[];
  close: () => void;
  onSelect: (plugin: SkillPlugin) => Promise<boolean>;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedPlugins, setSelectedPlugins] = useState<SkillPlugin[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let plugins = useSkillPlugins(p.instanceId, {
    order: 'asc',
    status: ['active'],
    limit: 30,
    ...(searchQuery ? { search: searchQuery } : {})
  });
  let excluded = useMemo(() => new Set(p.excludePluginIds), [p.excludePluginIds]);
  let selectedIds = useMemo(
    () => new Set(selectedPlugins.map(plugin => plugin.id)),
    [selectedPlugins]
  );

  let toggleSelected = (plugin: SkillPlugin, checked: boolean) =>
    setSelectedPlugins(current =>
      checked
        ? [...current, plugin]
        : current.filter(selectedPlugin => selectedPlugin.id !== plugin.id)
    );

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>Add Plugin</Panel.Title>
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
          <PluginPickerResults
            plugins={plugins}
            excluded={excluded}
            selectedIds={selectedIds}
            search={search}
            isAdding={isAdding}
            onToggle={toggleSelected}
          />
          <PickerActions>
            <Button
              loading={isAdding}
              disabled={!selectedPlugins.length}
              onClick={async () => {
                setIsAdding(true);
                try {
                  if (await addSelectedItems(selectedPlugins, p.onSelect)) p.close();
                } finally {
                  setIsAdding(false);
                }
              }}
            >
              Add
            </Button>
          </PickerActions>
        </PickerStack>
      </Panel.Content>
    </>
  );
};

let SkillPickerResults = (p: {
  skills: ReturnType<typeof useSkills>;
  linked: Set<string>;
  selectedIds: Set<string>;
  search: string;
  isAdding: boolean;
  onToggle: (skill: Skill, checked: boolean) => void;
}) =>
  renderWithPagination(
    p.skills,
    paginationOpts
  )(skills => {
    let items = skills.data.items.filter(skill => !p.linked.has(skill.id));

    if (!items.length)
      return (
        <Text size="2" color="gray600">
          {p.search.trim()
            ? 'No available skills match your search.'
            : 'All skills on this page are already in this marketplace.'}
        </Text>
      );

    return (
      <Table
        headers={['Name', 'Identifier']}
        data={items.map(skill => ({
          data: [
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PickerCheckbox key={skill.id} onClick={event => event.stopPropagation()}>
                <Checkbox
                  label={`Select ${skill.name}`}
                  hideLabel
                  checked={p.selectedIds.has(skill.id)}
                  disabled={p.isAdding}
                  onCheckedChange={checked => p.onToggle(skill, checked)}
                />
              </PickerCheckbox>

              <span>{skill.name}</span>
            </div>,

            skill.slug
          ],
          onClick: () => !p.isAdding && p.onToggle(skill, !p.selectedIds.has(skill.id))
        }))}
      />
    );
  });

let SkillPickerPanel = (p: {
  instanceId: string;
  linkedSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<boolean>;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let skills = useSkills(p.instanceId, {
    order: 'asc',
    status: ['active'],
    limit: 30,
    ...(searchQuery ? { search: searchQuery } : {})
  });
  let linked = useMemo(() => new Set(p.linkedSkillIds), [p.linkedSkillIds]);
  let selectedIds = useMemo(
    () => new Set(selectedSkills.map(skill => skill.id)),
    [selectedSkills]
  );

  let toggleSelected = (skill: Skill, checked: boolean) =>
    setSelectedSkills(current =>
      checked
        ? [...current, skill]
        : current.filter(selectedSkill => selectedSkill.id !== skill.id)
    );

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
          <SkillPickerResults
            skills={skills}
            linked={linked}
            selectedIds={selectedIds}
            search={search}
            isAdding={isAdding}
            onToggle={toggleSelected}
          />
          <PickerActions>
            <Button
              loading={isAdding}
              disabled={!selectedSkills.length}
              onClick={async () => {
                setIsAdding(true);
                try {
                  if (await addSelectedItems(selectedSkills, p.onSelect)) p.close();
                } finally {
                  setIsAdding(false);
                }
              }}
            >
              Add
            </Button>
          </PickerActions>
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
          skillMarketplaceId: p.skillMarketplaceId,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
        if (!plugin) return;
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
  let loading = createPlugin.isLoading || updatePlugin.isLoading;
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
  canUpdate: boolean;
  canAddSkill: boolean;
  canRemove: boolean;
  onAddSkill: () => void;
  onEdit: () => void;
  onRemove: () => void;
  variant?: 'ghost' | 'outline';
}) => {
  let items = [
    ...(p.canAddSkill ? [{ label: 'Add Skill', onClick: p.onAddSkill }] : []),
    ...(p.canUpdate ? [{ label: 'Edit Plugin', onClick: p.onEdit }] : []),
    ...(p.canRemove ? [{ label: 'Remove from Marketplace', onClick: p.onRemove }] : [])
  ];
  if (!items.length) return null;

  return (
    <Menu items={items}>
      <Button
        aria-label={`${p.plugin.name} options`}
        title="Plugin options"
        size="1"
        variant={p.variant ?? 'ghost'}
        iconRight={<RiMoreVerticalLine />}
        disabled={p.disabled}
      />
    </Menu>
  );
};

let SkillRow = (p: {
  skill: EmbeddedPluginSkill;
  pluginId: string;
  href?: string;
  disabled: boolean;
  showDragHandle: boolean;
  muted?: boolean;
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
    <TreeRow
      ref={drag.setNodeRef}
      $dragging={drag.isDragging}
      $dropTarget={p.dropTarget}
      $muted={p.muted}
    >
      {p.showDragHandle && (
        <DragHandle
          ref={drag.setActivatorNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          data-skill-drag-handle
          disabled={p.disabled}
          aria-label={`Move ${p.skill.skill.name}`}
        >
          <DragGutterIcon />
        </DragHandle>
      )}
      {p.href ? (
        <SkillLink to={p.href} onPointerDown={event => drag.listeners?.onPointerDown?.(event)}>
          {content}
        </SkillLink>
      ) : (
        content
      )}
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
  canCreatePlugins: boolean;
  onAddSkill: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  let plugin = p.item.skillPlugin!;
  let canUpdate = pluginCanUpdate(plugin);
  let muted = !canUpdate;
  let showInlineAddSkill = canUpdate && !p.canCreatePlugins;
  let drop = useDroppable({
    id: `plugin:${plugin.id}`,
    disabled: p.dragDisabled || !canUpdate,
    data: { pluginId: plugin.id }
  });

  let actions = (
    <RowActions>
      <PluginMenu
        plugin={plugin}
        disabled={p.actionsDisabled}
        canUpdate={canUpdate}
        canAddSkill={canUpdate && !showInlineAddSkill}
        canRemove={p.canCreatePlugins}
        onAddSkill={p.onAddSkill}
        onEdit={p.onEdit}
        onRemove={p.onRemove}
        variant={showInlineAddSkill ? 'outline' : 'ghost'}
      />

      {showInlineAddSkill && (
        <Button
          size="1"
          iconLeft={<RiAddLine />}
          disabled={p.actionsDisabled}
          onClick={p.onAddSkill}
        >
          Add Skill
        </Button>
      )}
    </RowActions>
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
          disabled={p.dragDisabled || !canUpdate}
          showDragHandle={canUpdate}
          muted={muted}
          combined
          dropTarget={drop.isOver}
          actions={actions}
        />
      ) : (
        <>
          <TreeRow $dropTarget={drop.isOver} $muted={muted}>
            <RowMain>
              <Text size="2" weight="strong">
                {plugin.name}
              </Text>
            </RowMain>

            <Badge size="1" color="gray">
              {p.item.identifier}
            </Badge>

            {actions}
          </TreeRow>

          {plugin.skills.length > 0 && (
            <SkillBranches>
              {plugin.skills.map(skill => (
                <SkillRowWrap key={skill.id}>
                  <SkillRow
                    skill={skill}
                    pluginId={plugin.id}
                    href={p.getSkillPath?.(skill.skillId)}
                    disabled={p.dragDisabled || !canUpdate}
                    showDragHandle={canUpdate}
                    muted={muted}
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
  showHeader?: boolean;
  showImportPlugin?: boolean;
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
  let moveVersionRef = useRef(0);
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
  };
  let finishMove = (version: number, plugins: SkillMarketplacePlugin[]) => {
    setOptimisticPlugins(plugins);
    setMovePending(false);
    void refresh().finally(() => {
      if (moveVersionRef.current === version) setOptimisticPlugins(null);
    });
  };
  let cleanupEmptySourcePlugin = async (sourceItem: SkillMarketplacePlugin) => {
    if (!shouldDeleteSourcePluginAfterMove(sourceItem) || !p.instanceId) return;

    if (pluginCanDelete(sourceItem.skillPlugin!)) {
      await deletePlugin.mutate({
        instanceId: p.instanceId,
        skillPluginId: sourceItem.skillPlugin!.id
      });
      return;
    }

    if (
      marketplace.data &&
      marketplaceCanCreatePlugins(marketplace.data) &&
      p.skillMarketplaceId
    ) {
      await removeMarketplacePlugin.mutate({
        instanceId: p.instanceId,
        skillMarketplaceId: p.skillMarketplaceId,
        skillMarketplacePluginId: sourceItem.id
      });
    }
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
        return Boolean(added);
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
        return Boolean(added);
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
          skillMarketplaceId: p.skillMarketplaceId!,
          name: skill.name,
          description: skill.description ?? undefined
        });
        if (!plugin) return false;
        let [membership] = await addPluginSkill.mutate({
          instanceId: p.instanceId!,
          skillPluginId: plugin.id,
          ...getNewSkillInput(skill)
        });
        if (membership) await refresh();
        return Boolean(membership);
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

    let sourcePluginId = p2.sourceItem.skillPlugin!.id;
    let [plugin] = await createPlugin.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
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

    let marketplaceMembership = asStandaloneMarketplacePlugin({
      plugin,
      skill: p2.skill,
      skillMarketplaceId: p.skillMarketplaceId
    });
    let rollbackStandalonePlugin = async () => {
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

    await cleanupEmptySourcePlugin(p2.sourceItem);

    return marketplaceMembership;
  };

  let onDragEnd = async (event: DragEndEvent) => {
    let data = event.active.data.current as
      | { pluginId?: string; skill?: EmbeddedPluginSkill }
      | undefined;
    let destinationId = event.over?.data.current?.pluginId as string | undefined;
    let createStandalonePlugin = Boolean(event.over?.data.current?.createStandalonePlugin);
    let clearOverlay = () => setMovingSkill(null);
    if (
      !p.instanceId ||
      !data?.pluginId ||
      !data.skill ||
      (!destinationId && !createStandalonePlugin)
    ) {
      clearOverlay();
      return;
    }
    let sourceItem = displayedPlugins.find(item => item.skillPlugin?.id === data.pluginId);
    if (!sourceItem?.skillPlugin || !pluginCanUpdate(sourceItem.skillPlugin)) {
      clearOverlay();
      return;
    }
    let canCreatePlugins = marketplace.data
      ? marketplaceCanCreatePlugins(marketplace.data)
      : false;
    let removeEmptySource = canCreatePlugins;

    if (createStandalonePlugin) {
      if (
        !canCreatePlugins ||
        isCollapsedMarketplacePlugin(sourceItem) ||
        !p.skillMarketplaceId
      ) {
        clearOverlay();
        return;
      }
      let moveVersion = ++moveVersionRef.current;
      let nextPlugins = moveSkillToStandaloneOptimistically(
        displayedPlugins,
        data.pluginId,
        data.skill,
        asOptimisticStandaloneMarketplacePlugin({
          sourcePlugin: sourceItem.skillPlugin,
          skill: data.skill,
          skillMarketplaceId: p.skillMarketplaceId
        }),
        removeEmptySource
      );
      flushSync(() => {
        setOptimisticPlugins(nextPlugins);
        setMovePending(true);
      });
      clearOverlay();
      let moveCompleted = false;
      try {
        let standalonePlugin = await moveSkillToStandalonePlugin({
          sourceItem,
          skill: data.skill
        });
        if (!standalonePlugin) return;
        moveCompleted = true;
        finishMove(moveVersion, nextPlugins);
      } finally {
        if (!moveCompleted && moveVersionRef.current === moveVersion) {
          setOptimisticPlugins(null);
          setMovePending(false);
        }
      }
      return;
    }

    if (!destinationId || destinationId === data.pluginId) {
      clearOverlay();
      return;
    }
    let destination = displayedPlugins.find(
      item => item.skillPlugin?.id === destinationId
    )?.skillPlugin;
    if (
      !destination ||
      !pluginCanUpdate(destination) ||
      destination.skills.some(skill => skill.skillId === data.skill!.skillId)
    ) {
      clearOverlay();
      return;
    }
    let moveVersion = ++moveVersionRef.current;
    let nextPlugins = moveSkillOptimistically(
      displayedPlugins,
      data.pluginId,
      destinationId,
      data.skill,
      removeEmptySource
    );
    flushSync(() => {
      setOptimisticPlugins(nextPlugins);
      setMovePending(true);
    });
    clearOverlay();
    let moveCompleted = false;
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

      await cleanupEmptySourcePlugin(sourceItem);
      moveCompleted = true;
      finishMove(moveVersion, nextPlugins);
    } finally {
      if (!moveCompleted && moveVersionRef.current === moveVersion) {
        setOptimisticPlugins(null);
        setMovePending(false);
      }
    }
  };

  let sensors = useSensors(useSensor(SkillPointerSensor), useSensor(KeyboardSensor));
  return renderWithLoader({ marketplace, marketplacePlugins })(
    ({ marketplace, marketplacePlugins }) => {
      let canCreatePlugins = marketplaceCanCreatePlugins(marketplace.data);
      let body = (
        <>
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
                disabled={actionsDisabled || !canCreatePlugins}
                actions={
                  canCreatePlugins ? (
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
                        menu={
                          p.showImportPlugin === false
                            ? undefined
                            : [{ label: 'Import Plugin', onClick: addExistingPlugin }]
                        }
                      >
                        Add Plugin
                      </Button>
                    </RootActions>
                  ) : null
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
                        canCreatePlugins={canCreatePlugins}
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
                  <DragGutterIcon />
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
        </>
      );

      if (p.showHeader === false) return body;

      return (
        <PageHeaderSection
          title="Plugins and Skills"
          description="Manage plugins and skills for this marketplace. Use plugins to group related skills or add individual skills to the marketplace directly."
        >
          {body}
        </PageHeaderSection>
      );
    }
  );
};
