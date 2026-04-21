import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderListings
} from '@metorial/state';
import { Datalist, RenderDate, theme, Title } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { SessionConnectionStatusBadge } from '../../providerSessions/table';
import { SessionConnection } from '../types';
import { formatConnectionLabel } from '../utils';
import { CollapsibleBox } from './collapsibleBox';

type ConnectionMcp =
  | (NonNullable<SessionConnection['mcp']> & {
      client?: { name?: string; version?: string } | null;
      server?: { name?: string; version?: string } | null;
      connectionType?: string | null;
    })
  | undefined;

type SessionProvider = DashboardInstanceSessionsGetOutput['providers'][number];

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

let HeaderGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

let HeaderColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`;

let ProviderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let ProviderRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  strong {
    font-size: 13px;
    font-weight: 600;
    color: ${theme.colors.gray900};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let DashedLink = styled(Link)`
  color: ${theme.colors.gray900};
  text-decoration: underline dashed;
  text-decoration-color: ${theme.colors.gray500};
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  font-weight: 500;
  word-break: break-all;
  transition:
    color 120ms ease,
    text-decoration-color 120ms ease;

  &:hover {
    color: ${theme.colors.gray700};
    text-decoration-color: ${theme.colors.gray700};
  }
`;

let ProvidersStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let EmptyHint = styled.div`
  font-size: 13px;
  color: ${theme.colors.gray700};
