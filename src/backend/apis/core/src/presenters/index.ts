import { declarePresenter } from '@metorial/presenter';
import {
  consumerMagicMcpEndpointPresenter,
  consumerMagicMcpServerPresenter,
  consumerMagicMcpSessionPresenter,
  consumerMagicMcpTokenPresenter,
  dashboardApiKeyPresenter,
  dashboardConsumerPresenter,
  dashboardConsumerProfilePresenter,
  dashboardCustomProviderDeploymentPresenter,
  dashboardCustomProviderPresenter,
  dashboardIdentityActorPresenter,
  dashboardMagicMcpServerPresenter,
  dashboardMagicMcpServerProviderPresenter,
  dashboardProviderListingPresenter,
  dashboardProviderPresenter,
  v1AccessPolicyPresenter,
  v1AccessPolicyVersionPresenter,
  v1AccessRolePresenter,
  v1AccessRoleVersionPresenter,
  v1AgentInstancePresenter,
  v1AgentPresenter,
  v1ApiKeyPresenter,
  v1AssistantConversationPresenter,
  v1AssistantMessagePresenter,
  v1AssistantPresenter,
  v1BootPresenter,
  v1BucketEditorTokenPresenter,
  v1CallbackDestinationPresenter,
  v1CallbackEventPresenter,
  v1CallbackInstancePresenter,
  v1CallbackNotificationPresenter,
  v1CallbackPresenter,
  v1CliDevicePresenter,
  v1ConfigPresenter,
  v1ConsumerAccessListingPresenter,
  v1ConsumerAccessPresenter,
  v1ConsumerAccessRequestPresenter,
  v1ConsumerAndProfilePresenter,
  v1ConsumerGroupPresenter,
  v1ConsumerInvitePresenter,
  v1ConsumerPresenter,
  v1ConsumerProfilePresenter,
  v1ConsumerProviderPresenter,
  v1ConsumerSessionPresenter,
  v1ConsumerSurfacePresenter,
  v1ConsumerSurfaceProviderGroupPresenter,
  v1CustomProviderCommitPresenter,
  v1CustomProviderDeploymentLogsPresenter,
  v1CustomProviderDeploymentPresenter,
  v1CustomProviderEnvironmentPresenter,
  // Custom Provider presenters
  v1CustomProviderPresenter,
  v1CustomProviderVersionPresenter,
  v1DocumentParticipantPresenter,
  v1DocumentPermissionsPresenter,
  v1DocumentPresenter,
  v1DocumentVersionPresenter,
  dashboardFilePresenter,
  v1FileLinkPresenter,
  v1FilePresenter,
  v1FlagsPresenter,
  v1IdentityActorPresenter,
  v1IdentityCredentialPresenter,
  v1IdentityDelegationConfigPresenter,
  v1IdentityDelegationPresenter,
  v1IdentityDelegationRequestPresenter,
  v1IdentityPresenter,
  v1InstanceListPresenter,
  v1InstancePresenter,
  v1IntegrationInstanceGroupPresenter,
  v1IntegrationInstanceGroupProviderPresenter,
  v1IntegrationInstancePresenter,
  v1IntegrationInstanceProviderPresenter,
  v1IntegrationPresenter,
  v1IntegrationProviderPresenter,
  v1IntegrationSetupSessionPresenter,
  v1MachineAccessPresenter,
  v1MagicMcpEndpointPresenter,
  v1MagicMcpGroupPresenter,
  v1MagicMcpServerPresenter,
  v1MagicMcpServerProviderPresenter,
  v1MagicMcpSessionPresenter,
  v1MagicMcpTokenPresenter,
  v1OAuthApplicationClientSecretPresenter,
  v1OAuthApplicationPresenter,
  v1OAuthAuthorizationLogPresenter,
  v1OAuthAuthorizationPresenter,
  v1OAuthAuthorizationRequestPresenter,
  v1OAuthInstallationPresenter,
  v1OAuthScopePermissionsPresenter,
  v1OrganizationActorPresenter,
  v1OrganizationInvitePresenter,
  v1OrganizationMemberPresenter,
  v1OrganizationPresenter,
  v1PortalAuthAppPresenter,
  v1PortalAuthSsoConnectionPresenter,
  v1PortalAuthSsoTenantPresenter,
  v1PortalAuthSsoTenantSetupPresenter,
  v1PortalOAuthAuthorizationPresenter,
  v1PortalOAuthClientPresenter,
  v1PortalPresenter,
  v1ProfilePresenter,
  v1ProjectBrandPresenter,
  v1ProjectPresenter,
  v1ProviderAuthConfigErrorGroupPresenter,
  v1ProviderAuthConfigErrorPresenter,
  v1ProviderAuthConfigEventPresenter,
  v1ProviderAuthConfigPresenter,
  v1ProviderAuthConfigSchemaPresenter,
  v1ProviderAuthCredentialsPresenter,
  v1ProviderAuthExportPresenter,
  v1ProviderAuthImportPresenter,
  v1ProviderAuthImportSchemaPresenter,
  v1ProviderAuthMethodPresenter,
  v1ProviderConfigPreviewPresenter,
  v1ProviderConfigSchemaPresenter,
  v1ProviderConfigVaultPresenter,
  v1ProviderDeploymentPresenter,
  v1ProviderDeploymentPreviewPresenter,
  v1ProviderInvocationPresenter,
  v1ProviderInvocationsPresenter,
  v1ProviderListingCategoryPresenter,
  v1ProviderListingCollectionPresenter,
  v1ProviderListingGroupPresenter,
  v1ProviderListingPresenter,
  v1ProviderPresenter,
  v1ProviderRunLogsPresenter,
  v1ProviderRunPresenter,
  v1ProviderSpecificationPresenter,
  v1ProviderTemplatePresenter,
  v1ProviderToolCallPresenter,
  v1ProviderToolPresenter,
  v1ProviderToolsPresenter,
  v1ProviderTriggerPresenter,
  v1ProviderTypePresenter,
  v1ProviderVersionPresenter,
  v1PublisherPresenter,
  v1ScmAccountPreviewPresenter,
  v1ScmConnectionPresenter,
  v1ScmConnectionSetupPresenter,
  v1ScmProviderPresenter,
  v1ScmProviderSetupPresenter,
  v1ScmRepoPresenter,
  v1ScmRepoPreviewPresenter,
  v1SecretPresenter,
  v1ServiceAccountCredentialPresenter,
  v1ServiceAccountPresenter,
  v1SessionConnectionPresenter,
  v1SessionErrorGroupPresenter,
  v1SessionErrorPresenter,
  v1SessionParticipantPresenter,
  v1SessionPresenter,
  v1SessionProviderPresenter,
  v1SessionTemplatePresenter,
  v1SessionTemplateProviderPresenter,
  v1SetupSessionPresenter,
  v1SkillGroupItemPresenter,
  v1SkillGroupPresenter,
  v1SkillItemPresenter,
  v1SkillAgentPresenter,
  v1SkillConfigurationPresenter,
  v1SkillMarketplacePresenter,
  v1SkillMarketplacePluginPresenter,
  v1SkillParticipantPresenter,
  v1SkillPresenter,
  v1SkillPluginPresenter,
  v1SkillPluginSkillPresenter,
  v1SkillTemplateItemPresenter,
  v1SkillTemplatePresenter,
  v1SkillVersionPresenter,
  v1SkillVersionSnapshotPresenter,
  v1StoreItemListPresenter,
  v1StoreItemPresenter,
  v1StoreParticipantPresenter,
  v1StorePermissionsPresenter,
  v1StorePresenter,
  v1SubspaceSessionEventPresenter,
  v1SubspaceSessionMessagePresenter,
  v1TeamPresenter,
  v1TokenPresenter,
  v1UsagePresenter,
  v1UserPresenter
} from './implementation';
import {
  accessPolicyType,
  accessPolicyVersionType,
  accessRoleType,
  accessRoleVersionType,
  agentInstanceType,
  agentType,
  apiKeyType,
  assistantConversationType,
  assistantMessageType,
  assistantType,
  authConfigSchemaType,
  authImportSchemaType,
  bootType,
  bucketEditorTokenType,
  callbackDestinationType,
  callbackEventType,
  callbackInstanceType,
  callbackNotificationType,
  callbackType,
  cliDeviceType,
  configPreviewType,
  configSchemaType,
  consumerAccessListingType,
  consumerAccessRequestType,
  consumerAccessType,
  consumerAndProfileType,
  consumerGroupType,
  consumerInviteType,
  consumerProfileType,
  consumerProviderType,
  consumerSessionType,
  consumerSurfaceProviderGroupType,
  consumerSurfaceType,
  consumerType,
  customProviderCommitType,
  customProviderDeploymentLogsType,
  customProviderDeploymentType,
  customProviderEnvironmentType,
  // Custom Provider types
  customProviderType,
  customProviderVersionType,
  deploymentPreviewType,
  documentParticipantType,
  documentPermissionsType,
  documentType,
  documentVersionType,
  fileLinkType,
  fileType,
  flagsType,
  identityActorType,
  identityCredentialType,
  identityDelegationConfigType,
  identityDelegationRequestType,
  identityDelegationType,
  identityType,
  instanceListType,
  instanceType,
  integrationInstanceGroupProviderType,
  integrationInstanceGroupType,
  integrationInstanceProviderType,
  integrationInstanceType,
  integrationProviderType,
  integrationSetupSessionType,
  integrationType,
  machineAccessType,
  magicMcpEndpointType,
  magicMcpGroupType,
  magicMcpServerProviderType,
  magicMcpServerType,
  magicMcpSessionType,
  magicMcpTokenType,
  oauthApplicationClientSecretType,
  oauthApplicationType,
  oauthAuthorizationLogType,
  oauthAuthorizationRequestType,
  oauthAuthorizationType,
  oauthInstallationType,
  oauthScopePermissionsType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  portalAuthAppType,
  portalAuthSsoConnectionType,
  portalAuthSsoTenantSetupType,
  portalAuthSsoTenantType,
  portalOAuthAuthorizationType,
  portalOAuthClientType,
  portalType,
  profileType,
  projectBrandType,
  projectType,
  providerAuthConfigErrorGroupType,
  providerAuthConfigErrorType,
  providerAuthConfigEventType,
  providerAuthConfigType,
  providerAuthCredentialsType,
  providerAuthExportType,
  providerAuthImportType,
  providerAuthMethodType,
  providerConfigType,
  providerConfigVaultType,
  providerDeploymentType,
  providerInvocationType,
  providerInvocationsType,
  providerListingCategoryType,
  providerListingCollectionType,
  providerListingGroupType,
  providerListingType,
  providerRunLogsType,
  providerRunType,
  providerSessionType,
  providerSetupSessionType,
  providerSpecificationType,
  providerTemplateType,
  providerToolType,
  providerToolsType,
  providerTriggerType,
  providerType,
  providerTypeType,
  providerVersionType,
  publisherType,
  scmAccountPreviewType,
  scmConnectionSetupType,
  scmConnectionType,
  scmProviderSetupType,
  scmProviderType,
  scmRepoPreviewType,
  scmRepoType,
  secretType,
  serviceAccountCredentialType,
  serviceAccountType,
  sessionConnectionType,
  sessionErrorGroupType,
  sessionErrorType,
  sessionEventType,
  sessionMessageType,
  sessionParticipantType,
  sessionProviderType,
  sessionTemplateProviderType,
  sessionTemplateType,
  skillGroupItemType,
  skillGroupType,
  skillItemType,
  skillAgentType,
  skillConfigurationType,
  skillMarketplaceType,
  skillMarketplacePluginType,
  skillParticipantType,
  skillPluginType,
  skillPluginSkillType,
  skillTemplateItemType,
  skillTemplateType,
  skillType,
  skillVersionSnapshotType,
  skillVersionType,
  storeItemListType,
  storeItemType,
  storeParticipantType,
  storePermissionsType,
  storeType,
  teamType,
  tokenType,
  toolCallType,
  usageType,
  userType
} from './types';

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_dashboard: dashboardApiKeyPresenter,
  mt_2026_01_01_magnetar: v1ApiKeyPresenter
});

