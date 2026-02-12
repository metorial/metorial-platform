import { declarePresenter, PRESENTER_NOT_AVAILABLE } from '@metorial/presenter';
import { dashboardApiKeyPresenter, v1ApiKeyPresenter } from './implementation/apiKey';
import { v1BootPresenter } from './implementation/boot';
import { v1CallbackPresenter } from './implementation/callback';
import { v1CallbackDestinationPresenter } from './implementation/callbackDestination';
import { v1CallbackEventPresenter } from './implementation/callbackEvent';
import { v1CallbackNotificationPresenter } from './implementation/callbackNotification';
import { v1ConsumerAccessPresenter } from './implementation/consumerAccess';
import { v1ConsumerAuthFactorPresenter } from './implementation/consumerAuthFactor';
import { v1ConsumerGroupPresenter } from './implementation/consumerGroup';
import { v1ConsumerProfilePresenter } from './implementation/consumerProfile';
import { v1ConsumerServerRequestPresenter } from './implementation/consumerServerRequest';
import { v1ConsumerSessionPresenter } from './implementation/consumerSession';
import {
  dashboardCustomServerPresenter,
  v1CustomServerPresenter
} from './implementation/customServer';
import { v1CustomServerCodeEditorTokenPresenter } from './implementation/customServerCodeEditorToken';
import { v1CustomServerDeploymentPresenter } from './implementation/customServerDeployment';
import { v1CustomServerEventPresenter } from './implementation/customServerEvent';
import {
  dashboardCustomServerVersionPresenter,
  v1CustomServerVersionPresenter
} from './implementation/customServerVersion';
import { v1DockerServerPresenter } from './implementation/dockerServer';
import { v1FilePresenter } from './implementation/file';
import { v1FileLinkPresenter } from './implementation/fileLink';
import { v1InstancePresenter } from './implementation/instance';
import { v1MachineAccessPresenter } from './implementation/machineAccess';
import { v1MagicMcpGroupPresenter } from './implementation/magicMcpGroup';
import {
  v1DashboardMagicMcpServerPresenter,
  v1MagicMcpServerPresenter
} from './implementation/magicMcpServer';
import {
  v1DashboardMagicMcpSessionPresenter,
  v1MagicMcpSessionPresenter
} from './implementation/magicMcpSession';
import { v1MagicMcpTokenPresenter } from './implementation/magicMcpToken';
import { v1ManagedServerTemplatePresenter } from './implementation/managedServerTemplate';
import { v1OrganizationPresenter } from './implementation/organization';
import { v1OrganizationActorPresenter } from './implementation/organizationActor';
import { v1OrganizationInvitePresenter } from './implementation/organizationInvite';
import { v1OrganizationMemberPresenter } from './implementation/organizationMember';
import { v1PortalPresenter } from './implementation/portal';
import { v1ProfilePresenter } from './implementation/profile';
import { v1ProjectPresenter } from './implementation/project';
import { v1ProviderOauthConnectionPresenter } from './implementation/providerOauthConnection';
import { v1ProviderOauthConnectionAuthenticationPresenter } from './implementation/providerOauthConnectionAuthentication';
import { v1ProviderOauthConnectionEventPresenter } from './implementation/providerOauthConnectionEvent';
import { v1ProviderOauthConnectionProfilePresenter } from './implementation/providerOauthConnectionProfile';
import { v1ProviderOauthConnectionTemplatePresenter } from './implementation/providerOauthConnectionTemplate';
import { v1ProviderOauthConnectionTemplateEvaluationPresenter } from './implementation/providerOauthConnectionTemplateEvaluation';
import { v1ProviderOauthDiscoveryPresenter } from './implementation/providerOauthDiscovery';
import { v1ProviderOauthTakeInPresenter } from './implementation/providerOauthTakeIn';
import { v1ProviderOauthTakeoutPresenter } from './implementation/providerOauthTakeout';
import { v1RemoteServerPresenter } from './implementation/remoteServer';
import { v1ScmAccountPreviewPresenter } from './implementation/scmAccountPreview';
import { v1ScmInstallPresenter } from './implementation/scmInstall';
import { v1ScmInstallationPresenter } from './implementation/scmInstallation';
import { v1ScmRepoPresenter } from './implementation/scmRepo';
import { v1ScmRepoPreviewPresenter } from './implementation/scmRepoPreview';
import { v1SecretPresenter } from './implementation/secret';
import { v1ServerPresenter } from './implementation/server';
import { v1ServerCapabilitiesPresenter } from './implementation/serverCapabilities';
import { v1ServerListingCategoryPresenter } from './implementation/serverCategory';
import { v1ServerListingCollectionPresenter } from './implementation/serverCollection';
import { v1ServerConfigVaultPresenter } from './implementation/serverConfigVault';
import { v1ServerDeploymentPresenter } from './implementation/serverDeployment';
import { v1ServerDeploymentConfigPresenter } from './implementation/serverDeploymentConfig';
import { v1ServerDeploymentTemplatePresenter } from './implementation/serverDeploymentTemplate';
import {
  dashboardServerImplementationPresenter,
  v1ServerImplementationPresenter
} from './implementation/serverImplementation';
import {
  dashboardServerListingPresenter,
  v1ServerListingPresenter,
  v1ServerListingReadmePresenter
} from './implementation/serverListing';
import { v1ServerOauthSessionPresenter } from './implementation/serverOauthSession';
import { v1ServerRunPresenter } from './implementation/serverRun';
import { v1ServerRunErrorPresenter } from './implementation/serverRunError';
import { v1ServerRunErrorGroupPresenter } from './implementation/serverRunErrorGroup';
import { v1ServerSessionPresenter } from './implementation/serverSession';
import { v1ServerVariantPresenter } from './implementation/serverVariant';
import { v1ServerVersionPresenter } from './implementation/serverVersion';
import { v1DashboardSessionPresenter, v1SessionPresenter } from './implementation/session';
import { v1SessionConnectionPresenter } from './implementation/sessionConnection';
import { v1SessionEventPresenter } from './implementation/sessionEvent';
import {
  dashboardSessionMessagePresenter,
  v1SessionMessagePresenter
} from './implementation/sessionMessage';
import { v1SsoTenantPresenter } from './implementation/ssoTenant';
import { v1SsoTenantSetupPresenter } from './implementation/ssoTenantSetup';
import { v1SsoUserPresenter } from './implementation/ssoUser';
import { v1SsoUserProfilePresenter } from './implementation/ssoUserProfile';
import { v1TeamPresenter } from './implementation/team';
import { v1TeamRolePresenter } from './implementation/teamRole';
import { v1TeamRolePermissionsPresenter } from './implementation/teamRolePermissons';
import { v1UsagePresenter } from './implementation/usage';
import { v1UserPresenter } from './implementation/user';

