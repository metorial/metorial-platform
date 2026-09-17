import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  useHasCallbacks
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { showCreateIntegrationProviderFirstFlow } from '../../../scenes/integrations/providerPanelFlow';

export let IntegrationsListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;
  let params = [organization.data, project.data, instance.data] as const;

  let flags = useDashboardFlags();
  let callbacksEnabled = !!flags.data?.flags['callbacks-enabled'];
  let { hasCallbacks } = useHasCallbacks(callbacksEnabled ? instance.data?.id : null);

  return (
    <ContentLayout>
      <PageHeader
        title="Integrations"
        description="Create reusable provider contracts and create sessions and Magic MCP servers from them."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showCreateIntegrationProviderFirstFlow({
                onCreate: integration => {
                  navigate(
                    Paths.instance.integration(
                      organization.data,
                      project.data,
                      instance.data,
                      integration.id
                    )
                  );
                }
              })
            }
          >
            Create Integration
          </Button>
        }
      />

      {hasCallbacks && (
        <LinkTabs
          current={pathname}
          links={[
            { label: 'Integrations', to: Paths.instance.integrations(...params) },
            { label: 'Callbacks', to: Paths.instance.callbacks(...params) }
          ]}
        />
      )}

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
