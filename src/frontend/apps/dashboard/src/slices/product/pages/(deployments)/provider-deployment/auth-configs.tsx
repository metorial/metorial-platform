import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';
import { providerAuthConfigsFilterTable } from '../(list)/provider-auth-configs';
import { ProviderAuthConfigCreateButton } from '../../../scenes/providerAuthConfigs/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
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
                onCreate={({ id }) => {
                  navigate(
                    Paths.instance.providerAuthConfig(
                      organization.data,
                      project.data,
                      instance.data!,
                      id
                    )
                  );
                }}
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
