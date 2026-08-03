import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { UsageScene } from '../../../scenes/usage/usage';

export let ProviderDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(
    instance.data?.id,
    effectiveVersionId ? { providerVersionId: effectiveVersionId } : null
  );

  return renderWithLoader({ deployment, provider })(({ deployment, provider }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Name',
            content: deployment.data.name ?? '—'
          },
          {
            label: 'Provider',
            content: provider.data?.name ?? deployment.data.providerId
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
        title="Usage"
        description="See how this provider deployment is being used in your instance."
        entities={[{ type: 'provider_deployment', id: deployment.data.id }]}
        entityNames={{
          [deployment.data.id]: deployment.data.name ?? deployment.data.id
        }}
      />

      <Spacer height={20} />

      <Box title="Recent Sessions" description="Latest sessions using this deployment.">
        <ProviderSessionsTable providerDeploymentId={deployment.data.id} />
      </Box>

      {/* {hasAuthMethods && (
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
                  deploymentId: deployment.data.id
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
      )} */}
    </>
  ));
};