export let assistantPresenter = declarePresenter(assistantType, {
  mt_2025_01_01_dashboard: v1AssistantPresenter,
  mt_2026_01_01_magnetar: v1AssistantPresenter
});

export let assistantConversationPresenter = declarePresenter(assistantConversationType, {
  mt_2025_01_01_dashboard: v1AssistantConversationPresenter,
  mt_2026_01_01_magnetar: v1AssistantConversationPresenter
});

export let assistantMessagePresenter = declarePresenter(assistantMessageType, {
  mt_2025_01_01_dashboard: v1AssistantMessagePresenter,
  mt_2026_01_01_magnetar: v1AssistantMessagePresenter
});

export let oauthAuthorizationRequestPresenter = declarePresenter(
  oauthAuthorizationRequestType,
  {
    mt_2025_01_01_dashboard: v1OAuthAuthorizationRequestPresenter,
    mt_2026_01_01_magnetar: v1OAuthAuthorizationRequestPresenter
  }
);

export let oauthAuthorizationLogPresenter = declarePresenter(oauthAuthorizationLogType, {
  mt_2025_01_01_dashboard: v1OAuthAuthorizationLogPresenter,
  mt_2026_01_01_magnetar: v1OAuthAuthorizationLogPresenter
});

export let oauthApplicationPresenter = declarePresenter(oauthApplicationType, {
  mt_2025_01_01_dashboard: v1OAuthApplicationPresenter,
  mt_2026_01_01_magnetar: v1OAuthApplicationPresenter
});

