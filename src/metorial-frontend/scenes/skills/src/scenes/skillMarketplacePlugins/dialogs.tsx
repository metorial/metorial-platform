import { useForm } from '@metorial/data-hooks';
import {
  type Skill,
  type SkillGroup,
  type SkillMarketplace,
  type SkillPlugin,
  useCreateSkillPlugin,
  useSkillGroupsPage,
  useSkillMarketplacesPage,
  useSkillPluginsPage,
  useSkillsPage,
  useUpdateSkillPlugin
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Panel,
  Select,
  Spinner,
  Text,
  showModal,
  theme
} from '@metorial/ui';
import { useSearchFilter } from '@metorial/use-search-filter';
import PQueue from 'p-queue';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import type { MoveDestination } from './hierarchy';
import { useFilledPages } from './useFilledPages';

let pickerPageSize = 30;

let pickerTargetCount = 25;

let PickerStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let PickerList = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  overflow: hidden;
`;

let PickerRow = styled.div<{ $selected: boolean; $disabled: boolean }>`
  height: 52px;
  padding: 0 14px;
  display: grid;
  grid-template-columns: 20px 28px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  background: ${({ $selected }) => ($selected ? theme.colors.gray200 : theme.colors.background)};
  transition: background 120ms ease;

  & + & {
    border-top: 1px solid ${theme.colors.gray300};
  }

  &:hover {
    background: ${({ $selected }) => ($selected ? theme.colors.gray250 : theme.colors.gray100)};
  }
`;

let PickerImage = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 22%;
  object-fit: cover;
  background: ${theme.colors.gray200};
`;

let PickerText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

let EmptyPicker = styled.div`
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let addSelectedItems = async <T,>(items: T[], onSelect: (item: T) => Promise<boolean>) => {
  let queue = new PQueue({ concurrency: 10 });
  let results = await queue.addAll(items.map(item => () => onSelect(item)));

  return results.every(Boolean);
};

let toggleIn = <T extends { id: string }>(current: T[], item: T, checked: boolean) =>
  checked ? [...current, item] : current.filter(selected => selected.id !== item.id);

type PickerItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

let PickerLoading = styled.div`
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let PickerPager = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

let PickerRows = <T extends PickerItem>(p: {
  pages: ReturnType<typeof useFilledPages<T>>;
  selectedIds: Set<string>;
  disabled: boolean;
  emptyMessage: string;
  onToggle: (item: T, checked: boolean) => void;
}) => {
  let { items, isLoading, error, hasNext, hasPrevious } = p.pages;

  if (error) {
    return (
      <PickerList>
        <EmptyPicker>
          <Text size="2" color="gray600">
            Failed to load results.
          </Text>

          <Button size="1" variant="outline" onClick={p.pages.refetch}>
            Try Again
          </Button>
        </EmptyPicker>
      </PickerList>
    );
  }

  if (isLoading) {
    return (
      <PickerList>
        <PickerLoading>
          <Spinner size={20} />
        </PickerLoading>
      </PickerList>
    );
  }

  if (!items.length) {
    return (
      <PickerList>
        <EmptyPicker>
          <Text size="2" color="gray600">
            {p.emptyMessage}
          </Text>
        </EmptyPicker>
      </PickerList>
    );
  }

  return (
    <PickerStack>
      <PickerList>
        {items.map(item => {
          let selected = p.selectedIds.has(item.id);

          return (
            <PickerRow
              key={item.id}
              $selected={selected}
              $disabled={p.disabled}
              onClick={() => !p.disabled && p.onToggle(item, !selected)}
            >
              <span onClick={event => event.stopPropagation()}>
                <Checkbox
                  label={`Select ${item.name}`}
                  hideLabel
                  checked={selected}
                  disabled={p.disabled}
                  onCheckedChange={checked => p.onToggle(item, checked)}
                />
              </span>

              {item.imageUrl ? (
                <PickerImage src={item.imageUrl} alt="" loading="lazy" />
              ) : (
                <span />
              )}

              <PickerText>
                <Text size="2" weight="strong" truncate>
                  {item.name}
                </Text>
              </PickerText>
            </PickerRow>
          );
        })}
      </PickerList>

      {(hasNext || hasPrevious) && (
        <PickerPager>
          <Button
            size="2"
            variant="outline"
            disabled={!hasPrevious}
            onClick={p.pages.previous}
          >
            Previous
          </Button>
          <Button size="2" variant="outline" disabled={!hasNext} onClick={p.pages.next}>
            Next
          </Button>
        </PickerPager>
      )}
    </PickerStack>
  );
};