// Provider API presenters
import {
  v1PublisherPresenter,
  v1VersionPresenter,
  v1ProviderPresenter,
  v1CategoryPresenter,
  v1CollectionPresenter,
  v1GroupPresenter,
  v1ProviderListingPresenter,
  v1ToolPresenter,
  v1AuthMethodPresenter,
  v1SpecificationPresenter,
  v1DeploymentPresenter,
  v1DeploymentPreviewPresenter,
  v1ConfigPresenter,
  v1ConfigPreviewPresenter,
  v1ProviderConfigVaultPresenter,
  v1AuthConfigPresenter,
  v1AuthCredentialsPresenter,
  v1SetupSessionPresenter,
  v1AuthImportPresenter,
  v1AuthExportPresenter,
  v1SessionTemplatePresenter,
  v1SessionTemplateProviderPresenter,
  v1ProviderSessionPresenter,
  v1SessionProviderPresenter,
  v1SessionParticipantPresenter,
  v1SessionErrorPresenter,
  v1SessionErrorGroupPresenter,
  v1ProviderRunPresenter,
  v1SubspaceSessionMessagePresenter,
  v1SubspaceSessionConnectionPresenter,
  v1SubspaceSessionEventPresenter,
  v1ProviderRunLogsPresenter,
  v1ConfigSchemaPresenter,
  v1AuthImportSchemaPresenter,
  // Custom Provider presenters
  v1CustomProviderPresenter,
  v1CustomProviderVersionPresenter,
  v1CustomProviderDeploymentPresenter,
  v1CustomProviderDeploymentLogsPresenter,
  v1CustomProviderCommitPresenter,
  v1CustomProviderEnvironmentPresenter,
  v1ProviderOAuthSetupPresenter
} from './implementation/provider';

import {
  apiKeyType,
  bootType,
  callbackDestinationType,
  callbackEventType,
  callbackNotificationType,
  callbackType,
  consumerAccessType,
  consumerAuthFactorType,
  consumerGroupType,
  consumerProfileType,
  consumerServerRequestType,
  consumerSessionType,
  customServerCodeEditorTokenType,
  customServerDeploymentType,
  customServerEventType,
  customServerType,
  customServerVersionType,
  dockerServerType,
  fileLinkType,
  fileType,
  instanceType,
  machineAccessType,
  magicMcpGroupType,
  magicMcpServerType,
  magicMcpSessionType,
  magicMcpTokenType,
  managedServerTemplateType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  portalType,
  profileType,
  projectType,
  providerOauthConnectionAuthenticationType,
  providerOauthConnectionDiscoveryType,
  providerOauthConnectionEventType,
  providerOauthConnectionProfileType,
  providerOauthConnectionTemplateEvaluationType,
  providerOauthConnectionTemplateType,
  providerOauthConnectionType,
  providerOauthTakeInType,
  providerOauthTakeoutType,
  remoteServerType,
  scmAccountPreviewType,
  scmInstallationType,
  scmInstallType,
  scmRepoPreviewType,
  scmRepoType,
  secretType,
  serverCapabilitiesType,
  serverConfigVaultType,
  serverDeploymentConfigType,
  serverDeploymentTemplateType,
  serverDeploymentType,
  serverImplementationType,
  serverListingCategoryType,
  serverListingCollectionType,
  serverListingType,
  serverOauthSessionType,
  serverRunErrorGroupType,
  serverRunErrorType,
  serverRunType,
  serverSessionType,
  serverType,
  serverVariantType,
  serverVersionType,
  sessionConnectionType,
  sessionEventType,
  sessionMessageType,
  sessionType,
  ssoTenantSetupType,
  ssoTenantType,
  ssoUserProfileType,
  ssoUserType,
  teamRolePermissionsType,
  teamRoleType,
  teamType,
  usageType,
  userType,
  // Provider API types
  publisherType,
  versionType,
  providerType,
  categoryType,
  collectionType,
  groupType,
  providerListingType,
  toolType,
  authMethodType,
  specificationType,
  deploymentType,
  deploymentPreviewType,
  configType,
  configPreviewType,
  configVaultType,
  authConfigType,
  authCredentialsType,
  setupSessionType,
  authImportType,
  authExportType,
  // Session template & session-nested types
  sessionTemplateType,
  sessionTemplateProviderType,
  sessionProviderType,
  sessionParticipantType,
  sessionErrorType,
  sessionErrorGroupType,
  providerRunType,
  // Provider Session type (Magnetar)
  providerSessionType,
  // Provider API session-nested types (Magnetar)
  subspaceSessionMessageType,
  subspaceSessionConnectionType,
  subspaceSessionEventType,
  providerRunLogsType,
  configSchemaType,
  authImportSchemaType,
  // Custom Provider types
  customProviderType,
  customProviderVersionType,
  customProviderDeploymentType,
  customProviderDeploymentLogsType,
  customProviderCommitType,
  customProviderEnvironmentType,
  providerOAuthSetupType
} from './types';