export let oauthApplicationClientSecretPresenter = declarePresenter(
  oauthApplicationClientSecretType,
  {
    mt_2025_01_01_dashboard: v1OAuthApplicationClientSecretPresenter,
    mt_2026_01_01_magnetar: v1OAuthApplicationClientSecretPresenter
  }
);

export let oauthInstallationPresenter = declarePresenter(oauthInstallationType, {
  mt_2025_01_01_dashboard: v1OAuthInstallationPresenter,
  mt_2026_01_01_magnetar: v1OAuthInstallationPresenter
});

export let cliDevicePresenter = declarePresenter(cliDeviceType, {
  mt_2025_01_01_dashboard: v1CliDevicePresenter,
  mt_2026_01_01_magnetar: v1CliDevicePresenter
});

export let oauthAuthorizationPresenter = declarePresenter(oauthAuthorizationType, {
  mt_2025_01_01_dashboard: v1OAuthAuthorizationPresenter,
  mt_2026_01_01_magnetar: v1OAuthAuthorizationPresenter
});

export let serviceAccountPresenter = declarePresenter(serviceAccountType, {
  mt_2025_01_01_dashboard: v1ServiceAccountPresenter,
  mt_2026_01_01_magnetar: v1ServiceAccountPresenter
});

export let accessRolePresenter = declarePresenter(accessRoleType, {
  mt_2025_01_01_dashboard: v1AccessRolePresenter,
  mt_2026_01_01_magnetar: v1AccessRolePresenter
});

export let accessRoleVersionPresenter = declarePresenter(accessRoleVersionType, {
  mt_2025_01_01_dashboard: v1AccessRoleVersionPresenter,
  mt_2026_01_01_magnetar: v1AccessRoleVersionPresenter
});

export let accessPolicyPresenter = declarePresenter(accessPolicyType, {
  mt_2025_01_01_dashboard: v1AccessPolicyPresenter,
  mt_2026_01_01_magnetar: v1AccessPolicyPresenter
});

export let accessPolicyVersionPresenter = declarePresenter(accessPolicyVersionType, {
  mt_2025_01_01_dashboard: v1AccessPolicyVersionPresenter,
  mt_2026_01_01_magnetar: v1AccessPolicyVersionPresenter
});

export let serviceAccountCredentialPresenter = declarePresenter(serviceAccountCredentialType, {
  mt_2025_01_01_dashboard: v1ServiceAccountCredentialPresenter,
  mt_2026_01_01_magnetar: v1ServiceAccountCredentialPresenter
});

export let tokenPresenter = declarePresenter(tokenType, {
  mt_2025_01_01_dashboard: v1TokenPresenter,
  mt_2026_01_01_magnetar: v1TokenPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  mt_2025_01_01_dashboard: v1InstancePresenter,
  mt_2026_01_01_magnetar: v1InstancePresenter
});

export let instanceListPresenter = declarePresenter(instanceListType, {
  mt_2025_01_01_dashboard: v1InstanceListPresenter,
  mt_2026_01_01_magnetar: v1InstanceListPresenter
});

export let machineAccessPresenter = declarePresenter(machineAccessType, {
  mt_2025_01_01_dashboard: v1MachineAccessPresenter,
  mt_2026_01_01_magnetar: v1MachineAccessPresenter
});

export let organizationActorPresenter = declarePresenter(organizationActorType, {
  mt_2025_01_01_dashboard: v1OrganizationActorPresenter,
  mt_2026_01_01_magnetar: v1OrganizationActorPresenter
});

export let organizationInvitePresenter = declarePresenter(organizationInviteType, {
  mt_2025_01_01_dashboard: v1OrganizationInvitePresenter,
  mt_2026_01_01_magnetar: v1OrganizationInvitePresenter
});

export let organizationMemberPresenter = declarePresenter(organizationMemberType, {
  mt_2025_01_01_dashboard: v1OrganizationMemberPresenter,
  mt_2026_01_01_magnetar: v1OrganizationMemberPresenter
});

export let portalAuthAppPresenter = declarePresenter(portalAuthAppType, {
  mt_2025_01_01_dashboard: v1PortalAuthAppPresenter,
  mt_2026_01_01_magnetar: v1PortalAuthAppPresenter
});

export let organizationPresenter = declarePresenter(organizationType, {
  mt_2025_01_01_dashboard: v1OrganizationPresenter,
  mt_2026_01_01_magnetar: v1OrganizationPresenter
});

export let projectPresenter = declarePresenter(projectType, {
  mt_2025_01_01_dashboard: v1ProjectPresenter,
  mt_2026_01_01_magnetar: v1ProjectPresenter
});

export let projectBrandPresenter = declarePresenter(projectBrandType, {
  mt_2025_01_01_dashboard: v1ProjectBrandPresenter,
  mt_2026_01_01_magnetar: v1ProjectBrandPresenter
});

export let userPresenter = declarePresenter(userType, {
  mt_2025_01_01_dashboard: v1UserPresenter,
  mt_2026_01_01_magnetar: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  mt_2025_01_01_dashboard: v1BootPresenter,
  mt_2026_01_01_magnetar: v1BootPresenter
});

export let filePresenter = declarePresenter(fileType, {
  mt_2025_01_01_dashboard: dashboardFilePresenter,
  mt_2026_01_01_magnetar: v1FilePresenter
});

export let fileLinkPresenter = declarePresenter(fileLinkType, {
  mt_2025_01_01_dashboard: v1FileLinkPresenter,
  mt_2026_01_01_magnetar: v1FileLinkPresenter
});

export let documentPresenter = declarePresenter(documentType, {
  mt_2025_01_01_dashboard: v1DocumentPresenter,
  mt_2026_01_01_magnetar: v1DocumentPresenter
});

export let documentPermissionsPresenter = declarePresenter(documentPermissionsType, {
  mt_2025_01_01_dashboard: v1DocumentPermissionsPresenter,
  mt_2026_01_01_magnetar: v1DocumentPermissionsPresenter
});

