import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Badge, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { UsageScene } from '../../../scenes/usage/usage';

let SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: ${theme.colors.gray300};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  overflow: hidden;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let SummaryItem = styled.div`
  background: ${theme.colors.background};
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
`;

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

  let hasAuthMethods = (authMethods.data?.items?.length ?? 0) > 0;
  return renderWithLoader({ deployment, provider })(({ deployment, provider }) => (
    <>
      <SummaryGrid>
        {[
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
        ].map(item => (
          <SummaryItem key={String(item.label)}>
            <Text weight="bold" size="1">
              {item.label}
            </Text>
            <Text size="1" weight="medium" color="gray700" as="div">
              {item.content}
            </Text>
          </SummaryItem>
        ))}
      </SummaryGrid>

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
