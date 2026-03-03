import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthConfigs,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Button, Flex, Spacer } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { showProviderAuthConfigFormModal } from '../../../scenes/providerAuthConfigs/modal';
import { showProviderAuthCredentialsFormModal } from '../../../scenes/providerAuthCredentials/modal';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';

export let ProviderDeploymentAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);
  let authConfigs = useProviderAuthConfigs(instance.data?.id, providerDeploymentId);
  let hasOAuthMethod = (authMethods.data?.items ?? []).some(method => method.type === 'oauth');

  return renderWithLoader({ instance, deployment })(({ instance, deployment }) => (
    <>
      <Flex gap={10} wrap="wrap">
        <Button
          size="2"
          onClick={() =>
            showProviderAuthConfigFormModal({
              type: 'create',
              instanceId: instance.data.id,
              providerDeploymentId: deployment.data.id,
              onCreate: () => authConfigs.refetch?.()
            })
          }
        >
          Create Auth Config
        </Button>

        {hasOAuthMethod && (
          <Button
            size="2"
            variant="outline"
            onClick={() =>
              showProviderAuthCredentialsFormModal({
                instanceId: instance.data.id,
                providerId: deployment.data.providerId,
                deploymentId: deployment.data.id
              })
            }
          >
            Create Auth Credentials
          </Button>
        )}

        {hasOAuthMethod && (
          <Button
            size="2"
            variant="outline"
            onClick={() =>
              showProviderSetupSessionModal({
                instanceId: instance.data.id,
                providerId: deployment.data.providerId,
                deploymentId: deployment.data.id,
                onComplete: () => authConfigs.refetch?.()
              })
            }
          >
            Connect
          </Button>
        )}
      </Flex>

      <Spacer size={15} />

      <ProviderAuthConfigsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
      />
    </>
  ));
};
