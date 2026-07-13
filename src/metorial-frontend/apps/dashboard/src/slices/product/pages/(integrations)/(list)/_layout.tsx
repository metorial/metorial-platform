import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useNavigate } from 'react-router-dom';
import { Explainer } from '../../../../../components/explainer';
import { showCreateIntegrationProviderFirstFlow } from '../../../scenes/integrations/providerPanelFlow';

export let IntegrationsListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

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

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>

      <Explainer
        title="Get started with Integrations"
        description="Create reusable integration contracts and create Magic MCP servers from them or connect them to Metorial Portals."
        videoUrl="https://dashboard-assets.metorial-cdn.com/videos/metorial-dashboard-onboarding/2026-07-13/integrations.mp4"
        id="integrations-home"
      />
    </ContentLayout>
  );
};
