import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import { InstanceLayout } from './pages/_instanceLayout';
import { InstanceRootRedirectPage } from './pages/rootRedirect';

let IntegrationsOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/overview').then(c => c.IntegrationsOverviewPage)
);

// Provider API pages
let ProvidersHubLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProvidersHubLayout)
);
let ProvidersPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/providers').then(c => c.ProvidersPage)
);
let ProviderSessionsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderSessionsListLayout)
);
let ProviderSessionsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-sessions').then(c => c.ProviderSessionsPage)
);
let ProviderLayout = dynamicPage(() =>
  import('./pages/provider/_layout').then(c => c.ProviderLayout)
);
let ProviderOverviewPage = dynamicPage(() =>
  import('./pages/provider/index').then(c => c.ProviderOverviewPage)
);
let ProviderVersionsPage = dynamicPage(() =>
  import('./pages/provider/versions').then(c => c.ProviderVersionsPage)
);
let ProviderCapabilitiesLayout = dynamicPage(() =>
  import('./pages/provider/(capapbilities)/_layout').then(c => c.ProviderCapabilitiesLayout)
);
let ProviderToolsPage = dynamicPage(() =>
  import('./pages/provider/(capapbilities)').then(c => c.ProviderToolsPage)
);
let ProviderTriggersPage = dynamicPage(() =>
  import('./pages/provider/(capapbilities)/triggers').then(c => c.ProviderTriggersPage)
);
let ProviderAuthMethodsPage = dynamicPage(() =>
  import('./pages/provider/(capapbilities)/auth-methods').then(c => c.ProviderAuthMethodsPage)
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session/providers').then(c => c.ProviderSessionProvidersPage)
);
let ProviderSessionLogsPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session').then(c => c.ProviderSessionLogsPage)
);
let IntegrationsListLayout = dynamicPage(() =>
  import('./pages/(integrations)/(list)/_layout').then(c => c.IntegrationsListLayout)
);
let IntegrationsPage = dynamicPage(() =>
  import('./pages/(integrations)/(list)/integrations').then(c => c.IntegrationsPage)
);
let SkillsPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/skills').then(c => c.SkillsPage)
);
let SkillTemplatesPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/templates').then(c => c.SkillTemplatesPage)
);
let SkillGroupsPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/groups').then(c => c.SkillGroupsPage)
);
let SkillMarketplacesPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/marketplaces').then(c => c.SkillMarketplacesPage)
);
let SkillLayout = dynamicPage(() =>
  import('./pages/(skills)/skill/_layout').then(c => c.SkillLayout)
);
let SkillPage = dynamicPage(() => import('./pages/(skills)/skill').then(c => c.SkillPage));
let SkillProvidersPage = dynamicPage(() =>
  import('./pages/(skills)/skill/providers').then(c => c.SkillProvidersPage)
);
let SkillAgentsPage = dynamicPage(() =>
  import('./pages/(skills)/skill/agents').then(c => c.SkillAgentsPage)
);
let SkillAgentDocumentPage = dynamicPage(() =>
  import('./pages/(skills)/skill/agent').then(c => c.SkillAgentDocumentPage)
);
let SkillParticipantsPage = dynamicPage(() =>
  import('./pages/(skills)/skill/participants').then(c => c.SkillParticipantsPage)
);
let SkillGroupsForSkillPage = dynamicPage(() =>
  import('./pages/(skills)/skill/groups').then(c => c.SkillGroupsPage)
);
let SkillVersionsPage = dynamicPage(() =>
  import('./pages/(skills)/skill/versions').then(c => c.SkillVersionsPage)
);
let SkillMergeRequestsPage = dynamicPage(() =>
  import('./pages/(skills)/skill/merge-requests').then(c => c.SkillMergeRequestsPage)
);
let SkillMergeRequestPage = dynamicPage(() =>
  import('./pages/(skills)/skill/merge-request').then(c => c.SkillMergeRequestPage)
);
let SkillSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill/settings').then(c => c.SkillSettingsPage)
);
let SkillTemplateLayout = dynamicPage(() =>
  import('./pages/(skills)/skill-template/_layout').then(c => c.SkillTemplateLayout)
);
let SkillTemplatePage = dynamicPage(() =>
  import('./pages/(skills)/skill-template').then(c => c.SkillTemplatePage)
);
let SkillTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-template/settings').then(c => c.SkillTemplateSettingsPage)
);
let SkillGroupLayout = dynamicPage(() =>
  import('./pages/(skills)/skill-group/_layout').then(c => c.SkillGroupLayout)
);
let SkillGroupPage = dynamicPage(() =>
  import('./pages/(skills)/skill-group').then(c => c.SkillGroupPage)
);
let SkillGroupSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-group/settings').then(c => c.SkillGroupSettingsPage)
);
let SkillMarketplaceLayout = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/_layout').then(c => c.SkillMarketplaceLayout)
);
let SkillMarketplacePage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace').then(c => c.SkillMarketplacePage)
);
let SkillMarketplaceEditorPage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/editor').then(c => c.SkillMarketplaceEditorPage)
);
let SkillMarketplaceSyncsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/syncs').then(c => c.SkillMarketplaceSyncsPage)
);
let SkillMarketplaceSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/settings').then(
    c => c.SkillMarketplaceSettingsPage
  )
);
let IntegrationLayout = dynamicPage(() =>
  import('./pages/(integrations)/integration/_layout').then(c => c.IntegrationLayout)
);
let IntegrationOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/integration').then(c => c.IntegrationOverviewPage)
);
let IntegrationInstancesPage = dynamicPage(() =>
  import('./pages/(integrations)/integration/instances').then(c => c.IntegrationInstancesPage)
);
let IntegrationSettingsPage = dynamicPage(() =>
  import('./pages/(integrations)/integration/settings').then(c => c.IntegrationSettingsPage)
);
let IntegrationInstanceLayout = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance/_layout').then(
    c => c.IntegrationInstanceLayout
  )
);
let IntegrationInstanceOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance').then(
    c => c.IntegrationInstanceOverviewPage
  )
);
let IntegrationInstanceSettingsPage = dynamicPage(() =>
  import('./pages/(integrations)/integration-instance/settings').then(
    c => c.IntegrationInstanceSettingsPage
  )
);

