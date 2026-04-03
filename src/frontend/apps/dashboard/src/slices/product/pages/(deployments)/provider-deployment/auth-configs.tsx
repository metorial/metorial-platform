import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { providerAuthConfigsFilterTable } from '../(list)/provider-auth-configs';
import { ProviderAuthConfigCreateButton } from '../../../scenes/providerAuthConfigs/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);

  return renderWithLoader({ instance, deployment, organization, project })(
    ({ deployment }) => (
      <ProviderDeploymentTabSection>
        <>
          {providerAuthConfigsFilterTable({
            instanceId: instance.data!.id,
            organization,
            project,
            instance,
            filters: { providerDeploymentId: deployment.data.id },
            emptyState: 'No auth configs for this deployment.',
            headerActions: () => (
              <ProviderAuthConfigCreateButton
                instanceId={instance.data!.id}
                providerDeploymentId={deployment.data.id}
                size="2"
              >
                Create Auth Config
              </ProviderAuthConfigCreateButton>
            )
          })}
        </>
      </ProviderDeploymentTabSection>
    )
  );
};
