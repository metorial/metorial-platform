import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ProjectHomePage } from './pages';
import { InstanceLayout } from './pages/_instanceLayout';
import { InstanceRootRedirectPage } from './pages/rootRedirect';

let IntegrationsOverviewPage = dynamicPage(() =>
  import('./pages/(integrations)/overview').then(c => c.IntegrationsOverviewPage)
);
let UsagePage = dynamicPage(() => import('./pages/usage').then(c => c.UsagePage));

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
let ProviderUsagePage = dynamicPage(() =>
  import('./pages/provider/usage').then(c => c.ProviderUsagePage)
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
let SkillGroupsForSkillPage = dynamicPage(() =>
  import('./pages/(skills)/skill/groups').then(c => c.SkillGroupsPage)
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
let SkillMarketplaceSettingsLayout = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/settings/_layout').then(
    c => c.SkillMarketplaceSettingsLayout
  )
);
let SkillMarketplaceSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/settings').then(
    c => c.SkillMarketplaceSettingsPage
  )
);
let SkillMarketplaceAccessPage = dynamicPage(() =>
  import('./pages/(skills)/skill-marketplace/settings/access').then(
    c => c.SkillMarketplaceAccessPage
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
let IntegrationUsagePage = dynamicPage(() =>
  import('./pages/(integrations)/integration/usage').then(c => c.IntegrationUsagePage)
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
let MagicMcpServerUsagePage = dynamicPage(() =>
  import('./pages/magic-mcp/server/usage').then(c => c.MagicMcpServerUsagePage)
);
let MagicMcpServerConfigPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/config').then(c => c.MagicMcpServerConfigPage)
);
let MagicMcpServerSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/sessions').then(c => c.MagicMcpServerSessionsPage)
);

let PublicMcpListLayout = dynamicPage(() =>
  import('./pages/public-mcp/(list)/_layout').then(c => c.PublicMcpListLayout)
);
let PublicMcpServersPage = dynamicPage(() =>
  import('./pages/public-mcp/(list)/servers').then(c => c.PublicMcpServersPage)
);
let PublicMcpServerLayout = dynamicPage(() =>
  import('./pages/public-mcp/server/_layout').then(c => c.PublicMcpServerLayout)
);
let PublicMcpServerOverviewPage = dynamicPage(() =>
  import('./pages/public-mcp/server/overview').then(c => c.PublicMcpServerOverviewPage)
);
let PublicMcpServerAccessPage = dynamicPage(() =>
  import('./pages/public-mcp/server/access').then(c => c.PublicMcpServerAccessPage)
);
let PublicMcpServerClientsPage = dynamicPage(() =>
  import('./pages/public-mcp/server/clients').then(c => c.PublicMcpServerClientsPage)
);
let PublicMcpServerSettingsPage = dynamicPage(() =>
  import('./pages/public-mcp/server/settings').then(c => c.PublicMcpServerSettingsPage)
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
let CustomProviderSettingsLayout = dynamicPage(() =>
  import('./pages/(custom-providers)/custom-provider/settings/_layout').then(
    c => c.CustomProviderSettingsLayout
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
let DocumentPage = dynamicPage(() => import('./pages/doc').then(c => c.DocumentPage));
let SkillItemDocumentPage = dynamicPage(() =>
  import('./pages/skill-item-document').then(c => c.SkillItemDocumentPage)
);
let IntegrationCallbacksPage = dynamicPage(() =>
  import('./pages/(integrations)/integration/callbacks').then(c => c.IntegrationCallbacksPage)
);
let WebhooksListLayout = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/_layout').then(c => c.WebhooksListLayout)
);
let CallbacksPage = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/callbacks').then(c => c.CallbacksPage)
);
let EventDestinationsPage = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/event-destinations').then(c => c.EventDestinationsPage)
);
let EventsPage = dynamicPage(() =>
  import('./pages/(callbacks)/(list)/events').then(c => c.EventsPage)
);
let WebhookRegistrationLayout = dynamicPage(() =>
  import('./pages/(callbacks)/webhook-registration/_layout').then(
    c => c.WebhookRegistrationLayout
  )
);
let WebhookRegistrationOverviewPage = dynamicPage(() =>
  import('./pages/(callbacks)/webhook-registration').then(
    c => c.WebhookRegistrationOverviewPage
  )
);
let WebhookRegistrationEventsPage = dynamicPage(() =>
  import('./pages/(callbacks)/webhook-registration/events').then(
    c => c.WebhookRegistrationEventsPage
  )
);
let WebhookRegistrationSettingsPage = dynamicPage(() =>
  import('./pages/(callbacks)/webhook-registration/settings').then(
    c => c.WebhookRegistrationSettingsPage
  )
);
let CallbackLayout = dynamicPage(() =>
  import('./pages/(callbacks)/callback/_layout').then(c => c.CallbackLayout)
);
let CallbackOverviewPage = dynamicPage(() =>
  import('./pages/(callbacks)/callback').then(c => c.CallbackOverviewPage)
);
let CallbackInstancesPage = dynamicPage(() =>
  import('./pages/(callbacks)/callback/instances').then(c => c.CallbackInstancesPage)
);
let CallbackSettingsPage = dynamicPage(() =>
  import('./pages/(callbacks)/callback/settings').then(c => c.CallbackSettingsPage)
);
let IncomingWebhookLayout = dynamicPage(() =>
  import('./pages/(callbacks)/incoming-webhook/_layout').then(c => c.IncomingWebhookLayout)
);
let IncomingWebhookPage = dynamicPage(() =>
  import('./pages/(callbacks)/incoming-webhook').then(c => c.IncomingWebhookPage)
);
let EventDestinationLayout = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination/_layout').then(c => c.EventDestinationLayout)
);
let EventDestinationPage = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination').then(c => c.EventDestinationPage)
);
let EventDestinationDeliveriesPage = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination/deliveries').then(
    c => c.EventDestinationDeliveriesPage
  )
);
let EventDestinationSettingsLayout = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination/settings/_layout').then(
    c => c.EventDestinationSettingsLayout
  )
);
let EventDestinationGeneralSettingsPage = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination/settings').then(
    c => c.EventDestinationGeneralSettingsPage
  )
);
let EventDestinationListenersSettingsPage = dynamicPage(() =>
  import('./pages/(callbacks)/event-destination/settings/listeners').then(
    c => c.EventDestinationListenersSettingsPage
  )
);
let EventLayout = dynamicPage(() =>
  import('./pages/(callbacks)/event/_layout').then(c => c.EventLayout)
);
let EventPage = dynamicPage(() => import('./pages/(callbacks)/event').then(c => c.EventPage));
let EventDeliveryLayout = dynamicPage(() =>
  import('./pages/(callbacks)/event-delivery/_layout').then(c => c.EventDeliveryLayout)
);
let EventDeliveryPage = dynamicPage(() =>
  import('./pages/(callbacks)/event-delivery').then(c => c.EventDeliveryPage)
);
// Chat pages
let ChatListLayout = dynamicPage(() =>
  import('./pages/(chat)/(list)/_layout').then(c => c.ChatListLayout)
);
let ChatConnectionsPage = dynamicPage(() =>
  import('./pages/(chat)/(list)/chat-connections').then(c => c.ChatConnectionsPage)
);
let ChatConnectionLayout = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/_layout').then(c => c.ChatConnectionLayout)
);
let ChatConnectionOverviewPage = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/index').then(c => c.ChatConnectionOverviewPage)
);
let ChatConnectionInstancesPage = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/instances').then(c => c.ChatConnectionInstancesPage)
);
let ChatConnectionChatsPage = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/chats').then(c => c.ChatConnectionChatsPage)
);
let ChatConnectionEventsPage = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/events').then(c => c.ChatConnectionEventsPage)
);
let ChatConnectionSettingsPage = dynamicPage(() =>
  import('./pages/(chat)/chat-connection/settings').then(c => c.ChatConnectionSettingsPage)
);
let ChatInstanceLayout = dynamicPage(() =>
  import('./pages/(chat)/chat-instance/_layout').then(c => c.ChatInstanceLayout)
);
let ChatInstanceOverviewPage = dynamicPage(() =>
  import('./pages/(chat)/chat-instance/index').then(c => c.ChatInstanceOverviewPage)
);
let ChatInstanceSettingsPage = dynamicPage(() =>
  import('./pages/(chat)/chat-instance/settings').then(c => c.ChatInstanceSettingsPage)
);
let ChatInstanceEventsPage = dynamicPage(() =>
  import('./pages/(chat)/chat-instance/events').then(c => c.ChatInstanceEventsPage)
);
let ChatLayout = dynamicPage(() =>
  import('./pages/(chat)/chat/_layout').then(c => c.ChatLayout)
);
let ChatOverviewPage = dynamicPage(() =>
  import('./pages/(chat)/chat/index').then(c => c.ChatOverviewPage)
);
let ChatEventsPage = dynamicPage(() =>
  import('./pages/(chat)/chat/events').then(c => c.ChatEventsPage)
);
let ChatEventLayout = dynamicPage(() =>
  import('./pages/(chat)/chat-event/_layout').then(c => c.ChatEventLayout)
);
let ChatEventPage = dynamicPage(() =>
  import('./pages/(chat)/chat-event/index').then(c => c.ChatEventPage)
);
let ChatExplorerPage = dynamicPage(() =>
  import('./pages/(chat)/chat-explorer/index').then(c => c.ChatExplorerPage)
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

let ConfigurationsAuthConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/_layout').then(
    c => c.ProviderAuthConfigLayout
  )
);
let ConfigurationsAuthConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/index').then(
    c => c.ProviderAuthConfigOverviewPage
  )
);
let ConfigurationsAuthConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConfigSettingsPage
  )
);
let ConfigurationsAuthConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-auth-configs').then(
    c => c.ProviderAuthConfigsOverviewPage
  )
);
let ConfigurationsConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/_layout').then(c => c.ProviderConfigLayout)
);
let ConfigurationsConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/index').then(c => c.ProviderConfigOverviewPage)
);
let ConfigurationsConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/settings').then(
    c => c.ProviderConfigSettingsPage
  )
);
let ConfigurationsConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-configs').then(
    c => c.ProviderConfigsOverviewPage
  )
);
let ConfigurationsDeploymentAuthConfigsPage = dynamicPage(() =>
  import('./pages/(developer)/deployment/auth-configs').then(
    c => c.ConfigurationsDeploymentAuthConfigsPage
  )
);
let ConfigurationsDeploymentConfigsPage = dynamicPage(() =>
  import('./pages/(developer)/deployment/configs').then(
    c => c.ConfigurationsDeploymentConfigsPage
  )
);
let ConfigurationsDeploymentLayout = dynamicPage(() =>
  import('./pages/(developer)/deployment/layout').then(c => c.ConfigurationsDeploymentLayout)
);
let ConfigurationsDeploymentNetworkPage = dynamicPage(() =>
  import('./pages/(developer)/deployment/network').then(
    c => c.ConfigurationsDeploymentNetworkPage
  )
);
let ConfigurationsDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(developer)/deployment').then(c => c.ConfigurationsDeploymentOverviewPage)
);
let ConfigurationsDeploymentSettingsPage = dynamicPage(() =>
  import('./pages/(developer)/deployment/settings').then(
    c => c.ConfigurationsDeploymentSettingsPage
  )
);
let ConfigurationsDeploymentsPage = dynamicPage(() =>
  import('./pages/(developer)/deployments').then(c => c.ConfigurationsDeploymentsPage)
);
let ConfigurationsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/providerDeploymentsListLayout').then(
    c => c.ProviderDeploymentsListLayout
  )
);
let DeveloperHomePage = dynamicPage(() =>
  import('./pages/(developer)/home').then(c => c.DeveloperHomePage)
);
let DeveloperApiKeysPage = dynamicPage(() =>
  import('./pages/(developer)/apiKeys').then(c => c.ProjectDeveloperApiKeysPage)
);
let DeveloperApiAccessPage = dynamicPage(() =>
  import('./pages/(developer)/apiAccess').then(c => c.ProjectDeveloperApiAccessPage)
);

