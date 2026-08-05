import { dynamicPage } from '@metorial/dynamic-component';
import type { ProviderSetupSectionsProps } from './product/scenes/sessionTemplates/addProviderPanelFlow';

export {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from './product/lib/configSelection';

export {
  deploySlice,
  productDocumentSlice,
  productExplorerSlice,
  productHomeSlice,
  productIdentitySlice,
  productInfrastructureSlice,
  productTraceDetailSlice,
  productTraceSlice
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
export { SkillTemplateGridCard } from './product/scenes/skills/templateGrid';
export { showAddProviderSidePanel } from './product/scenes/sessionTemplates/providersManager';

export let ProviderSetupSections = dynamicPage<[ProviderSetupSectionsProps]>(() =>
  import('./product/scenes/sessionTemplates/addProviderPanelFlow').then(
    module => module.ProviderSetupSections
  )
);