export let documentVersionPresenter = declarePresenter(documentVersionType, {
  mt_2025_01_01_dashboard: v1DocumentVersionPresenter,
  mt_2026_01_01_magnetar: v1DocumentVersionPresenter
});

export let documentParticipantPresenter = declarePresenter(documentParticipantType, {
  mt_2025_01_01_dashboard: v1DocumentParticipantPresenter,
  mt_2026_01_01_magnetar: v1DocumentParticipantPresenter
});

export let storePresenter = declarePresenter(storeType, {
  mt_2025_01_01_dashboard: v1StorePresenter,
  mt_2026_01_01_magnetar: v1StorePresenter
});

export let storePermissionsPresenter = declarePresenter(storePermissionsType, {
  mt_2025_01_01_dashboard: v1StorePermissionsPresenter,
  mt_2026_01_01_magnetar: v1StorePermissionsPresenter
});

export let storeItemPresenter = declarePresenter(storeItemType, {
  mt_2025_01_01_dashboard: v1StoreItemPresenter,
  mt_2026_01_01_magnetar: v1StoreItemPresenter
});

export let storeItemListPresenter = declarePresenter(storeItemListType, {
  mt_2025_01_01_dashboard: v1StoreItemListPresenter,
  mt_2026_01_01_magnetar: v1StoreItemListPresenter
});

export let storeParticipantPresenter = declarePresenter(storeParticipantType, {
  mt_2025_01_01_dashboard: v1StoreParticipantPresenter,
  mt_2026_01_01_magnetar: v1StoreParticipantPresenter
});

export let skillAgentPresenter = declarePresenter(skillAgentType, {
  mt_2025_01_01_dashboard: v1SkillAgentPresenter,
  mt_2026_01_01_magnetar: v1SkillAgentPresenter
});

export let skillConfigurationPresenter = declarePresenter(skillConfigurationType, {
  mt_2025_01_01_dashboard: v1SkillConfigurationPresenter,
  mt_2026_01_01_magnetar: v1SkillConfigurationPresenter
});

export let skillMarketplacePresenter = declarePresenter(skillMarketplaceType, {
  mt_2025_01_01_dashboard: v1SkillMarketplacePresenter,
  mt_2026_01_01_magnetar: v1SkillMarketplacePresenter
});

export let skillMarketplacePluginPresenter = declarePresenter(skillMarketplacePluginType, {
  mt_2025_01_01_dashboard: v1SkillMarketplacePluginPresenter,
  mt_2026_01_01_magnetar: v1SkillMarketplacePluginPresenter
});

export let skillPluginPresenter = declarePresenter(skillPluginType, {
  mt_2025_01_01_dashboard: v1SkillPluginPresenter,
  mt_2026_01_01_magnetar: v1SkillPluginPresenter
});

export let skillPluginSkillPresenter = declarePresenter(skillPluginSkillType, {
  mt_2025_01_01_dashboard: v1SkillPluginSkillPresenter,
  mt_2026_01_01_magnetar: v1SkillPluginSkillPresenter
});

export let skillParticipantPresenter = declarePresenter(skillParticipantType, {
  mt_2025_01_01_dashboard: v1SkillParticipantPresenter,
  mt_2026_01_01_magnetar: v1SkillParticipantPresenter
});

export let skillVersionPresenter = declarePresenter(skillVersionType, {
  mt_2025_01_01_dashboard: v1SkillVersionPresenter,
  mt_2026_01_01_magnetar: v1SkillVersionPresenter
});

export let skillVersionSnapshotPresenter = declarePresenter(skillVersionSnapshotType, {
  mt_2025_01_01_dashboard: v1SkillVersionSnapshotPresenter,
  mt_2026_01_01_magnetar: v1SkillVersionSnapshotPresenter
});

export let secretPresenter = declarePresenter(secretType, {
  mt_2025_01_01_dashboard: v1SecretPresenter,
  mt_2026_01_01_magnetar: v1SecretPresenter
});

export let usagePresenter = declarePresenter(usageType, {
  mt_2025_01_01_dashboard: v1UsagePresenter,
  mt_2026_01_01_magnetar: v1UsagePresenter
});

export let profilePresenter = declarePresenter(profileType, {
  mt_2025_01_01_dashboard: v1ProfilePresenter,
  mt_2026_01_01_magnetar: v1ProfilePresenter
});

export let flagsPresenter = declarePresenter(flagsType, {
  mt_2025_01_01_dashboard: v1FlagsPresenter,
  mt_2026_01_01_magnetar: v1FlagsPresenter
});

export let callbackPresenter = declarePresenter(callbackType, {
  mt_2025_01_01_dashboard: v1CallbackPresenter,
  mt_2026_01_01_magnetar: v1CallbackPresenter
});

export let callbackEventPresenter = declarePresenter(callbackEventType, {
  mt_2025_01_01_dashboard: v1CallbackEventPresenter,
  mt_2026_01_01_magnetar: v1CallbackEventPresenter
});

export let callbackNotificationPresenter = declarePresenter(callbackNotificationType, {
  mt_2025_01_01_dashboard: v1CallbackNotificationPresenter,
  mt_2026_01_01_magnetar: v1CallbackNotificationPresenter
});

export let callbackDestinationPresenter = declarePresenter(callbackDestinationType, {
  mt_2025_01_01_dashboard: v1CallbackDestinationPresenter,
  mt_2026_01_01_magnetar: v1CallbackDestinationPresenter
});

export let callbackInstancePresenter = declarePresenter(callbackInstanceType, {
  mt_2025_01_01_dashboard: v1CallbackInstancePresenter,
  mt_2026_01_01_magnetar: v1CallbackInstancePresenter
});

export let teamPresenter = declarePresenter(teamType, {
  mt_2025_01_01_dashboard: v1TeamPresenter,
  mt_2026_01_01_magnetar: v1TeamPresenter
});

export let oauthScopePermissionsPresenter = declarePresenter(oauthScopePermissionsType, {
  mt_2025_01_01_dashboard: v1OAuthScopePermissionsPresenter,
  mt_2026_01_01_magnetar: v1OAuthScopePermissionsPresenter
});

export let consumerGroupPresenter = declarePresenter(consumerGroupType, {
  mt_2025_01_01_dashboard: v1ConsumerGroupPresenter,
  mt_2026_01_01_magnetar: v1ConsumerGroupPresenter,
  mt_2026_04_01_consumer: v1ConsumerGroupPresenter
});

