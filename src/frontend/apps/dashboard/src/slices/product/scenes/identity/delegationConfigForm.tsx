import { DashboardInstanceIdentitiesDelegationConfigsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateIdentityDelegationConfig, useCurrentInstance } from '@metorial/state';
import { Button, Dialog, Input, Select, Spacer } from '@metorial/ui';

export let IdentityDelegationConfigForm = ({
  instanceId: instanceIdProp,
  close,
  onCreate
}: {
  instanceId?: string;
  close?: () => void;
  onCreate?: (
    delegationConfig: DashboardInstanceIdentitiesDelegationConfigsCreateOutput
  ) => void;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instanceIdProp ?? instance.data?.id;
  let createMutation = useCreateIdentityDelegationConfig();

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      subDelegationBehavior: 'require_consent' as 'allow' | 'deny' | 'require_consent',
      subDelegationDepth: '1'
    },
    onSubmit: async values => {
      if (!instanceId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        name: values.name.trim() || undefined,
        description: values.description.trim() || undefined,
        subDelegationBehavior: values.subDelegationBehavior,
        subDelegationDepth: Number(values.subDelegationDepth)
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
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

  return (
    <form onSubmit={form.handleSubmit}>
      <Input
        label="Name"
        placeholder="Default delegation policy"
        {...form.getFieldProps('name')}
      />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input
        label="Description"
        placeholder="Short description"
        {...form.getFieldProps('description')}
      />
      <form.RenderError field="description" />

      <Spacer size={10} />

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

      <Spacer size={10} />

      <Input
        label="Sub-delegation Depth"
        type="number"
        min={0}
        {...form.getFieldProps('subDelegationDepth')}
      />
      <form.RenderError field="subDelegationDepth" />

      <createMutation.RenderError />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isLoading}>
          Create Config
        </Button>
      </Dialog.Actions>
    </form>
  );
};
