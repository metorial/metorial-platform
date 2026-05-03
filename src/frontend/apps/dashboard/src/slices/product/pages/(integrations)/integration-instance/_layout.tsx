import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstance
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let IntegrationInstanceLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);
  let pathname = useLocation().pathname;

  let instancePathParams = [
    organization.data,
    project.data,
    instance.data,
    integrationInstance.data?.id ?? integrationInstanceId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={integrationInstance.data?.name ?? '...'}
        description={integrationInstance.data?.description ?? undefined}
        pagination={[
          {
            label: 'Integrations',
            href: Paths.instance.integrations(organization.data, project.data, instance.data)
          },
          {
            label: integration.data?.name ?? 'Integration',
            href: Paths.instance.integration(
              organization.data,
              project.data,
              instance.data,
              integrationInstance.data?.integrationId
            )
          },
          {
            label: integrationInstance.data?.name,
            href: Paths.instance.integrationInstance(...instancePathParams)
          }
        ]}
      />

      {renderWithLoader({ integrationInstance })(({ integrationInstance }) => (
        <>
          <DeletedRecordCallout status={integrationInstance.data.status} />

          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.integrationInstance(...instancePathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.integrationInstance(...instancePathParams, 'settings')
              }
            ]}
          />
          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
