import { renderWithLoader } from '@metorial/data-hooks';
import { dynamicPage } from '@metorial/dynamic-component';
import { createSlice } from '@metorial/microfrontend';
import { NotFound } from '@metorial/pages';
import { lastInstanceIdStore, useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { Error } from '@metorial/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Upgrade } from '../../components/emptyState';
import { ProjectHomePage } from './pages';
import { NetworkManagedPage } from './pages/(network)/_gate';
import { InstanceLayout } from './pages/_instanceLayout';

// Provider API pages
let ProvidersHubLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProvidersHubLayout)
);
let ProvidersPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/providers').then(c => c.ProvidersPage)
);
let ProviderDeploymentsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderDeploymentsListLayout)
);
let ProviderAuthCredentialsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderAuthCredentialsListLayout)
);
let ProviderDeploymentsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-deployments').then(
    c => c.ProviderDeploymentsPage
  )
);
let ProviderAuthConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-auth-configs').then(
    c => c.ProviderAuthConfigsOverviewPage
  )
);
let ProviderAuthCredentialsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-auth-credentials').then(
    c => c.ProviderAuthCredentialsOverviewPage
  )
);
let ProviderConfigsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-configs').then(
    c => c.ProviderConfigsOverviewPage
  )
);
let ProviderConfigVaultsOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-config-vaults').then(
    c => c.ProviderConfigVaultsOverviewPage
  )
);
let ProviderSessionsListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.ProviderSessionsListLayout)
);
let ProviderSessionsPage = dynamicPage(() =>
  import('./pages/(deployments)/(list)/provider-sessions').then(c => c.ProviderSessionsPage)
);
let SessionTemplatesListLayout = dynamicPage(() =>
  import('./pages/(deployments)/(list)/_layout').then(c => c.SessionTemplatesListLayout)
);
let SessionTemplatesPage = dynamicPage(() =>
  import('./pages/(session)/(list)/session-templates').then(c => c.SessionTemplatesPage)
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
let ProviderDeploymentLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/_layout').then(
    c => c.ProviderDeploymentLayout
  )
);
let ProviderDeploymentOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/index').then(
    c => c.ProviderDeploymentOverviewPage
  )
);
let ProviderDeploymentConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/configs').then(
    c => c.ProviderDeploymentConfigsPage
  )
);
let ProviderDeploymentAuthConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/auth-configs').then(
    c => c.ProviderDeploymentAuthConfigsPage
  )
);
let ProviderDeploymentSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/settings').then(
    c => c.ProviderDeploymentSettingsPage
  )
);
let ProviderDeploymentNetworkPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-deployment/network').then(
    c => c.ProviderDeploymentNetworkPage
  )
);
let SecurityOverviewPage = dynamicPage(() =>
  import('./pages/(network)/security').then(c => c.SecurityOverviewPage)
);
let NetworkListLayout = dynamicPage(() =>
  import('./pages/(network)/(list)/_layout').then(c => c.NetworkListLayout)
);
let NetworkEnclavesListLayout = dynamicPage(() =>
  import('./pages/(network)/(list)/_layout').then(c => c.NetworkEnclavesListLayout)
);
let NetworkOverviewPage = dynamicPage(() =>
  import('./pages/(network)/(list)/network').then(c => c.NetworkOverviewPage)
);
let NetworkFirewallsPage = dynamicPage(() =>
  import('./pages/(network)/(list)/firewalls').then(c => c.NetworkFirewallsPage)
);
let NetworkEnclavesPage = dynamicPage(() =>
  import('./pages/(network)/(list)/enclaves').then(c => c.NetworkEnclavesPage)
);
let NetworkFirewallPageLayout = dynamicPage(() =>
  import('./pages/(network)/firewall/_layout').then(c => c.NetworkFirewallPageLayout)
);
let NetworkFirewallPage = dynamicPage(() =>
  import('./pages/(network)/firewall/index').then(c => c.NetworkFirewallPage)
);
let NetworkFirewallSettingsPage = dynamicPage(() =>
  import('./pages/(network)/firewall/settings').then(c => c.NetworkFirewallSettingsPage)
);
let NetworkSettingsPage = dynamicPage(() =>
  import('./pages/(network)/(list)/settings').then(c => c.NetworkSettingsPage)
);
let ProviderConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/_layout').then(c => c.ProviderConfigLayout)
);
let ProviderConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/index').then(c => c.ProviderConfigOverviewPage)
);
let ProviderConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config/settings').then(
    c => c.ProviderConfigSettingsPage
  )
);
let ProviderConfigVaultLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/_layout').then(
    c => c.ProviderConfigVaultLayout
  )
);
let ProviderConfigVaultOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/index').then(
    c => c.ProviderConfigVaultOverviewPage
  )
);
let ProviderConfigVaultConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/configs').then(
    c => c.ProviderConfigVaultConfigsPage
  )
);
let ProviderConfigVaultSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-config-vault/settings').then(
    c => c.ProviderConfigVaultSettingsPage
  )
);
let ProviderAuthCredentialLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/_layout').then(
    c => c.ProviderAuthCredentialLayout
  )
);
let ProviderAuthCredentialOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/index').then(
    c => c.ProviderAuthCredentialOverviewPage
  )
);
let ProviderAuthCredentialAuthConfigsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/auth-configs').then(
    c => c.ProviderAuthCredentialAuthConfigsPage
  )
);
let ProviderAuthCredentialSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-credential/settings').then(
    c => c.ProviderAuthCredentialSettingsPage
  )
);
let ProviderAuthConfigLayout = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/_layout').then(
    c => c.ProviderAuthConfigLayout
  )
);
let ProviderAuthConfigOverviewPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/index').then(
    c => c.ProviderAuthConfigOverviewPage
  )
);
let ProviderAuthConfigSettingsPage = dynamicPage(() =>
  import('./pages/(deployments)/provider-auth-configs/settings').then(
    c => c.ProviderAuthConfigSettingsPage
  )
);
let ProviderSessionLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-session/_layout').then(c => c.ProviderSessionLayout)
);
let ProviderSessionProvidersPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session/providers').then(c => c.ProviderSessionProvidersPage)
);
let ProviderSessionRunsPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session/runs').then(c => c.ProviderSessionRunsPage)
);
let ProviderSessionLogsPage = dynamicPage(() =>
  import('./pages/(logs)/provider-session').then(c => c.ProviderSessionLogsPage)
);
let SessionTemplateLayout = dynamicPage(() =>
  import('./pages/(session)/session-template/_layout').then(c => c.SessionTemplateLayout)
);
let SessionTemplateOverviewPage = dynamicPage(() =>
  import('./pages/(session)/session-template').then(c => c.SessionTemplateOverviewPage)
);
let SessionTemplateSettingsPage = dynamicPage(() =>
  import('./pages/(session)/session-template/settings').then(
    c => c.SessionTemplateSettingsPage
  )
);