let SandboxMachinesPage = dynamicPage(() =>
  import('./pages/(sandbox)/machines').then(c => c.SandboxMachinesPage)
);
let SandboxMachineLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/_layout').then(c => c.SandboxMachineLayout)
);
let SandboxMachineOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine').then(c => c.SandboxMachineOverviewPage)
);
let SandboxMachineTerminalPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/terminal').then(c => c.SandboxMachineTerminalPage)
);
let SandboxMachineFilesPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/files').then(c => c.SandboxMachineFilesPage)
);
let SandboxMachineLogsPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/logs').then(c => c.SandboxMachineLogsPage)
);
let SandboxMachineUsagePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/usage').then(c => c.SandboxMachineUsagePage)
);
let SandboxMachineActivityLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/activityLayout').then(c => c.SandboxMachineActivityLayout)
);

let SandboxMachineEventsRedirect = dynamicPage(() =>
  import('./pages/(sandbox)/machine/activityLayout').then(c => c.SandboxMachineEventsRedirect)
);

let SandboxMachineEventsPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/events').then(c => c.SandboxMachineEventsPage)
);
let SandboxMachineSettingsLayout = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/_layout').then(
    c => c.SandboxMachineSettingsLayout
  )
);
let SandboxMachineSettingsGeneralPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/general').then(
    c => c.SandboxMachineSettingsGeneralPage
  )
);
let SandboxMachineSettingsSizePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/size').then(c => c.SandboxMachineSettingsSizePage)
);
let SandboxMachineSettingsStoragePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/storage').then(
    c => c.SandboxMachineSettingsStoragePage
  )
);
let SandboxMachineSettingsRuntimePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/runtime').then(
    c => c.SandboxMachineSettingsRuntimePage
  )
);
let SandboxMachineSettingsLifecyclePage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/lifecycle').then(
    c => c.SandboxMachineSettingsLifecyclePage
  )
);
let SandboxMachineSettingsNetworkPage = dynamicPage(() =>
  import('./pages/(sandbox)/machine/settings/network').then(
    c => c.SandboxMachineSettingsNetworkPage
  )
);

