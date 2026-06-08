import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useSkill, useSkillGroup, useSkillTemplate } from '@metorial/state';
import { Button, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';
import { SkillImageUploader } from '../components/skillImageUploader';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

export let SkillSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  onDeleteSuccess?: () => void;
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
      clientName: skill.data?.clientName ?? '',
      clientDescription: skill.data?.clientDescription ?? '',
      license: skill.data?.license ?? '',
      compatibility: skill.data?.compatibility ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await discoveryUpdateMutator.mutate({
        clientName: values.clientName.trim(),
        clientDescription: values.clientDescription.trim() || undefined,
        license: values.license.trim() || null,
        compatibility: values.compatibility.trim() || null
      });
    },
    schema: yup =>
      yup.object({
        clientName: yup.string().trim().required('Client name is required'),
        clientDescription: yup.string().ensure(),
        license: yup.string().ensure(),
        compatibility: yup.string().ensure()
      })
  });

  return renderWithLoader({ skill })(({ skill }) => (
    <PageStack>
      {p.instanceId && (
        <Box
          title="Skill Image"
          description="Upload the image shown for this skill in discovery flows."
        >
          <SkillImageUploader
            instanceId={p.instanceId}
            skill={skill.data}
            updateSkill={imageUpdateMutator}
          />

          <Spacer size={10} />
          <imageUpdateMutator.RenderError />
        </Box>
      )}

      <Box
        title="Discovery Settings"
        description="Manage the values exposed to clients and discovery flows for this skill."
      >
        <form onSubmit={discoveryForm.handleSubmit}>
          <FormStack>
            <Input label="Client name" {...discoveryForm.getFieldProps('clientName')} />
            <discoveryForm.RenderError field="clientName" />

            <Input
              as="textarea"
              label="Client description"
              minRows={4}
              {...discoveryForm.getFieldProps('clientDescription')}
            />
            <discoveryForm.RenderError field="clientDescription" />

            <Input label="License" {...discoveryForm.getFieldProps('license')} />
            <discoveryForm.RenderError field="license" />

            <Input label="Compatibility" {...discoveryForm.getFieldProps('compatibility')} />
            <discoveryForm.RenderError field="compatibility" />

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

            <discoveryUpdateMutator.RenderError />
          </FormStack>
        </form>
      </Box>

      <Box
        title="General Settings"
        description="Manage the name and description of this skill. This information is used in Metorial, but not passed to agents or clients."
      >
        <form onSubmit={generalForm.handleSubmit}>
          <FormStack>
            <Input label="Name" {...generalForm.getFieldProps('name')} />
            <generalForm.RenderError field="name" />

            <Input
              as="textarea"
              label="Description"
              minRows={4}
              {...generalForm.getFieldProps('description')}
            />
            <generalForm.RenderError field="description" />

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

            <generalUpdateMutator.RenderError />
          </FormStack>
        </form>
      </Box>

      <Box
        title="Danger Zone"
        description="Delete this skill and remove its current configuration from the instance."
      >
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

        <Spacer size={10} />
        <deleteMutator.RenderError />
      </Box>
    </PageStack>
  ));
};

export let SkillTemplateSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillTemplateId: string | null | undefined;
  onDeleteSuccess?: () => void;
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
      if (skillTemplate.data?.owner === 'system') return;

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
    let isSystemTemplate = skillTemplate.data.owner === 'system';

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

export let SkillGroupSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillGroupId: string | null | undefined;
  onDeleteSuccess?: () => void;
}) => {
  let skillGroup = useSkillGroup(p.instanceId, p.skillGroupId);
  let updateMutator = skillGroup.updateMutator();
  let deleteMutator = skillGroup.deleteMutator();

  let form = useForm({
    initialValues: {
      name: skillGroup.data?.name ?? '',
      description: skillGroup.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
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

  return renderWithLoader({ skillGroup })(({ skillGroup }) => (
    <PageStack>
      <Box
        title="General Settings"
        description="Manage the name and description for this skill group."
      >
        <form onSubmit={form.handleSubmit}>
          <FormStack>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Input
              as="textarea"
              label="Description"
              minRows={4}
              {...form.getFieldProps('description')}
            />
            <form.RenderError field="description" />

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

            <updateMutator.RenderError />
          </FormStack>
        </form>
      </Box>

      <Box
        title="Danger Zone"
        description="Delete this skill group. The skills themselves will remain available."
      >
        <Button
          color="red"
          loading={deleteMutator.isLoading}
          onClick={() =>
            confirm({
              title: `Delete ${skillGroup.data.name}?`,
              description: 'Are you sure you want to delete this skill group?',
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
          Delete Group
        </Button>

        <Spacer size={10} />
        <deleteMutator.RenderError />
      </Box>
    </PageStack>
  ));
};
