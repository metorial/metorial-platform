import { InitialLoadBoundary, renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationPreview,
  useCreateIntegrationInstance,
  useCreateIntegrationSetupSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useIntegration
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Copy,
  Dialog,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiFlowChart } from '@remixicon/react';
import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { generatePlaceholderInstanceName } from '../../../lib/instanceName';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

let showIntegrationSetupSessionModal = (p: {
  instanceId: string;
  integration: IntegrationPreview;
}) =>
  showModal(({ dialogProps, close }) => {
    let createSetupSession = useCreateIntegrationSetupSession();
    let [toolFiltersEnabled, setToolFiltersEnabled] = useState(false);
    let [createdUrl, setCreatedUrl] = useState<string | null>(null);
    let form = useForm({
      initialValues: {
        name: `${p.integration.name} Setup`,
        description: ''
      },
      onSubmit: async values => {
        let [created] = await createSetupSession.mutate({
          instanceId: p.instanceId,
          integrationId: p.integration.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          toolFiltersEnabled
        });

        if (!created) return;
        setCreatedUrl(created.url);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Create Setup Session</Dialog.Title>
        <Dialog.Description>
          Create a shared setup link for configuring all providers in {p.integration.name}.
        </Dialog.Description>

        {createdUrl ? (
          <>
            <Text size="2" color="gray600">
              Share this setup link with the user who should configure the integration.
            </Text>
            <Spacer size={12} />
            <Copy label="Setup Link" value={createdUrl} />
            <Spacer size={18} />
            <Dialog.Actions>
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => window.open(createdUrl, '_blank', 'noopener,noreferrer')}
              >
                Open
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" required {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={10} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={12} />

            <Checkbox
              checked={toolFiltersEnabled}
              label="Enable tool filters"
              description="Let the setup flow collect tool filter settings when the integration allows it."
              onCheckedChange={checked => setToolFiltersEnabled(!!checked)}
            />

            <Spacer size={18} />

            <Dialog.Actions>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={createSetupSession.isPending}>
                Create Setup Session
              </Button>
            </Dialog.Actions>

            <createSetupSession.RenderError />
          </form>
        )}
      </Dialog.Wrapper>
    );
  });

export let IntegrationLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationId } = useParams();
  let integration = useIntegration(instance.data?.id, integrationId);
  let flags = useDashboardFlags();
  let navigate = useNavigate();
  let createInstance = useCreateIntegrationInstance();

  let params = [
    organization.data,
    project.data,
    instance.data,
    integration.data?.id ?? integrationId
  ] as const;

  let hasCallbacks =
    flags.data?.flags['callbacks-enabled'] &&
    integration.data?.providers?.some(provider => provider.callbacks.status === 'enabled');

  return (
    <DetailsLayout
      entity={integration.data}
      icon={<RiFlowChart />}
      breadcrumbs={[
        {
          label: 'Integrations',
          to: Paths.instance.integrations(organization.data, project.data, instance.data)
        },
        { label: integration.data?.name, to: Paths.instance.integration(...params) }
      ]}
      tabs={[
        { label: 'Overview', to: Paths.instance.integration(...params) },
        { label: 'Instances', to: Paths.instance.integration(...params, 'instances') },
        ...(hasCallbacks
          ? [{ label: 'Callbacks', to: Paths.instance.integration(...params, 'callbacks') }]
          : []),
        { label: 'Settings', to: Paths.instance.integration(...params, 'settings') }
      ]}
      actions={[
        {
          label: 'Create Instance',
          disabled: !instance.data || !integration.data || createInstance.isLoading,
          loading: createInstance.isLoading,
          success: createInstance.isSuccess,
          onClick: async () => {
            if (!instance.data || !integration.data) return;

            let [created] = await createInstance.mutate({
              instanceId: instance.data.id,
              integrationId: integration.data.id,
              name: generatePlaceholderInstanceName()
            });
            if (!created) return;

            navigate(
              Paths.instance.integrationInstance(
                organization.data,
                project.data,
                instance.data,
                created.id
              ),
              { state: { configurePendingIntegrationProvider: true } }
            );
          }
        }
      ]}
      attributes={
        integration.data
          ? [
              { label: 'ID', value: <ID id={integration.data.id} /> },
              { label: 'Slug', value: integration.data.slug ?? '-' },
              { label: 'Created', value: <RenderDate date={integration.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ integration })(({ integration }) => (
          <>
            <DeletedRecordCallout status={integration.data.status} />
            <createInstance.RenderError />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