export let consumerAccessPresenter = declarePresenter(consumerAccessType, {
  mt_2025_01_01_dashboard: v1ConsumerAccessPresenter,
  mt_2026_01_01_magnetar: v1ConsumerAccessPresenter
});

export let consumerAccessListingPresenter = declarePresenter(consumerAccessListingType, {
  mt_2025_01_01_dashboard: v1ConsumerAccessListingPresenter,
  mt_2026_01_01_magnetar: v1ConsumerAccessListingPresenter
});

export let consumerAccessRequestPresenter = declarePresenter(consumerAccessRequestType, {
  mt_2025_01_01_dashboard: v1ConsumerAccessRequestPresenter,
  mt_2026_01_01_magnetar: v1ConsumerAccessRequestPresenter,
  mt_2026_04_01_consumer: v1ConsumerAccessRequestPresenter
});

export let consumerInvitePresenter = declarePresenter(consumerInviteType, {
  mt_2025_01_01_dashboard: v1ConsumerInvitePresenter,
  mt_2026_01_01_magnetar: v1ConsumerInvitePresenter
});

export let consumerPresenter = declarePresenter(consumerType, {
  mt_2025_01_01_dashboard: dashboardConsumerPresenter,
  mt_2026_01_01_magnetar: v1ConsumerPresenter
});

export let consumerProfilePresenter = declarePresenter(consumerProfileType, {
  mt_2025_01_01_dashboard: dashboardConsumerProfilePresenter,
  mt_2026_01_01_magnetar: v1ConsumerProfilePresenter,
  mt_2026_04_01_consumer: v1ConsumerProfilePresenter
});

export let consumerAndProfilePresenter = declarePresenter(consumerAndProfileType, {
  mt_2025_01_01_dashboard: v1ConsumerAndProfilePresenter,
  mt_2026_01_01_magnetar: v1ConsumerAndProfilePresenter
});

export let consumerSurfacePresenter = declarePresenter(consumerSurfaceType, {
  mt_2025_01_01_dashboard: v1ConsumerSurfacePresenter,
  mt_2026_01_01_magnetar: v1ConsumerSurfacePresenter
});

export let consumerSurfaceProviderGroupPresenter = declarePresenter(
  consumerSurfaceProviderGroupType,
  {
    mt_2025_01_01_dashboard: v1ConsumerSurfaceProviderGroupPresenter,
    mt_2026_01_01_magnetar: v1ConsumerSurfaceProviderGroupPresenter,
    mt_2026_04_01_consumer: v1ConsumerSurfaceProviderGroupPresenter
  }
);

export let consumerSessionPresenter = declarePresenter(consumerSessionType, {
  mt_2025_01_01_dashboard: v1ConsumerSessionPresenter,
  mt_2026_01_01_magnetar: v1ConsumerSessionPresenter,
  mt_2026_04_01_consumer: v1ConsumerSessionPresenter
});

export let consumerProviderPresenter = declarePresenter(consumerProviderType, {
  mt_2025_01_01_dashboard: v1ConsumerProviderPresenter,
  mt_2026_01_01_magnetar: v1ConsumerProviderPresenter,
  mt_2026_04_01_consumer: v1ConsumerProviderPresenter
});

export let portalOAuthClientPresenter = declarePresenter(portalOAuthClientType, {
  mt_2025_01_01_dashboard: v1PortalOAuthClientPresenter,
  mt_2026_01_01_magnetar: v1PortalOAuthClientPresenter,
  mt_2026_04_01_consumer: v1PortalOAuthClientPresenter
});

export let portalOAuthAuthorizationPresenter = declarePresenter(portalOAuthAuthorizationType, {
  mt_2025_01_01_dashboard: v1PortalOAuthAuthorizationPresenter,
  mt_2026_01_01_magnetar: v1PortalOAuthAuthorizationPresenter,
  mt_2026_04_01_consumer: v1PortalOAuthAuthorizationPresenter
});

export let portalPresenter = declarePresenter(portalType, {
  mt_2025_01_01_dashboard: v1PortalPresenter,
  mt_2026_01_01_magnetar: v1PortalPresenter
});

export let portalAuthSsoTenantPresenter = declarePresenter(portalAuthSsoTenantType, {
  mt_2025_01_01_dashboard: v1PortalAuthSsoTenantPresenter,
  mt_2026_01_01_magnetar: v1PortalAuthSsoTenantPresenter
});

export let portalAuthSsoConnectionPresenter = declarePresenter(portalAuthSsoConnectionType, {
  mt_2025_01_01_dashboard: v1PortalAuthSsoConnectionPresenter,
  mt_2026_01_01_magnetar: v1PortalAuthSsoConnectionPresenter
});

export let portalAuthSsoTenantSetupPresenter = declarePresenter(portalAuthSsoTenantSetupType, {
  mt_2025_01_01_dashboard: v1PortalAuthSsoTenantSetupPresenter,
  mt_2026_01_01_magnetar: v1PortalAuthSsoTenantSetupPresenter
});

export let providerTemplatePresenter = declarePresenter(providerTemplateType, {
  mt_2025_01_01_dashboard: v1ProviderTemplatePresenter,
  mt_2026_01_01_magnetar: v1ProviderTemplatePresenter
});

export let magicMcpServerPresenter = declarePresenter(magicMcpServerType, {
  mt_2025_01_01_dashboard: dashboardMagicMcpServerPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpServerPresenter,
  mt_2026_04_01_consumer: consumerMagicMcpServerPresenter
});

export let magicMcpServerProviderPresenter = declarePresenter(magicMcpServerProviderType, {
  mt_2025_01_01_dashboard: dashboardMagicMcpServerProviderPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpServerProviderPresenter,
  mt_2026_04_01_consumer: v1MagicMcpServerProviderPresenter
});

export let magicMcpEndpointPresenter = declarePresenter(magicMcpEndpointType, {
  mt_2025_01_01_dashboard: v1MagicMcpEndpointPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpEndpointPresenter,
  mt_2026_04_01_consumer: consumerMagicMcpEndpointPresenter
});

export let magicMcpSessionPresenter = declarePresenter(magicMcpSessionType, {
  mt_2025_01_01_dashboard: v1MagicMcpSessionPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpSessionPresenter,
  mt_2026_04_01_consumer: consumerMagicMcpSessionPresenter
});

export let magicMcpTokenPresenter = declarePresenter(magicMcpTokenType, {
  mt_2025_01_01_dashboard: v1MagicMcpTokenPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpTokenPresenter,
  mt_2026_04_01_consumer: consumerMagicMcpTokenPresenter
});