// =============================================================================
// Core API Presenters (available in all versions)
// =============================================================================

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_pulsar: v1ApiKeyPresenter,
  mt_2025_01_01_dashboard: dashboardApiKeyPresenter,
  mt_2026_02_01_magnetar: v1ApiKeyPresenter,
  mt_2026_02_01_dashboard: dashboardApiKeyPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  mt_2025_01_01_pulsar: v1InstancePresenter,
  mt_2025_01_01_dashboard: v1InstancePresenter,
  mt_2026_02_01_magnetar: v1InstancePresenter,
  mt_2026_02_01_dashboard: v1InstancePresenter
});

export let machineAccessPresenter = declarePresenter(machineAccessType, {
  mt_2025_01_01_pulsar: v1MachineAccessPresenter,
  mt_2025_01_01_dashboard: v1MachineAccessPresenter,
  mt_2026_02_01_magnetar: v1MachineAccessPresenter,
  mt_2026_02_01_dashboard: v1MachineAccessPresenter
});

export let organizationActorPresenter = declarePresenter(organizationActorType, {
  mt_2025_01_01_pulsar: v1OrganizationActorPresenter,
  mt_2025_01_01_dashboard: v1OrganizationActorPresenter,
  mt_2026_02_01_magnetar: v1OrganizationActorPresenter,
  mt_2026_02_01_dashboard: v1OrganizationActorPresenter
});

export let organizationInvitePresenter = declarePresenter(organizationInviteType, {
  mt_2025_01_01_pulsar: v1OrganizationInvitePresenter,
  mt_2025_01_01_dashboard: v1OrganizationInvitePresenter,
  mt_2026_02_01_magnetar: v1OrganizationInvitePresenter,
  mt_2026_02_01_dashboard: v1OrganizationInvitePresenter
});

export let organizationMemberPresenter = declarePresenter(organizationMemberType, {
  mt_2025_01_01_pulsar: v1OrganizationMemberPresenter,
  mt_2025_01_01_dashboard: v1OrganizationMemberPresenter,
  mt_2026_02_01_magnetar: v1OrganizationMemberPresenter,
  mt_2026_02_01_dashboard: v1OrganizationMemberPresenter
});

export let organizationPresenter = declarePresenter(organizationType, {
  mt_2025_01_01_pulsar: v1OrganizationPresenter,
  mt_2025_01_01_dashboard: v1OrganizationPresenter,
  mt_2026_02_01_magnetar: v1OrganizationPresenter,
  mt_2026_02_01_dashboard: v1OrganizationPresenter
});

export let projectPresenter = declarePresenter(projectType, {
  mt_2025_01_01_pulsar: v1ProjectPresenter,
  mt_2025_01_01_dashboard: v1ProjectPresenter,
  mt_2026_02_01_magnetar: v1ProjectPresenter,
  mt_2026_02_01_dashboard: v1ProjectPresenter
});

export let userPresenter = declarePresenter(userType, {
  mt_2025_01_01_pulsar: v1UserPresenter,
  mt_2025_01_01_dashboard: v1UserPresenter,
  mt_2026_02_01_magnetar: v1UserPresenter,
  mt_2026_02_01_dashboard: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  mt_2025_01_01_pulsar: v1BootPresenter,
  mt_2025_01_01_dashboard: v1BootPresenter,
  mt_2026_02_01_magnetar: v1BootPresenter,
  mt_2026_02_01_dashboard: v1BootPresenter
});

export let filePresenter = declarePresenter(fileType, {
  mt_2025_01_01_pulsar: v1FilePresenter,
  mt_2025_01_01_dashboard: v1FilePresenter,
  mt_2026_02_01_magnetar: v1FilePresenter,
  mt_2026_02_01_dashboard: v1FilePresenter
});

export let fileLinkPresenter = declarePresenter(fileLinkType, {
  mt_2025_01_01_pulsar: v1FileLinkPresenter,
  mt_2025_01_01_dashboard: v1FileLinkPresenter,
  mt_2026_02_01_magnetar: v1FileLinkPresenter,
  mt_2026_02_01_dashboard: v1FileLinkPresenter
});

export let secretPresenter = declarePresenter(secretType, {
  mt_2025_01_01_pulsar: v1SecretPresenter,
  mt_2025_01_01_dashboard: v1SecretPresenter,
  mt_2026_02_01_magnetar: v1SecretPresenter,
  mt_2026_02_01_dashboard: v1SecretPresenter
});

export let serverPresenter = declarePresenter(serverType, {
  mt_2025_01_01_pulsar: v1ServerPresenter,
  mt_2025_01_01_dashboard: v1ServerPresenter,
  mt_2026_02_01_magnetar: v1ServerPresenter,
  mt_2026_02_01_dashboard: v1ServerPresenter
});

export let dockerServerPresenter = declarePresenter(dockerServerType, {
  mt_2025_01_01_pulsar: v1DockerServerPresenter,
  mt_2025_01_01_dashboard: v1DockerServerPresenter,
  mt_2026_02_01_magnetar: v1DockerServerPresenter,
  mt_2026_02_01_dashboard: v1DockerServerPresenter
});

export let serverVariantPresenter = declarePresenter(serverVariantType, {
  mt_2025_01_01_pulsar: v1ServerVariantPresenter,
  mt_2025_01_01_dashboard: v1ServerVariantPresenter,
  mt_2026_02_01_magnetar: v1ServerVariantPresenter,
  mt_2026_02_01_dashboard: v1ServerVariantPresenter
});

export let serverVersionPresenter = declarePresenter(serverVersionType, {
  mt_2025_01_01_pulsar: v1ServerVersionPresenter,
  mt_2025_01_01_dashboard: v1ServerVersionPresenter,
  mt_2026_02_01_magnetar: v1ServerVersionPresenter,
  mt_2026_02_01_dashboard: v1ServerVersionPresenter
});

export let serverListingPresenter = declarePresenter(serverListingType, {
  mt_2025_01_01_pulsar: v1ServerListingPresenter,
  mt_2025_01_01_dashboard: dashboardServerListingPresenter,
  mt_2026_02_01_magnetar: v1ServerListingPresenter,
  mt_2026_02_01_dashboard: dashboardServerListingPresenter
});

