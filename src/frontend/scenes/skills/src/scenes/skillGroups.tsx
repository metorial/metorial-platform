import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  type Skill,
  type SkillGroup,
  type SkillGroupItem,
  useAllSkillGroupItems,
  useCreateSkillGroupItem,
  useDeleteSkillGroupItem,
  useSkillGroups,
  useSkills,
  useUpdateSkillGroup
} from '@metorial/state';
import {
  Avatar,
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

let SkillName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
`;

let SkillText = styled.div`
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

let SkillPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<void> | void;
}) => {
  let [search, setSearch] = useState('');
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let excludedSkillIds = useMemo(() => new Set(p.excludeSkillIds), [p.excludeSkillIds]);
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
          <Panel.Description>
            Choose a skill to add to this group. Skills already in the group are hidden.
          </Panel.Description>
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
              let items = skills.data.items.filter(skill => !excludedSkillIds.has(skill.id));

              if (items.length === 0) {
                return (
                  <Text size="2" color="gray600">
                    {search.trim()
                      ? 'No skills match your search.'
                      : 'All available skills are already selected.'}
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

let showSkillPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  onSelect: (skill: Skill) => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <SkillPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let getSkillTableRow = (p: {
  skill: SkillGroupItem['skill'] | SkillGroup['skills'][number];
  getSkillPath?: (skillId: string) => string;
  isDeleting?: boolean;
  onRemove?: () => void;
}) => {
  return {
    href: p.getSkillPath?.(p.skill.id),
    data: [
      <SkillName>
        <Avatar
          entity={{
            name: p.skill.name,
            imageUrl: `https://avatar-cdn.metorial.com/${p.skill.id}`
          }}
          size={32}
          radius={999}
        />
        <SkillText>
          <Text size="2" weight="strong">
            {p.skill.name}
          </Text>
          {p.skill.description && (
            <Text size="2" color="gray600">
              <Description>{p.skill.description}</Description>
            </Text>
          )}
        </SkillText>
      </SkillName>,
      <Slug>{p.skill.slug}</Slug>,
      p.onRemove ? (
        <Actions>
          <Menu
            items={[{ id: 'remove', label: 'Remove' }]}
            onItemClick={item => {
              if (item !== 'remove') return;
              confirm({
                title: `Remove ${p.skill.name}?`,
                description: 'Remove this skill from the group?',
                confirmText: 'Remove',
                onConfirm: () => p.onRemove?.()
              });
            }}
          >
            <Button
              size="1"
              variant="outline"
              iconRight={<RiMore2Line />}
              loading={p.isDeleting}
              title="Skill group membership options"
            />
          </Menu>
        </Actions>
      ) : null
    ]
  };
};

export let SkillGroupSkillsScene = (p: {
  instanceId: string | null | undefined;
  skillGroupId: string | null | undefined;
  getSkillPath?: (skillId: string) => string;
}) => {
  let skillGroupItems = useAllSkillGroupItems(p.instanceId, p.skillGroupId, {
    order: 'asc',
    status: ['active']
  });
  let createSkillGroupItem = useCreateSkillGroupItem();
  let deleteSkillGroupItem = useDeleteSkillGroupItem();
  let linkedSkillIds = useMemo(
    () => (skillGroupItems.data ?? []).map(item => item.skill.id),
    [skillGroupItems.data]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillGroupId) return;

    showSkillPickerPanel({
      instanceId: p.instanceId,
      excludeSkillIds: linkedSkillIds,
      onSelect: async skill => {
        await createSkillGroupItem.mutate({
          instanceId: p.instanceId!,
          skillGroupId: p.skillGroupId!,
          skillId: skill.id
        });
        await skillGroupItems.refetch();
      }
    });
  };

  let removeSkill = async (item: SkillGroupItem) => {
    if (!p.instanceId || !p.skillGroupId) return;

    let [deleted] = await deleteSkillGroupItem.mutate({
      instanceId: p.instanceId,
      skillGroupId: p.skillGroupId,
      skillGroupItemId: item.id
    });
    if (deleted) await skillGroupItems.refetch();
  };

  return renderWithLoader({ skillGroupItems })(({ skillGroupItems }) => (
    <Box
      title="Skills"
      description="Choose which skills belong to this group."
      rightActions={
        <Button
          size="2"
          iconLeft={<RiAddLine />}
          disabled={!p.instanceId || !p.skillGroupId}
          onClick={openPicker}
        >
          Add Skill
        </Button>
      }
    >
      {skillGroupItems.data.length === 0 ? (
        <EmptyState>
          <Text color="gray600" size="2">
            This group does not include any skills yet.
          </Text>
        </EmptyState>
      ) : (
        <>
          <Table
            headers={['Name', 'Identifier', '']}
            data={skillGroupItems.data.map(item =>
              getSkillTableRow({
                skill: item.skill,
                getSkillPath: p.getSkillPath,
                isDeleting: deleteSkillGroupItem.isLoading,
                onRemove: () => removeSkill(item)
              })
            )}
          />
          <createSkillGroupItem.RenderError />
          <deleteSkillGroupItem.RenderError />
        </>
      )}
    </Box>
  ));
};

export let SkillGroupsForSkillScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  getSkillGroupPath?: (skillGroupId: string) => string;
}) => {
  let skillGroups = useSkillGroups(p.instanceId, {
    order: 'asc',
    status: ['active'],
    ...(p.skillId ? { skillId: p.skillId } : {})
  });
  let allSkillGroups = useSkillGroups(p.instanceId, {
    order: 'asc',
    status: ['active'],
    limit: 100
  });
  let createSkillGroupItem = useCreateSkillGroupItem();
  let updateSkillGroup = useUpdateSkillGroup();

  let linkedGroupIds = useMemo(
    () => (skillGroups.data?.items ?? []).map(group => group.id),
    [skillGroups.data?.items]
  );

  let openPicker = () => {
    if (!p.instanceId || !p.skillId || !allSkillGroups.data?.items) return;

    let existing = new Set(linkedGroupIds);
    let options = allSkillGroups.data.items.filter(group => !existing.has(group.id));

    showModal(({ dialogProps, close }) => (
      <Panel.Wrapper {...dialogProps} width={850}>
        <Panel.Header>
          <div>
            <Panel.Title>Add to Group</Panel.Title>
            <Panel.Description>Select a group to add this skill to.</Panel.Description>
          </div>
        </Panel.Header>
        <Panel.Content>
          {options.length === 0 ? (
            <Text size="2" color="gray600">
              This skill already belongs to every active group.
            </Text>
          ) : (
            <ItemGrid.Root width="260px">
              {options.map(group => (
                <ItemGrid.Item
                  key={group.id}
                  title={group.name}
                  description={
                    <Description>
                      {group.description || 'No description provided yet.'}
                    </Description>
                  }
                  height={180}
                  onClick={async () => {
                    await createSkillGroupItem.mutate({
                      instanceId: p.instanceId!,
                      skillGroupId: group.id,
                      skillId: p.skillId!
                    });
                    await skillGroups.refetch();
                    close();
                  }}
                  bottom={
                    <Text size="1" color="gray600">
                      {group.skills.length} skill{group.skills.length === 1 ? '' : 's'}
                    </Text>
                  }
                />
              ))}
            </ItemGrid.Root>
          )}
          <createSkillGroupItem.RenderError />
        </Panel.Content>
      </Panel.Wrapper>
    ));
  };

  let removeFromGroup = async (group: SkillGroup) => {
    if (!p.instanceId || !p.skillId) return;

    let [updated] = await updateSkillGroup.mutate({
      instanceId: p.instanceId,
      skillGroupId: group.id,
      skillIds: group.skills.filter(skill => skill.id !== p.skillId).map(skill => skill.id)
    });
    if (updated) await skillGroups.refetch();
  };

  return renderWithPagination(skillGroups)(skillGroups => (
    <Box
      title="Groups"
      description="Manage the groups this skill belongs to."
      rightActions={
        <Button
          size="2"
          iconLeft={<RiAddLine />}
          disabled={!p.instanceId || !p.skillId || !allSkillGroups.data}
          onClick={openPicker}
        >
          Add to Group
        </Button>
      }
    >
      {skillGroups.data.items.length === 0 ? (
        <EmptyState>
          <Text color="gray600" size="2">
            This skill is not part of any groups yet.
          </Text>
        </EmptyState>
      ) : (
        <>
          <Table
            headers={['Name', 'Skills', '']}
            data={skillGroups.data.items.map(group => ({
              href: p.getSkillGroupPath?.(group.id),
              data: [
                <SkillText>
                  <Text size="2" weight="strong">
                    {group.name}
                  </Text>
                  {group.description && (
                    <Text size="2" color="gray600">
                      <Description>{group.description}</Description>
                    </Text>
                  )}
                </SkillText>,
                <Text size="2">
                  {group.skills.length} skill{group.skills.length === 1 ? '' : 's'}
                </Text>,
                <Actions>
                  <Menu
                    items={[{ id: 'remove', label: 'Remove' }]}
                    onItemClick={item => {
                      if (item !== 'remove') return;
                      confirm({
                        title: `Remove from ${group.name}?`,
                        description: 'Remove this skill from the group?',
                        confirmText: 'Remove',
                        onConfirm: async () => removeFromGroup(group)
                      });
                    }}
                  >
                    <Button
                      size="1"
                      variant="outline"
                      iconRight={<RiMore2Line />}
                      loading={updateSkillGroup.isLoading}
                      title="Group membership options"
                    />
                  </Menu>
                </Actions>
              ]
            }))}
          />
          <updateSkillGroup.RenderError />
        </>
      )}
    </Box>
  ));
};