export let magicMcpGroupPresenter = declarePresenter(magicMcpGroupType, {
  mt_2025_01_01_dashboard: v1MagicMcpGroupPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpGroupPresenter,
  mt_2026_04_01_consumer: v1MagicMcpGroupPresenter
});

export let publisherPresenter = declarePresenter(publisherType, {
  mt_2025_01_01_dashboard: v1PublisherPresenter,
  mt_2026_01_01_magnetar: v1PublisherPresenter
});

export let agentPresenter = declarePresenter(agentType, {
  mt_2025_01_01_dashboard: v1AgentPresenter,
  mt_2026_01_01_magnetar: v1AgentPresenter
});

export let agentInstancePresenter = declarePresenter(agentInstanceType, {
  mt_2025_01_01_dashboard: v1AgentInstancePresenter,
  mt_2026_01_01_magnetar: v1AgentInstancePresenter
});

export let providerVersionPresenter = declarePresenter(providerVersionType, {
  mt_2025_01_01_dashboard: v1ProviderVersionPresenter,
  mt_2026_01_01_magnetar: v1ProviderVersionPresenter,
  mt_2026_04_01_consumer: v1ProviderVersionPresenter
});

export let providerPresenter = declarePresenter(providerType, {
  mt_2025_01_01_dashboard: dashboardProviderPresenter,
  mt_2026_01_01_magnetar: v1ProviderPresenter,
  mt_2026_04_01_consumer: v1ProviderPresenter
});

export let identityPresenter = declarePresenter(identityType, {
  mt_2025_01_01_dashboard: v1IdentityPresenter,
  mt_2026_01_01_magnetar: v1IdentityPresenter
});

export let identityActorPresenter = declarePresenter(identityActorType, {
  mt_2025_01_01_dashboard: dashboardIdentityActorPresenter,
  mt_2026_01_01_magnetar: v1IdentityActorPresenter
});

export let identityCredentialPresenter = declarePresenter(identityCredentialType, {
  mt_2025_01_01_dashboard: v1IdentityCredentialPresenter,
  mt_2026_01_01_magnetar: v1IdentityCredentialPresenter
});

export let identityDelegationPresenter = declarePresenter(identityDelegationType, {
  mt_2025_01_01_dashboard: v1IdentityDelegationPresenter,
  mt_2026_01_01_magnetar: v1IdentityDelegationPresenter
});

export let identityDelegationConfigPresenter = declarePresenter(identityDelegationConfigType, {
  mt_2025_01_01_dashboard: v1IdentityDelegationConfigPresenter,
  mt_2026_01_01_magnetar: v1IdentityDelegationConfigPresenter
});

export let identityDelegationRequestPresenter = declarePresenter(
  identityDelegationRequestType,
  {
    mt_2025_01_01_dashboard: v1IdentityDelegationRequestPresenter,
    mt_2026_01_01_magnetar: v1IdentityDelegationRequestPresenter
  }
);

export let providerTypePresenter = declarePresenter(providerTypeType, {
  mt_2025_01_01_dashboard: v1ProviderTypePresenter,
  mt_2026_01_01_magnetar: v1ProviderTypePresenter
});

export let providerCategoryPresenter = declarePresenter(providerListingCategoryType, {
  mt_2025_01_01_dashboard: v1ProviderListingCategoryPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingCategoryPresenter,
  mt_2026_04_01_consumer: v1ProviderListingCategoryPresenter
});

export let providerCollectionPresenter = declarePresenter(providerListingCollectionType, {
  mt_2025_01_01_dashboard: v1ProviderListingCollectionPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingCollectionPresenter,
  mt_2026_04_01_consumer: v1ProviderListingCollectionPresenter
});

export let providerGroupPresenter = declarePresenter(providerListingGroupType, {
  mt_2025_01_01_dashboard: v1ProviderListingGroupPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingGroupPresenter
});

export let providerListingPresenter = declarePresenter(providerListingType, {
  mt_2025_01_01_dashboard: dashboardProviderListingPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingPresenter,
  mt_2026_04_01_consumer: v1ProviderListingPresenter
});

export let providerToolPresenter = declarePresenter(providerToolType, {
  mt_2025_01_01_dashboard: v1ProviderToolPresenter,
  mt_2026_01_01_magnetar: v1ProviderToolPresenter
});

export let providerToolsPresenter = declarePresenter(providerToolsType, {
  mt_2025_01_01_dashboard: v1ProviderToolsPresenter,
  mt_2026_01_01_magnetar: v1ProviderToolsPresenter
});

export let providerTriggerPresenter = declarePresenter(providerTriggerType, {
  mt_2025_01_01_dashboard: v1ProviderTriggerPresenter,
  mt_2026_01_01_magnetar: v1ProviderTriggerPresenter
});

export let providerAuthMethodPresenter = declarePresenter(providerAuthMethodType, {
  mt_2025_01_01_dashboard: v1ProviderAuthMethodPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthMethodPresenter
});

export let providerSpecificationPresenter = declarePresenter(providerSpecificationType, {
  mt_2025_01_01_dashboard: v1ProviderSpecificationPresenter,
  mt_2026_01_01_magnetar: v1ProviderSpecificationPresenter,
  mt_2026_04_01_consumer: v1ProviderSpecificationPresenter
});

export let providerDeploymentPresenter = declarePresenter(providerDeploymentType, {
  mt_2025_01_01_dashboard: v1ProviderDeploymentPresenter,
  mt_2026_01_01_magnetar: v1ProviderDeploymentPresenter
});

export let providerDeploymentPreviewPresenter = declarePresenter(deploymentPreviewType, {
  mt_2025_01_01_dashboard: v1ProviderDeploymentPreviewPresenter,
  mt_2026_01_01_magnetar: v1ProviderDeploymentPreviewPresenter
});

export let providerConfigPresenter = declarePresenter(providerConfigType, {
  mt_2025_01_01_dashboard: v1ConfigPresenter,
  mt_2026_01_01_magnetar: v1ConfigPresenter
});

export let providerConfigPreviewPresenter = declarePresenter(configPreviewType, {
  mt_2025_01_01_dashboard: v1ProviderConfigPreviewPresenter,
  mt_2026_01_01_magnetar: v1ProviderConfigPreviewPresenter
});

export let providerConfigVaultPresenter = declarePresenter(providerConfigVaultType, {
  mt_2025_01_01_dashboard: v1ProviderConfigVaultPresenter,
  mt_2026_01_01_magnetar: v1ProviderConfigVaultPresenter
});