export let serverListingReadmePresenter = declarePresenter(serverListingType, {
  mt_2025_01_01_pulsar: v1ServerListingReadmePresenter,
  mt_2025_01_01_dashboard: v1ServerListingReadmePresenter,
  mt_2026_02_01_magnetar: v1ServerListingReadmePresenter,
  mt_2026_02_01_dashboard: v1ServerListingReadmePresenter
});

export let serverListingCategoryPresenter = declarePresenter(serverListingCategoryType, {
  mt_2025_01_01_pulsar: v1ServerListingCategoryPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCategoryPresenter,
  mt_2026_02_01_magnetar: v1ServerListingCategoryPresenter,
  mt_2026_02_01_dashboard: v1ServerListingCategoryPresenter
});

export let serverListingCollectionPresenter = declarePresenter(serverListingCollectionType, {
  mt_2025_01_01_pulsar: v1ServerListingCollectionPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCollectionPresenter,
  mt_2026_02_01_magnetar: v1ServerListingCollectionPresenter,
  mt_2026_02_01_dashboard: v1ServerListingCollectionPresenter
});

export let serverImplementationPresenter = declarePresenter(serverImplementationType, {
  mt_2025_01_01_pulsar: v1ServerImplementationPresenter,
  mt_2025_01_01_dashboard: dashboardServerImplementationPresenter,
  mt_2026_02_01_magnetar: v1ServerImplementationPresenter,
  mt_2026_02_01_dashboard: dashboardServerImplementationPresenter
});

export let serverDeploymentPresenter = declarePresenter(serverDeploymentType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentPresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentPresenter,
  mt_2026_02_01_magnetar: v1ServerDeploymentPresenter,
  mt_2026_02_01_dashboard: v1ServerDeploymentPresenter
});

export let serverDeploymentTemplatePresenter = declarePresenter(serverDeploymentTemplateType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentTemplatePresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentTemplatePresenter,
  mt_2026_02_01_magnetar: v1ServerDeploymentTemplatePresenter,
  mt_2026_02_01_dashboard: v1ServerDeploymentTemplatePresenter
});

export let serverDeploymentConfigPresenter = declarePresenter(serverDeploymentConfigType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentConfigPresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentConfigPresenter,
  mt_2026_02_01_magnetar: v1ServerDeploymentConfigPresenter,
  mt_2026_02_01_dashboard: v1ServerDeploymentConfigPresenter
});

export let usagePresenter = declarePresenter(usageType, {
  mt_2025_01_01_pulsar: v1UsagePresenter,
  mt_2025_01_01_dashboard: v1UsagePresenter,
  mt_2026_02_01_magnetar: v1UsagePresenter,
  mt_2026_02_01_dashboard: v1UsagePresenter
});

export let sessionPresenter = declarePresenter(sessionType, {
  mt_2025_01_01_pulsar: v1SessionPresenter,
  mt_2025_01_01_dashboard: v1DashboardSessionPresenter,
  mt_2026_02_01_magnetar: v1SessionPresenter,
  mt_2026_02_01_dashboard: v1DashboardSessionPresenter
});

export let serverRunPresenter = declarePresenter(serverRunType, {
  mt_2025_01_01_pulsar: v1ServerRunPresenter,
  mt_2025_01_01_dashboard: v1ServerRunPresenter,
  mt_2026_02_01_magnetar: v1ServerRunPresenter,
  mt_2026_02_01_dashboard: v1ServerRunPresenter
});

export let serverRunErrorPresenter = declarePresenter(serverRunErrorType, {
  mt_2025_01_01_pulsar: v1ServerRunErrorPresenter,
  mt_2025_01_01_dashboard: v1ServerRunErrorPresenter,
  mt_2026_02_01_magnetar: v1ServerRunErrorPresenter,
  mt_2026_02_01_dashboard: v1ServerRunErrorPresenter
});

export let serverRunErrorGroupPresenter = declarePresenter(serverRunErrorGroupType, {
  mt_2025_01_01_pulsar: v1ServerRunErrorGroupPresenter,
  mt_2025_01_01_dashboard: v1ServerRunErrorGroupPresenter,
  mt_2026_02_01_magnetar: v1ServerRunErrorGroupPresenter,
  mt_2026_02_01_dashboard: v1ServerRunErrorGroupPresenter
});

export let serverSessionPresenter = declarePresenter(serverSessionType, {
  mt_2025_01_01_pulsar: v1ServerSessionPresenter,
  mt_2025_01_01_dashboard: v1ServerSessionPresenter,
  mt_2026_02_01_magnetar: v1ServerSessionPresenter,
  mt_2026_02_01_dashboard: v1ServerSessionPresenter
});

export let sessionConnectionPresenter = declarePresenter(sessionConnectionType, {
  mt_2025_01_01_pulsar: v1SessionConnectionPresenter,
  mt_2025_01_01_dashboard: v1SessionConnectionPresenter,
  mt_2026_02_01_magnetar: v1SessionConnectionPresenter,
  mt_2026_02_01_dashboard: v1SessionConnectionPresenter
});

export let sessionEventPresenter = declarePresenter(sessionEventType, {
  mt_2025_01_01_pulsar: v1SessionEventPresenter,
  mt_2025_01_01_dashboard: v1SessionEventPresenter,
  mt_2026_02_01_magnetar: v1SessionEventPresenter,
  mt_2026_02_01_dashboard: v1SessionEventPresenter
});

export let sessionMessagePresenter = declarePresenter(sessionMessageType, {
  mt_2025_01_01_pulsar: v1SessionMessagePresenter,
  mt_2025_01_01_dashboard: dashboardSessionMessagePresenter,
  mt_2026_02_01_magnetar: v1SessionMessagePresenter,
  mt_2026_02_01_dashboard: dashboardSessionMessagePresenter
});