`;

let getConnectionTransportLabel = (connectionType?: string | null) => {
  if (!connectionType) return null;
  return (
    {
      mcp: 'MCP'
    }[connectionType] ?? connectionType
  );
};

let getProviderDisplayName = (provider: SessionProvider) =>
  provider.deployment?.name ?? provider.config?.name ?? null;

let formatCount = (value: number) => value.toLocaleString();

let SessionBox = ({ session }: { session: DashboardInstanceSessionsGetOutput }) => {
  let usage = session.usage;

  return (
    <CollapsibleBox
      id="session"
      title="Session"
      description="Lifecycle and usage for this session."
    >
      <Datalist
        items={[
          {
            label: 'ID',
            value: <ID id={session.id} />
          },
          ...(session.name ? [{ label: 'Name', value: <>{session.name}</> }] : []),
          {
            label: 'Created',
            value: <RenderDate date={session.createdAt} />
          }
        ]}
      />
    </CollapsibleBox>
  );
};

let ConnectionBox = ({
  connection,
  session
}: {
  connection: SessionConnection;
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let usage = connection.usage;

  return (
    <CollapsibleBox
      id="connection"
      title="Connection"
      description={formatConnectionLabel(connection, session)}
      rightActions={
        <SessionConnectionStatusBadge
          connectionStatus={connection.connectionState}
          hasErrors={connection.hasErrors}
          hasWarnings={connection.hasWarnings}
        />
      }
    >
      <Datalist
        items={[
          {
            label: 'ID',
            value: <ID id={connection.id} />
          },
          {
            label: 'Transport',
            value: <>{connection.transport}</>
          },
          {
            label: 'Client Messages',
            value: <>{formatCount(usage.totalProductiveClientMessageCount)}</>
          },
          {
            label: 'Provider Messages',
            value: <>{formatCount(usage.totalProductiveProviderMessageCount)}</>
          },
          {
            label: 'Created',
            value: <RenderDate date={connection.createdAt} />
          },
          ...(connection.lastActiveAt
            ? [
                {
                  label: 'Last Active',
                  value: <RenderDate date={connection.lastActiveAt} />
                }
              ]
            : [])
        ]}
      />
    </CollapsibleBox>
  );
};

let ClientBox = ({ mcp }: { mcp: ConnectionMcp }) => {
  let clientName = mcp?.client?.name ?? null;
  let clientVersion = mcp?.client?.version ?? null;
  let serverName = mcp?.server?.name ?? null;
  let serverVersion = mcp?.server?.version ?? null;
  let connectionTypeLabel = getConnectionTransportLabel(
    mcp?.connectionType ?? mcp?.transport ?? null
  );

  let items = [
    clientName || clientVersion
      ? {
          label: 'Client',
          value: <>{[clientName, clientVersion].filter(Boolean).join(' · ')}</>
        }
      : null,
    serverName || serverVersion
      ? {
          label: 'Server',
          value: <>{[serverName, serverVersion].filter(Boolean).join(' · ')}</>
        }
      : null,
    connectionTypeLabel
      ? {
          label: 'Connected Via',
          value: <>{connectionTypeLabel}</>
        }
      : null,
    mcp?.protocolVersion
      ? {
          label: 'Protocol',
          value: <>{mcp.protocolVersion}</>
        }
      : null
  ].filter(Boolean) as { label: React.ReactNode; value: React.ReactNode }[];

  return (
    <CollapsibleBox
      id="client"
      title="Client"
      description="The connected MCP client's details and capabilities."
    >
      {items.length > 0 ? (
        <Datalist items={items} />
      ) : (
        <EmptyHint>No client information has been reported for this connection yet.</EmptyHint>
      )}
    </CollapsibleBox>
  );
};

let ProviderResourceLink = ({
  fallback,
  name,
  to
}: {
  fallback: string;
  name: string | null | undefined;
  to: string;
}) => {
  let label = name && name.trim().length > 0 ? name : fallback;
  return <DashedLink to={to}>{label}</DashedLink>;
};

let ProvidersBox = ({ providers }: { providers: SessionProvider[] }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let listings = useProviderListings(instance.data?.id, {
    id: providers.map(p => p.providerId)
  });
  let providerNameMap = new Map(listings.data?.items.map(p => [p.provider.id, p.name]) ?? []);

  return (
    <CollapsibleBox
      id="providers"
      title="Providers"
      description={
        providers.length === 0
          ? 'No providers have been used by this connection.'
          : providers.length === 1
            ? 'The provider backing this connection.'
            : `${providers.length} providers are backing this connection.`
      }
    >
      {providers.length === 0 ? (
        <EmptyHint>This connection has not used any providers yet.</EmptyHint>
      ) : (
        <ProvidersStack>
          {providers.map(provider => {
            let displayName = getProviderDisplayName(provider);
            let items: { label: ReactNode; value: ReactNode }[] = [
              {
                label: 'Provider',
                value: (
                  <ProviderResourceLink
                    fallback={provider.providerId}
                    name={providerNameMap.get(provider.providerId) ?? displayName}
                    to={Paths.instance.provider(
                      organization.data,
                      project.data,
                      instance.data,
                      provider.providerId
                    )}
                  />
                )
              }
            ];

            if (provider.deployment) {
              items.push({
                label: 'Deployment',
                value: (
                  <ProviderResourceLink
                    fallback={provider.deployment.id}
                    name={provider.deployment.name}
                    to={Paths.instance.providerDeployment(
                      organization.data,
                      project.data,
                      instance.data,
                      provider.deployment.id
                    )}
                  />
                )
              });
            }

            if (provider.config) {
              items.push({
                label: 'Config',
                value: (
                  <ProviderResourceLink
                    fallback={provider.config.id}
                    name={provider.config.name}
                    to={Paths.instance.providerConfig(
                      organization.data,
                      project.data,
                      instance.data,
                      provider.config.id
                    )}
                  />
                )
              });
            }

            if (provider.authConfig) {
              items.push({
                label: 'Auth Config',
                value: (
                  <ProviderResourceLink
                    fallback={provider.authConfig.id}
                    name={null}
                    to={Paths.instance.providerAuthConfig(
                      organization.data,
                      project.data,
                      instance.data,
                      provider.authConfig.id
                    )}
                  />
                )
              });
            }

            return (
              <ProviderRow key={provider.id}>
                <ProviderRowHeader>
                  <strong>{displayName ?? provider.providerId}</strong>
                </ProviderRowHeader>
                <Datalist items={items} />
              </ProviderRow>
            );
          })}
        </ProvidersStack>
      )}
    </CollapsibleBox>
  );
};

export let ConnectionTraceHeader = ({
  connection,
  mcp,
  providers,
  session
}: {
  connection: SessionConnection;
  mcp: ConnectionMcp;
  providers: SessionProvider[];
  session: DashboardInstanceSessionsGetOutput;
}) => {
  return (
    <Wrapper>
      <Title as="h1" size="4" weight="strong" color="gray600">
        <span style={{ color: theme.colors.foreground }}>
          {formatConnectionLabel(connection, session)}
        </span>{' '}
        connected via{' '}
        <span style={{ color: theme.colors.foreground }}>
          {getConnectionTransportLabel(connection.transport) ?? connection.transport}
        </span>{' '}
        on{' '}
        {new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date(connection.createdAt))}
      </Title>

      <HeaderGrid>
        <HeaderColumn>
          <SessionBox session={session} />
          <ConnectionBox connection={connection} session={session} />
        </HeaderColumn>
        <HeaderColumn>
          <ClientBox mcp={mcp} />
          <ProvidersBox providers={providers} />
        </HeaderColumn>
      </HeaderGrid>
    </Wrapper>
  );
};