let SkillPickerResults = (p: {
  pages: ReturnType<typeof useFilledPages<Skill>>;
  selectedIds: Set<string>;
  search: string;
  disabled: boolean;
  onToggle: (skill: Skill, checked: boolean) => void;
}) => (
  <PickerRows
    pages={p.pages}
    selectedIds={p.selectedIds}
    disabled={p.disabled}
    emptyMessage={
      p.search.trim()
        ? 'No available skills match your search.'
        : 'Every skill is already in this marketplace.'
    }
    onToggle={p.onToggle}
  />
);

export type AddSkillsDestinationOption = { id: string; label: string };

let AddSkillsPanel = (p: {
  instanceId: string;
  linkedSkillIds: Record<string, string[]>;
  destinations: AddSkillsDestinationOption[];
  initialDestination: string;
  close: () => void;
  onAdd: (skills: Skill[], destination: MoveDestination) => Promise<boolean>;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [destination, setDestination] = useState(p.initialDestination);
  let [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let linked = useMemo(
    () => new Set(p.linkedSkillIds[destination] ?? []),
    [p.linkedSkillIds, destination]
  );
  let skillsQuery = {
    order: 'asc' as const,
    status: ['active' as const],
    limit: pickerPageSize,
    ...(searchQuery ? { search: searchQuery } : {})
  };
  let skillPages = useFilledPages<Skill>({
    resetKey: `${p.instanceId}:${destination}:${searchQuery ?? ''}`,
    target: pickerTargetCount,
    usePage: after => useSkillsPage(p.instanceId, skillsQuery, after),
    isAllowed: skill => !linked.has(skill.id)
  });
  let selectedIds = useMemo(
    () => new Set(selectedSkills.map(skill => skill.id)),
    [selectedSkills]
  );

  let submit = async () => {
    setIsAdding(true);

    try {
      let added = await p.onAdd(
        selectedSkills,
        destination === 'standalone'
          ? { type: 'standalone' }
          : { type: 'plugin', pluginId: destination }
      );
      if (added) p.close();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Panel.Header
        actions={
          <Button
            size="2"
            loading={isAdding}
            disabled={!selectedSkills.length}
            onClick={submit}
          >
            {selectedSkills.length > 1 ? `Add ${selectedSkills.length} Skills` : 'Add Skill'}
          </Button>
        }
      >
        <Panel.Title>Add Skills</Panel.Title>
        <Panel.Description>
          Pick skills and choose whether they join a plugin or stand on their own.
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <PickerStack>
          <Select
            label="Add To"
            value={destination}
            onChange={value => {
              let nextLinked = new Set(p.linkedSkillIds[value] ?? []);
              setDestination(value);
              setSelectedSkills(current => current.filter(skill => !nextLinked.has(skill.id)));
            }}
            disabled={isAdding}
            items={p.destinations}
          />

          <Input
            label="Search skills"
            hideLabel
            placeholder="Search skills..."
            value={search}
            onInput={setSearch}
          />

          <SkillPickerResults
            pages={skillPages}
            selectedIds={selectedIds}
            search={search}
            disabled={isAdding}
            onToggle={(skill, checked) =>
              setSelectedSkills(current => toggleIn(current, skill, checked))
            }
          />
        </PickerStack>
      </Panel.Content>
    </>
  );
};

export let showAddSkillsPanel = (p: Omit<Parameters<typeof AddSkillsPanel>[0], 'close'>) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={760}>
      <AddSkillsPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let SkillGroupPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<boolean>;
  onDone?: () => Promise<void> | void;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let excluded = useMemo(() => new Set(p.excludeSkillIds), [p.excludeSkillIds]);
  let skillsQuery = {
    order: 'asc' as const,
    status: ['active' as const],
    limit: pickerPageSize,
    ...(searchQuery ? { search: searchQuery } : {})
  };
  let skillPages = useFilledPages<Skill>({
    resetKey: `${p.instanceId}:${searchQuery ?? ''}`,
    target: pickerTargetCount,
    usePage: after => useSkillsPage(p.instanceId, skillsQuery, after),
    isAllowed: skill => !excluded.has(skill.id)
  });
  let selectedIds = useMemo(
    () => new Set(selectedSkills.map(skill => skill.id)),
    [selectedSkills]
  );

  let submit = async () => {
    setIsAdding(true);

    try {
      let added = await addSelectedItems(selectedSkills, p.onSelect);
      await p.onDone?.();
      if (added) p.close();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Panel.Header
        actions={
          <Button
            size="2"
            loading={isAdding}
            disabled={!selectedSkills.length}
            onClick={submit}
          >
            {selectedSkills.length > 1 ? `Add ${selectedSkills.length} Skills` : 'Add Skill'}
          </Button>
        }
      >
        <Panel.Title>Add Skills</Panel.Title>
        <Panel.Description>
          Pick one or more skills to add to this group. Skills already in the group are hidden.
        </Panel.Description>
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

          <PickerRows
            pages={skillPages}
            selectedIds={selectedIds}
            disabled={isAdding}
            emptyMessage={
              search.trim()
                ? 'No available skills match your search.'
                : 'Every skill is already in this group.'
            }
            onToggle={(skill, checked) =>
              setSelectedSkills(current => toggleIn(current, skill, checked))
            }
          />
        </PickerStack>
      </Panel.Content>
    </>
  );
};

export let showSkillGroupSkillsPanel = (
  p: Omit<Parameters<typeof SkillGroupPickerPanel>[0], 'close'>
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={760}>
      <SkillGroupPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let PluginPickerResults = (p: {
  pages: ReturnType<typeof useFilledPages<SkillPlugin>>;
  selectedIds: Set<string>;
  search: string;
  disabled: boolean;
  onToggle: (plugin: SkillPlugin, checked: boolean) => void;
}) => (
  <PickerRows
    pages={p.pages}
    selectedIds={p.selectedIds}
    disabled={p.disabled}
    emptyMessage={
      p.search.trim()
        ? 'No available plugins match your search.'
        : 'No additional plugins to add to this marketplace.'
    }
    onToggle={p.onToggle}
  />
);

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
  let excluded = useMemo(() => new Set(p.excludePluginIds), [p.excludePluginIds]);
  let pluginsQuery = {
    order: 'asc' as const,
    status: ['active' as const],
    limit: pickerPageSize,
    ...(searchQuery ? { search: searchQuery } : {})
  };
  let pluginPages = useFilledPages<SkillPlugin>({
    resetKey: `${p.instanceId}:${searchQuery ?? ''}`,
    target: pickerTargetCount,
    usePage: after => useSkillPluginsPage(p.instanceId, pluginsQuery, after),
    isAllowed: plugin => !excluded.has(plugin.id)
  });
  let selectedIds = useMemo(
    () => new Set(selectedPlugins.map(plugin => plugin.id)),
    [selectedPlugins]
  );

  let submit = async () => {
    setIsAdding(true);

    try {
      if (await addSelectedItems(selectedPlugins, p.onSelect)) p.close();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Panel.Header
        actions={
          <Button
            size="2"
            loading={isAdding}
            disabled={!selectedPlugins.length}
            onClick={submit}
          >
            {selectedPlugins.length > 1
              ? `Import ${selectedPlugins.length} Plugins`
              : 'Import Plugin'}
          </Button>
        }
      >
        <Panel.Title>Import Plugin</Panel.Title>
        <Panel.Description>
          Add existing plugins, with all of their skills, to this marketplace.
        </Panel.Description>
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
            pages={pluginPages}
            selectedIds={selectedIds}
            search={search}
            disabled={isAdding}
            onToggle={(plugin, checked) =>
              setSelectedPlugins(current => toggleIn(current, plugin, checked))
            }
          />
        </PickerStack>
      </Panel.Content>
    </>
  );
};

export let showPluginPickerPanel = (
  p: Omit<Parameters<typeof PluginPickerPanel>[0], 'close'>
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={760}>
      <PluginPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let PublishSkillGroupPanel = (p: {
  instanceId: string;
  excludeSkillGroupIds: string[];
  close: () => void;
  onSelect: (skillGroup: SkillGroup) => Promise<boolean>;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedGroups, setSelectedGroups] = useState<SkillGroup[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let excluded = useMemo(() => new Set(p.excludeSkillGroupIds), [p.excludeSkillGroupIds]);
  let groupsQuery = {
    order: 'asc' as const,
    status: ['active' as const],
    limit: pickerPageSize,
    ...(searchQuery ? { search: searchQuery } : {})
  };
  let groupPages = useFilledPages<SkillGroup>({
    resetKey: `${p.instanceId}:${searchQuery ?? ''}`,
    target: pickerTargetCount,
    usePage: after => useSkillGroupsPage(p.instanceId, groupsQuery, after),
    isAllowed: group => !excluded.has(group.id)
  });
  let selectedIds = useMemo(
    () => new Set(selectedGroups.map(group => group.id)),
    [selectedGroups]
  );

  let submit = async () => {
    setIsAdding(true);

    try {
      if (await addSelectedItems(selectedGroups, p.onSelect)) p.close();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Panel.Header
        actions={
          <Button
            size="2"
            loading={isAdding}
            disabled={!selectedGroups.length}
            onClick={submit}
          >
            {selectedGroups.length > 1
              ? `Publish ${selectedGroups.length} Skill Groups`
              : 'Publish Skill Group'}
          </Button>
        }
      >
        <Panel.Title>Publish Skill Group</Panel.Title>
        <Panel.Description>
          Each group becomes a plugin in this marketplace. Its skills stay in sync with the
          group and are managed there.
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <PickerStack>
          <Input
            label="Search skill groups"
            hideLabel
            placeholder="Search skill groups..."
            value={search}
            onInput={setSearch}
          />

          <PickerRows
            pages={groupPages}
            selectedIds={selectedIds}
            disabled={isAdding}
            emptyMessage={
              search.trim()
                ? 'No available skill groups match your search.'
                : 'Every skill group is already published to this marketplace.'
            }
            onToggle={(group, checked) =>
              setSelectedGroups(current => toggleIn(current, group, checked))
            }
          />
        </PickerStack>
      </Panel.Content>
    </>
  );
};

let PublishToMarketplacePanel = (p: {
  instanceId: string;
  skillGroupName: string;
  excludeSkillMarketplaceIds: string[];
  close: () => void;
  onSelect: (skillMarketplace: SkillMarketplace) => Promise<boolean>;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedMarketplaces, setSelectedMarketplaces] = useState<SkillMarketplace[]>([]);
  let [isAdding, setIsAdding] = useState(false);
  let excluded = useMemo(
    () => new Set(p.excludeSkillMarketplaceIds),
    [p.excludeSkillMarketplaceIds]
  );
  let marketplacesQuery = {
    order: 'asc' as const,
    status: ['active' as const],
    limit: pickerPageSize,
    ...(searchQuery ? { search: searchQuery } : {})
  };
  let marketplacePages = useFilledPages<SkillMarketplace>({
    resetKey: `${p.instanceId}:${searchQuery ?? ''}`,
    target: pickerTargetCount,
    usePage: after => useSkillMarketplacesPage(p.instanceId, marketplacesQuery, after),
    isAllowed: marketplace => !excluded.has(marketplace.id) && marketplace.canCreatePlugins
  });
  let selectedIds = useMemo(
    () => new Set(selectedMarketplaces.map(marketplace => marketplace.id)),
    [selectedMarketplaces]
  );

  let submit = async () => {
    setIsAdding(true);

    try {
      if (await addSelectedItems(selectedMarketplaces, p.onSelect)) p.close();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Panel.Header
        actions={
          <Button
            size="2"
            loading={isAdding}
            disabled={!selectedMarketplaces.length}
            onClick={submit}
          >
            {selectedMarketplaces.length > 1
              ? `Publish to ${selectedMarketplaces.length} Marketplaces`
              : 'Publish to Marketplace'}
          </Button>
        }
      >
        <Panel.Title>Publish to Marketplace</Panel.Title>
        <Panel.Description>
          {p.skillGroupName} becomes a plugin in each selected marketplace. Its skills stay in
          sync with this group.
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <PickerStack>
          <Input
            label="Search marketplaces"
            hideLabel
            placeholder="Search marketplaces..."
            value={search}
            onInput={setSearch}
          />

          <PickerRows
            pages={marketplacePages}
            selectedIds={selectedIds}
            disabled={isAdding}
            emptyMessage={
              search.trim()
                ? 'No available marketplaces match your search.'
                : 'This group is already published to every marketplace you can edit.'
            }
            onToggle={(marketplace, checked) =>
              setSelectedMarketplaces(current => toggleIn(current, marketplace, checked))
            }
          />
        </PickerStack>
      </Panel.Content>
    </>
  );
};

export let showPublishToMarketplacePanel = (
  p: Omit<Parameters<typeof PublishToMarketplacePanel>[0], 'close'>
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={760}>
      <PublishToMarketplacePanel {...p} close={close} />
    </Panel.Wrapper>
  ));

export let showPublishSkillGroupPanel = (
  p: Omit<Parameters<typeof PublishSkillGroupPanel>[0], 'close'>
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={760}>
      <PublishSkillGroupPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let PluginForm = (p: {
  instanceId: string;
  skillMarketplaceId: string;
  plugin?: SkillPlugin;
  close: () => void;
  onChanged: (plugin: SkillPlugin) => Promise<void>;
}) => {
  let createPlugin = useCreateSkillPlugin();
  let updatePlugin = useUpdateSkillPlugin();
  let mutator = p.plugin ? updatePlugin : createPlugin;

  let form = useForm({
    initialValues: { name: p.plugin?.name ?? '', description: p.plugin?.description ?? '' },
    onSubmit: async values => {
      let input = {
        name: values.name.trim(),
        description: values.description.trim() || undefined
      };
      let [plugin] = p.plugin
        ? await updatePlugin.mutate({
            instanceId: p.instanceId,
            skillPluginId: p.plugin.id,
            ...input
          })
        : await createPlugin.mutate({
            instanceId: p.instanceId,
            skillMarketplaceId: p.skillMarketplaceId,
            ...input
          });
      if (!plugin) return;

      await p.onChanged(plugin);
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormStack>
        <Input label="Name" required autoFocus {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Input
          label="Description"
          as="textarea"
          minRows={3}
          {...form.getFieldProps('description')}
        />
        <form.RenderError field="description" />

        <Dialog.Actions>
          <Button type="button" variant="soft" disabled={mutator.isLoading} onClick={p.close}>
            Cancel
          </Button>
          <Button type="submit" loading={mutator.isLoading} success={mutator.isSuccess}>
            {p.plugin ? 'Save Changes' : 'Create Plugin'}
          </Button>
        </Dialog.Actions>

        <mutator.RenderError />
      </FormStack>
    </form>
  );
};

export let showPluginForm = (
  p: Omit<Parameters<typeof PluginForm>[0], 'close'> & { title?: string; description?: string }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <Dialog.Title>{p.title ?? (p.plugin ? 'Edit Plugin' : 'New Plugin')}</Dialog.Title>
      <Dialog.Description>
        {p.description ??
          (p.plugin
            ? 'Update how this plugin is listed in the marketplace.'
            : 'Create a plugin to group related skills in this marketplace.')}
      </Dialog.Description>
      <PluginForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