export let serverCapabilitiesPresenter = declarePresenter(serverCapabilitiesType, {
  mt_2025_01_01_pulsar: v1ServerCapabilitiesPresenter,
  mt_2025_01_01_dashboard: v1ServerCapabilitiesPresenter,
  mt_2026_02_01_magnetar: v1ServerCapabilitiesPresenter,
  mt_2026_02_01_dashboard: v1ServerCapabilitiesPresenter
});

export let profilePresenter = declarePresenter(profileType, {
  mt_2025_01_01_pulsar: v1ProfilePresenter,
  mt_2025_01_01_dashboard: v1ProfilePresenter,
  mt_2026_02_01_magnetar: v1ProfilePresenter,
  mt_2026_02_01_dashboard: v1ProfilePresenter
});

export let serverOAuthSessionPresenter = declarePresenter(serverOauthSessionType, {
  mt_2025_01_01_pulsar: v1ServerOauthSessionPresenter,
  mt_2025_01_01_dashboard: v1ServerOauthSessionPresenter,
  mt_2026_02_01_magnetar: v1ServerOauthSessionPresenter,
  mt_2026_02_01_dashboard: v1ServerOauthSessionPresenter
});

export let callbackPresenter = declarePresenter(callbackType, {
  mt_2025_01_01_pulsar: v1CallbackPresenter,
  mt_2025_01_01_dashboard: v1CallbackPresenter,
  mt_2026_02_01_magnetar: v1CallbackPresenter,
  mt_2026_02_01_dashboard: v1CallbackPresenter
});

export let callbackEventPresenter = declarePresenter(callbackEventType, {
  mt_2025_01_01_pulsar: v1CallbackEventPresenter,
  mt_2025_01_01_dashboard: v1CallbackEventPresenter,
  mt_2026_02_01_magnetar: v1CallbackEventPresenter,
  mt_2026_02_01_dashboard: v1CallbackEventPresenter
});

export let callbackNotificationPresenter = declarePresenter(callbackNotificationType, {
  mt_2025_01_01_pulsar: v1CallbackNotificationPresenter,
  mt_2025_01_01_dashboard: v1CallbackNotificationPresenter,
  mt_2026_02_01_magnetar: v1CallbackNotificationPresenter,
  mt_2026_02_01_dashboard: v1CallbackNotificationPresenter
});

export let callbackDestinationPresenter = declarePresenter(callbackDestinationType, {
  mt_2025_01_01_pulsar: v1CallbackDestinationPresenter,
  mt_2025_01_01_dashboard: v1CallbackDestinationPresenter,
  mt_2026_02_01_magnetar: v1CallbackDestinationPresenter,
  mt_2026_02_01_dashboard: v1CallbackDestinationPresenter
});

export let serverConfigVaultPresenter = declarePresenter(serverConfigVaultType, {
  mt_2025_01_01_pulsar: v1ServerConfigVaultPresenter,
  mt_2025_01_01_dashboard: v1ServerConfigVaultPresenter,
  mt_2026_02_01_magnetar: v1ServerConfigVaultPresenter,
  mt_2026_02_01_dashboard: v1ServerConfigVaultPresenter
});

export let teamPresenter = declarePresenter(teamType, {
  mt_2025_01_01_pulsar: v1TeamPresenter,
  mt_2025_01_01_dashboard: v1TeamPresenter,
  mt_2026_02_01_magnetar: v1TeamPresenter,
  mt_2026_02_01_dashboard: v1TeamPresenter
});

export let teamRolePresenter = declarePresenter(teamRoleType, {
  mt_2025_01_01_pulsar: v1TeamRolePresenter,
  mt_2025_01_01_dashboard: v1TeamRolePresenter,
  mt_2026_02_01_magnetar: v1TeamRolePresenter,
  mt_2026_02_01_dashboard: v1TeamRolePresenter
});

export let teamRolePermissionsPresenter = declarePresenter(teamRolePermissionsType, {
  mt_2025_01_01_pulsar: v1TeamRolePermissionsPresenter,
  mt_2025_01_01_dashboard: v1TeamRolePermissionsPresenter,
  mt_2026_02_01_magnetar: v1TeamRolePermissionsPresenter,
  mt_2026_02_01_dashboard: v1TeamRolePermissionsPresenter
});

export let ssoTenantPresenter = declarePresenter(ssoTenantType, {
  mt_2025_01_01_pulsar: v1SsoTenantPresenter,
  mt_2025_01_01_dashboard: v1SsoTenantPresenter,
  mt_2026_02_01_magnetar: v1SsoTenantPresenter,
  mt_2026_02_01_dashboard: v1SsoTenantPresenter
});

export let ssoTenantSetupPresenter = declarePresenter(ssoTenantSetupType, {
  mt_2025_01_01_pulsar: v1SsoTenantSetupPresenter,
  mt_2025_01_01_dashboard: v1SsoTenantSetupPresenter,
  mt_2026_02_01_magnetar: v1SsoTenantSetupPresenter,
  mt_2026_02_01_dashboard: v1SsoTenantSetupPresenter
});

export let ssoUserPresenter = declarePresenter(ssoUserType, {
  mt_2025_01_01_pulsar: v1SsoUserPresenter,
  mt_2025_01_01_dashboard: v1SsoUserPresenter,
  mt_2026_02_01_magnetar: v1SsoUserPresenter,
  mt_2026_02_01_dashboard: v1SsoUserPresenter
});

export let ssoUserProfilePresenter = declarePresenter(ssoUserProfileType, {
  mt_2025_01_01_pulsar: v1SsoUserProfilePresenter,
  mt_2025_01_01_dashboard: v1SsoUserProfilePresenter,
  mt_2026_02_01_magnetar: v1SsoUserProfilePresenter,
  mt_2026_02_01_dashboard: v1SsoUserProfilePresenter
});

export let portalPresenter = declarePresenter(portalType, {
  mt_2025_01_01_pulsar: v1PortalPresenter,
  mt_2025_01_01_dashboard: v1PortalPresenter,
  mt_2026_02_01_magnetar: v1PortalPresenter,
  mt_2026_02_01_dashboard: v1PortalPresenter
});

