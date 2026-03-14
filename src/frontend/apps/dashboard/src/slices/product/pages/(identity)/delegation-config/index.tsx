import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useIdentityDelegationConfig } from '@metorial/state';
import { Attributes, Button, Input, RenderDate, Select, Spacer, confirm } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

let getDelegationBehaviorLabel = (behavior: 'allow' | 'deny' | 'require_consent') => {
  if (behavior === 'require_consent') return 'Require Consent';
  if (behavior === 'allow') return 'Allow';
  return 'Deny';
};

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
      description: config.data?.description ?? '',
      subDelegationBehavior:
        config.data?.subDelegationBehavior ??
        ('require_consent' as 'allow' | 'deny' | 'require_consent'),
      subDelegationDepth: config.data?.subDelegationDepth?.toString() ?? '1'
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim() || undefined,
        description: values.description.trim() || undefined,
        subDelegationBehavior: values.subDelegationBehavior,
        subDelegationDepth: Number(values.subDelegationDepth)
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().ensure(),
        description: yup.string().ensure(),
        subDelegationBehavior: yup
          .string()
          .oneOf(['allow', 'deny', 'require_consent'])
          .required('Behavior is required'),
        subDelegationDepth: yup
          .string()
          .required('Depth is required')
          .test(
            'is-valid-depth',
            'Depth must be an integer 0 or greater',
            value =>
              value !== undefined &&
              value !== '' &&
              !Number.isNaN(Number(value)) &&
              Number.isInteger(Number(value)) &&
              Number(value) >= 0
          )
      })
  });

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Attributes
        itemWidth="300px"
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
            content: getDelegationBehaviorLabel(config.data.subDelegationBehavior)
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

      <UsageScene
        title="Usage"
        description="See how this delegation config is being used across identities and delegations."
        entities={[{ type: 'identity_delegation_config', id: config.data.id }]}
        entityNames={{ [config.data.id]: config.data.name ?? config.data.id }}
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

          <Select
            label="Sub-delegation Behavior"
            value={form.values.subDelegationBehavior}
            onChange={value => form.setFieldValue('subDelegationBehavior', value)}
            items={[
              {
                id: 'require_consent',
                label: 'Require Consent'
              },
              {
                id: 'allow',
                label: 'Allow'
              },
              {
                id: 'deny',
                label: 'Deny'
              }
            ]}
          />
          <form.RenderError field="subDelegationBehavior" />

          <Spacer size={15} />

          <Input
            label="Sub-delegation Depth"
            type="number"
            min={0}
            {...form.getFieldProps('subDelegationDepth')}
          />
          <form.RenderError field="subDelegationDepth" />

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
