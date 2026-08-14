import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateMagicMcpServerProvider,
  useCreateMagicMcpServerSession,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServer,
  useMagicMcpServerProviders,
  useUpdateMagicMcpServerProvider
} from '@metorial/state';
import { Button, Flex, LinkTabs } from '@metorial/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { OpenExplorerButton, type OpenExplorerMode } from '../../../components/openExplorer';
import { createMagicMcpTokenModal } from '../../../scenes/magicMcp/tokensTable';
import { showAddProviderSidePanel } from '../../../scenes/sessionTemplates/providersManager';

export let MagicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let providers = useMagicMcpServerProviders(instance.data?.id, magicMcpServerId, {
    status: ['active']
  });
  let createSession = useCreateMagicMcpServerSession();
  let createProvider = useCreateMagicMcpServerProvider();
  let updateProvider = useUpdateMagicMcpServerProvider();
  let [isCreatingSession, setIsCreatingSession] = useState(false);
  let pathname = useLocation().pathname;
  let isTokensPage = pathname.endsWith('/tokens');

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    server.data?.id ?? magicMcpServerId
  ] as const;

  let handleOpenExplorer = async (mode: OpenExplorerMode) => {
    if (isCreatingSession || !instance.data || !magicMcpServerId) return;

    setIsCreatingSession(true);

    let [res] = await createSession.mutate({
      instanceId: instance.data.id,
      magicMcpServerId
    });
    setIsCreatingSession(false);

    if (res) {
      navigate(
        Paths.instance.explorer(organization.data, project.data, instance.data, {
          session_id: res.id,
          mode
        }),
        {
          state: { magicMcpServerId: server.data?.id ?? magicMcpServerId }
        }
      );
    }
  };

  return (
    <ContentLayout>
      {renderWithLoader({ server })(({ server }) => {
        let serverLabel = server.data.name ?? server.data.id;
        let canAddProviders = server.data.providerManagementMode === 'manual';
        let addProviderDisabledReason =
          server.data.providerManagementMode === 'inherited_from_integration'
            ? 'Providers are inherited from the integration and cannot be changed here.'
            : server.data.providerManagementMode === 'inherited_from_provider_template'
              ? 'Providers are inherited from the provider template and cannot be changed here.'
              : undefined;

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
                  <OpenExplorerButton
                    size="2"
                    variant="outline"
                    onOpen={handleOpenExplorer}
                    loading={isCreatingSession}
                  />

                  <Button
                    size="2"
                    disabled={!isTokensPage && !canAddProviders}
                    title={!isTokensPage ? addProviderDisabledReason : undefined}
                    onClick={() => {
                      if (isTokensPage) {
                        createMagicMcpTokenModal();
                        return;
                      }

                      if (!canAddProviders) return;

                      showAddProviderSidePanel({
                        instanceId: instance.data!.id,
                        filterAvailableResources: true,
                        excludeProviderIds: Array.from(
                          new Set(
                            (server.data.providers ?? []).map(provider => provider.provider.id)
                          )
                        ),
                        onSubmitProvider: async (input, currentProviderId) => {
                          if (currentProviderId) {
                            let [, error] = await updateProvider.mutate({
                              instanceId: instance.data!.id,
                              magicMcpServerId: server.data.id,
                              magicMcpServerProviderId: currentProviderId,
                              providerDeploymentId: input.providerDeploymentId,
                              providerConfigId: input.providerConfigId,
                              providerAuthConfigId: input.providerAuthConfigId,
                              toolFilters: input.toolFilters
                            });

                            return error ? { error } : { success: true };
                          }

                          let [, error] = await createProvider.mutate({
                            instanceId: instance.data!.id,
                            magicMcpServerId: server.data.id,
                            providerId: input.providerId,
                            providerDeploymentId: input.providerDeploymentId!,
                            providerConfigId: input.providerConfigId,
                            providerAuthConfigId: input.providerAuthConfigId,
                            toolFilters: input.toolFilters
                          });

                          return error ? { error } : { success: true };
                        },
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
                  label: 'Settings',
                  to: Paths.instance.magicMcp.server(...serverPathParams, 'config')
                }
              ]}
            />

            <InitialLoadBoundary>
              <Outlet />
            </InitialLoadBoundary>
          </>
        );
      })}
    </ContentLayout>
  );
};