export let consumerGroupPresenter = declarePresenter(consumerGroupType, {
  mt_2025_01_01_pulsar: v1ConsumerGroupPresenter,
  mt_2025_01_01_dashboard: v1ConsumerGroupPresenter,
  mt_2026_02_01_magnetar: v1ConsumerGroupPresenter,
  mt_2026_02_01_dashboard: v1ConsumerGroupPresenter
});

export let consumerAuthFactorPresenter = declarePresenter(consumerAuthFactorType, {
  mt_2025_01_01_pulsar: v1ConsumerAuthFactorPresenter,
  mt_2025_01_01_dashboard: v1ConsumerAuthFactorPresenter,
  mt_2026_02_01_magnetar: v1ConsumerAuthFactorPresenter,
  mt_2026_02_01_dashboard: v1ConsumerAuthFactorPresenter
});

export let consumerAccessPresenter = declarePresenter(consumerAccessType, {
  mt_2025_01_01_pulsar: v1ConsumerAccessPresenter,
  mt_2025_01_01_dashboard: v1ConsumerAccessPresenter,
  mt_2026_02_01_magnetar: v1ConsumerAccessPresenter,
  mt_2026_02_01_dashboard: v1ConsumerAccessPresenter
});

export let consumerProfilePresenter = declarePresenter(consumerProfileType, {
  mt_2025_01_01_pulsar: v1ConsumerProfilePresenter,
  mt_2025_01_01_dashboard: v1ConsumerProfilePresenter,
  mt_2026_02_01_magnetar: v1ConsumerProfilePresenter,
  mt_2026_02_01_dashboard: v1ConsumerProfilePresenter
});

export let consumerSessionPresenter = declarePresenter(consumerSessionType, {
  mt_2025_01_01_pulsar: v1ConsumerSessionPresenter,
  mt_2025_01_01_dashboard: v1ConsumerSessionPresenter,
  mt_2026_02_01_magnetar: v1ConsumerSessionPresenter,
  mt_2026_02_01_dashboard: v1ConsumerSessionPresenter
});

export let consumerServerRequestPresenter = declarePresenter(consumerServerRequestType, {
  mt_2025_01_01_pulsar: v1ConsumerServerRequestPresenter,
  mt_2025_01_01_dashboard: v1ConsumerServerRequestPresenter,
  mt_2026_02_01_magnetar: v1ConsumerServerRequestPresenter,
  mt_2026_02_01_dashboard: v1ConsumerServerRequestPresenter
});

export let scmInstallPresenter = declarePresenter(scmInstallType, {
  mt_2025_01_01_pulsar: v1ScmInstallPresenter,
  mt_2025_01_01_dashboard: v1ScmInstallPresenter,
  mt_2026_02_01_magnetar: v1ScmInstallPresenter,
  mt_2026_02_01_dashboard: v1ScmInstallPresenter
});

export let scmRepoPreviewPresenter = declarePresenter(scmRepoPreviewType, {
  mt_2025_01_01_pulsar: v1ScmRepoPreviewPresenter,
  mt_2025_01_01_dashboard: v1ScmRepoPreviewPresenter,
  mt_2026_02_01_magnetar: v1ScmRepoPreviewPresenter,
  mt_2026_02_01_dashboard: v1ScmRepoPreviewPresenter
});

export let scmAccountPreviewPresenter = declarePresenter(scmAccountPreviewType, {
  mt_2025_01_01_pulsar: v1ScmAccountPreviewPresenter,
  mt_2025_01_01_dashboard: v1ScmAccountPreviewPresenter,
  mt_2026_02_01_magnetar: v1ScmAccountPreviewPresenter,
  mt_2026_02_01_dashboard: v1ScmAccountPreviewPresenter
});

export let scmRepoPresenter = declarePresenter(scmRepoType, {
  mt_2025_01_01_pulsar: v1ScmRepoPresenter,
  mt_2025_01_01_dashboard: v1ScmRepoPresenter,
  mt_2026_02_01_magnetar: v1ScmRepoPresenter,
  mt_2026_02_01_dashboard: v1ScmRepoPresenter
});

export let scmInstallationPresenter = declarePresenter(scmInstallationType, {
  mt_2025_01_01_pulsar: v1ScmInstallationPresenter,
  mt_2025_01_01_dashboard: v1ScmInstallationPresenter,
  mt_2026_02_01_magnetar: v1ScmInstallationPresenter,
  mt_2026_02_01_dashboard: v1ScmInstallationPresenter
});

// =============================================================================
// Deprecated Presenters (OAuth - available in pulsar/dashboard only)
// =============================================================================

