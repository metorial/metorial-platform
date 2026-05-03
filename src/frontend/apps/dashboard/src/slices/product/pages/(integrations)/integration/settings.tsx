import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration
} from '@metorial/state';
import { Button, Checkbox, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let IntegrationSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);
  let navigate = useNavigate();
  let updateMutator = integration.useUpdateMutator();
  let deleteMutator = integration.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: integration.data?.name ?? '',
      description: integration.data?.description ?? '',
      canAttachCustomProviderConfig:
        integration.data?.configuration?.canAttachCustomProviderConfig ?? true,
      canAttachCustomToolFilters:
        integration.data?.configuration?.canAttachCustomToolFilters ?? true,
      canOverrideToolFilters: integration.data?.configuration?.canOverrideToolFilters ?? true
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        canAttachCustomProviderConfig: values.canAttachCustomProviderConfig,
        canAttachCustomToolFilters: values.canAttachCustomToolFilters,
        canOverrideToolFilters: values.canOverrideToolFilters
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string(),
        canAttachCustomProviderConfig: yup.boolean(),
        canAttachCustomToolFilters: yup.boolean(),
        canOverrideToolFilters: yup.boolean()
      })
  });

  return renderWithLoader({ integration })(({ integration }) => (
    <>
      <Box
        title="Integration Settings"
        description="Modify the saved details for this integration."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Checkbox
            label="Allow custom provider configs"
            description="Allow integration instances to attach their own provider configurations."
            checked={form.values.canAttachCustomProviderConfig}
            onCheckedChange={checked =>
              form.setFieldValue('canAttachCustomProviderConfig', checked)
            }
          />

          <Spacer size={10} />

          <Checkbox
            label="Allow custom tool filters"
            description="Allow integration instances to define their own tool filter selections."
            checked={form.values.canAttachCustomToolFilters}
            onCheckedChange={checked =>
              form.setFieldValue('canAttachCustomToolFilters', checked)
            }
          />

          <Spacer size={10} />

          <Checkbox
            label="Allow tool filter overrides"
            description="Allow integration instances to override the tool filters set at the integration level."
            checked={form.values.canOverrideToolFilters}
            onCheckedChange={checked => form.setFieldValue('canOverrideToolFilters', checked)}
          />

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
        description="Delete this integration and all its associated providers and instances."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={() =>
            confirm({
              title: 'Delete integration',
              description: `Are you sure you want to delete ${integration.data.name}?`,
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate(undefined as never);
                if (res) {
                  navigate(
                    Paths.instance.integrations(organization.data, project.data, instance.data)
                  );
                }
              }
            })
          }
        >
          Delete Integration
        </Button>
      </Box>
    </>
  ));
};
