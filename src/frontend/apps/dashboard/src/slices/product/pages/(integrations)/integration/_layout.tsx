import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration
} from '@metorial/state';
import { Button, Flex, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { showIntegrationInstanceFormModal } from '../../../scenes/integrations/instancesTable';

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
    </ContentLayout>
  );
};
