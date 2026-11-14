import {
  ResourcePicker,
  showResourcePicker,
  submitEach,
  useResourcePicker
} from '@metorial/access-ui';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  type Skill,
  type SkillPluginSkill,
  useAllSkillPluginSkills,
  useCreateSkillPluginSkill,
  useDeleteSkillPluginSkill,
  skillsLoader,
  useSkillPlugin,
  useSkills,
  useUpdateSkillPluginSkill
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Dialog,
  Input,
  Menu,
  Spacer,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useMemo } from 'react';
import styled from 'styled-components';
import { useEntityPickerSource } from '../components/entityPickerSource';

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

let SkillPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<boolean>;
  onDone: () => Promise<void> | void;
}) => {
  let picker = useResourcePicker<Skill>();
  let excluded = useMemo(() => new Set(p.excludeSkillIds), [p.excludeSkillIds]);

  let source = useEntityPickerSource({
    loader: skillsLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill',
    subtitle: skill => skill.slug,
    exclude: skill => excluded.has(skill.id)
  });

  return (
    <ResourcePicker
      picker={picker}
      title="Add Skills"
      description="Pick one or more skills to add to this plugin."
      placeholder="Search skills…"
      source={source}
      empty={{ title: 'All active skills are already linked to this plugin.' }}
      verb="Add"
      success={count => (count == 1 ? 'Added 1 skill.' : `Added ${count} skills.`)}
      onSubmit={async selected => {
        let result = await submitEach(selected, selection => p.onSelect(selection.value));
        await p.onDone();
        return result;
      }}
      close={p.close}
    />
  );
};

let showSkillPickerPanel = (p: Omit<Parameters<typeof SkillPickerPanel>[0], 'close'>) =>
  showResourcePicker(close => <SkillPickerPanel {...p} close={close} />);

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
  canEdit: boolean;
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
      <Badge color={p.pluginSkill.status === 'active' ? 'green' : 'gray'} size="2">
        {p.pluginSkill.status}
      </Badge>,
      <Text size="2" color={p.pluginSkill.clientName ? 'gray800' : 'gray500'}>
        {p.pluginSkill.clientName || 'Default'}
      </Text>,
      p.canEdit ? (
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
      ) : (
        <span />
      )
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
        return !!created;
      },
      onDone: async () => {
        await pluginSkills.refetch();
        await plugin.refetch();
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
    let canEditSkills = plugin.data?.canEditSkills ?? false;
    let skillGroupSource =
      plugin.data?.source.type === 'skill_group' ? plugin.data.source : null;

    return (
      <Box
        title="Skills"
        description={
          skillGroupSource
            ? `Skills are synced from the ${skillGroupSource.skillGroup.name} skill group.`
            : 'Choose which skills are included in this plugin.'
        }
        rightActions={
          canEditSkills ? (
            <Button
              size="2"
              iconLeft={<RiAddLine />}
              disabled={!p.instanceId || !p.skillPluginId}
              onClick={openPicker}
              variant="outline"
            >
              Add Skill
            </Button>
          ) : undefined
        }
      >
        {skillGroupSource && (
          <>
            <Callout color={skillGroupSource.unsyncedSkills.length ? 'orange' : 'gray'}>
              {skillGroupSource.unsyncedSkills.length
                ? `${skillGroupSource.unsyncedSkills.length} of the group's skills could not be synced: ${skillGroupSource.unsyncedSkills[0].message}`
                : 'To add or remove skills, change the skill group. Its changes are synced to this plugin automatically.'}
            </Callout>
            <Spacer size={12} />
          </>
        )}

        {pluginSkills.data.length === 0 ? (
          <EmptyState>
            <Text color="gray600" size="2">
              {skillGroupSource
                ? 'The skill group has no skills yet.'
                : 'This plugin does not include any skills yet.'}
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
                  canEdit: canEditSkills,
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
