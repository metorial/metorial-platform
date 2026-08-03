import { InitialLoadBoundary } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ContentPanelLayoutInner } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';
import { SessionConnectionStatusBadge } from '../../../scenes/providerSessions/table';

let OutletWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

export let MagicMcpConnectionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let pathname = useLocation().pathname;

  let { connectionId } = useParams();

  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ magicMcpSession, session }) => {
        let magicMcpServer = magicMcpSession.magicMcpServer;
        let connectionPathParams = [
          organization.data,
          project.data,
          instance.data,
          magicMcpSession.id
        ] as const;
        let isLogsPage =
          pathname === Paths.instance.magicMcp.connection(...connectionPathParams);
        let outlet = (
          <InitialLoadBoundary>
            <Outlet />
          </InitialLoadBoundary>
        );

        return (
          <ContentPanelLayout
            title={session.name ?? `Session ${session.id.slice(0, 8)}...`}
            description={session.description ?? magicMcpServer?.description ?? undefined}
            breadcrumbs={[
              {
                label: 'Connections',
                to: Paths.instance.magicMcp.connections(
                  organization.data,
                  project.data,
                  instance.data
                )
              },
              {
                label: session.name ?? 'Connection',
                to: Paths.instance.magicMcp.connection(...connectionPathParams)
              }
            ]}
            extra={<DeletedRecordCallout status={session.status} />}
            links={{
              current: pathname,
              items: [
                {
                  label: 'Logs',
                  to: Paths.instance.magicMcp.connection(...connectionPathParams)
                },
                {
                  label: 'Deployments',
                  to: Paths.instance.magicMcp.connection(
                    ...connectionPathParams,
                    'providers'
                  )
                },
                {
                  label: 'Provider Runs',
                  to: Paths.instance.magicMcp.connection(...connectionPathParams, 'runs')
                }
              ]
            }}
          >
            {isLogsPage ? (
              <OutletWrapper>{outlet}</OutletWrapper>
            ) : (
              <ContentPanelLayoutInner>
                <AttributesLayout
                  variant="large"
                  items={[
                    {
                      label: 'Status',
                      value: (
                        <SessionConnectionStatusBadge
                          connectionStatus={session.connectionState}
                          hasErrors={session.hasErrors}
                          hasWarnings={session.hasWarnings}
                        />
                      )
                    },
                    {
                      label: 'Magic MCP Server',
                      value: magicMcpServer?.name ?? (
                        <Text size="2" color="gray600">
                          Unnamed Server
                        </Text>
                      )
                    },
                    {
                      label: 'Magic MCP Session ID',
                      value: <ID id={magicMcpSession.id} />
                    },
                    {
                      label: 'Session ID',
                      value: <ID id={session.id} />
                    },
                    {
                      label: 'Created At',
                      value: <RenderDate date={magicMcpSession.createdAt} />
                    },
                    {
                      label: 'Messages',
                      value:
                        (session.usage?.totalProductiveClientMessageCount ?? 0) +
                        (session.usage?.totalProductiveProviderMessageCount ?? 0)
                    }
                  ]}
                >
                  {outlet}
                </AttributesLayout>
              </ContentPanelLayoutInner>
            )}
          </ContentPanelLayout>
        );
      }}
    </RenderWithResolvedMagicMcpSession>
  );
};
