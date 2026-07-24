import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  type Skill,
  type SkillMarketplacePlugin,
  type SkillPlugin,
  useAllSkillMarketplacePlugins,
  useCreateSkillMarketplacePlugin,
  useCreateSkillPlugin,
  useCreateSkillPluginSkill,
  useDeleteSkillMarketplacePlugin,
  useSkillMarketplace,
  useSkillPlugins,
  useSkills
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Input,
  Menu,
  Panel,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { Box, ItemGrid, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let EntityName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
`;

let EntityText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let Actions = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
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

let Slug = styled.div`
  background: ${theme.colors.gray300};
  min-height: 24px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

let truncate = (value: string | null | undefined, length = 100) => {
  if (!value) return undefined;
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
};

let PluginPickerPanel = (p: {
  instanceId: string;
  excludePluginIds: string[];
  close: () => void;
  onSelect: (plugin: SkillPlugin) => Promise<void> | void;
}) => {
  let [search, setSearch] = useState('');
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let excludedPluginIds = useMemo(() => new Set(p.excludePluginIds), [p.excludePluginIds]);
  let plugins = useSkillPlugins(p.instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 30,
    ...(search.trim() ? { slug: search.trim() } : {})
  });

  let selectPlugin = async (plugin: SkillPlugin) => {
    if (selectedId) return;
    setSelectedId(plugin.id);
    await p.onSelect(plugin);
    p.close();
  };

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>Add Existing Plugin</Panel.Title>
          <Panel.Description>
            Choose a plugin to add to this marketplace. Plugins already in the marketplace are
            hidden.
          </Panel.Description>
        </div>
      </Panel.Header>

      <Panel.Content>
        <PickerStack>
          <Input
            label="Filter plugins"
            hideLabel
            placeholder="Filter plugins by slug..."
            value={search}
            onInput={setSearch}
          />

          <PickerScroll>
            {renderWithPagination(plugins, { hidePaginationWhenUnavailable: true })(
              plugins => {
                let items = plugins.data.items.filter(
                  plugin => !excludedPluginIds.has(plugin.id)
                );

                if (items.length === 0) {
                  return (
                    <Text size="2" color="gray600">
                      {search.trim()
                        ? 'No plugins match your filter.'
                        : 'All active plugins are already linked to this marketplace.'}
                    </Text>
                  );
                }

                return (
                  <ItemGrid.Root width="270px">
                    {items.map(plugin => (
                      <ItemGrid.Item
                        key={plugin.id}
                        title={plugin.name}
                        description={truncate(plugin.description)}
                        height={200}
                        onClick={() => selectPlugin(plugin)}
                        disabled={selectedId !== null && selectedId !== plugin.id}
                        loading={selectedId === plugin.id}
                        icon={
                          <Avatar
                            entity={{
                              name: plugin.name,
                              photoUrl: plugin.imageUrl ?? undefined
                            }}
                            size={30}
                            imageFit="contain"
                          />
                        }
                        bottom={
                          <div style={{ display: 'flex' }}>
                            <Slug>{plugin.slug}</Slug>
                          </div>
                        }
                      />
                    ))}
                  </ItemGrid.Root>
                );
              }
            )}
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
  let linkedSkillIds = useMemo(() => new Set(p.linkedSkillIds), [p.linkedSkillIds]);
  let skills = useSkills(p.instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 30,
    ...(search.trim() ? { search: search.trim() } : {})
  });

  let selectSkill = async (skill: Skill) => {
    if (selectedId) return;
    setSelectedId(skill.id);
    await p.onSelect(skill);
    p.close();
  };

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
            {renderWithPagination(skills, { hidePaginationWhenUnavailable: true })(skills => {
              let items = skills.data.items.filter(skill => !linkedSkillIds.has(skill.id));

              if (items.length === 0) {
                return (
                  <Text size="2" color="gray600">
                    {search.trim()
                      ? 'No skills match your search.'
                      : 'Every active skill already appears in this marketplace.'}
                  </Text>
                );
              }

              return (
                <ItemGrid.Root width="270px">
                  {items.map(skill => (
                    <ItemGrid.Item
                      key={skill.id}
                      title={skill.name}
                      description={truncate(skill.description)}
                      height={200}
                      onClick={() => selectSkill(skill)}
                      disabled={selectedId !== null && selectedId !== skill.id}
                      loading={selectedId === skill.id}
                      icon={
                        <Avatar
                          entity={{
                            name: skill.name,
                            imageUrl: `https://avatar-cdn.metorial.com/${skill.id}`
                          }}
                          size={30}
                        />
                      }
                      bottom={
                        <div style={{ display: 'flex' }}>
                          <Slug>{skill.slug}</Slug>
                        </div>
                      }
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

let showPluginPickerPanel = (p: {
  instanceId: string;
  excludePluginIds: string[];
  onSelect: (plugin: SkillPlugin) => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <PluginPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let showSkillPickerPanel = (p: {
  instanceId: string;
  linkedSkillIds: string[];
  onSelect: (skill: Skill) => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <SkillPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let getPluginTableRow = (p: {
  item: SkillMarketplacePlugin;
  getSkillPluginPath?: (skillPluginId: string) => string;
  isDeleting: boolean;
  onRemove: () => void;
}) => {
  let plugin = p.item.skillPlugin;
  let title = plugin?.name ?? p.item.identifier;
  let description = plugin?.description;

  return {
    href: plugin?.id ? p.getSkillPluginPath?.(plugin.id) : undefined,
    data: [
      <EntityName>
        <Avatar
          entity={{
            name: title,
            imageUrl: plugin?.imageUrl ?? undefined
          }}
          size={32}
          radius={999}
          imageFit="contain"
        />
        <EntityText>
          <Text size="2" weight="strong">
            {title}
          </Text>
        </EntityText>
      </EntityName>,
      <Slug>{p.item.identifier}</Slug>,
      <Badge color={p.item.status === 'active' ? 'green' : 'gray'} size="1">
        {p.item.status}
      </Badge>,
      <Text size="2">
        {plugin?.skills.length ?? 0} skill{plugin?.skills.length === 1 ? '' : 's'}
      </Text>,
      <Actions onClick={e => e.stopPropagation()}>
        <Menu
          items={[{ id: 'remove', label: 'Remove' }]}
          onItemClick={item => {
            if (item !== 'remove') return;
            confirm({
              title: `Remove ${title}?`,
              description: 'Remove this plugin from the marketplace?',
              confirmText: 'Remove',
              onConfirm: p.onRemove
            });
          }}
        >
          <Button
            size="1"
            variant="outline"
            iconRight={<RiMore2Line />}
            loading={p.isDeleting}
            title="Marketplace plugin options"
          />
        </Menu>
      </Actions>
    ]
  };
};

export let SkillMarketplacePluginsScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  getSkillPluginPath?: (skillPluginId: string) => string;
  getSkillPath?: (skillId: string) => string;
}) => {
  let marketplace = useSkillMarketplace(p.instanceId, p.skillMarketplaceId);
  let syncMarketplace = marketplace.syncMutator();
  let marketplacePlugins = useAllSkillMarketplacePlugins(p.instanceId, p.skillMarketplaceId, {
    order: 'asc',
    status: ['active']
  });
  let createMarketplacePlugin = useCreateSkillMarketplacePlugin();
  let deleteMarketplacePlugin = useDeleteSkillMarketplacePlugin();
  let createSkillPlugin = useCreateSkillPlugin();
  let createSkillPluginSkill = useCreateSkillPluginSkill();
  let linkedPluginIds = useMemo(
    () =>
      (marketplacePlugins.data ?? [])
        .map(item => item.skillPlugin?.id ?? item.skillPlugin?.id)
        .filter((id): id is string => !!id),
    [marketplacePlugins.data]
  );
  let linkedSkillIds = useMemo(
    () =>
      (marketplacePlugins.data ?? []).flatMap(
        item => item.skillPlugin?.skills.map(skill => skill.skillId) ?? []
      ),
    [marketplacePlugins.data]
  );

  let addExistingPlugin = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showPluginPickerPanel({
      instanceId: p.instanceId,
      excludePluginIds: linkedPluginIds,
      onSelect: async plugin => {
        let [created] = await createMarketplacePlugin.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          skillPluginId: plugin.id
        });
        if (created) await marketplacePlugins.refetch();
      }
    });
  };

  let addSingleSkill = () => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    showSkillPickerPanel({
      instanceId: p.instanceId,
      linkedSkillIds,
      onSelect: async skill => {
        let [plugin] = await createSkillPlugin.mutate({
          instanceId: p.instanceId!,
          name: skill.name,
          description: skill.description ?? undefined,
          longDescription: skill.description ?? undefined,
          category: 'skill'
        });

        if (!plugin) return;

        await createSkillPluginSkill.mutate({
          instanceId: p.instanceId!,
          skillPluginId: plugin.id,
          skillId: skill.id,
          clientName: skill.clientName ?? skill.name,
          clientDescription: skill.clientDescription ?? skill.description ?? undefined,
          license: skill.license ?? undefined,
          compatibility: skill.compatibility ?? undefined
        });

        let [created] = await createMarketplacePlugin.mutate({
          instanceId: p.instanceId!,
          skillMarketplaceId: p.skillMarketplaceId!,
          skillPluginId: plugin.id
        });
        if (created) {
          await marketplacePlugins.refetch();
          await marketplace.refetch();
          await syncMarketplace.mutate({});
        }
      }
    });
  };

  let removePlugin = async (item: SkillMarketplacePlugin) => {
    if (!p.instanceId || !p.skillMarketplaceId) return;

    let [deleted] = await deleteMarketplacePlugin.mutate({
      instanceId: p.instanceId,
      skillMarketplaceId: p.skillMarketplaceId,
      skillMarketplacePluginId: item.id
    });
    if (deleted) {
      await marketplacePlugins.refetch();
      await marketplace.refetch();
      await syncMarketplace.mutate({});
    }
  };

  return renderWithLoader({ marketplacePlugins })(({ marketplacePlugins }) => (
    <Box
      title="Plugins and Skills"
      description="Choose which plugins and skills are available in this marketplace."
      rightActions={
        // <Menu
        //   items={[
        //     // { id: 'plugin', label: 'Add Existing Plugin' },
        //     { id: 'skill', label: 'Add Skill' }
        //   ]}
        //   onItemClick={item => {
        //     if (item === 'plugin') addExistingPlugin();
        //     if (item === 'skill') addSingleSkill();
        //   }}
        // >
        //   <Button
        //     size="2"
        //     iconLeft={<RiAddLine />}
        //     disabled={!p.instanceId || !p.skillMarketplaceId}
        //     variant="outline"
        //   >
        //     Add
        //   </Button>
        // </Menu>

        <Button
          size="2"
          iconLeft={<RiAddLine />}
          disabled={!p.instanceId || !p.skillMarketplaceId}
          onClick={addSingleSkill}
          variant="outline"
        >
          Add Skill
        </Button>
      }
    >
      {marketplacePlugins.data.length === 0 ? (
        <EmptyState>
          <Text color="gray600" size="2">
            This marketplace does not include any plugins yet.
          </Text>
        </EmptyState>
      ) : (
        <>
          <Table
            headers={['Name', 'Identifier', 'Status', 'Skills', '']}
            data={marketplacePlugins.data.map(item =>
              getPluginTableRow({
                item,
                getSkillPluginPath: p.getSkillPluginPath,
                isDeleting: deleteMarketplacePlugin.isLoading,
                onRemove: () => removePlugin(item)
              })
            )}
          />
          <createMarketplacePlugin.RenderError />
          <deleteMarketplacePlugin.RenderError />
          <createSkillPlugin.RenderError />
          <createSkillPluginSkill.RenderError />
          <syncMarketplace.RenderError />
        </>
      )}
    </Box>
  ));
};
