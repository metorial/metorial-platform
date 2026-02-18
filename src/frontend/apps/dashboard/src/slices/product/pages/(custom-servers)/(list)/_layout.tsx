import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Button, Menu } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { showCustomServerRemoteFormModal } from '../../../scenes/customServer/modal';

export let ManagedServersListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;

  let flags = useDashboardFlags();

  return (
    <ContentLayout>
      <PageHeader
        title="Custom Providers"
        description="Build custom MCP providers powered by Metorial. Deploy them on your own infrastructure or use our custom providers."
        actions={
          !!flags.data?.flags['paid-custom-docker-servers'] ? (
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
                showCustomServerRemoteFormModal({
                  type: id as 'docker' | 'managed'
                });
              }}
            >
              <Button size="2">Create Custom Provider</Button>
            </Menu>
          ) : (
            !!(
              flags.data?.flags['managed-servers-enabled'] &&
              flags.data?.flags['paid-custom-servers']
            ) && (
              <Button
                onClick={() =>
                  showCustomServerRemoteFormModal({
                    type: 'managed'
                  })
                }
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

export let ExternalServersListLayout = () => {
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
          !!flags.data?.flags['paid-custom-servers'] && (
            <Button
              onClick={() =>
                showCustomServerRemoteFormModal({
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
