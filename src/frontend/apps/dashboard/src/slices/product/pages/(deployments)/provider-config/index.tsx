import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderConfig,
  useSessions
} from '@metorial/state';
import { Badge, Callout, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useLocation, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { getFromDeployment, withFromDeployment } from '../fromDeployment';
import {
  ProviderSessionsTable,
  SessionConnectionStatusBadge
} from '../../../scenes/providerSessions/table';
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

let SummaryValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

export let ProviderConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let fromDeployment = getFromDeployment(location.search);

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);
  let provider = useProvider(instance.data?.id, config.data?.providerId ?? undefined);

  let sessions = useSessions(
    instance.data?.id && config.data?.id ? instance.data.id : null,
    config.data?.id
      ? {
          providerConfigId: config.data.id,
          order: 'desc'
        }
      : undefined
  );

  let sessionsContent = renderWithPagination(sessions)(sessions => (
    <>
      {sessions.data.items.length > 0 ? (
        <Table
          headers={['Status', 'Deployments', 'Name', 'Created']}
          data={sessions.data.items.map(session => ({
            href: Paths.instance.providerSession(
              organization.data,
              project.data,
              instance.data,
              session.id
            ),
            data: [
              <SessionConnectionStatusBadge
                connectionStatus={session.connectionState}
                hasErrors={session.hasErrors}
                hasWarnings={session.hasWarnings}
              />,
              <Text size="2" weight="strong">
                {session.providers
                  ?.map(s => s.deployment?.name ?? s.providerId ?? 'Unknown')
                  .join(', ') || 'No deployments'}
              </Text>,
              <Text size="2">{session.name ?? 'Unnamed Session'}</Text>,
              <RenderDate date={session.createdAt} />
            ]
          }))}
        />
      ) : (
        <Callout color="gray">No sessions are using this configuration yet.</Callout>
      )}
    </>
  ));

  return renderWithLoader({ config })(({ config }) => (
    <>
      <SummaryGrid>
        {[
          {
            label: 'Type',
            content: config.data.isDefault ? (
              <Badge color="blue">Default</Badge>
            ) : (
              <Badge color="gray">Custom</Badge>
            )
          },
          {
            label: 'Source',
            content: config.data.fromVault ? (
              <SummaryValue>
                <Badge color="purple">Vault</Badge>
                <Link
                  to={withFromDeployment(
                    Paths.instance.providerConfigVault(
                      organization.data,
                      project.data,
                      instance.data,
                      config.data.fromVault.id
                    ),
                    fromDeployment
                  )}
                >
                  {config.data.fromVault.name ?? config.data.fromVault.id}
                </Link>
              </SummaryValue>
            ) : (
              'Direct'
            )
          },
          {
            label: 'Deployment',
            content: config.data.deployment ? (
              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  config.data.deployment.id
                )}
              >
                {config.data.deployment.name ?? config.data.deployment.id}
              </Link>
            ) : (
              <Text size="2" color="gray600">
                Unlinked
              </Text>
            )
          },
          {
            label: 'Provider',
            content: provider.data?.name ?? '...'
          },
          {
            label: 'Config ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={config.data.updatedAt} />
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

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this config is being used in your instance."
        entities={[{ type: 'provider_auth_config', id: config.data.id }]}
        entityNames={{
          [config.data.id]: config.data.name ?? config.data.id
        }}
      />

      <Spacer height={15} />

      <Box
        title="Recent Sessions"
        description="Latest sessions currently using this configuration."
      >
        <ProviderSessionsTable providerConfigId={config.data.id} />
      </Box>
    </>
  ));
};