let SandboxImagesPage = dynamicPage(() =>
  import('./pages/(sandbox)/images').then(c => c.SandboxImagesPage)
);
let SandboxImageLayout = dynamicPage(() =>
  import('./pages/(sandbox)/image/_layout').then(c => c.SandboxImageLayout)
);
let SandboxImageOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/image').then(c => c.SandboxImageOverviewPage)
);
let SandboxImageVersionsPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/versions').then(c => c.SandboxImageVersionsPage)
);
let SandboxImageVersionPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/version').then(c => c.SandboxImageVersionPage)
);
let SandboxImageSettingsPage = dynamicPage(() =>
  import('./pages/(sandbox)/image/settings').then(c => c.SandboxImageSettingsPage)
);

let SandboxDisksPage = dynamicPage(() =>
  import('./pages/(sandbox)/disks').then(c => c.SandboxDisksPage)
);
let SandboxDiskLayout = dynamicPage(() =>
  import('./pages/(sandbox)/disk/_layout').then(c => c.SandboxDiskLayout)
);
let SandboxDiskOverviewPage = dynamicPage(() =>
  import('./pages/(sandbox)/disk').then(c => c.SandboxDiskOverviewPage)
);
let SandboxDiskSettingsPage = dynamicPage(() =>
  import('./pages/(sandbox)/disk/settings').then(c => c.SandboxDiskSettingsPage)
);

