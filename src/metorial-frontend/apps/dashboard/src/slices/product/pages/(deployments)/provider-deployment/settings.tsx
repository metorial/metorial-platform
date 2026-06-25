import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useProviderDeployment,
  useProviderVersions
} from '@metorial/state';
import { Button, Input, Select, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

let latestVersionOptionId = '__latest__';

export let ProviderDeploymentSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let updateMutator = deployment.useUpdateMutator();
  let versionLockMutator = deployment.useUpdateMutator();
  let deleteMutator = deployment.useDeleteMutator();
  let versions = useProviderVersions(instance.data?.id, deployment.data?.providerId);
  let versionItems = versions.data?.items ?? [];
  let versionOptions = [
    { id: latestVersionOptionId, label: 'Latest' },
    ...versionItems.map(version => ({
      id: version.id,
      label: version.isCurrent ? `${version.version} (current)` : version.version
    }))
  ];

  if (
    deployment.data?.lockedVersion &&
    !versionOptions.some(option => option.id === deployment.data?.lockedVersion?.id)
  ) {
    versionOptions.push({
      id: deployment.data.lockedVersion.id,
      label: `${deployment.data.lockedVersion.version} (pinned)`
    });
  }

  let form = useForm({
    initialValues: {
      name: deployment.data?.name ?? '',
      description: deployment.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      }) as any
  });
  let versionLockForm = useForm({
    initialValues: {
      lockedProviderVersionId: deployment.data?.lockedVersion?.id ?? latestVersionOptionId
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await versionLockMutator.mutate({
        lockedProviderVersionId:
          values.lockedProviderVersionId === latestVersionOptionId
            ? null
            : values.lockedProviderVersionId
      });
    },
    schema: yup =>
      yup.object({
        lockedProviderVersionId: yup.string().required('Version is required')
      }) as any
  });

  return renderWithLoader({ deployment })(() => (
    <ProviderDeploymentTabSection>
      <Box title="Deployment Settings" description="Modify the settings of this deployment.">
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
        title="Version Locking"
        description="Pin this deployment to a specific provider version, or let it follow the latest version."
      >
        <form onSubmit={versionLockForm.handleSubmit}>
          <Select
            label="Version"
            value={versionLockForm.values.lockedProviderVersionId}
            onChange={value => {
              versionLockForm.setFieldValue('lockedProviderVersionId', value);
              versionLockForm.setFieldTouched('lockedProviderVersionId', false, false);
              versionLockForm.setFieldError('lockedProviderVersionId', undefined);
            }}
            items={versionOptions}
            disabled={versions.isLoading || versionLockMutator.isLoading}
          />
          <versionLockForm.RenderError field="lockedProviderVersionId" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={versionLockMutator.isLoading}
              success={versionLockMutator.isSuccess}
              disabled={versions.isLoading}
            >
              Save Version Lock
            </Button>
          </div>

          <versionLockMutator.RenderError />
        </form>
      </Box>

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Delete this deployment and remove it from your instance."
        buttonLabel="Delete Deployment"
        confirmTitle="Delete deployment"
        confirmDescription="Are you sure you want to delete this deployment?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            Paths.instance.providerDeployments(
              instance.data?.organization,
              instance.data?.project,
              instance.data
            )
          );
        }}
      />
    </ProviderDeploymentTabSection>
  ));
};
