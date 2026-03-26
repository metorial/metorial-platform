import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { NotFound } from '@metorial/pages';
import {
  useCurrentProject,
  useDashboardFlags,
  useIdentityDelegationConfig
} from '@metorial/state';
import { Button, Input, Select, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useSearchParams } from 'react-router-dom';
import { useSetLayout } from './_layout';

let isIdentitySettingsEnabled = (flags: Record<string, boolean> | undefined) =>
  !!flags?.['identity-management'] && !!flags?.['paid-identity'];

export let ProjectSettingsDelegationConfigPage = () => {
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let [searchParams, setSearchParams] = useSearchParams();

  useSetLayout({
    title: 'Delegation Config',
    breadcrumbs: [{ label: 'Delegation Config', to: 'delegation-config' }]
  });

  let instances = project.data?.instances ?? [];
  let selectedInstanceIdFromSearch = searchParams.get('instanceId');
  let selectedInstance =
    instances.find(instance => instance.id === selectedInstanceIdFromSearch) ?? instances[0];
  let config = useIdentityDelegationConfig(selectedInstance?.id, 'default');
  let updateMutator = config.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: config.data?.name ?? '',
      description: config.data?.description ?? '',
      subDelegationBehavior: config.data?.subDelegationBehavior ?? 'require_consent',
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

  return renderWithLoader({ project, flags })(({ project, flags }) => {
    if (!isIdentitySettingsEnabled(flags.data.flags)) {
      return <NotFound />;
    }

    if (!selectedInstance) {
      return (
        <ContentLayout variant="large">
          <PageHeader
            title="Delegation Config"
            description="Update the default delegation config for a project instance."
          />

          <Box
            title="No Instances"
            description="Create an instance for this project before editing a default delegation config."
          >
            <Text size="2" color="gray600">
              Default delegation configs are stored per instance.
            </Text>
          </Box>
        </ContentLayout>
      );
    }

    return renderWithLoader({ config })(({ config }) => (
      <ContentLayout variant="large">
        <PageHeader
          title="Delegation Config"
          description="Update the default delegation config for each project instance."
        />

        <Select
          label="Instance"
          value={selectedInstance.id}
          onChange={value => {
            let next = new URLSearchParams(searchParams);
            next.set('instanceId', value);
            setSearchParams(next);
          }}
          items={project.data.instances.map(instance => ({
            id: instance.id,
            label: instance.name
          }))}
        />

        <Spacer size={15} />

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
      </ContentLayout>
    ));
  });
};
