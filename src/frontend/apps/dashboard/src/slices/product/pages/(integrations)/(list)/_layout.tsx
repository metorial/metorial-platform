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
import { showIntegrationFormModal } from '../../../scenes/integrations/modal';

export let IntegrationsListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Integrations"
        description="Create reusable provider contracts and configure instances from them."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showIntegrationFormModal({
                type: 'create',
                instanceId: instance.data.id,
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
    </ContentLayout>
  );
};
