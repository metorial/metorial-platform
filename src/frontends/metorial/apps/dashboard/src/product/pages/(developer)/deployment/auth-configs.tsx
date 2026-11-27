import { DetailsTableLayout } from '@metorial/details-layout';
import { ProviderAuthConfigCreateButton } from '../../../scenes/providerAuthConfigs/modal';
import { ProviderAuthConfigsOverviewTable } from '../../../scenes/providerAuthConfigs/overviewTable';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let ConfigurationsDeploymentAuthConfigsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);

  return renderWithLoader({ instance, deployment })(({ instance, deployment }) => (
    <DetailsTableLayout title="Auth Configs">
      <ProviderDeploymentTabSection>
        <ProviderAuthConfigsOverviewTable
          instanceId={instance.data.id}
          filters={{ providerDeploymentId: deployment.data.id }}
          emptyState="No auth configs for this deployment."
          headerActions={() => (
            <ProviderAuthConfigCreateButton
              instanceId={instance.data.id}
              providerDeploymentId={deployment.data.id}
              size="2"
              onCreate={({ id }) =>
                navigate(
                  Paths.instance.providerAuthConfig(
                    organization.data,
                    project.data,
                    instance.data,
                    id
                  )
                )
              }
            >
              Create Auth Config
            </ProviderAuthConfigCreateButton>
          )}
        />
      </ProviderDeploymentTabSection>
    </DetailsTableLayout>
  ));
};
