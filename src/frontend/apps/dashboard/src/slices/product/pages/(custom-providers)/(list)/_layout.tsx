import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useUser
} from '@metorial/state';
import { Button, Menu } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
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
        title="Custom Providers"
        description="Build custom MCP providers powered by Metorial. Deploy them on your own infrastructure or use our custom providers."
        actions={
          !!flags.data?.flags['paid-custom-docker-providers'] ? (
            <Menu
              label="Create Custom Provider"
              items={[
                {
                  id: 'docker',
                  label: 'Docker Provider',
                  description: 'Deploy a custom Docker image as an MCP provider on Metorial.'
                },
                {
                  id: 'managed',
                  label: 'Custom Provider',
                  description: 'Connect a GitHub repo and deploy to Metorial automatically.'
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
              <Button size="2" loading={user.isLoading} disabled={!user.data && !user.isLoading}>
                Create Custom Provider
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
                Create Custom Provider
              </Button>
            )
          )
        }
      />

      <Outlet />
    </ContentLayout>
  );
};

export let ExternalProvidersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  let flags = useDashboardFlags();

  return (
    <ContentLayout>
      <PageHeader
        title="External Providers"
        description="Connect to external MCP providers using the Metorial platform."
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
              Link Remote Provider
            </Button>
          )
        }
      />

      <Outlet />
    </ContentLayout>
  );
};
