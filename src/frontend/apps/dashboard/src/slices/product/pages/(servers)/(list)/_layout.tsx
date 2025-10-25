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
import { showServerImplementationFormModal } from '../../../scenes/serverImplementations/modal';
import { showCreateSeverConfigVaultsModal } from './server-config-vaults';

export let ServersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Servers"
        description="Explore Metorial's server catalog and deploy your own servers."
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ServerDeploymentsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="Servers"
        description="Manage your server deployments and customize your server implementations."
        actions={
          <>
            {pathname.endsWith('server-deployments') && (
              <Button
                onClick={() =>
                  showServerDeploymentFormModal({
                    type: 'create'
                  })
                }
                size="2"
              >
                Create Deployment
              </Button>
            )}

            {pathname.endsWith('server-implementations') && (
              <Button
                onClick={() =>
                  showServerImplementationFormModal({
                    type: 'create'
                  })
                }
                size="2"
              >
                Create Server Implementation
              </Button>
            )}

            {pathname.endsWith('server-config-vaults') && (
              <Button onClick={() => showCreateSeverConfigVaultsModal()} size="2">
                Create Config Vault
              </Button>
            )}
          </>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Server Deployments',
            to: Paths.instance.serverDeployments(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: 'Server Implementations',
            to: Paths.instance.serverImplementations(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: 'Config Vault',
            to: Paths.instance.serverConfigVaults(
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
