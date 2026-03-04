import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthConfigs,
  useProviderAuthMethods,
  useProviderDeployment,
  useSessions
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';
import { SessionsTable } from '../../../scenes/sessions/table';
import { UsageScene } from '../../../scenes/usage/usage';

export let ProviderDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);
  let authConfigs = useProviderAuthConfigs(
    instance.data?.id,
    deployment.data?.id ?? providerDeploymentId
  );

  let hasAuthMethods = (authMethods.data?.items?.length ?? 0) > 0;

  let sessions = useSessions(instance.data?.id, {
    providerDeploymentId: deployment.data?.id ?? providerDeploymentId,
    order: 'desc',
    limit: 100
  });
  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: deployment.data.name ?? '—'
          },
          {
            label: 'Provider',
            content: deployment.data.providerId
          },
          {
            label: 'ID',
            content: <ID id={deployment.data.id} />
          },
          {
            label: 'Pinned Version',
            content: deployment.data.lockedVersion ? (
              <Badge color="blue">
                {deployment.data.lockedVersion.name} ({deployment.data.lockedVersion.version})
              </Badge>
            ) : (
              <Badge color="gray">Latest</Badge>
            )
          },
          {
            label: 'Default Config',
            content: deployment.data.defaultConfig?.name ?? '—'
          },
          {
            label: 'Created At',
            content: <RenderDate date={deployment.data.createdAt!} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={deployment.data.updatedAt!} />
          }
        ]}
      />

      <Spacer height={20} />

      <UsageScene
        title="Messages"
        description="See how this provider deployment is being used in your project."
        entities={[{ type: 'provider_deployment', id: deployment.data.id }]}
        entityNames={{
          [deployment.data.id]: deployment.data.name ?? deployment.data.id
        }}
      />

      <Spacer height={20} />

      <Box title="Recent Sessions" description="Latest sessions using this deployment.">
        <SessionsTable providerDeploymentId={deployment.data.id} />
      </Box>

      {hasAuthMethods && (
        <>
          <Spacer height={20} />

          <SideBox
            title="Authentication"
            description="Manage auth configurations for this deployment."
          >
            <Button
              size="2"
              onClick={() => {
                if (!instance.data) return;
                showProviderSetupSessionModal({
                  instanceId: instance.data.id,
                  providerId: deployment.data.providerId,
                  deploymentId: deployment.data.id,
                  onComplete: () => authConfigs.refetch?.()
                });
              }}
            >
              Configure Authentication
            </Button>
          </SideBox>

          <Spacer height={15} />

          <ProviderAuthConfigsTable
            instanceId={instance.data!.id}
            providerDeploymentId={deployment.data.id}
          />
        </>
      )}
    </>
  ));
};
