import { ProviderDeploymentsTable } from '../../scenes/providerDeployments/table';
import { showProviderDeploymentFormModal } from '../../scenes/providerDeployments/modal';
import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';

export let ConfigurationsDeploymentsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Deployments"
        description="Manage the base configuration of your provider deployments."
        actions={
          <Button
            size="2"
            onClick={() =>
              showProviderDeploymentFormModal({
                type: 'create',
                instanceId: instance.data.id,
                onCreate: deployment =>
                  navigate(
                    Paths.instance.providerDeployment(
                      organization.data,
                      project.data,
                      instance.data,
                      deployment.id
                    )
                  )
              })
            }
          >
            Create Deployment
          </Button>
        }
      />

      <PaginationSearchParamsProvider enabled={true}>
        <ProviderDeploymentsTable instanceId={instance.data.id} />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  ));
};
