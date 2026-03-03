import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderAuthConfigs,
  useProviderAuthMethods,
  useProviderConfigVaults,
  useProviderDeployment,
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
import { Link, useParams } from 'react-router-dom';
import { ProviderAuthConfigsTable } from '../../../scenes/providerAuthConfigs/table';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';
import { SessionsTable } from '../../../scenes/sessions/table';
import { UsageScene } from '../../../scenes/usage/usage';

export let ProviderDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

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
  let configVaults = useProviderConfigVaults(instance.data?.id, {
    providerDeploymentId: deployment.data?.id ?? providerDeploymentId ?? undefined
  });

  let hasAuthMethods = (authMethods.data?.items?.length ?? 0) > 0;
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

      <Spacer height={20} />

      <SideBox
        title="Config Vaults"
        description="Manage reusable configuration values for this deployment."
      >
        <Text size="2" color="gray600">
          {configVaults.data?.items?.length ?? 0} vault
          {(configVaults.data?.items?.length ?? 0) === 1 ? '' : 's'} available
        </Text>

        <Spacer height={10} />

        <Link
          to={Paths.instance.providerDeployment(
            organization.data,
            project.data,
            instance.data,
            deployment.data.id,
            'config-vaults'
          )}
        >
          <Button as="span" size="2" variant="outline">
            View Config Vaults
          </Button>
        </Link>
      </SideBox>

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