export let providerOauthConnectionPresenter = declarePresenter(providerOauthConnectionType, {
  mt_2025_01_01_pulsar: v1ProviderOauthConnectionPresenter,
  mt_2025_01_01_dashboard: v1ProviderOauthConnectionPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let providerOauthConnectionAuthenticationPresenter = declarePresenter(
  providerOauthConnectionAuthenticationType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionAuthenticationPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionAuthenticationPresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthConnectionEventPresenter = declarePresenter(
  providerOauthConnectionEventType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionEventPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionEventPresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthConnectionProfilePresenter = declarePresenter(
  providerOauthConnectionProfileType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionProfilePresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionProfilePresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthConnectionTemplatePresenter = declarePresenter(
  providerOauthConnectionTemplateType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionTemplatePresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionTemplatePresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthConnectionTemplateEvaluationPresenter = declarePresenter(
  providerOauthConnectionTemplateEvaluationType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionTemplateEvaluationPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionTemplateEvaluationPresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthDiscoveryPresenter = declarePresenter(
  providerOauthConnectionDiscoveryType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthDiscoveryPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthDiscoveryPresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let providerOauthTakeoutPresenter = declarePresenter(providerOauthTakeoutType, {
  mt_2025_01_01_pulsar: v1ProviderOauthTakeoutPresenter,
  mt_2025_01_01_dashboard: v1ProviderOauthTakeoutPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let providerOauthTakeInPresenter = declarePresenter(providerOauthTakeInType, {
  mt_2025_01_01_pulsar: v1ProviderOauthTakeInPresenter,
  mt_2025_01_01_dashboard: v1ProviderOauthTakeInPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

// =============================================================================
// Deprecated Presenters (Custom Server - available in pulsar/dashboard only)
// =============================================================================

export let remoteServerPresenter = declarePresenter(remoteServerType, {
  mt_2025_01_01_dashboard: v1RemoteServerPresenter,
  mt_2025_01_01_pulsar: v1RemoteServerPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let customServerPresenter = declarePresenter(customServerType, {
  mt_2025_01_01_pulsar: v1CustomServerPresenter,
  mt_2025_01_01_dashboard: dashboardCustomServerPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let customServerVersionPresenter = declarePresenter(customServerVersionType, {
  mt_2025_01_01_pulsar: v1CustomServerVersionPresenter,
  mt_2025_01_01_dashboard: dashboardCustomServerVersionPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let customServerEventPresenter = declarePresenter(customServerEventType, {
  mt_2025_01_01_pulsar: v1CustomServerEventPresenter,
  mt_2025_01_01_dashboard: v1CustomServerEventPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let customServerDeploymentPresenter = declarePresenter(customServerDeploymentType, {
  mt_2025_01_01_pulsar: v1CustomServerDeploymentPresenter,
  mt_2025_01_01_dashboard: v1CustomServerDeploymentPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let customServerCodeEditorTokenTypePresenter = declarePresenter(
  customServerCodeEditorTokenType,
  {
    mt_2025_01_01_pulsar: v1CustomServerCodeEditorTokenPresenter,
    mt_2025_01_01_dashboard: v1CustomServerCodeEditorTokenPresenter,
    mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
  }
);

export let managedServerTemplateTypePresenter = declarePresenter(managedServerTemplateType, {
  mt_2025_01_01_pulsar: v1ManagedServerTemplatePresenter,
  mt_2025_01_01_dashboard: v1ManagedServerTemplatePresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

// =============================================================================
// Deprecated Presenters (Magic MCP - available in pulsar/dashboard only)
// =============================================================================

export let magicMcpServerPresenter = declarePresenter(magicMcpServerType, {
  mt_2025_01_01_pulsar: v1MagicMcpServerPresenter,
  mt_2025_01_01_dashboard: v1DashboardMagicMcpServerPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let magicMcpSessionPresenter = declarePresenter(magicMcpSessionType, {
  mt_2025_01_01_pulsar: v1MagicMcpSessionPresenter,
  mt_2025_01_01_dashboard: v1DashboardMagicMcpSessionPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let magicMcpTokenPresenter = declarePresenter(magicMcpTokenType, {
  mt_2025_01_01_pulsar: v1MagicMcpTokenPresenter,
  mt_2025_01_01_dashboard: v1MagicMcpTokenPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

export let magicMcpGroupPresenter = declarePresenter(magicMcpGroupType, {
  mt_2025_01_01_pulsar: v1MagicMcpGroupPresenter,
  mt_2025_01_01_dashboard: v1MagicMcpGroupPresenter,
  mt_2026_02_01_magnetar: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_dashboard: PRESENTER_NOT_AVAILABLE
});

// =============================================================================
// Provider API Presenters (available in magnetar only)
// =============================================================================

export let publisherPresenter = declarePresenter(publisherType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1PublisherPresenter,
  mt_2026_02_01_dashboard: v1PublisherPresenter
});

export let providerVersionPresenter = declarePresenter(versionType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1VersionPresenter,
  mt_2026_02_01_dashboard: v1VersionPresenter
});

export let providerPresenter = declarePresenter(providerType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderPresenter,
  mt_2026_02_01_dashboard: v1ProviderPresenter
});

export let providerCategoryPresenter = declarePresenter(categoryType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1CategoryPresenter,
  mt_2026_02_01_dashboard: v1CategoryPresenter
});

export let providerCollectionPresenter = declarePresenter(collectionType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1CollectionPresenter,
  mt_2026_02_01_dashboard: v1CollectionPresenter
});

export let providerGroupPresenter = declarePresenter(groupType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1GroupPresenter,
  mt_2026_02_01_dashboard: v1GroupPresenter
});

export let providerListingPresenter = declarePresenter(providerListingType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderListingPresenter,
  mt_2026_02_01_dashboard: v1ProviderListingPresenter
});

export let providerToolPresenter = declarePresenter(toolType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ToolPresenter,
  mt_2026_02_01_dashboard: v1ToolPresenter
});

export let providerAuthMethodPresenter = declarePresenter(authMethodType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthMethodPresenter,
  mt_2026_02_01_dashboard: v1AuthMethodPresenter
});

export let providerSpecificationPresenter = declarePresenter(specificationType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SpecificationPresenter,
  mt_2026_02_01_dashboard: v1SpecificationPresenter
});

export let providerDeploymentPresenter = declarePresenter(deploymentType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1DeploymentPresenter,
  mt_2026_02_01_dashboard: v1DeploymentPresenter
});

export let providerDeploymentPreviewPresenter = declarePresenter(deploymentPreviewType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1DeploymentPreviewPresenter,
  mt_2026_02_01_dashboard: v1DeploymentPreviewPresenter
});

export let providerConfigPresenter = declarePresenter(configType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ConfigPresenter,
  mt_2026_02_01_dashboard: v1ConfigPresenter
});

export let providerConfigPreviewPresenter = declarePresenter(configPreviewType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ConfigPreviewPresenter,
  mt_2026_02_01_dashboard: v1ConfigPreviewPresenter
});

export let providerConfigVaultPresenter = declarePresenter(configVaultType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderConfigVaultPresenter,
  mt_2026_02_01_dashboard: v1ProviderConfigVaultPresenter
});

export let providerAuthConfigPresenter = declarePresenter(authConfigType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthConfigPresenter,
  mt_2026_02_01_dashboard: v1AuthConfigPresenter
});

export let providerAuthCredentialsPresenter = declarePresenter(authCredentialsType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthCredentialsPresenter,
  mt_2026_02_01_dashboard: v1AuthCredentialsPresenter
});

export let providerSetupSessionPresenter = declarePresenter(setupSessionType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SetupSessionPresenter,
  mt_2026_02_01_dashboard: v1SetupSessionPresenter
});

export let providerAuthImportPresenter = declarePresenter(authImportType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthImportPresenter,
  mt_2026_02_01_dashboard: v1AuthImportPresenter
});

export let providerAuthExportPresenter = declarePresenter(authExportType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthExportPresenter,
  mt_2026_02_01_dashboard: v1AuthExportPresenter
});

// =============================================================================
// Session Template & Session-Nested Presenters (available in magnetar only)
// =============================================================================

export let sessionTemplatePresenter = declarePresenter(sessionTemplateType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionTemplatePresenter,
  mt_2026_02_01_dashboard: v1SessionTemplatePresenter
});

export let sessionTemplateProviderPresenter = declarePresenter(sessionTemplateProviderType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionTemplateProviderPresenter,
  mt_2026_02_01_dashboard: v1SessionTemplateProviderPresenter
});

export let sessionProviderPresenter = declarePresenter(sessionProviderType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionProviderPresenter,
  mt_2026_02_01_dashboard: v1SessionProviderPresenter
});

export let sessionParticipantPresenter = declarePresenter(sessionParticipantType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionParticipantPresenter,
  mt_2026_02_01_dashboard: v1SessionParticipantPresenter
});

export let subspaceSessionErrorPresenter = declarePresenter(sessionErrorType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionErrorPresenter,
  mt_2026_02_01_dashboard: v1SessionErrorPresenter
});

export let subspaceSessionErrorGroupPresenter = declarePresenter(sessionErrorGroupType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SessionErrorGroupPresenter,
  mt_2026_02_01_dashboard: v1SessionErrorGroupPresenter
});

export let subspaceProviderRunPresenter = declarePresenter(providerRunType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderRunPresenter,
  mt_2026_02_01_dashboard: v1ProviderRunPresenter
});

// Provider Session presenter (Magnetar only - uses provider_deployments instead of server_deployments)
export let providerSessionPresenter = declarePresenter(providerSessionType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderSessionPresenter,
  mt_2026_02_01_dashboard: v1ProviderSessionPresenter
});

// Provider API session-nested presenters (Magnetar only)
export let subspaceSessionMessagePresenter = declarePresenter(subspaceSessionMessageType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SubspaceSessionMessagePresenter,
  mt_2026_02_01_dashboard: v1SubspaceSessionMessagePresenter
});

export let subspaceSessionConnectionPresenter = declarePresenter(
  subspaceSessionConnectionType,
  {
    mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
    mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_magnetar: v1SubspaceSessionConnectionPresenter,
    mt_2026_02_01_dashboard: v1SubspaceSessionConnectionPresenter
  }
);

export let subspaceSessionEventPresenter = declarePresenter(subspaceSessionEventType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1SubspaceSessionEventPresenter,
  mt_2026_02_01_dashboard: v1SubspaceSessionEventPresenter
});

