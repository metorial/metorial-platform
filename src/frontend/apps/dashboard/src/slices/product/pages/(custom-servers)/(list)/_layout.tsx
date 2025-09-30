import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { showCustomServerRemoteFormModal } from '../../../scenes/customServer/modal';
import { showProviderConnectionFormModal } from '../../../scenes/providerConnection/modal';

export let ProviderConnectionsListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="OAuth Connections"
        description="Use OAuth to seamlessly authenticate with external providers, like Google or GitHub."
        actions={
          <Button onClick={() => showProviderConnectionFormModal({})} size="2">
            Create OAuth Connection
          </Button>
        }
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
        actions={
          <Button
            onClick={() =>
              showCustomServerRemoteFormModal({
                type: 'managed'
              })
            }
            size="2"
          >
            Create Managed Server
          </Button>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ExternalServersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title="External Servers"
        description="Connect to external MCP servers using the Metorial platform."
        actions={
          <Button
            onClick={() =>
              showCustomServerRemoteFormModal({
                type: 'remote'
              })
            }
            size="2"
          >
            Link Remote Server
          </Button>
        }
      />

      <Outlet />
    </ContentLayout>
  );
};