let NetworkListLayout = dynamicPage(() =>
  import('./pages/(network)/(list)/_layout').then(c => c.NetworkListLayout)
);

let NetworkFirewallsPage = dynamicPage(() =>
  import('./pages/(network)/(list)/firewalls').then(c => c.NetworkFirewallsPage)
);

let NetworkSettingsPage = dynamicPage(() =>
  import('./pages/(network)/(list)/settings').then(c => c.NetworkSettingsPage)
);

let InternetGatewayRedirect = dynamicPage(() =>
  import('./pages/(network)/(list)/settings').then(c => c.InternetGatewayRedirect)
);

let NetworkFirewallPageLayout = dynamicPage(() =>
  import('./pages/(network)/firewall/_layout').then(c => c.NetworkFirewallPageLayout)
);

let NetworkFirewallPage = dynamicPage(() =>
  import('./pages/(network)/firewall').then(c => c.NetworkFirewallPage)
);

let NetworkFirewallSettingsPage = dynamicPage(() =>
  import('./pages/(network)/firewall/settings').then(c => c.NetworkFirewallSettingsPage)
);

export let productDeveloperSlice = createSlice([
  {
    element: <ProductWrapper />,
    children: [
      {
        element: <InstanceLayout />,
        children: [
          { path: 'developer', element: <DeveloperHomePage /> },
          { path: 'developer/api-keys', element: <DeveloperApiKeysPage /> },
          { path: 'developer/api', element: <DeveloperApiAccessPage /> },

          {
            element: <NetworkListLayout />,
            children: [
              { path: 'network/firewalls', element: <NetworkFirewallsPage /> },
              { path: 'network/internet-gateway', element: <NetworkSettingsPage /> }
            ]
          },
          { path: 'network/settings', element: <InternetGatewayRedirect /> },
          {
            path: 'network/firewall/:firewallId',
            element: <NetworkFirewallPageLayout />,
            children: [
              { path: '', element: <NetworkFirewallPage /> },
              { path: 'settings', element: <NetworkFirewallSettingsPage /> }
            ]
          },

          {
            path: 'configurations',
            element: <ConfigurationsDeploymentsPage />
          },
          {
            element: <ConfigurationsListLayout />,
            children: [
              {
                path: 'configurations/configs',
                element: <ConfigurationsConfigsPage />
              },
              {
                path: 'configurations/auth-configs',
                element: <ConfigurationsAuthConfigsPage />
              }
            ]
          },

          {
            path: 'configurations/config/:providerConfigId',
            element: <ConfigurationsConfigLayout />,
            children: [
              {
                path: '',
                element: <ConfigurationsConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ConfigurationsConfigSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/auth-config/:providerAuthConfigId',
            element: <ConfigurationsAuthConfigLayout />,
            children: [
              {
                path: '',
                element: <ConfigurationsAuthConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ConfigurationsAuthConfigSettingsPage />
              }
            ]
          },
          { path: 'configurations/config-vaults', element: <NotFound /> },
          { path: 'configurations/config-vault/*', element: <NotFound /> },
          {
            path: 'configurations/:providerDeploymentId',
            element: <ConfigurationsDeploymentLayout />,
            children: [
              {
                path: '',
                element: <ConfigurationsDeploymentOverviewPage />
              },
              {
                path: 'configs',
                element: <ConfigurationsDeploymentConfigsPage />
              },
              {
                path: 'auth-configs',
                element: <ConfigurationsDeploymentAuthConfigsPage />
              },
              {
                path: 'settings',
                element: <ConfigurationsDeploymentSettingsPage />
              },
              {
                path: 'network',
                element: <ConfigurationsDeploymentNetworkPage />
              }
            ]
          },

          { path: 'sandbox', element: <Navigate to="machines" replace /> },

          { path: 'sandbox/machines', element: <SandboxMachinesPage /> },
          {
            path: 'sandbox/machines/:machineId',
            element: <SandboxMachineLayout />,
            children: [
              { path: '', element: <SandboxMachineOverviewPage /> },
              { path: 'terminal', element: <SandboxMachineTerminalPage /> },
              { path: 'files', element: <SandboxMachineFilesPage /> },
              { path: 'events', element: <SandboxMachineEventsRedirect /> },
              { path: 'events/logs', element: <SandboxMachineEventsRedirect /> },
              { path: 'usage', element: <SandboxMachineUsagePage /> },
              {
                path: 'logs',
                element: <SandboxMachineActivityLayout />,
                children: [
                  { path: '', element: <SandboxMachineEventsPage /> },
                  { path: 'runtime', element: <SandboxMachineLogsPage /> }
                ]
              },
              {
                path: 'settings',
                element: <SandboxMachineSettingsLayout />,
                children: [
                  { path: '', element: <SandboxMachineSettingsGeneralPage /> },
                  { path: 'size', element: <SandboxMachineSettingsSizePage /> },
                  { path: 'storage', element: <SandboxMachineSettingsStoragePage /> },
                  { path: 'runtime', element: <SandboxMachineSettingsRuntimePage /> },
                  { path: 'lifecycle', element: <SandboxMachineSettingsLifecyclePage /> },
                  { path: 'network', element: <SandboxMachineSettingsNetworkPage /> }
                ]
              }
            ]
          },

          { path: 'sandbox/images', element: <SandboxImagesPage /> },
          {
            path: 'sandbox/images/:imageId',
            element: <SandboxImageLayout />,
            children: [
              { path: '', element: <SandboxImageOverviewPage /> },
              { path: 'versions', element: <SandboxImageVersionsPage /> },
              { path: 'versions/:versionId', element: <SandboxImageVersionPage /> },
              { path: 'settings', element: <SandboxImageSettingsPage /> }
            ]
          },

          { path: 'sandbox/disks', element: <SandboxDisksPage /> },
          {
            path: 'sandbox/disks/:diskId',
            element: <SandboxDiskLayout />,
            children: [
              { path: '', element: <SandboxDiskOverviewPage /> },
              { path: 'settings', element: <SandboxDiskSettingsPage /> }
            ]
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
                path: 'groups',
                element: <SkillGroupsForSkillPage />
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
                element: <SkillMarketplaceSettingsLayout />,
                children: [
                  {
                    path: '',
                    element: <SkillMarketplaceSettingsPage />
                  },
                  {
                    path: 'access',
                    element: <SkillMarketplaceAccessPage />
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
            path: 'integrations/usage',
            element: <UsagePage />
          },

          {
            path: 'integrations',
            element: <IntegrationsListLayout />,
            children: [
              {
                path: '',
                element: <IntegrationsPage />
              },
              {
                path: 'callbacks',
                element: (
                  <FlaggedPage flag="callbacks-enabled">
                    <CallbacksPage />
                  </FlaggedPage>
                )
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
                path: 'usage',
                element: <IntegrationUsagePage />
              },
              {
                path: 'callbacks',
                element: (
                  <FlaggedPage flag="callbacks-enabled">
                    <IntegrationCallbacksPage />
                  </FlaggedPage>
                )
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
              },
              {
                path: 'usage',
                element: <ProviderUsagePage />
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
                    path: 'usage',
                    element: <MagicMcpServerUsagePage />
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
            path: 'public-mcp',
            children: [
              {
                element: (
                  <FlaggedPage flag="public-mcp-servers-enabled">
                    <PublicMcpListLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: 'servers',
                    element: <PublicMcpServersPage />
                  }
                ]
              },
              {
                path: 'server/:publicMcpServerId',
                element: (
                  <FlaggedPage flag="public-mcp-servers-enabled">
                    <PublicMcpServerLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <PublicMcpServerOverviewPage />
                  },
                  {
                    path: 'access',
                    element: <PublicMcpServerAccessPage />
                  },
                  {
                    path: 'clients',
                    element: <PublicMcpServerClientsPage />
                  },
                  {
                    path: 'settings',
                    element: <PublicMcpServerSettingsPage />
                  }
                ]
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
                element: <CustomProviderSettingsLayout />,

                children: [
                  {
                    path: '',
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
    ]
  }
]);

export let productCallbacksSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'callback/:callbackId',
            element: (
              <FlaggedPage flag="callbacks-enabled">
                <CallbackLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <CallbackOverviewPage />
              },
              {
                path: 'instances',
                element: <CallbackInstancesPage />
              },
              {
                path: 'settings',
                element: <CallbackSettingsPage />
              }
            ]
          },

          {
            path: 'webhook-registration/:webhookRegistrationId',
            element: (
              <FlaggedPage flag="callbacks-enabled">
                <WebhookRegistrationLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <WebhookRegistrationOverviewPage />
              },
              {
                path: 'events',
                element: <WebhookRegistrationEventsPage />
              },
              {
                path: 'settings',
                element: <WebhookRegistrationSettingsPage />
              }
            ]
          },

          {
            path: 'incoming-webhook/:incomingWebhookId',
            element: (
              <FlaggedPage flag="callbacks-enabled">
                <IncomingWebhookLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <IncomingWebhookPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productWebhooksSlice = createSlice([
  {
    element: <ProductWrapper />,
    children: [
      {
        element: <InstanceLayout />,
        children: [
          {
            element: (
              <FlaggedPage flag="webhooks-enabled">
                <WebhooksListLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: 'event-destinations',
                element: <EventDestinationsPage />
              },
              {
                path: 'events',
                element: <EventsPage />
              }
            ]
          },
          {
            path: 'event-destination/:eventDestinationId',
            element: (
              <FlaggedPage flag="webhooks-enabled">
                <EventDestinationLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <EventDestinationPage />
              },
              {
                path: 'deliveries',
                element: <EventDestinationDeliveriesPage />
              },
              {
                path: 'settings',
                element: <EventDestinationSettingsLayout />,
                children: [
                  {
                    path: '',
                    element: <EventDestinationGeneralSettingsPage />
                  },
                  {
                    path: 'listeners',
                    element: <EventDestinationListenersSettingsPage />
                  }
                ]
              }
            ]
          },
          {
            path: 'event/:eventId',
            element: (
              <FlaggedPage flag="webhooks-enabled">
                <EventLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <EventPage />
              }
            ]
          },
          {
            path: 'event-delivery/:eventDeliveryId',
            element: (
              <FlaggedPage flag="webhooks-enabled">
                <EventDeliveryLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <EventDeliveryPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productChatSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        // The explorer fills the whole layout, so it skips the instance/details chrome.
        element: <Outlet />,

        children: [
          {
            path: 'chat-explorer',
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatExplorerPage />
              </FlaggedPage>
            )
          }
        ]
      },

      {
        element: <InstanceLayout />,

        children: [
          {
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatListLayout />
              </FlaggedPage>
            ),

            children: [
              {
                path: 'chat-connections',
                element: <ChatConnectionsPage />
              }
            ]
          },

          {
            path: 'chat-connection/:chatConnectionId',
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatConnectionLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <ChatConnectionOverviewPage />
              },
              {
                path: 'instances',
                element: <ChatConnectionInstancesPage />
              },
              {
                path: 'chats',
                element: <ChatConnectionChatsPage />
              },
              {
                path: 'events',
                element: <ChatConnectionEventsPage />
              },
              {
                path: 'settings',
                element: <ChatConnectionSettingsPage />
              }
            ]
          },

          {
            path: 'chat-instance/:chatInstanceId',
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatInstanceLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <ChatInstanceOverviewPage />
              },
              {
                path: 'settings',
                element: <ChatInstanceSettingsPage />
              },
              {
                path: 'events',
                element: <ChatInstanceEventsPage />
              }
            ]
          },

          {
            path: 'chat/:chatId',
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <ChatOverviewPage />
              },
              {
                path: 'events',
                element: <ChatEventsPage />
              }
            ]
          },

          {
            path: 'chat-event/:chatEventId',
            element: (
              <FlaggedPage flag="chat-enabled">
                <ChatEventLayout />
              </FlaggedPage>
            ),
            children: [
              {
                path: '',
                element: <ChatEventPage />
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
      ...productCallbacksSlice.routes,
      ...productWebhooksSlice.routes,
      ...productChatSlice.routes,
      ...productSkillsSlice.routes,
      ...productHomeSlice.routes,
      ...productDeveloperSlice.routes
    ]
  },
  {
    children: deploySlice.routes
  }
]);
