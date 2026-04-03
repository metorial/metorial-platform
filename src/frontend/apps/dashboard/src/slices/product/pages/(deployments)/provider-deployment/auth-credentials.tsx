import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { Button, Tooltip } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useProviderAuthCreationCapabilities } from '../../../lib/providerCreationCapabilities';
import { showProviderAuthCredentialsFormModal } from '../../../scenes/providerAuthCredentials/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { providerAuthCredentialsTable } from '../(list)/provider-auth-credentials';

export let ProviderDeploymentAuthCredentialsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    instance.data?.id,
    providerDeploymentId
  );

  return renderWithLoader({ instance, organization, project, deployment })(
    ({ deployment }) => (
      <ProviderDeploymentTabSection>
        {providerAuthCredentialsTable({
          instanceId: instance.data!.id,
          organization,
          project,
          instance,
          filters: { providerId: deployment.data.providerId },
          emptyState: "No auth credentials found for this deployment's provider.",
          headerActions: () => (
            <Tooltip
              content={authCreation.authCredentialsDisabledReason ?? ''}
              enabled={!authCreation.canCreateAuthCredentials}
              delayDuration={0}
            >
              <div style={{ display: 'inline-flex' }}>
                <Button
                  size="2"
                  disabled={!authCreation.canCreateAuthCredentials}
                  onClick={() =>
                    showProviderAuthCredentialsFormModal({
                      instanceId: instance.data!.id,
                      providerId: deployment.data.providerId,
                      deploymentId: deployment.data.id,
                      onCreate: credential =>
                        navigate(
                          Paths.instance.providerAuthCredential(
                            organization.data,
                            project.data,
                            instance.data!,
                            credential.id
                          )
                        )
                    })
                  }
                >
                  Create Auth Credentials
                </Button>
              </div>
            </Tooltip>
          )
        })}
      </ProviderDeploymentTabSection>
    )
  );
};