let IntegrationsListLayout = dynamicPage(() =>
  import('./pages/(integrations)/(list)/_layout').then(c => c.IntegrationsListLayout)
);
let IntegrationsPage = dynamicPage(() =>
  import('./pages/(integrations)/(list)/integrations').then(c => c.IntegrationsPage)
);
let SkillsListLayout = dynamicPage(() =>
  import('./pages/(skills)/(list)/_layout').then(c => c.SkillsListLayout)
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
let SkillPluginsPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/plugins').then(c => c.SkillPluginsPage)
);
let SkillConfigurationSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/(list)/settings').then(c => c.SkillConfigurationSettingsPage)
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
let SkillPluginLayout = dynamicPage(() =>
  import('./pages/(skills)/skill-plugin/_layout').then(c => c.SkillPluginLayout)
);
let SkillPluginPage = dynamicPage(() =>
  import('./pages/(skills)/skill-plugin').then(c => c.SkillPluginPage)
);
let SkillPluginEditorPage = dynamicPage(() =>
  import('./pages/(skills)/skill-plugin/editor').then(c => c.SkillPluginEditorPage)
);
let SkillPluginSyncsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-plugin/syncs').then(c => c.SkillPluginSyncsPage)
);
let SkillPluginSettingsPage = dynamicPage(() =>
  import('./pages/(skills)/skill-plugin/settings').then(c => c.SkillPluginSettingsPage)
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

let IdentityListLayout = dynamicPage(() =>
  import('./pages/(identity)/(list)/_layout').then(c => c.IdentityListLayout)
);
let AgentsListLayout = dynamicPage(() =>
  import('./pages/(identity)/(list)/_layout').then(c => c.AgentsListLayout)
);
let ConsumersPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/consumers').then(c => c.ConsumersPage)
);
let AgentsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/agents').then(c => c.AgentsPage)
);
let IdentityActorsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/actors').then(c => c.IdentityActorsPage)
);
let IdentitiesPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/identities').then(c => c.IdentitiesPage)
);
let IdentityDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/delegations').then(c => c.IdentityDelegationsPage)
);
let IdentityDelegationConfigsPage = dynamicPage(() =>
  import('./pages/(identity)/(list)/delegation-configs').then(
    c => c.IdentityDelegationConfigsPage
  )
);
let IdentityActorLayout = dynamicPage(() =>
  import('./pages/(identity)/actor/_layout').then(c => c.IdentityActorLayout)
);
let AgentLayout = dynamicPage(() =>
  import('./pages/(identity)/agent/_layout').then(c => c.AgentLayout)
);
let ConsumerLayout = dynamicPage(() =>
  import('./pages/(identity)/consumer/_layout').then(c => c.ConsumerLayout)
);
let ConsumerPage = dynamicPage(() =>
  import('./pages/(identity)/consumer').then(c => c.ConsumerPage)
);
let ConsumerOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/operations').then(c => c.ConsumerOperationsPage)
);
let ConsumerConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/connections').then(c => c.ConsumerConnectionsPage)
);
let ConsumerDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/delegations').then(c => c.ConsumerDelegationsPage)
);
let ConsumerSettingsPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/settings').then(c => c.ConsumerSettingsPage)
);
let ConsumerMagicMcpServersPage = dynamicPage(() =>
  import('./pages/(identity)/consumer/magic-mcp-servers').then(
    c => c.ConsumerMagicMcpServersPage
  )
);
let IdentityActorPage = dynamicPage(() =>
  import('./pages/(identity)/actor').then(c => c.IdentityActorPage)
);
let IdentityActorOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/operations').then(c => c.IdentityActorOperationsPage)
);
let IdentityActorConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/connections').then(c => c.IdentityActorConnectionsPage)
);
let IdentityActorDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/delegations').then(c => c.IdentityActorDelegationsPage)
);
let AgentPage = dynamicPage(() => import('./pages/(identity)/agent').then(c => c.AgentPage));
let AgentOperationsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/operations').then(c => c.AgentOperationsPage)
);
let AgentConnectionsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/connections').then(c => c.AgentConnectionsPage)
);
let AgentDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/agent/delegations').then(c => c.AgentDelegationsPage)
);
let IdentityActorSettingsPage = dynamicPage(() =>
  import('./pages/(identity)/actor/settings').then(c => c.IdentityActorSettingsPage)
);
let IdentityLayout = dynamicPage(() =>
  import('./pages/(identity)/identity/_layout').then(c => c.IdentityLayout)
);
let IdentityPage = dynamicPage(() =>
  import('./pages/(identity)/identity').then(c => c.IdentityPage)
);
let IdentityDetailsDelegationsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/delegations').then(c => c.IdentityDelegationsPage)
);
let IdentityDelegationRequestsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/delegationRequests').then(
    c => c.IdentityDelegationRequestsPage
  )
);
let IdentitySettingsPage = dynamicPage(() =>
  import('./pages/(identity)/identity/settings').then(c => c.IdentitySettingsPage)
);
let IdentityDelegationLayout = dynamicPage(() =>
  import('./pages/(identity)/delegation/_layout').then(c => c.IdentityDelegationLayout)
);
let IdentityDelegationPage = dynamicPage(() =>
  import('./pages/(identity)/delegation').then(c => c.IdentityDelegationPage)
);
let IdentityDelegationConfigLayout = dynamicPage(() =>
  import('./pages/(identity)/delegation-config/_layout').then(
    c => c.IdentityDelegationConfigLayout
  )
);
let IdentityDelegationConfigPage = dynamicPage(() =>
  import('./pages/(identity)/delegation-config').then(c => c.IdentityDelegationConfigPage)
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
let MagicMcpTokensPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/tokens').then(c => c.MagicMcpTokensPage)
);
let MagicMcpSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/sessions').then(c => c.MagicMcpSessionsPage)
);
let MagicMcpGroupsPage = dynamicPage(() =>
  import('./pages/magic-mcp/(list)/groups').then(c => c.MagicMcpGroupsPage)
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
  import('./pages/magic-mcp/(list)/tokens').then(c => c.MagicMcpTokensPage)
);
let MagicMcpServerConfigPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/config').then(c => c.MagicMcpServerConfigPage)
);
let MagicMcpServerSessionsPage = dynamicPage(() =>
  import('./pages/magic-mcp/server/sessions').then(c => c.MagicMcpServerSessionsPage)
);
let MagicMcpConnectionLayout = dynamicPage(() =>
  import('./pages/magic-mcp/connection/_layout').then(c => c.MagicMcpConnectionLayout)
);
let MagicMcpConnectionMessagesPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/messages').then(c => c.MagicMcpConnectionMessagesPage)
);
let MagicMcpConnectionProvidersPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/providers').then(c => c.MagicMcpConnectionProvidersPage)
);
let MagicMcpConnectionRunsPage = dynamicPage(() =>
  import('./pages/magic-mcp/connection/runs').then(c => c.MagicMcpConnectionRunsPage)
);
let MagicMcpGroupLayout = dynamicPage(() =>
  import('./pages/magic-mcp/group/_layout').then(c => c.MagicMcpGroupLayout)
);
let MagicMcpGroupOverviewPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/overview').then(c => c.MagicMcpGroupOverviewPage)
);
let MagicMcpGroupSettingsPage = dynamicPage(() =>
  import('./pages/magic-mcp/group/settings').then(c => c.MagicMcpGroupSettingsPage)
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
let LogsHomePage = dynamicPage(() => import('./pages/(logs)/home').then(c => c.LogsHomePage));
let SessionLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.SessionLogsListLayout)
);
let AuthLogsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(list)/_layout').then(c => c.AuthLogsListLayout)
);
let AlertsListLayout = dynamicPage(() =>
  import('./pages/(logs)/(alerts)/_layout').then(c => c.AlertsListLayout)
);
let AlertsPage = dynamicPage(() =>
  import('./pages/(logs)/(alerts)/alerts').then(c => c.AlertsPage)
);
let MonitorsPage = dynamicPage(() =>
  import('./pages/(logs)/(alerts)/monitors').then(c => c.MonitorsPage)
);
let ProtoGuardPage = dynamicPage(() =>
  import('./pages/(logs)/protoguard').then(c => c.ProtoGuardPage)
);
let ProtoGuardSettingsPage = dynamicPage(() =>
  import('./pages/(logs)/protoguard/settings').then(c => c.ProtoGuardSettingsPage)
);
let ProtoGuardLayout = dynamicPage(() =>
  import('./pages/(logs)/protoguard/_layout').then(c => c.ProtoGuardLayout)
);
let ServerErrorsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-errors').then(c => c.ProviderErrorsPage)
);
let ServerRunsPage = dynamicPage(() =>
  import('./pages/(logs)/(list)/provider-runs').then(c => c.ProviderRunsPage)
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
let ServerRunPage = dynamicPage(() =>
  import('./pages/(logs)/provider-run').then(c => c.ProviderRunPage)
);
let ServerRunLayout = dynamicPage(() =>
  import('./pages/(logs)/provider-run/_layout').then(c => c.ProviderRunLayout)
);
let AlertPage = dynamicPage(() => import('./pages/(logs)/alert').then(c => c.AlertPage));
let AlertAccessPage = dynamicPage(() =>
  import('./pages/(logs)/alert/access').then(c => c.AlertAccessPage)
);
let AlertLayout = dynamicPage(() =>
  import('./pages/(logs)/alert/_layout').then(c => c.AlertLayout)
);
let MonitorPage = dynamicPage(() => import('./pages/(logs)/monitor').then(c => c.MonitorPage));
let MonitorLayout = dynamicPage(() =>
  import('./pages/(logs)/monitor/_layout').then(c => c.MonitorLayout)
);
let ProtoGuardFilterSettingsPage = dynamicPage(() =>
  import('./pages/(logs)/protoguard/filter').then(c => c.ProtoGuardFilterSettingsPage)
);
let ProtoGuardFilterEventsPage = dynamicPage(() =>
  import('./pages/(logs)/protoguard/filter/events').then(c => c.ProtoGuardFilterEventsPage)
);
let ProtoGuardFilterLayout = dynamicPage(() =>
  import('./pages/(logs)/protoguard/filter/_layout').then(c => c.ProtoGuardFilterLayout)
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
let ProjectDeveloperPage = dynamicPage(() =>
  import('./pages/developer').then(c => c.ProjectDeveloperPage)
);
let ProjectDeveloperPageLayout = dynamicPage(() =>
  import('./pages/developer/_layout').then(c => c.ProjectDeveloperPageLayout)
);
let ProjectDeveloperAPIPage = dynamicPage(() =>
  import('./pages/developer/api').then(c => c.ProjectDeveloperAPIPage)
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
let InfrastructureOverviewPage = dynamicPage(() =>
  import('./pages/(infrastructure)/overview').then(c => c.InfrastructureOverviewPage)
);
let FlaggedPage = ({ children, flag }: { children: React.ReactNode; flag: string }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) =>
    (flags.data.flags as any)[flag] ? children : <NotFound />
  );
};
let IdentityManagedPage = ({ children }: { children: React.ReactNode }) => {
  let flags = useDashboardFlags();

  return renderWithLoader({ flags })(({ flags }) => {
    if (!flags.data.flags['identity-management']) {
      return <Error>Identity management is not enabled for this instance.</Error>;
    }

    if (!flags.data.flags['paid-identity']) {
      return (
        <Upgrade
          title="Identity Management"
          description="Manage identity actors, identities, delegations, and delegation policies once this instance is upgraded."
        />
      );
    }

    return children;
  });
};
let ProductWrapper = () => {
  let instance = useCurrentInstance();

  useEffect(() => {
    if (!instance.data) return;
    lastInstanceIdStore.set(instance.data.id);
  }, [instance.data]);

  return <Outlet />;
};

export let productTraceSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'logs',
            element: <LogsHomePage />
          },

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
                    path: 'provider-runs',
                    element: <ServerRunsPage />
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
              },
              {
                path: '',
                element: <AlertsListLayout />,

                children: [
                  {
                    path: 'alerts',
                    element: <AlertsPage />
                  },
                  {
                    path: 'monitors',
                    element: <MonitorsPage />
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
            path: 'provider-runs',
            element: <ProviderSessionsListLayout />,
            children: [
              {
                path: '',
                element: <ServerRunsPage />
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
          },
          {
            path: 'alerts',
            element: <AlertsListLayout />,
            children: [
              {
                path: '',
                element: <AlertsPage />
              }
            ]
          },
          {
            path: 'monitors',
            element: <AlertsListLayout />,
            children: [
              {
                path: '',
                element: <MonitorsPage />
              }
            ]
          },
          {
            path: 'protoguard',
            element: <ProtoGuardLayout />,
            children: [
              {
                path: '',
                element: <ProtoGuardPage />
              },
              {
                path: 'settings',
                element: <ProtoGuardSettingsPage />
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
            path: 'provider-run/:providerRunId',
            element: <ServerRunLayout />,

            children: [
              {
                path: '',
                element: <ServerRunPage />
              }
            ]
          },

          {
            path: 'alert/:monitorAlertId',
            element: <AlertLayout />,

            children: [
              {
                path: '',
                element: <AlertPage />
              },
              {
                path: 'access',
                element: <AlertAccessPage />
              }
            ]
          },

          {
            path: 'monitor/:monitorId',
            element: <MonitorLayout />,

            children: [
              {
                path: '',
                element: <MonitorPage />
              }
            ]
          },

          {
            path: 'protoguard/filter/:filterId',
            element: <ProtoGuardFilterLayout />,

            children: [
              {
                path: '',
                element: <ProtoGuardFilterSettingsPage />
              },
              {
                path: 'events',
                element: <ProtoGuardFilterEventsPage />
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
              },
              {
                path: 'runs',
                element: <ProviderSessionRunsPage />
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

export let productIdentitySlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'agents',
            element: <AgentsListLayout />,
            children: [
              {
                path: '',
                element: <AgentsPage />
              }
            ]
          },
          {
            element: <IdentityListLayout />,
            children: [
              {
                path: 'actors',
                element: <IdentityActorsPage />
              },
              {
                path: 'identities',
                element: <IdentitiesPage />
              },

              {
                path: 'identity',
                children: [
                  {
                    path: 'delegations',
                    element: <IdentityDelegationsPage />
                  },
                  {
                    path: 'delegation-configs',
                    element: <IdentityDelegationConfigsPage />
                  }
                ]
              }
            ]
          },
          {
            path: 'consumers',
            element: <ConsumersPage />
          },

          {
            path: 'agent/:agentId',
            element: (
              <IdentityManagedPage>
                <AgentLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <AgentPage />
              },
              {
                path: 'operations',
                element: <AgentOperationsPage />
              },
              {
                path: 'connections',
                element: <AgentConnectionsPage />
              },
              {
                path: 'delegations',
                element: <AgentDelegationsPage />
              }
            ]
          },

          {
            path: 'consumer/:consumerId',
            element: (
              <IdentityManagedPage>
                <ConsumerLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <ConsumerPage />
              },
              {
                path: 'operations',
                element: <ConsumerOperationsPage />
              },
              {
                path: 'connections',
                element: <ConsumerConnectionsPage />
              },
              {
                path: 'delegations',
                element: <ConsumerDelegationsPage />
              },
              {
                path: 'settings',
                element: <ConsumerSettingsPage />
              },
              {
                path: 'magic-mcp-servers',
                element: <ConsumerMagicMcpServersPage />
              }
            ]
          },

          {
            path: 'actor/:identityActorId',
            element: (
              <IdentityManagedPage>
                <IdentityActorLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityActorPage />
              },
              {
                path: 'operations',
                element: <IdentityActorOperationsPage />
              },
              {
                path: 'connections',
                element: <IdentityActorConnectionsPage />
              },
              {
                path: 'delegations',
                element: <IdentityActorDelegationsPage />
              },
              {
                path: 'settings',
                element: <IdentityActorSettingsPage />
              }
            ]
          },

          {
            path: 'identity/:identityId',
            element: (
              <IdentityManagedPage>
                <IdentityLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityPage />
              },
              {
                path: 'delegations',
                element: <IdentityDetailsDelegationsPage />
              },
              {
                path: 'delegation-requests',
                element: <IdentityDelegationRequestsPage />
              },
              {
                path: 'settings',
                element: <IdentitySettingsPage />
              }
            ]
          },
          {
            path: 'identity/delegation/:identityDelegationId',
            element: (
              <IdentityManagedPage>
                <IdentityDelegationLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityDelegationPage />
              }
            ]
          },
          {
            path: 'identity/delegation-config/:identityDelegationConfigId',
            element: (
              <IdentityManagedPage>
                <IdentityDelegationConfigLayout />
              </IdentityManagedPage>
            ),
            children: [
              {
                path: '',
                element: <IdentityDelegationConfigPage />
              }
            ]
          }
        ]
      }
    ]
  }
]);