export let providerAuthConfigPresenter = declarePresenter(providerAuthConfigType, {
  mt_2025_01_01_dashboard: v1ProviderAuthConfigPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthConfigPresenter
});

export let providerAuthConfigEventPresenter = declarePresenter(providerAuthConfigEventType, {
  mt_2025_01_01_dashboard: v1ProviderAuthConfigEventPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthConfigEventPresenter
});

export let providerAuthConfigErrorPresenter = declarePresenter(providerAuthConfigErrorType, {
  mt_2025_01_01_dashboard: v1ProviderAuthConfigErrorPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthConfigErrorPresenter
});

export let providerAuthConfigErrorGroupPresenter = declarePresenter(
  providerAuthConfigErrorGroupType,
  {
    mt_2025_01_01_dashboard: v1ProviderAuthConfigErrorGroupPresenter,
    mt_2026_01_01_magnetar: v1ProviderAuthConfigErrorGroupPresenter
  }
);

export let providerAuthCredentialsPresenter = declarePresenter(providerAuthCredentialsType, {
  mt_2025_01_01_dashboard: v1ProviderAuthCredentialsPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthCredentialsPresenter
});

export let integrationPresenter = declarePresenter(integrationType, {
  mt_2025_01_01_dashboard: v1IntegrationPresenter,
  mt_2026_01_01_magnetar: v1IntegrationPresenter
});

export let integrationProviderPresenter = declarePresenter(integrationProviderType, {
  mt_2025_01_01_dashboard: v1IntegrationProviderPresenter,
  mt_2026_01_01_magnetar: v1IntegrationProviderPresenter
});

export let integrationInstancePresenter = declarePresenter(integrationInstanceType, {
  mt_2025_01_01_dashboard: v1IntegrationInstancePresenter,
  mt_2026_01_01_magnetar: v1IntegrationInstancePresenter
});

export let integrationSetupSessionPresenter = declarePresenter(integrationSetupSessionType, {
  mt_2025_01_01_dashboard: v1IntegrationSetupSessionPresenter,
  mt_2026_01_01_magnetar: v1IntegrationSetupSessionPresenter,
  mt_2026_04_01_consumer: v1IntegrationSetupSessionPresenter
});

export let integrationInstanceProviderPresenter = declarePresenter(
  integrationInstanceProviderType,
  {
    mt_2025_01_01_dashboard: v1IntegrationInstanceProviderPresenter,
    mt_2026_01_01_magnetar: v1IntegrationInstanceProviderPresenter
  }
);

export let integrationInstanceGroupPresenter = declarePresenter(integrationInstanceGroupType, {
  mt_2025_01_01_dashboard: v1IntegrationInstanceGroupPresenter,
  mt_2026_01_01_magnetar: v1IntegrationInstanceGroupPresenter
});

export let integrationInstanceGroupProviderPresenter = declarePresenter(
  integrationInstanceGroupProviderType,
  {
    mt_2025_01_01_dashboard: v1IntegrationInstanceGroupProviderPresenter,
    mt_2026_01_01_magnetar: v1IntegrationInstanceGroupProviderPresenter
  }
);

export let providerSetupSessionPresenter = declarePresenter(providerSetupSessionType, {
  mt_2025_01_01_dashboard: v1SetupSessionPresenter,
  mt_2026_01_01_magnetar: v1SetupSessionPresenter,
  mt_2026_04_01_consumer: v1SetupSessionPresenter
});

export let providerAuthImportPresenter = declarePresenter(providerAuthImportType, {
  mt_2025_01_01_dashboard: v1ProviderAuthImportPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthImportPresenter
});

export let providerAuthExportPresenter = declarePresenter(providerAuthExportType, {
  mt_2025_01_01_dashboard: v1ProviderAuthExportPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthExportPresenter
});

export let sessionTemplatePresenter = declarePresenter(sessionTemplateType, {
  mt_2025_01_01_dashboard: v1SessionTemplatePresenter,
  mt_2026_01_01_magnetar: v1SessionTemplatePresenter
});

export let sessionTemplateProviderPresenter = declarePresenter(sessionTemplateProviderType, {
  mt_2025_01_01_dashboard: v1SessionTemplateProviderPresenter,
  mt_2026_01_01_magnetar: v1SessionTemplateProviderPresenter
});

export let skillPresenter = declarePresenter(skillType, {
  mt_2025_01_01_dashboard: v1SkillPresenter,
  mt_2026_01_01_magnetar: v1SkillPresenter
});

export let skillGroupPresenter = declarePresenter(skillGroupType, {
  mt_2025_01_01_dashboard: v1SkillGroupPresenter,
  mt_2026_01_01_magnetar: v1SkillGroupPresenter
});

export let skillGroupItemPresenter = declarePresenter(skillGroupItemType, {
  mt_2025_01_01_dashboard: v1SkillGroupItemPresenter,
  mt_2026_01_01_magnetar: v1SkillGroupItemPresenter
});

export let skillItemPresenter = declarePresenter(skillItemType, {
  mt_2025_01_01_dashboard: v1SkillItemPresenter,
  mt_2026_01_01_magnetar: v1SkillItemPresenter
});

export let skillTemplatePresenter = declarePresenter(skillTemplateType, {
  mt_2025_01_01_dashboard: v1SkillTemplatePresenter,
  mt_2026_01_01_magnetar: v1SkillTemplatePresenter
});

export let skillTemplateItemPresenter = declarePresenter(skillTemplateItemType, {
  mt_2025_01_01_dashboard: v1SkillTemplateItemPresenter,
  mt_2026_01_01_magnetar: v1SkillTemplateItemPresenter
});

export let sessionProviderPresenter = declarePresenter(sessionProviderType, {
  mt_2025_01_01_dashboard: v1SessionProviderPresenter,
  mt_2026_01_01_magnetar: v1SessionProviderPresenter
});

export let sessionParticipantPresenter = declarePresenter(sessionParticipantType, {
  mt_2025_01_01_dashboard: v1SessionParticipantPresenter,
  mt_2026_01_01_magnetar: v1SessionParticipantPresenter
});

export let subspaceSessionErrorPresenter = declarePresenter(sessionErrorType, {
  mt_2025_01_01_dashboard: v1SessionErrorPresenter,
  mt_2026_01_01_magnetar: v1SessionErrorPresenter
});

export let subspaceSessionErrorGroupPresenter = declarePresenter(sessionErrorGroupType, {
  mt_2025_01_01_dashboard: v1SessionErrorGroupPresenter,
  mt_2026_01_01_magnetar: v1SessionErrorGroupPresenter
});

