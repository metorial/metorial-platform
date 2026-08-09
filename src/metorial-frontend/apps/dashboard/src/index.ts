import { dynamicPage } from '@metorial/dynamic-component';
import type { ProviderSetupSectionsProps } from './product/scenes/sessionTemplates/addProviderPanelFlow';

export {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from './product/lib/configSelection';

export {
  deploySlice,
  productAssistantSlice,
  productDocumentSlice,
  productExplorerSlice,
  productHomeSlice,
  productIdentitySlice,
  productIntegrationsSlice,
  productLogsSlice,
  productSkillsSlice,
  productTraceDetailSlice
} from './product';

export { ConsumersTable } from './product/scenes/consumer/table';
export { ApiKeysScene } from './product/scenes/apiKeys';
export { UsageScene } from './product/scenes/usage/usage';
export { AgentsTable } from './product/scenes/identity/agentsTable';
export {
  ConfigureSectionCard,
  showConfigureIntegrationProviderPanelFlow,
  type IntegrationProviderPanelSubmitInput
} from './product/scenes/integrations/providerPanelFlow';
export { AuthMethodPicker } from './product/scenes/providerAuthConfigs/authMethodPicker';
export { showProviderCreationPanel } from './product/scenes/providerCreationPanel';
export { SkillGridCard } from './product/scenes/skills/grid';
export { SkillGroupGridCard } from './product/scenes/skills/groupGrid';
export {
  SkillTemplateGridCard,
  SkillTemplatesGrid
} from './product/scenes/skills/templateGrid';
export {
  SkillResourceFilters,
  useSkillPluginFilters,
  useSkillTemplateFilters
} from './product/scenes/skills/filters';
export { SkillPluginsGrid } from './product/scenes/skills/pluginGrid';
export { showSkillPluginFormModal } from './product/scenes/skills/pluginModal';
export { showSkillTemplateFormModal } from './product/scenes/skills/templateModal';
export { showSkillCloneFormModal } from './product/scenes/skills/cloneModal';
export { SkillSyncsTable } from './product/pages/(skills)/skillSyncs';
export {
  MagicGroupsTable,
  createMagicMcpGroupModal
} from './product/scenes/magicMcp/groupsTable';
export {
  MagicTokensTable,
  createMagicMcpTokenModal
} from './product/scenes/magicMcp/tokensTable';
export { showAddProviderSidePanel } from './product/scenes/sessionTemplates/providersManager';
export {
  NetworkEnclavesListLayout,
  NetworkListLayout
} from './product/pages/(network)/(list)/_layout';
export { SecurityOverviewPage } from './product/pages/(network)/security';
export { NetworkOverviewPage } from './product/pages/(network)/(list)/network';
export { NetworkFirewallsPage } from './product/pages/(network)/(list)/firewalls';
export { NetworkSettingsPage } from './product/pages/(network)/(list)/settings';
export { NetworkEnclavesPage } from './product/pages/(network)/(list)/enclaves';
export { NetworkFirewallPageLayout } from './product/pages/(network)/firewall/_layout';
export { NetworkFirewallPage } from './product/pages/(network)/firewall';
export { NetworkFirewallSettingsPage } from './product/pages/(network)/firewall/settings';
export { IdentityDelegationConfigsTable } from './product/scenes/identity/delegationConfigsTable';
export { showIdentityDelegationConfigFormModal } from './product/scenes/identity/delegationConfigModal';
export { IdentityDelegationsTable } from './product/scenes/identity/delegationsTable';
export { AlertsTable } from './product/scenes/monitoring/alertsTable';
export { MonitorsTable } from './product/scenes/monitoring/monitorsTable';
export { ProtoGuardAlertsTable } from './product/scenes/monitoring/protoGuardAlertsTable';
export {
  MonitorAlertStatusBadge,
  MonitorStatusBadge,
  MonitorTargetBadge,
  MonitorOwnerBadge,
  ProtoGuardSeverityBadge
} from './product/scenes/monitoring/badges';

export { ProviderDeploymentsTable } from './product/scenes/providerDeployments/table';
export {
  showProviderDeploymentFormModal,
  showMagicMcpServerFormModal
} from './product/scenes/providerDeployments/modal';
export { ProviderConfigsOverviewTable } from './product/scenes/providerConfigs/overviewTable';
export { ProviderDeploymentsListLayout } from './product/pages/(deployments)/(list)/providerDeploymentsListLayout';
export { ProviderConfigsOverviewPage } from './product/pages/(deployments)/(list)/provider-configs';
export { ProviderAuthConfigsOverviewPage } from './product/pages/(deployments)/(list)/provider-auth-configs';
export { ProviderConfigLayout } from './product/pages/(deployments)/provider-config/_layout';
export { ProviderConfigOverviewPage } from './product/pages/(deployments)/provider-config';
export { ProviderConfigSettingsPage } from './product/pages/(deployments)/provider-config/settings';
export { ProviderAuthConfigLayout } from './product/pages/(deployments)/provider-auth-configs/_layout';
export { ProviderAuthConfigOverviewPage } from './product/pages/(deployments)/provider-auth-configs';
export { ProviderAuthConfigSettingsPage } from './product/pages/(deployments)/provider-auth-configs/settings';
export { showProviderConfigFormModal } from './product/scenes/providerConfigs/modal';
export { ProviderConfigVaultsOverviewTable } from './product/scenes/providerConfigVaults/overviewTable';
export { ProviderAuthCredentialsOverviewTable } from './product/scenes/providerAuthCredentials/overviewTable';
export { ProviderAuthConfigsOverviewTable } from './product/scenes/providerAuthConfigs/overviewTable';
export {
  ScopePicker,
  ScopePickerField,
  type ScopePickerScope
} from './product/scenes/providerAuthCredentials/scopePicker';
export {
  showCreateProviderConfigFlow,
  showCreateProviderConfigVaultFlow,
  showCreateProviderAuthCredentialsFlow,
  showCreateProviderAuthConfigFlow
} from './product/scenes/providerCreationFlows';
export {
  ProviderAuthConfigCreateButton,
  showProviderAuthConfigMethodPickerModal
} from './product/scenes/providerAuthConfigs/modal';
export {
  useProviderConfigCreationCapabilities,
  useProviderAuthCreationCapabilities
} from './product/lib/providerCreationCapabilities';
export {
  getAuthMethodOAuthDoc,
  getAuthMethodOAuthScopesDoc,
  ProviderDocsLink
} from './product/lib/providerDocs';
export { ProviderSessionsTable } from './product/scenes/providerSessions/table';
export { ProviderAuthErrorsTable } from './product/scenes/providerAuthErrors/table';
export { ProviderAuthEventsTable } from './product/scenes/providerAuthEvents/table';
export { DeletedRecordCallout } from './product/scenes/deletedRecordCallout';
export { DeleteResourceDangerZone } from './product/scenes/deleteResourceDangerZone';
export { ProviderDeploymentTabSection } from './product/scenes/providerDeployments/tabSection';
export {
  OpenExplorerButton,
  OpenExplorerBox,
  getExplorerModeUrl,
  type OpenExplorerMode
} from './product/components/openExplorer';
export {
  NetworkManagedPage,
  useNetworkManagementAccess
} from './product/pages/(network)/_gate';
export { EmptyText, Stack } from './product/pages/(network)/_common';
export { showApplyFirewallPanel } from './product/pages/(network)/_applyFirewallPanel';

export let ProviderSetupSections = dynamicPage<[ProviderSetupSectionsProps]>(() =>
  import('./product/scenes/sessionTemplates/addProviderPanelFlow').then(
    module => module.ProviderSetupSections
  )
);
