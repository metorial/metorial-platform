import {
  DashboardInstanceSessionsCreateOutput,
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServer,
  useSessionTemplateProviders
} from '@metorial/state';
import { Button, Flex, LinkTabs } from '@metorial/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createMagicMcpTokenModal } from '../../../scenes/magicMcp/tokensTable';
import { showAddProviderModal } from '../../../scenes/sessionTemplates/providersManager';

export let MagicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let providers = useSessionTemplateProviders(instance.data?.id, server.data?.sessionTemplateId);
  let createSession = useCreateSession(instance.data?.id);
  let [isCreatingSession, setIsCreatingSession] = useState(false);
  let pathname = useLocation().pathname;
  let isTokensPage = pathname.endsWith('/tokens');

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? magicMcpServerId
  ] as const;

  let getTemplateProviderDeploymentId = (
    provider: DashboardInstanceSessionTemplatesProvidersListOutput['items'][number]
  ): string | null => provider.deployment?.id ?? null;

  let getFirstSessionDeploymentId = (
    session: DashboardInstanceSessionsCreateOutput
  ): string | null => session.providers[0]?.deployment?.id ?? null;

  let handleOpenExplorer = async () => {
    if (isCreatingSession || !instance.data || !providers.data?.items.length) return;

    setIsCreatingSession(true);

    let sessionTemplateId = server.data?.sessionTemplateId;
    let providerEntries = (providers.data?.items ?? [])
      .map(p => getTemplateProviderDeploymentId(p))
      .filter((id): id is string => !!id)
      .map(providerDeploymentId => ({
        providerDeployment: { providerDeploymentId },
        ...(sessionTemplateId ? { sessionTemplateId } : {})
      }));

    if (!providerEntries.length) {
      setIsCreatingSession(false);
      return;
    }

    let [res] = await createSession.mutate({ providers: providerEntries });
    setIsCreatingSession(false);

    if (res) {
      let firstDeploymentId =
        getFirstSessionDeploymentId(res) ??
        providerEntries[0]?.providerDeployment?.providerDeploymentId ??
        null;
      if (firstDeploymentId) {
        navigate(
          Paths.instance.explorer(organization.data, project.data, instance.data, {
            provider_deployment_id: firstDeploymentId,
            session_id: res.id
          })
        );
      }
    }
  };

  return (
    <ContentLayout>
      {renderWithLoader({ server })(({ server }) => {
        let serverLabel = server.data.name ?? server.data.id;

        return (
          <>
            <PageHeader
              title={serverLabel}
              description={server.data.description ?? undefined}
              pagination={[
                {
                  label: 'Magic MCP Servers',
                  href: Paths.instance.magicMcp.servers(
                    organization.data,
                    project.data,
                    instance.data
                  )
                },
                {
                  label: serverLabel,
                  href: Paths.instance.magicMcp.server(...serverPathParams)
                }
              ]}
              actions={
                <Flex gap={8}>
                  <Button
                    size="2"
                    variant="outline"
                    onClick={handleOpenExplorer}
                    loading={isCreatingSession}
                  >
                    Open Explorer
                  </Button>

                  <Button
                    size="2"
                    onClick={() => {
                      if (isTokensPage) {
                        createMagicMcpTokenModal();
                        return;
                      }

                      showAddProviderModal({
                        instanceId: instance.data!.id,
                        sessionTemplateId: server.data.sessionTemplateId,
                        onComplete: () => providers.refetch()
                      });
                    }}
                  >
                    {isTokensPage ? 'Create Magic MCP Token' : 'Add Provider'}
                  </Button>
                </Flex>
              }
            />

            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.magicMcp.server(...serverPathParams)
                },
                {
                  label: 'Providers',
                  to: Paths.instance.magicMcp.server(...serverPathParams, 'providers')
                },
                {
                  label: 'Tokens',
                  to: Paths.instance.magicMcp.server(...serverPathParams, 'tokens')
                },
                {
                  label: 'Sessions',
                  to: Paths.instance.magicMcp.server(...serverPathParams, 'sessions')
                },
                {
                  label: 'Settings',
                  to: Paths.instance.magicMcp.server(...serverPathParams, 'config')
                }
              ]}
            />

            <Outlet />
          </>
        );
      })}
    </ContentLayout>
  );
};