export let subspaceProviderRunPresenter = declarePresenter(providerRunType, {
  mt_2025_01_01_dashboard: v1ProviderRunPresenter,
  mt_2026_01_01_magnetar: v1ProviderRunPresenter
});

// Provider Session presenter (Magnetar only - uses provider_deployments instead of server_deployments)
export let providerSessionPresenter = declarePresenter(providerSessionType, {
  mt_2025_01_01_dashboard: v1SessionPresenter,
  mt_2026_01_01_magnetar: v1SessionPresenter
});

export let subspaceSessionMessagePresenter = declarePresenter(sessionMessageType, {
  mt_2025_01_01_dashboard: v1SubspaceSessionMessagePresenter,
  mt_2026_01_01_magnetar: v1SubspaceSessionMessagePresenter
});

export let subspaceSessionConnectionPresenter = declarePresenter(sessionConnectionType, {
  mt_2025_01_01_dashboard: v1SessionConnectionPresenter,
  mt_2026_01_01_magnetar: v1SessionConnectionPresenter
});

export let subspaceSessionEventPresenter = declarePresenter(sessionEventType, {
  mt_2025_01_01_dashboard: v1SubspaceSessionEventPresenter,
  mt_2026_01_01_magnetar: v1SubspaceSessionEventPresenter
});

export let providerRunLogsPresenter = declarePresenter(providerRunLogsType, {
  mt_2025_01_01_dashboard: v1ProviderRunLogsPresenter,
  mt_2026_01_01_magnetar: v1ProviderRunLogsPresenter
});

export let providerInvocationPresenter = declarePresenter(providerInvocationType, {
  mt_2025_01_01_dashboard: v1ProviderInvocationPresenter,
  mt_2026_01_01_magnetar: v1ProviderInvocationPresenter
});

export let providerInvocationsPresenter = declarePresenter(providerInvocationsType, {
  mt_2025_01_01_dashboard: v1ProviderInvocationsPresenter,
  mt_2026_01_01_magnetar: v1ProviderInvocationsPresenter
});

export let configSchemaPresenter = declarePresenter(configSchemaType, {
  mt_2025_01_01_dashboard: v1ProviderConfigSchemaPresenter,
  mt_2026_01_01_magnetar: v1ProviderConfigSchemaPresenter
});

export let authImportSchemaPresenter = declarePresenter(authImportSchemaType, {
  mt_2025_01_01_dashboard: v1ProviderAuthImportSchemaPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthImportSchemaPresenter
});

export let authConfigSchemaPresenter = declarePresenter(authConfigSchemaType, {
  mt_2025_01_01_dashboard: v1ProviderAuthConfigSchemaPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthConfigSchemaPresenter
});

export let bucketEditorTokenPresenter = declarePresenter(bucketEditorTokenType, {
  mt_2025_01_01_dashboard: v1BucketEditorTokenPresenter,
  mt_2026_01_01_magnetar: v1BucketEditorTokenPresenter
});

export let subspaceCustomProviderPresenter = declarePresenter(customProviderType, {
  mt_2025_01_01_dashboard: dashboardCustomProviderPresenter,
  mt_2026_01_01_magnetar: v1CustomProviderPresenter
});

export let subspaceCustomProviderVersionPresenter = declarePresenter(
  customProviderVersionType,
  {
    mt_2025_01_01_dashboard: v1CustomProviderVersionPresenter,
    mt_2026_01_01_magnetar: v1CustomProviderVersionPresenter
  }
);

export let subspaceCustomProviderDeploymentPresenter = declarePresenter(
  customProviderDeploymentType,
  {
    mt_2025_01_01_dashboard: dashboardCustomProviderDeploymentPresenter,
    mt_2026_01_01_magnetar: v1CustomProviderDeploymentPresenter
  }
);

export let subspaceCustomProviderDeploymentLogsPresenter = declarePresenter(
  customProviderDeploymentLogsType,
  {
    mt_2025_01_01_dashboard: v1CustomProviderDeploymentLogsPresenter,
    mt_2026_01_01_magnetar: v1CustomProviderDeploymentLogsPresenter
  }
);

export let subspaceCustomProviderCommitPresenter = declarePresenter(customProviderCommitType, {
  mt_2025_01_01_dashboard: v1CustomProviderCommitPresenter,
  mt_2026_01_01_magnetar: v1CustomProviderCommitPresenter
});

export let subspaceCustomProviderEnvironmentPresenter = declarePresenter(
  customProviderEnvironmentType,
  {
    mt_2025_01_01_dashboard: v1CustomProviderEnvironmentPresenter,
    mt_2026_01_01_magnetar: v1CustomProviderEnvironmentPresenter
  }
);

export let toolCallPresenter = declarePresenter(toolCallType, {
  mt_2025_01_01_dashboard: v1ProviderToolCallPresenter,
  mt_2026_01_01_magnetar: v1ProviderToolCallPresenter
});

export let scmConnectionPresenter = declarePresenter(scmConnectionType, {
  mt_2025_01_01_dashboard: v1ScmConnectionPresenter,
  mt_2026_01_01_magnetar: v1ScmConnectionPresenter
});

export let scmConnectionSetupPresenter = declarePresenter(scmConnectionSetupType, {
  mt_2025_01_01_dashboard: v1ScmConnectionSetupPresenter,
  mt_2026_01_01_magnetar: v1ScmConnectionSetupPresenter
});

export let scmRepoPresenter = declarePresenter(scmRepoType, {
  mt_2025_01_01_dashboard: v1ScmRepoPresenter,
  mt_2026_01_01_magnetar: v1ScmRepoPresenter
});

export let scmRepoPreviewPresenter = declarePresenter(scmRepoPreviewType, {
  mt_2025_01_01_dashboard: v1ScmRepoPreviewPresenter,
  mt_2026_01_01_magnetar: v1ScmRepoPreviewPresenter
});

export let scmAccountPreviewPresenter = declarePresenter(scmAccountPreviewType, {
  mt_2025_01_01_dashboard: v1ScmAccountPreviewPresenter,
  mt_2026_01_01_magnetar: v1ScmAccountPreviewPresenter
});

export let scmProviderPresenter = declarePresenter(scmProviderType, {
  mt_2025_01_01_dashboard: v1ScmProviderPresenter,
  mt_2026_01_01_magnetar: v1ScmProviderPresenter
});

export let scmProviderSetupPresenter = declarePresenter(scmProviderSetupType, {
  mt_2025_01_01_dashboard: v1ScmProviderSetupPresenter,
  mt_2026_01_01_magnetar: v1ScmProviderSetupPresenter
});
