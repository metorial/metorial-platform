import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { showServerDeploymentFormModal } from '../../../scenes/serverDeployments/modal';

export let ExternalServersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="External Servers"
        description="Metorial can connect to external MCP servers, giving you the features you know and love from Metorial, but with external infrastructure."
        actions={
          <Button
            onClick={() =>
              showServerDeploymentFormModal({
                type: 'create'
              })
            }
            size="2"
          >
            Connect External Server
          </Button>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'External Servers',
            to: Paths.instance.externalServers(organization.data, project.data, instance.data)
          },
          {
            label: 'OAuth Connections',
            to: Paths.instance.providerConnections(
              organization.data,
              project.data,
              instance.data
            )
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ManagedServersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Managed Servers"
        description="Build custom MCP servers powered by Metorial. Deploy them on your own infrastructure or use our managed servers."
      />

      <Outlet />
    </ContentLayout>
  );
};
