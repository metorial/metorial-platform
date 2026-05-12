import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useSkill } from '@metorial/state';
import { Button, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';

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