let SetupProviderPage = dynamicPage(() =>
  import('./pages/setup-provider').then(c => c.SetupProviderPage)
);

let MagicMcpListLayout = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/_layout').then(c => c.MagicMcpListLayout)
);
let MagicMcpServerPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/servers').then(c => c.MagicMcpServerPage)
);
let MagicMcpServerLayout = dynamicPage(() =>
  import('./pages/magic-mcp/server/_layout').then(c => c.MagicMcpServerLayout)
);
let MagicMcpServerOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/overview').then(c => c.MagicMcpServerOverviewPage)
);
let MagicMcpServerProvidersPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/providers').then(c => c.MagicMcpServerProvidersPage)
);
let MagicMcpServerTokensPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/tokens').then(c => c.MagicMcpServerTokensPage)
);
let MagicMcpServerConfigPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/config').then(c => c.MagicMcpServerConfigPage)
);
let MagicMcpServerSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/sessions').then(c => c.MagicMcpServerSessionsPage)
);

let CustomProviderCodePage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/code').then(c => c.CustomProviderCodePage)
);
let CustomProviderOverviewPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider').then(c => c.CustomProviderOverviewPage)
);
let CustomProviderVersionsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/versions').then(
    c => c.CustomProviderVersionsPage
  )
);
let CustomProviderSettingsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/settings').then(
    c => c.CustomProviderSettingsPage
  )
);
let CustomProviderLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/_layout').then(
    c => c.CustomProviderLayout
  )
);
let CustomProviderCommitsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/commits').then(
    c => c.CustomProviderCommitsPage
  )
);
let CustomProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/deployments').then(
    c => c.CustomProviderProviderDeploymentsPage
  )
);
let CustomProviderListingPage = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/listing').then(
    c => c.CustomProviderListingPage
  )
);
let CustomProvidersListLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/_layout').then(c => c.CustomProvidersListLayout)
);
let ExternalServersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/external-providers').then(
    c => c.ExternalProvidersPage
  )
);
let ManagedServersPage = dynamicPage(() =>
  import('./pages/(custom-providers)/(list)/custom-providers').then(
    c => c.CustomerProvidersPage
  )
);
let CallbacksListLayout = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/_layout').then(c => c.CallbacksListLayout)
);
let CallbacksPage = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/index').then(c => c.CallbacksPage)
);
let CallbackLayout = dynamicPage(() =>
  import('./pages/(callbacks)/_layout').then(c => c.CallbackLayout)
);
let CallbackOverviewPage = dynamicPage(() =>
  import('./pages/(callbacks)/overview').then(c => c.CallbackOverviewPage)
);
let CallbackEventsPage = dynamicPage(() =>
  import('./pages/(callbacks)/events').then(c => c.CallbackEventsPage)
);
let CallbackLogsPage = dynamicPage(() =>
  import('./pages/(callbacks)/logs').then(c => c.CallbackLogsPage)
);
let CallbackTriggersPage = dynamicPage(() =>
  import('./pages/(callbacks)/triggers').then(c => c.CallbackTriggersPage)
);
let CallbackDestinationsPage = dynamicPage(() =>
  import('./pages/(callbacks)/destinations').then(c => c.CallbackDestinationsPage)
);
let SessionLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.SessionLogsListLayout)
);
let AuthLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.AuthLogsListLayout)
);
let ServerErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-errors').then(c => c.ProviderErrorsPage)
);
let SessionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/sessions').then(c => c.SessionsPage)
);
let SessionConnectionsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/connections').then(c => c.SessionConnectionsPage)
);
let ToolCallsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/tool-calls').then(c => c.ToolCallsPage)
);
let ServerErrorPage = dynamicPage(() =>
  import('./pages/(logs)/provider-error').then(c => c.ProviderErrorPage)
);
let ServerErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-error/_layout').then(c => c.ProviderErrorLayout)
);
let ProviderAuthErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-auth-errors').then(c => c.ProviderAuthErrorsPage)
);
let ProviderAuthEventsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-auth-events').then(c => c.ProviderAuthEventsPage)
);
let ProviderAuthErrorPage = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-error').then(c => c.ProviderAuthErrorPage)
);
let ProviderAuthErrorLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-error/_layout').then(c => c.ProviderAuthErrorLayout)
);
let ProviderAuthEventPage = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-event').then(c => c.ProviderAuthEventPage)
);
let ProviderAuthEventLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-auth-event/_layout').then(c => c.ProviderAuthEventLayout)
);
let ProjectPageLayout = dynamicPage(() =>
  import('./pages/_layout').then(c => c.ProjectPageLayout)
);
let DeployPage = dynamicPage(() =>
  import('./pages/setup-provider').then(c => c.SetupProviderPage)
);
let ExplorerPage = dynamicPage(() => import('./pages/explorer').then(c => c.ExplorerPage));
let AssistantPage = dynamicPage(() => import('./pages/assistant').then(c => c.AssistantPage));
let AssistantPageLayout = dynamicPage(() =>
  import('./pages/assistant/_layout').then(c => c.AssistantPageLayout)
);
let AssistantConversationPage = dynamicPage(() =>
  import('./pages/assistant/conversation').then(c => c.AssistantConversationPage)
);
let AssistantSkillsPage = dynamicPage(() =>
  import('./pages/assistant/skills').then(c => c.AssistantSkillsPage)
);
let AssistantContextPage = dynamicPage(() =>
  import('./pages/assistant/context').then(c => c.AssistantContextPage)
);
let DocumentPage = dynamicPage(() => import('./pages/doc').then(c => c.DocumentPage));
let SkillItemDocumentPage = dynamicPage(() =>
  import('./pages/skill-item-document').then(c => c.SkillItemDocumentPage)
);
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};
let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  return <Outlet />;
};

