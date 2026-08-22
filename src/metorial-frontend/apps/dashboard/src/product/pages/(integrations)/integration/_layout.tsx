import { InitialLoadBoundary, renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  IntegrationPreview,
  useCreateIntegrationSetupSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Copy,
  Dialog,
  Flex,
  Input,
  LinkTabs,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { showIntegrationInstanceFormModal } from '../../../scenes/integrations/instancesTable';

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
  let pathname = useLocation().pathname;
  let navigate = useNavigate();

  let params = [
    organization.data,
    project.data,
    instance.data,
    integration.data?.id ?? integrationId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={integration.data?.name ?? '...'}
        description={integration.data?.description ?? undefined}
        pagination={[
          {
            label: 'Integrations',
            href: Paths.instance.integrations(organization.data, project.data, instance.data)
          },
          {
            label: integration.data?.name,
            href: Paths.instance.integration(...params)
          }
        ]}
        actions={
          instance.data && integration.data ? (
            <Flex gap={8}>
              {/* <Button
                size="2"
                variant="outline"
                onClick={() =>
                  showIntegrationFormModal({
                    type: 'update',
                    instanceId: instance.data!.id,
                    integrationId: integration.data!.id,
                    onUpdate: () => integration.refetch()
                  })
                }
              >
                Edit
              </Button> */}

              {/* <Button
                size="2"
                variant="outline"
                onClick={() =>
                  instance.data &&
                  showIntegrationSetupSessionModal({
                    instanceId: instance.data.id,
                    integration: integration.data!
                  })
                }
              >
                Create Setup Link
              </Button> */}

              <Button
                size="2"
                onClick={() =>
                  instance.data &&
                  showIntegrationInstanceFormModal({
                    instanceId: instance.data.id,
                    integration: integration.data!,
                    onCreate: created => {
                      navigate(
                        Paths.instance.integrationInstance(
                          organization.data,
                          project.data,
                          instance.data,
                          created.id
                        )
                      );
                    }
                  })
                }
              >
                Create Instance
              </Button>
            </Flex>
          ) : undefined
        }
      />

      <InitialLoadBoundary>
        {renderWithLoader({ integration })(({ integration }) => (
          <>
            <DeletedRecordCallout status={integration.data.status} />
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.integration(...params)
                },
                {
                  label: 'Instances',
                  to: Paths.instance.integration(...params, 'instances')
                },
                {
                  label: 'Settings',
                  to: Paths.instance.integration(...params, 'settings')
                }
              ]}
            />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
