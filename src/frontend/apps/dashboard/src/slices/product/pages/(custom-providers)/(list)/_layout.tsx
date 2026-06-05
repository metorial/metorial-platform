import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useDashboardFlags, useUser } from '@metorial/state';
import { Button, Menu } from '@metorial/ui';
import { Outlet } from 'react-router-dom';
import { showCustomProviderRemoteFormModal } from '../../../scenes/customProvider/modal';

export let ManagedProvidersListLayout = () => {
  let flags = useDashboardFlags();
  let user = useUser();
  let openManagedCreateModal = () => {
    if (!user.data) return;

    showCustomProviderRemoteFormModal({
      type: 'managed'
    });
  };

  return (
    <ContentLayout>
      <PageHeader
        title="Custom MCP Servers"
        description="Build custom MCP servers powered by Metorial. Deploy them on your own infrastructure or use Metorial-managed infrastructure."
        actions={
          !!flags.data?.flags['paid-custom-docker-providers'] ? (
            <Menu
              label="Create Custom MCP Server"
              items={[
                {
                  id: 'docker',
                  label: 'Docker MCP Server',
                  description: 'Deploy a custom Docker image as an MCP server on Metorial.'
                },
                {
                  id: 'managed',
                  label: 'Custom MCP Server',
                  description: 'Connect a GitHub repo and deploy a custom MCP server to Metorial automatically.'
                }
              ]}
              onItemClick={id => {
                if (id === 'managed') {
                  openManagedCreateModal();
                  return;
                }

                showCustomProviderRemoteFormModal({
                  type: 'docker'
                });
              }}
            >
              <Button
                size="2"
                loading={user.isLoading}
                disabled={!user.data && !user.isLoading}
              >
                Create Custom MCP Server
              </Button>
            </Menu>
          ) : (
            !!(
              flags.data?.flags['custom-providers-enabled'] &&
              flags.data?.flags['paid-custom-providers']
            ) && (
              <Button
                onClick={openManagedCreateModal}
                loading={user.isLoading}
                disabled={!user.data && !user.isLoading}
                size="2"
              >
                Create Custom MCP Server
              </Button>
            )
          )
        }
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};

export let ExternalProvidersListLayout = () => {
  let flags = useDashboardFlags();

  return (
    <ContentLayout>
      <PageHeader
        title="Remote MCP Servers"
        description="Connect to remote MCP servers using the Metorial platform."
        actions={
          !!flags.data?.flags['paid-custom-providers'] && (
            <Button
              onClick={() =>
                showCustomProviderRemoteFormModal({
                  type: 'remote'
                })
              }
              size="2"
            >
              Link Remote MCP Server
            </Button>
          )
        }
      />

      <Outlet />
    </ContentLayout>
  );
};