export let productLogsSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            children: [
              {
                path: '',
                element: <SessionLogsListLayout />,

                children: [
                  {
                    path: 'sessions',
                    element: <SessionsPage />
                  },
                  {
                    path: 'session-connections',
                    element: <SessionConnectionsPage />
                  },
                  {
                    path: 'tool-calls',
                    element: <ToolCallsPage />
                  },
                  {
                    path: 'provider-errors',
                    element: <ServerErrorsPage />
                  }
                ]
              },
              {
                path: '',
                element: <AuthLogsListLayout />,

                children: [
                  {
                    path: 'provider-auth-events',
                    element: <ProviderAuthEventsPage />
                  },
                  {
                    path: 'provider-auth-errors',
                    element: <ProviderAuthErrorsPage />
                  }
                ]
              }
            ]
          },

          {
            path: 'provider-sessions',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ProviderSessionsPage />
              }
            ]
          },
          {
            path: 'session-connections',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <SessionConnectionsPage />
              }
            ]
          },
          {
            path: 'tool-calls',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ToolCallsPage />
              }
            ]
          },
          {
            path: 'provider-errors',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ServerErrorsPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productTraceDetailSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'provider-error/:providerErrorId',
            element: <ServerErrorLayout />,

            children: [
              {
                path: '',
                element: <ServerErrorPage />
              }
            ]
          },

          {
            path: 'provider-auth-error/:providerAuthErrorId',
            element: <ProviderAuthErrorLayout />,

            children: [
              {
                path: '',
                element: <ProviderAuthErrorPage />
              }
            ]
          },

          {
            path: 'provider-auth-event/:providerAuthEventId',
            element: <ProviderAuthEventLayout />,

            children: [
              {
                path: '',
                element: <ProviderAuthEventPage />
              }
            ]
          },

          {
            path: 'provider-session/:sessionId',
            element: <ProviderSessionLayout />,
            children: [
              {
                path: '',
                element: <ProviderSessionLogsPage />
              },
              {
                path: 'providers',
                element: <ProviderSessionProvidersPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productExplorerSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <Outlet />,

        children: [
          {
            path: 'explorer',
            element: <ExplorerPage />
          }
        ]
      }
    ]
  }
]);

