import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useSkill, useSkillGroup, useSkillTemplate, useUploadFile } from '@metorial/state';
import { Button, Dialog, Input, Spacer, Text, confirm, snackbar, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiFolderLine } from '@remixicon/react';
import styled from 'styled-components';
import { IconPicker, type SkillImageChange } from '../components/workspace/iconPicker';
import { SkillGroupIcon } from '../components/workspace/skillIconTile';
import { SkillImageUploader } from '../components/skillImageUploader';
import { SkillPanelPage } from '../components/skillPanelPage';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let SettingsSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 20px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let IconTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) > :first-child,
  &:focus-visible > :first-child {
    box-shadow: 0 0 0 3px ${theme.colors.gray300};
  }

  > :first-child {
    border-radius: 12px;
    transition: box-shadow 0.15s ease;
  }
`;

let IconPlaceholder = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray800};

  svg {
    width: 24px;
    height: 24px;
  }
`;

let IconTriggerLabel = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: ${theme.colors.foreground};
  font-size: 14px;
  font-weight: 500;

  small {
    color: ${theme.colors.gray650};
    font-size: 12.5px;
    font-weight: 400;
  }
`;

let ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export let SkillSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  onDeleteSuccess?: () => void;
  readOnly?: boolean;
}) => {
  let skill = useSkill(p.instanceId, p.skillId);
  let imageUpdateMutator = skill.updateMutator();
  let generalUpdateMutator = skill.updateMutator();
  let discoveryUpdateMutator = skill.updateMutator();
  let deleteMutator = skill.deleteMutator();

  let generalForm = useForm({
    initialValues: {
      name: skill.data?.name ?? '',
      description: skill.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await generalUpdateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  let discoveryForm = useForm({
    initialValues: {
      clientName: (skill.data?.clientName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      clientDescription: skill.data?.clientDescription ?? '',
      license: skill.data?.license ?? '',
      compatibility: skill.data?.compatibility ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await discoveryUpdateMutator.mutate({
        clientName:
          values.clientName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-') || undefined,
        clientDescription: values.clientDescription.trim() || undefined,
        license: values.license.trim() || null,
        compatibility: values.compatibility.trim() || null
      });
    },
    schema: yup =>
      yup.object({
        clientName: yup
          .string()
          .trim()
          .required('Client name is required')
          .matches(/^[a-z0-9-]+$/, 'Client name must only contain letters and numbers'),
        clientDescription: yup.string().ensure(),
        license: yup.string().ensure(),
        compatibility: yup.string().ensure()
      })
  });

  return renderWithLoader({ skill })(({ skill }) => (
    <SkillPanelPage
      title="Settings"
      description="Manage this skill's details and discovery metadata."
    >
      <PageStack>
        {p.instanceId && !p.readOnly && (
          <SettingsSection>
            <SectionHeader>
              <Text size="3" weight="strong">
                Skill Image
              </Text>
              <Text size="2" color="gray700">
                Upload the image shown for this skill in discovery flows.
              </Text>
            </SectionHeader>
            <SkillImageUploader
              instanceId={p.instanceId}
              skill={skill.data}
              updateSkill={imageUpdateMutator}
            />
            <imageUpdateMutator.RenderError />
          </SettingsSection>
        )}

        <SettingsSection>
          <SectionHeader>
            <Text size="3" weight="strong">
              Discovery Settings
            </Text>
            <Text size="2" color="gray700">
              Manage the values exposed to clients and discovery flows for this skill.
            </Text>
          </SectionHeader>
          <form onSubmit={discoveryForm.handleSubmit}>
            <FormStack>
              <Input
                label="Client name"
                disabled={p.readOnly}
                {...discoveryForm.getFieldProps('clientName')}
              />
              <discoveryForm.RenderError field="clientName" />

              <Input
                as="textarea"
                label="Client description"
                minRows={4}
                disabled={p.readOnly}
                {...discoveryForm.getFieldProps('clientDescription')}
              />
              <discoveryForm.RenderError field="clientDescription" />

              <Input
                label="License"
                disabled={p.readOnly}
                {...discoveryForm.getFieldProps('license')}
              />
              <discoveryForm.RenderError field="license" />

              <Input
                label="Compatibility"
                disabled={p.readOnly}
                {...discoveryForm.getFieldProps('compatibility')}
              />
              <discoveryForm.RenderError field="compatibility" />

              {!p.readOnly && (
                <ActionsRow>
                  <Button
                    loading={discoveryUpdateMutator.isLoading}
                    size="2"
                    success={discoveryUpdateMutator.isSuccess}
                    type="submit"
                  >
                    Save
                  </Button>
                </ActionsRow>
              )}

              <discoveryUpdateMutator.RenderError />
            </FormStack>
          </form>
        </SettingsSection>

        <SettingsSection>
          <SectionHeader>
            <Text size="3" weight="strong">
              General Settings
            </Text>
            <Text size="2" color="gray700">
              Manage the name and description of this skill. This information is used in
              Metorial, but not passed to agents or clients.
            </Text>
          </SectionHeader>
          <form onSubmit={generalForm.handleSubmit}>
            <FormStack>
              <Input
                label="Name"
                disabled={p.readOnly}
                {...generalForm.getFieldProps('name')}
              />
              <generalForm.RenderError field="name" />

              <Input
                as="textarea"
                label="Description"
                minRows={4}
                disabled={p.readOnly}
                {...generalForm.getFieldProps('description')}
              />
              <generalForm.RenderError field="description" />

              {!p.readOnly && (
                <ActionsRow>
                  <Button
                    loading={generalUpdateMutator.isLoading}
                    size="2"
                    success={generalUpdateMutator.isSuccess}
                    type="submit"
                  >
                    Save
                  </Button>
                </ActionsRow>
              )}

              <generalUpdateMutator.RenderError />
            </FormStack>
          </form>
        </SettingsSection>

        {!p.readOnly && (
          <SettingsSection>
            <SectionHeader>
              <Text size="3" weight="strong">
                Danger Zone
              </Text>
              <Text size="2" color="gray700">
                Delete this skill and remove its current configuration from the instance.
              </Text>
            </SectionHeader>
            <div>
              <Button
                color="red"
                loading={deleteMutator.isLoading}
                onClick={() =>
                  confirm({
                    title: `Delete ${skill.data.name}?`,
                    description: 'Are you sure you want to delete this skill?',
                    confirmText: 'Delete',
                    onConfirm: async () => {
                      let [result] = await deleteMutator.mutate(undefined as never);
                      if (result) {
                        await p.onDeleteSuccess?.();
                      }
                    }
                  })
                }
                size="2"
                success={deleteMutator.isSuccess}
                type="button"
              >
                Delete Skill
              </Button>
            </div>
            <deleteMutator.RenderError />
          </SettingsSection>
        )}
      </PageStack>
    </SkillPanelPage>
  ));
};

export let SkillTemplateSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillTemplateId: string | null | undefined;
  onDeleteSuccess?: () => void;
  readOnly?: boolean;
}) => {
  let skillTemplate = useSkillTemplate(p.instanceId, p.skillTemplateId);
  let updateMutator = skillTemplate.updateMutator();
  let deleteMutator = skillTemplate.deleteMutator();

  let form = useForm({
    initialValues: {
      name: skillTemplate.data?.name ?? '',
      description: skillTemplate.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (p.readOnly || skillTemplate.data?.owner === 'system') return;

      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ skillTemplate })(({ skillTemplate }) => {
    let isSystemTemplate = p.readOnly || skillTemplate.data.owner === 'system';

    return (
      <PageStack>
        <Box
          title="General Settings"
          description="Manage the name and description used to identify this skill template."
        >
          <form onSubmit={form.handleSubmit}>
            <FormStack>
              <Input
                label="Name"
                disabled={isSystemTemplate}
                {...form.getFieldProps('name')}
              />
              <form.RenderError field="name" />

              <Input
                as="textarea"
                label="Description"
                minRows={4}
                disabled={isSystemTemplate}
                {...form.getFieldProps('description')}
              />
              <form.RenderError field="description" />

              {!isSystemTemplate && (
                <ActionsRow>
                  <Button
                    loading={updateMutator.isLoading}
                    size="2"
                    success={updateMutator.isSuccess}
                    type="submit"
                  >
                    Save
                  </Button>
                </ActionsRow>
              )}

              {!isSystemTemplate && <updateMutator.RenderError />}
            </FormStack>
          </form>
        </Box>

        {!isSystemTemplate && (
          <Box
            title="Danger Zone"
            description="Delete this skill template and remove it from this instance."
          >
            <Button
              color="red"
              loading={deleteMutator.isLoading}
              onClick={() =>
                confirm({
                  title: `Delete ${skillTemplate.data.name}?`,
                  description: 'Are you sure you want to delete this skill template?',
                  confirmText: 'Delete',
                  onConfirm: async () => {
                    let [result] = await deleteMutator.mutate(undefined as never);
                    if (result) {
                      await p.onDeleteSuccess?.();
                    }
                  }
                })
              }
              size="2"
              success={deleteMutator.isSuccess}
              type="button"
            >
              Delete Template
            </Button>

            <Spacer size={10} />
            <deleteMutator.RenderError />
          </Box>
        )}
      </PageStack>
    );
  });
};

export let SkillGroupSettingsForm = (p: {
  instanceId: string | null | undefined;
  skillGroupId: string | null | undefined;
  onSaved?: () => void;
  onCancel?: () => void;
}) => {
  let skillGroup = useSkillGroup(p.instanceId, p.skillGroupId);
  let updateMutator = skillGroup.updateMutator();
  let imageMutator = skillGroup.updateMutator();
  let uploadFile = useUploadFile();

  let changeImage = async (change: SkillImageChange) => {
    if (!p.instanceId) return;

    try {
      if (change.type == 'icon') {
        await imageMutator.mutate({ imageIcon: { icon: change.icon, color: change.color } });
      }

      if (change.type == 'remove') {
        await imageMutator.mutate({ imageIcon: null });
      }

      if (change.type == 'upload') {
        let [file, error] = await uploadFile.mutate({
          instanceId: p.instanceId,
          file: change.file,
          purpose: 'skill_image'
        });
        if (!file || error) throw error ?? new Error('Upload failed');

        await imageMutator.mutate({ imageFileId: file.id });
      }
    } catch {
      snackbar.error('Could not update the group icon');
    }
  };

  let form = useForm({
    initialValues: {
      name: skillGroup.data?.name ?? '',
      description: skillGroup.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      let [result] = await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
      if (result) p.onSaved?.();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ skillGroup })(() => (
    <form onSubmit={form.handleSubmit}>
      <FormStack>
        <IconPicker
          image={skillGroup.data?.image}
          onChange={changeImage}
          trigger={
            <IconTrigger type="button" aria-label="Change icon">
              <SkillGroupIcon
                image={skillGroup.data?.image}
                imageUrl={skillGroup.data?.imageUrl}
                size={48}
                fallback={
                  <IconPlaceholder>
                    <RiFolderLine />
                  </IconPlaceholder>
                }
              />
              <IconTriggerLabel>
                <span>Group Icon</span>
                <small>Click to change</small>
              </IconTriggerLabel>
            </IconTrigger>
          }
        />

        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Input
          as="textarea"
          label="Description"
          minRows={4}
          {...form.getFieldProps('description')}
        />
        <form.RenderError field="description" />
      </FormStack>

      <Spacer size={15} />

      <Dialog.Actions>
        {p.onCancel && (
          <Button type="button" variant="soft" onClick={p.onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={updateMutator.isLoading}>
          Save
        </Button>
      </Dialog.Actions>

      <updateMutator.RenderError />
    </form>
  ));
};
