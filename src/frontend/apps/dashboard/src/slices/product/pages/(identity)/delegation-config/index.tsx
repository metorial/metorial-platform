import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useIdentityDelegationConfig } from '@metorial/state';
import { Attributes, Button, Input, RenderDate, Spacer, Text, confirm } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let IdentityDelegationConfigPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { identityDelegationConfigId } = useParams();
  let config = useIdentityDelegationConfig(instance.data?.id, identityDelegationConfigId);
  let updateMutator = config.useUpdateMutator();
  let deleteMutator = config.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: config.data?.name ?? '',
      description: config.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim() || undefined,
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().ensure(),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Attributes
        itemWidth="240px"
        attributes={[
          {
            label: 'ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Status',
            content: config.data.status
          },
          {
            label: 'Default',
            content: config.data.isDefault ? 'Yes' : 'No'
          },
          {
            label: 'Sub-Delegation Behavior',
            content: config.data.subDelegationBehavior
          },
          {
            label: 'Sub-Delegation Depth',
            content: config.data.subDelegationDepth
          },
          {
            label: 'Created At',
            content: <RenderDate date={config.data.createdAt} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={config.data.updatedAt} />
          }
        ]}
      />

      <Spacer size={20} />

      <Box title="Config Settings" description="Update the editable details of this config.">
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={updateMutator.isLoading}
              success={updateMutator.isSuccess}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>

      <Spacer size={20} />

      <Box
        title="Danger Zone"
        description="Delete this delegation config. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={() =>
            confirm({
              title: 'Delete delegation config',
              description: 'Are you sure you want to delete this delegation config?',
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate({});
                if (res) {
                  navigate(
                    Paths.instance.identity.delegationConfigs(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data
                    )
                  );
                }
              }
            })
          }
        >
          Delete Config
        </Button>
      </Box>
    </>
  ));
};
