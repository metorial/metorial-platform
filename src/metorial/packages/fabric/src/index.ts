import { FabricEvents } from './types';

export type {
  AuditConsumerAccess,
  AuditConsumerAccessListing,
  AuditConsumerAccessRequest,
  AuditConsumerAccessTarget,
  AuditConsumerProfile,
  AuditConsumerProviderDeployment,
  AuditConsumerSession,
  AuditConsumerSurface,
  AuditConsumerSurfaceProviderGroup,
  AuditDocument,
  AuditFile,
  AuditInstanceConsumer,
  AuditMagicMcpEndpoint,
  AuditMagicMcpGroup,
  AuditMagicMcpToken,
  AuditPortal,
  AuditStore,
  AuditSubspaceAgent,
  AuditSubspaceAgentClient,
  AuditSubspaceCodeBucketFile,
  AuditSubspaceCustomProvider,
  AuditSubspaceCustomProviderCommit,
  AuditSubspaceCustomProviderVersion,
  AuditSubspaceFirewall,
  AuditSubspaceFirewallBinding,
  AuditSubspaceIdentity,
  AuditSubspaceIdentityActor,
  AuditSubspaceIdentityCredential,
  AuditSubspaceIdentityDelegation,
  AuditSubspaceIdentityDelegationConfig,
  AuditSubspaceIntegration,
  AuditSubspaceIntegrationInstance,
  AuditSubspaceIntegrationInstanceGroup,
  AuditSubspaceIntegrationInstanceProvider,
  AuditSubspaceIntegrationProvider,
  AuditSubspaceIntegrationSetupSession,
  AuditSubspaceNetworkPolicy,
  AuditSubspaceProtoGuardAlert,
  AuditSubspaceProtoGuardAlertMatch,
  AuditSubspaceProtoGuardAlertThreshold,
  AuditSubspaceProtoGuardFilterDefinition,
  AuditSubspaceProtoGuardFilterSetting,
  AuditSubspaceProviderAuthConfig,
  AuditSubspaceProviderAuthCredentials,
  AuditSubspaceProviderAuthExport,
  AuditSubspaceProviderAuthImport,
  AuditSubspaceProviderConfig,
  AuditSubspaceProviderConfigVault,
  AuditSubspaceProviderDeployment,
  AuditSubspaceProviderSetupSession,
  AuditSubspaceScmRepo,
  AuditSubspaceSession,
  AuditSubspaceSessionProvider,
  AuditSubspaceSessionTemplate,
  AuditSubspaceSessionTemplateProvider,
  FabricBillingAccount,
  FabricBillingPlan,
  FabricEvents,
  FabricOrganizationSubscription,
  FabricUserTenant,
  FileFabricOwner,
  KeyProviderEventBase,
  KeyProviderEventKeyProvider,
  KeyProviderEventValidation,
  MagicMcpServerMembershipFabricChange,
  ProviderEventBase,
  SkillStoreFabricOwner,
  StoreItemFabricOperation
} from './types';

let listeners = new Map<string, Set<(data: any) => void | Promise<void>>>();

export let Fabric = {
  fire: async <K extends keyof FabricEvents>(
    event: K,
    data: FabricEvents[K] extends void | never | undefined
      ? never | undefined
      : FabricEvents[K]
  ) => {
    let listenerSet = listeners.get(event);
    if (!listenerSet) return;

    await Promise.all(Array.from(listenerSet).map(l => l(data)));
  },

  listen: <K extends keyof FabricEvents>(
    event: K,
    callback: (data: FabricEvents[K]) => void | Promise<void>
  ) => {
    let listenerSet = listeners.get(event);
    if (!listenerSet) {
      listenerSet = new Set();
      listeners.set(event, listenerSet);
    }

    listenerSet.add(callback);

    return () => {
      listenerSet?.delete(callback);
      if (listenerSet.size === 0) {
        listeners.delete(event);
      }
    };
  }
};