export let productInfrastructureSlice = createSlice([
  {
    element: <ProductWrapper />,

    children: [
      {
        element: <InstanceLayout />,

        children: [
          {
            path: 'infra',
            element: <InfrastructureOverviewPage />
          },

          {
            path: 'configurations',
            element: <ProviderDeploymentsListLayout />,
            children: [
              {
                path: '',
                element: <ProviderDeploymentsPage />
              },
              {
                path: 'configs',
                element: <ProviderConfigsOverviewPage />
              },
              {
                path: 'config-vaults',
                element: <ProviderConfigVaultsOverviewPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderAuthConfigsOverviewPage />
              }
            ]
          },
          {
            path: 'configurations/auth-credentials',
            element: <ProviderAuthCredentialsListLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthCredentialsOverviewPage />
              }
            ]
          },

          {
            path: 'security',
            element: <SecurityOverviewPage />
          },
          {
            path: 'network',
            element: <NetworkListLayout />,
            children: [
              {
                path: '',
                element: <NetworkOverviewPage />
              },
              {
                path: 'firewalls',
                element: <NetworkFirewallsPage />
              },
              {
                path: 'settings',
                element: <NetworkSettingsPage />
              }
            ]
          },
          {
            path: 'network/enclaves',
            element: <NetworkEnclavesListLayout />,
            children: [
              {
                path: '',
                element: <NetworkEnclavesPage />
              }
            ]
          },
          {
            path: 'network/firewall/:firewallId',
            element: <NetworkFirewallPageLayout />,
            children: [
              {
                path: '',
                element: <NetworkFirewallPage />
              },
              {
                path: 'settings',
                element: <NetworkFirewallSettingsPage />
              }
            ]
          },

          {
            path: 'configurations/:providerDeploymentId',
            element: <ProviderDeploymentLayout />,
            children: [
              {
                path: '',
                element: <ProviderDeploymentOverviewPage />
              },
              {
                path: 'configs',
                element: <ProviderDeploymentConfigsPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderDeploymentAuthConfigsPage />
              },
              {
                path: 'settings',
                element: <ProviderDeploymentSettingsPage />
              },
              {
                path: 'network',
                element: (
                  <NetworkManagedPage>
                    <ProviderDeploymentNetworkPage />
                  </NetworkManagedPage>
                )
              }
            ]
          },
          {
            path: 'provider-config-vault/:providerConfigVaultId',
            element: <ProviderConfigVaultLayout />,
            children: [
              {
                path: '',
                element: <ProviderConfigVaultOverviewPage />
              },
              {
                path: 'configs',
                element: <ProviderConfigVaultConfigsPage />
              },
              {
                path: 'settings',
                element: <ProviderConfigVaultSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/config/:providerConfigId',
            element: <ProviderConfigLayout />,
            children: [
              {
                path: '',
                element: <ProviderConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderConfigSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/auth-credential/:providerAuthCredentialsId',
            element: <ProviderAuthCredentialLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthCredentialOverviewPage />
              },
              {
                path: 'auth-configs',
                element: <ProviderAuthCredentialAuthConfigsPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthCredentialSettingsPage />
              }
            ]
          },
          {
            path: 'configurations/auth-config/:providerAuthConfigId',
            element: <ProviderAuthConfigLayout />,
            children: [
              {
                path: '',
                element: <ProviderAuthConfigOverviewPage />
              },
              {
                path: 'settings',
                element: <ProviderAuthConfigSettingsPage />
              }
            ]
          },

          {
            path: 'session-templates',
            element: <SessionTemplatesListLayout />,
            children: [
              {
                path: '',
                element: <SessionTemplatesPage />
              }
            ]
          },

          {
            path: 'session-template/:sessionTemplateId',
            element: <SessionTemplateLayout />,
            children: [
              {
                path: '',
                element: <SessionTemplateOverviewPage />
              },
              {
                path: 'settings',
                element: <SessionTemplateSettingsPage />
              }
            ]
          }
        ]
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
            element: <ProjectHomePage />
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
            path: 'skills',
            element: <SkillsListLayout />,
            children: [
              {
                path: '',
                element: <SkillsPage />
              },
              {
                path: 'templates',
                element: <SkillTemplatesPage />
              },
              {
                path: 'groups',
                element: <SkillGroupsPage />
              },
              {
                path: 'marketplaces',
                element: <SkillMarketplacesPage />
              },
              {
                path: 'plugins',
                element: <SkillPluginsPage />
              },
              {
                path: 'settings',
                element: <SkillConfigurationSettingsPage />
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
          },
          {
            path: 'skill-plugin/:skillPluginId',
            element: <SkillPluginLayout />,
            children: [
              {
                path: '',
                element: <SkillPluginPage />
              },
              {
                path: 'editor',
                element: <SkillPluginEditorPage />
              },
              {
                path: 'syncs',
                element: <SkillPluginSyncsPage />
              },
              {
                path: 'settings',
                element: <SkillPluginSettingsPage />
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
                  },
                  {
                    path: 'tokens',
                    element: <MagicMcpTokensPage />
                  },
                  {
                    path: 'connections',
                    element: <MagicMcpSessionsPage />
                  },
                  {
                    path: 'groups',
                    element: <MagicMcpGroupsPage />
                  }
                ]
              },
              {
                path: 'connection/:connectionId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpConnectionLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpConnectionMessagesPage />
                  },
                  {
                    path: 'providers',
                    element: <MagicMcpConnectionProvidersPage />
                  },
                  {
                    path: 'runs',
                    element: <MagicMcpConnectionRunsPage />
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
              },
              {
                path: 'group/:magicMcpGroupId',
                element: (
                  <FlaggedPage flag="magic-mcp-enabled">
                    <MagicMcpGroupLayout />
                  </FlaggedPage>
                ),
                children: [
                  {
                    path: '',
                    element: <MagicMcpGroupOverviewPage />
                  },
                  {
                    path: 'settings',
                    element: <MagicMcpGroupSettingsPage />
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
            path: 'developer',
            element: <ProjectDeveloperPageLayout />,

            children: [
              {
                path: '',
                element: <ProjectDeveloperPage />
              },
              {
                path: 'api',
                element: <ProjectDeveloperAPIPage />
              }
            ]
          },
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
      ...productTraceSlice.routes,
      ...productTraceDetailSlice.routes,
      ...productExplorerSlice.routes,
      ...productDocumentSlice.routes,
      ...productInfrastructureSlice.routes,
      ...productIdentitySlice.routes,
      ...productHomeSlice.routes
    ]
  },
  {
    children: deploySlice.routes
  }
]);