export let providerRunLogsPresenter = declarePresenter(providerRunLogsType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderRunLogsPresenter,
  mt_2026_02_01_dashboard: v1ProviderRunLogsPresenter
});

export let configSchemaPresenter = declarePresenter(configSchemaType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ConfigSchemaPresenter,
  mt_2026_02_01_dashboard: v1ConfigSchemaPresenter
});

export let authImportSchemaPresenter = declarePresenter(authImportSchemaType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1AuthImportSchemaPresenter,
  mt_2026_02_01_dashboard: v1AuthImportSchemaPresenter
});

// =============================================================================
// Custom Provider Presenters (available in magnetar only)
// =============================================================================

export let subspaceCustomProviderPresenter = declarePresenter(customProviderType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1CustomProviderPresenter,
  mt_2026_02_01_dashboard: v1CustomProviderPresenter
});

export let subspaceCustomProviderVersionPresenter = declarePresenter(customProviderVersionType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1CustomProviderVersionPresenter,
  mt_2026_02_01_dashboard: v1CustomProviderVersionPresenter
});

export let subspaceCustomProviderDeploymentPresenter = declarePresenter(
  customProviderDeploymentType,
  {
    mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
    mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_magnetar: v1CustomProviderDeploymentPresenter,
    mt_2026_02_01_dashboard: v1CustomProviderDeploymentPresenter
  }
);

export let subspaceCustomProviderDeploymentLogsPresenter = declarePresenter(
  customProviderDeploymentLogsType,
  {
    mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
    mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_magnetar: v1CustomProviderDeploymentLogsPresenter,
    mt_2026_02_01_dashboard: v1CustomProviderDeploymentLogsPresenter
  }
);

export let subspaceCustomProviderCommitPresenter = declarePresenter(customProviderCommitType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1CustomProviderCommitPresenter,
  mt_2026_02_01_dashboard: v1CustomProviderCommitPresenter
});

export let subspaceCustomProviderEnvironmentPresenter = declarePresenter(
  customProviderEnvironmentType,
  {
    mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
    mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
    mt_2026_02_01_magnetar: v1CustomProviderEnvironmentPresenter,
    mt_2026_02_01_dashboard: v1CustomProviderEnvironmentPresenter
  }
);

export let subspaceProviderOAuthSetupPresenter = declarePresenter(providerOAuthSetupType, {
  mt_2025_01_01_pulsar: PRESENTER_NOT_AVAILABLE,
  mt_2025_01_01_dashboard: PRESENTER_NOT_AVAILABLE,
  mt_2026_02_01_magnetar: v1ProviderOAuthSetupPresenter,
  mt_2026_02_01_dashboard: v1ProviderOAuthSetupPresenter
});