export let productDocumentSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        path: 'doc/:id',
        element: <DocumentPage />
      }
    ]
  }
]);

export let productHomeSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: '',
            element: <InstanceRootRedirectPage />
          },
          {
            path: 'home',
            element: <ProjectHomePage />
          }
        ]
      }
    ]
  }
]);

export let productSkillsSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'skills',
            element: <SkillsPage />
          },
          {
            path: 'skills/templates',
            element: <SkillTemplatesPage />
          },
          {
            path: 'skills/groups',
            element: <SkillGroupsPage />
          },
          {
            path: 'skills/marketplaces',
            element: <SkillMarketplacesPage />
          },

          {
            path: 'skill/:skillId',
            element: <SkillLayout />,
            children: [
              {
                path: '',
                element: <SkillPage />
              },
              {
                path: 'item/:itemId',
                element: <SkillItemDocumentPage />
              },
              {
                path: 'providers',
                element: <SkillProvidersPage />
              },
              {
                path: 'agents',
                element: <SkillAgentsPage />
              },
              {
                path: 'agent/:documentId',
                element: <SkillAgentDocumentPage />
              },
              {
                path: 'participants',
                element: <SkillParticipantsPage />
              },
              {
                path: 'groups',
                element: <SkillGroupsForSkillPage />
              },
              {
                path: 'versions',
                element: <SkillVersionsPage />
              },
              {
                path: 'merge-requests',
                element: <SkillMergeRequestsPage />
              },
              {
                path: 'merge-requests/:mergeRequestId/:mergeRequestTab?',
                element: <SkillMergeRequestPage />
              },
              {
                path: 'settings',
                element: <SkillSettingsPage />
              }
            ]
          },
          {
            path: 'skill-template/:skillTemplateId',
            element: <SkillTemplateLayout />,
            children: [
              {
                path: '',
                element: <SkillTemplatePage />
              },
              {
                path: 'settings',
                element: <SkillTemplateSettingsPage />
              }
            ]
          },
          {
            path: 'skill-group/:skillGroupId',
            element: <SkillGroupLayout />,
            children: [
              {
                path: '',
                element: <SkillGroupPage />
              },
              {
                path: 'settings',
                element: <SkillGroupSettingsPage />
              }
            ]
          },
          {
            path: 'skill-marketplace/:skillMarketplaceId',
            element: <SkillMarketplaceLayout />,
            children: [
              {
                path: '',
                element: <SkillMarketplacePage />
              },
              {
                path: 'editor',
                element: <SkillMarketplaceEditorPage />
              },
              {
                path: 'syncs',
                element: <SkillMarketplaceSyncsPage />
              },
              {
                path: 'settings',
                element: <SkillMarketplaceSettingsPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productIntegrationsSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'integrations/overview',
            element: <IntegrationsOverviewPage />
          },

          {
            path: 'integrations',
            element: <IntegrationsListLayout />,
            children: [
              {
                path: '',
                element: <IntegrationsPage />
              }
            ]
          },

          {
            path: 'providers',
            element: <ProvidersHubLayout />,
            children: [
              {
                path: '',
                element: <ProvidersPage />
              }
            ]
          },

          {
            path: 'integration/:integrationId',
            element: <IntegrationLayout />,
            children: [
              {
                path: '',
                element: <IntegrationOverviewPage />
              },
              {
                path: 'instances',
                element: <IntegrationInstancesPage />
              },
              {
                path: 'settings',
                element: <IntegrationSettingsPage />
              }
            ]
          },

          {
            path: 'integration-instance/:integrationInstanceId',
            element: <IntegrationInstanceLayout />,
            children: [
              {
                path: '',
                element: <IntegrationInstanceOverviewPage />
              },
              {
                path: 'settings',
                element: <IntegrationInstanceSettingsPage />
              }
            ]
          },

          {
            path: 'provider/:providerId',
            element: <ProviderLayout />,
            children: [
              {
                path: '',
                element: <ProviderOverviewPage />
              },
              {
                path: 'capabilities',
                element: <ProviderCapabilitiesLayout />,
                children: [
                  {
                    path: '',
                    element: <ProviderToolsPage />
                  },
                  {
                    path: 'triggers',
                    element: <ProviderTriggersPage />
                  },
                  {
                    path: 'auth-methods',
                    element: <ProviderAuthMethodsPage />
                  }
                ]
              },
              {
                path: 'versions',
                element: <ProviderVersionsPage />
              }
            ]
          },

          {
            path: 'magic-mcp',
            children: [
              {
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpListLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: 'servers',
                    element: <MagicMcpServerPage />
                  }
                ]
              },
              {
                path: 'server/:magicMcpServerId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpServerLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpServerOverviewPage />
                  },
                  {
                    path: 'providers',
                    element: <MagicMcpServerProvidersPage />
                  },
                  {
                    path: 'tokens',
                    element: <MagicMcpServerTokensPage />
                  },
                  {
                    path: 'config',
                    element: <MagicMcpServerConfigPage />
                  },
                  {
                    path: 'connections',
                    element: <MagicMcpServerSessionsPage />
                  }
                ]
              }
            ]
          },

          {
            path: 'callback/:callbackId',
            element: <CallbackLayout />,
            children: [
              {
                path: '',
                element: <CallbackOverviewPage />
              },
              {
                path: 'events',
                element: <CallbackEventsPage />
              },
              {
                path: 'logs',
                element: <CallbackLogsPage />
              },
              {
                path: 'triggers',
                element: <CallbackTriggersPage />
              },
              {
                path: 'destinations',
                element: <CallbackDestinationsPage />
              }
            ]
          },

          {
            path: 'callbacks',
            element: <CallbacksListLayout />,
            children: [
              {
                path: '',
                element: <CallbacksPage />
              }
            ]
          },

          {
            path: '',
            element: <CustomProvidersListLayout />,

            children: [
              {
                path: 'external-providers',
                element: <ExternalServersPage />
              },
              {
                path: 'custom-providers',
                element: <ManagedServersPage />
              }
            ]
          },

          {
            path: 'custom-provider/:customProviderId',
            element: <CustomProviderLayout />,

            children: [
              {
                path: '',
                element: <CustomProviderOverviewPage />
              },
              {
                path: 'versions',
                element: <CustomProviderVersionsPage />
              },
              {
                path: 'code',
                element: <CustomProviderCodePage />
              },
              {
                path: 'commits',
                element: <CustomProviderCommitsPage />
              },
              {
                path: 'deployments',
                element: <CustomProviderDeploymentsPage />
              },
              {
                path: 'settings',
                element: <CustomProviderSettingsPage />
              },
              {
                path: 'listing',
                element: <CustomProviderListingPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productAssistantSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'assistant',
            element: (
              <FlaggedPage flag="assistant-enabled">
                <Outlet />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <AssistantPage />
              },
              {
                path: 'conversation/:assistantConversationId',
                element: <AssistantConversationPage />
              },
              {
                element: <AssistantPageLayout />,
                children: [
                  {
                    path: 'skills',
                    element: <AssistantSkillsPage />
                  },
                  {
                    path: 'context',
                    element: <AssistantContextPage />
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let deploySlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId/deploy',
    element: <DeployPage />
  },
  {
    path: ':organizationId/:projectId/:instanceId/setup-provider',
    element: <SetupProviderPage />
  }
]);

export let productSlice = createSlice([
  {
    path: ':organizationId/:projectId/:instanceId',

    element: <ProjectPageLayout />,

    children: [
      ...productLogsSlice.routes,
      ...productTraceDetailSlice.routes,
      ...productExplorerSlice.routes,
      ...productDocumentSlice.routes,
      ...productIntegrationsSlice.routes,
      ...productSkillsSlice.routes,
      ...productAssistantSlice.routes,
      ...productHomeSlice.routes
    ]
  },
  {
    children: deploySlice.routes
  }
]);
