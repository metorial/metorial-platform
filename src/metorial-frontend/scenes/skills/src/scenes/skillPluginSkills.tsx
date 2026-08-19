import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  type Skill,
  type SkillPluginSkill,
  useAllSkillPluginSkills,
  useCreateSkillPluginSkill,
  useDeleteSkillPluginSkill,
  useSkillPlugin,
  useSkills,
  useUpdateSkillPluginSkill
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  Input,
  Menu,
  Panel,
  Spacer,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { Box, ItemGrid, Table } from '@metorial/ui-product';
import { useSearchFilter } from '@metorial/use-search-filter';
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

let paginationOpts = { hidePaginationWhenUnavailable: true };

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

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

let truncate = (value: string | null | undefined, length = 100) => {
  if (!value) return undefined;
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
};

let SkillPickerResults = (p: {
  skills: ReturnType<typeof useSkills>;
  excludedSkillIds: Set<string>;
  search: string;
  selectedId: string | null;
  onSelect: (skill: Skill) => void;
}) =>
  renderWithPagination(p.skills, paginationOpts)(skills => {
    let items = skills.data.items.filter(skill => !p.excludedSkillIds.has(skill.id));

    if (items.length === 0) {
      return (
        <Text size="2" color="gray600">
          {p.search.trim()
            ? 'No skills match your search.'
            : 'All active skills are already linked to this plugin.'}
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
            onClick={() => !p.selectedId && p.onSelect(skill)}
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
  });

let SkillPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<void> | void;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let excludedSkillIds = useMemo(() => new Set(p.excludeSkillIds), [p.excludeSkillIds]);
  let skills = useSkills(p.instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 30,
    ...(searchQuery ? { search: searchQuery } : {})
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
            Choose a skill to add to this plugin. Skills already in the plugin are hidden.
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
            <SkillPickerResults
              skills={skills}
              excludedSkillIds={excludedSkillIds}
              search={search}
              selectedId={selectedId}
              onSelect={selectSkill}
            />
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

let showPluginSkillFormModal = (p: {
  instanceId: string;
  skillPluginId: string;
  pluginSkill: SkillPluginSkill;
  onComplete: () => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => {
    let updateSkill = useUpdateSkillPluginSkill();
    let form = useForm({
      initialValues: {
        clientName: p.pluginSkill.clientName ?? '',
        clientDescription: p.pluginSkill.clientDescription ?? '',
        license: p.pluginSkill.license ?? '',
        compatibility: p.pluginSkill.compatibility ?? ''
      },
      onSubmit: async values => {
        let [updated] = await updateSkill.mutate({
          instanceId: p.instanceId,
          skillPluginId: p.skillPluginId,
          skillPluginSkillId: p.pluginSkill.id,
          clientName: values.clientName.trim() || undefined,
          clientDescription: values.clientDescription.trim() || undefined,
          license: values.license.trim() || null,
          compatibility: values.compatibility.trim() || null
        });

        if (!updated) return;
        await p.onComplete();
        close();
      },
      schema: yup =>
        yup.object({
          clientName: yup.string(),
          clientDescription: yup.string(),
          license: yup.string(),
          compatibility: yup.string()
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Edit Plugin Skill</Dialog.Title>
        <Dialog.Description>
          Manage the client-facing metadata for this skill inside the plugin.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <FormStack>
            <Input label="Client name" {...form.getFieldProps('clientName')} />
            <form.RenderError field="clientName" />

            <Input
              as="textarea"
              label="Client description"
              minRows={4}
              {...form.getFieldProps('clientDescription')}
            />
            <form.RenderError field="clientDescription" />

            <Input label="License" {...form.getFieldProps('license')} />
            <form.RenderError field="license" />

            <Input label="Compatibility" {...form.getFieldProps('compatibility')} />
            <form.RenderError field="compatibility" />

            <ActionsRow>
              <Dialog.Actions>
                <Button variant="soft" type="button" onClick={close} size="2">
                  Cancel
                </Button>
                <Button
                  loading={updateSkill.isLoading}
                  success={updateSkill.isSuccess}
                  size="2"
                  type="submit"
                >
                  Save
                </Button>
              </Dialog.Actions>
            </ActionsRow>

            <updateSkill.RenderError />
          </FormStack>
        </form>
      </Dialog.Wrapper>
    );
  });

let getSkillTableRow = (p: {
  pluginSkill: SkillPluginSkill;
  skill?: Skill;
  getSkillPath?: (skillId: string) => string;
  isDeleting: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  let title = p.skill?.name ?? p.pluginSkill.clientName ?? p.pluginSkill.skillId;
  let description = p.skill?.description ?? p.pluginSkill.clientDescription;

  return {
    href: p.getSkillPath?.(p.pluginSkill.skillId),
    data: [
      <SkillName>
        <Avatar
          entity={{
            name: title,
            imageUrl: `https://avatar-cdn.metorial.com/${p.pluginSkill.skillId}`
          }}
          size={32}
          radius={999}
        />
        <SkillText>
          <Text size="2" weight="strong">
            {title}
          </Text>
          {description && (
            <Text size="2" color="gray600">
              <Description>{description}</Description>
            </Text>
          )}
        </SkillText>
      </SkillName>,
      <Slug>{p.pluginSkill.identifier}</Slug>,
      <Badge color={p.pluginSkill.status === 'active' ? 'green' : 'gray'} size="1">
        {p.pluginSkill.status}
      </Badge>,
      <Text size="2" color={p.pluginSkill.clientName ? 'gray800' : 'gray500'}>
        {p.pluginSkill.clientName || 'Default'}
      </Text>,
      <Actions onClick={e => e.stopPropagation()}>
        <Menu
          items={[
            { id: 'edit', label: 'Edit' },
            { id: 'remove', label: 'Remove' }
          ]}
          onItemClick={item => {
            if (item === 'edit') p.onEdit();
            if (item === 'remove') {
              confirm({
                title: `Remove ${title}?`,
                description: 'Remove this skill from the plugin?',
                confirmText: 'Remove',
                onConfirm: p.onRemove
              });
            }
          }}
        >
          <Button
            size="1"
            variant="outline"
            iconRight={<RiMore2Line />}
            loading={p.isDeleting}
            title="Plugin skill options"
          />
        </Menu>
      </Actions>
    ]
  };
};

export let SkillPluginSkillsScene = (p: {
  instanceId: string | null | undefined;
  skillPluginId: string | null | undefined;
  getSkillPath?: (skillId: string) => string;
}) => {
  let plugin = useSkillPlugin(p.instanceId, p.skillPluginId);
  let pluginSkills = useAllSkillPluginSkills(p.instanceId, p.skillPluginId, {
    order: 'asc',
    status: ['active']
  });
  let linkedSkillIds = useMemo(
    () => (pluginSkills.data ?? []).map(item => item.skillId),
    [pluginSkills.data]
  );
  let skills = useSkills(
    p.instanceId,
    linkedSkillIds.length
      ? {
          order: 'asc',
          status: ['active', 'archived'],
          id: linkedSkillIds,
          limit: 100
        }
      : null
  );
  let createPluginSkill = useCreateSkillPluginSkill();
  let deletePluginSkill = useDeleteSkillPluginSkill();

  let openPicker = () => {
    if (!p.instanceId || !p.skillPluginId) return;

    showSkillPickerPanel({
      instanceId: p.instanceId,
      excludeSkillIds: linkedSkillIds,
      onSelect: async skill => {
        let [created] = await createPluginSkill.mutate({
          instanceId: p.instanceId!,
          skillPluginId: p.skillPluginId!,
          skillId: skill.id,
          clientName: skill.clientName ?? skill.name,
          clientDescription: skill.clientDescription ?? skill.description ?? undefined,
          license: skill.license ?? undefined,
          compatibility: skill.compatibility ?? undefined
        });
        if (created) {
          await pluginSkills.refetch();
          await plugin.refetch();
        }
      }
    });
  };

  let removeSkill = async (pluginSkill: SkillPluginSkill) => {
    if (!p.instanceId || !p.skillPluginId) return;

    let [deleted] = await deletePluginSkill.mutate({
      instanceId: p.instanceId,
      skillPluginId: p.skillPluginId,
      skillPluginSkillId: pluginSkill.id
    });
    if (deleted) {
      await pluginSkills.refetch();
      await plugin.refetch();
    }
  };

  let openEdit = (pluginSkill: SkillPluginSkill) => {
    if (!p.instanceId || !p.skillPluginId) return;

    showPluginSkillFormModal({
      instanceId: p.instanceId,
      skillPluginId: p.skillPluginId,
      pluginSkill,
      onComplete: () => pluginSkills.refetch()
    });
  };

  return renderWithLoader({ pluginSkills })(({ pluginSkills }) => {
    let skillLookup = new Map((skills.data?.items ?? []).map(skill => [skill.id, skill]));

    return (
      <Box
        title="Skills"
        description="Choose which skills are included in this plugin."
        rightActions={
          <Button
            size="2"
            iconLeft={<RiAddLine />}
            disabled={!p.instanceId || !p.skillPluginId}
            onClick={openPicker}
            variant="outline"
          >
            Add Skill
          </Button>
        }
      >
        {pluginSkills.data.length === 0 ? (
          <EmptyState>
            <Text color="gray600" size="2">
              This plugin does not include any skills yet.
            </Text>
          </EmptyState>
        ) : (
          <>
            <Table
              headers={['Name', 'Identifier', 'Status', 'Client Name', '']}
              data={pluginSkills.data.map(pluginSkill =>
                getSkillTableRow({
                  pluginSkill,
                  skill: skillLookup.get(pluginSkill.skillId),
                  getSkillPath: p.getSkillPath,
                  isDeleting: deletePluginSkill.isLoading,
                  onEdit: () => openEdit(pluginSkill),
                  onRemove: () => removeSkill(pluginSkill)
                })
              )}
            />
            <createPluginSkill.RenderError />
            <deletePluginSkill.RenderError />
          </>
        )}
        <Spacer size={10} />
      </Box>
    );
  });
};
