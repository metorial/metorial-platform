import { declarePresenter } from '@metorial/presenter';
import { dashboardApiKeyPresenter, v1ApiKeyPresenter } from './implementation/apiKey';
import { v1BootPresenter } from './implementation/boot';
import { v1ConsumerGroupPresenter } from './implementation/consumerGroup';
import { v1ConsumerProfilePresenter } from './implementation/consumerProfile';
import { v1ConsumerAccessPresenter } from './implementation/consumerAccess';
import { v1ConsumerAccessRequestPresenter } from './implementation/consumerAccessRequest';
import { v1ConsumerProviderPresenter } from './implementation/consumerProvider';
import { v1ConsumerSessionPresenter } from './implementation/consumerSession';
import { v1FilePresenter } from './implementation/file';
import { v1FileLinkPresenter } from './implementation/fileLink';
import { v1InstancePresenter } from './implementation/instance';
import { v1MachineAccessPresenter } from './implementation/machineAccess';
import { v1OrganizationPresenter } from './implementation/organization';
import { v1OrganizationActorPresenter } from './implementation/organizationActor';
import { v1OrganizationInvitePresenter } from './implementation/organizationInvite';
import { v1OrganizationMemberPresenter } from './implementation/organizationMember';
import { v1PortalPresenter } from './implementation/portal';
import { v1PortalAuthAppPresenter } from './implementation/portalAuthApp';
import { v1PortalAuthSsoConnectionPresenter } from './implementation/portalAuthSsoConnection';
import { v1PortalAuthSsoTenantPresenter } from './implementation/portalAuthSsoTenant';
import { v1PortalAuthSsoTenantSetupPresenter } from './implementation/portalAuthSsoTenantSetup';
import { v1ProfilePresenter } from './implementation/profile';
import { v1ProjectPresenter } from './implementation/project';
import { v1ProviderTemplatePresenter } from './implementation/providerTemplate';
import { v1SecretPresenter } from './implementation/secret';
import { v1TeamPresenter } from './implementation/team';
import { v1TeamRolePresenter } from './implementation/teamRole';
import { v1TeamRolePermissionsPresenter } from './implementation/teamRolePermissions';
import { v1UsagePresenter } from './implementation/usage';
import { v1UserPresenter } from './implementation/user';

// Provider API presenters
import {
  dashboardCustomProviderDeploymentPresenter,
  dashboardCustomProviderPresenter,
  dashboardProviderPresenter,
  v1BucketEditorTokenPresenter,
  v1ConfigPresenter,
  v1CustomProviderCommitPresenter,
  v1CustomProviderDeploymentLogsPresenter,
  v1CustomProviderDeploymentPresenter,
  v1CustomProviderEnvironmentPresenter,
  v1MagicMcpGroupPresenter,
  v1MagicMcpServerPresenter,
  v1MagicMcpSessionPresenter,
  v1MagicMcpTokenPresenter,
  // Custom Provider presenters
  v1CustomProviderPresenter,
  v1CustomProviderVersionPresenter,
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
  v1ProviderListingCategoryPresenter,
  v1ProviderListingCollectionPresenter,
  v1ProviderListingGroupPresenter,
  v1ProviderListingPresenter,
  v1ProviderPresenter,
  v1ProviderRunLogsPresenter,
  v1ProviderRunPresenter,
  v1ProviderSpecificationPresenter,
  v1ProviderToolCallPresenter,
  v1ProviderToolPresenter,
  v1ProviderTypePresenter,
  v1ProviderVersionPresenter,
  v1PublisherPresenter,
  v1SessionConnectionPresenter,
  v1SessionErrorGroupPresenter,
  v1SessionErrorPresenter,
  v1SessionParticipantPresenter,
  v1SessionPresenter,
  v1SessionProviderPresenter,
  v1SessionTemplatePresenter,
  v1SessionTemplateProviderPresenter,
  v1SetupSessionPresenter,
  v1SubspaceSessionEventPresenter,
  v1SubspaceSessionMessagePresenter
} from './implementation/provider';

import {
  v1ScmAccountPreviewPresenter,
  v1ScmConnectionPresenter,
  v1ScmConnectionSetupPresenter,
  v1ScmProviderPresenter,
  v1ScmProviderSetupPresenter,
  v1ScmRepoPresenter,
  v1ScmRepoPreviewPresenter
} from './implementation/scm';

import {
  apiKeyType,
  authConfigSchemaType,
  authImportSchemaType,
  bootType,
  consumerAccessRequestType,
  consumerAccessType,
  consumerGroupType,
  consumerProfileType,
  consumerProviderType,
  consumerSessionType,
  bucketEditorTokenType,
  configPreviewType,
  configSchemaType,
  customProviderCommitType,
  customProviderDeploymentLogsType,
  customProviderDeploymentType,
  customProviderEnvironmentType,
  // Custom Provider types
  customProviderType,
  customProviderVersionType,
  deploymentPreviewType,
  fileLinkType,
  fileType,
  instanceType,
  machineAccessType,
  magicMcpGroupType,
  magicMcpServerType,
  magicMcpSessionType,
  magicMcpTokenType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  portalAuthAppType,
  portalAuthSsoConnectionType,
  portalAuthSsoTenantSetupType,
  portalAuthSsoTenantType,
  portalType,
  profileType,
  projectType,
  providerTemplateType,
  providerAuthConfigType,
  providerAuthCredentialsType,
  providerAuthExportType,
  providerAuthImportType,
  providerAuthMethodType,
  providerConfigType,
  providerConfigVaultType,
  providerDeploymentType,
  // callbackDestinationType,
  // callbackEventType,
  // callbackNotificationType,
  // callbackType,
  providerListingCategoryType,
  providerListingCollectionType,
  providerListingGroupType,
  providerListingType,
  providerRunLogsType,
  providerRunType,
  providerSessionType,
  providerSetupSessionType,
  providerSpecificationType,
  providerToolType,
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
  // ssoTenantSetupType,
  // ssoTenantType,
  // ssoUserProfileType,
  // ssoUserType,
  sessionConnectionType,
  sessionErrorGroupType,
  sessionErrorType,
  sessionEventType,
  sessionMessageType,
  sessionParticipantType,
  sessionProviderType,
  sessionTemplateProviderType,
  sessionTemplateType,
  teamRolePermissionsType,
  teamRoleType,
  teamType,
  toolCallType,
  usageType,
  userType
} from './types';

// =============================================================================
// Core API Presenters (available in all versions)
// =============================================================================

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_dashboard: dashboardApiKeyPresenter,
  mt_2026_01_01_magnetar: v1ApiKeyPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  mt_2025_01_01_dashboard: v1InstancePresenter,
  mt_2026_01_01_magnetar: v1InstancePresenter
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

export let userPresenter = declarePresenter(userType, {
  mt_2025_01_01_dashboard: v1UserPresenter,
  mt_2026_01_01_magnetar: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  mt_2025_01_01_dashboard: v1BootPresenter,
  mt_2026_01_01_magnetar: v1BootPresenter
});

export let filePresenter = declarePresenter(fileType, {
  mt_2025_01_01_dashboard: v1FilePresenter,
  mt_2026_01_01_magnetar: v1FilePresenter
});

export let fileLinkPresenter = declarePresenter(fileLinkType, {
  mt_2025_01_01_dashboard: v1FileLinkPresenter,
  mt_2026_01_01_magnetar: v1FileLinkPresenter
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

// export let callbackPresenter = declarePresenter(callbackType, {
//   mt_2025_01_01_dashboard: v1CallbackPresenter,
//   mt_2026_01_01_magnetar: v1CallbackPresenter,
// });

// export let callbackEventPresenter = declarePresenter(callbackEventType, {
//   mt_2025_01_01_dashboard: v1CallbackEventPresenter,
//   mt_2026_01_01_magnetar: v1CallbackEventPresenter,
// });

// export let callbackNotificationPresenter = declarePresenter(callbackNotificationType, {
//   mt_2025_01_01_dashboard: v1CallbackNotificationPresenter,
//   mt_2026_01_01_magnetar: v1CallbackNotificationPresenter,
// });

// export let callbackDestinationPresenter = declarePresenter(callbackDestinationType, {
//   mt_2025_01_01_dashboard: v1CallbackDestinationPresenter,
//   mt_2026_01_01_magnetar: v1CallbackDestinationPresenter,
// });

export let teamPresenter = declarePresenter(teamType, {
  mt_2025_01_01_dashboard: v1TeamPresenter,
  mt_2026_01_01_magnetar: v1TeamPresenter
});

export let teamRolePresenter = declarePresenter(teamRoleType, {
  mt_2025_01_01_dashboard: v1TeamRolePresenter,
  mt_2026_01_01_magnetar: v1TeamRolePresenter
});

export let teamRolePermissionsPresenter = declarePresenter(teamRolePermissionsType, {
  mt_2025_01_01_dashboard: v1TeamRolePermissionsPresenter,
  mt_2026_01_01_magnetar: v1TeamRolePermissionsPresenter
});

export let consumerGroupPresenter = declarePresenter(consumerGroupType, {
  mt_2025_01_01_dashboard: v1ConsumerGroupPresenter,
  mt_2026_01_01_magnetar: v1ConsumerGroupPresenter
});

export let consumerAccessPresenter = declarePresenter(consumerAccessType, {
  mt_2025_01_01_dashboard: v1ConsumerAccessPresenter,
  mt_2026_01_01_magnetar: v1ConsumerAccessPresenter
});

export let consumerAccessRequestPresenter = declarePresenter(consumerAccessRequestType, {
  mt_2025_01_01_dashboard: v1ConsumerAccessRequestPresenter,
  mt_2026_01_01_magnetar: v1ConsumerAccessRequestPresenter
});

export let consumerProfilePresenter = declarePresenter(consumerProfileType, {
  mt_2025_01_01_dashboard: v1ConsumerProfilePresenter,
  mt_2026_01_01_magnetar: v1ConsumerProfilePresenter
});

export let consumerSessionPresenter = declarePresenter(consumerSessionType, {
  mt_2025_01_01_dashboard: v1ConsumerSessionPresenter,
  mt_2026_01_01_magnetar: v1ConsumerSessionPresenter
});

export let consumerProviderPresenter = declarePresenter(consumerProviderType, {
  mt_2025_01_01_dashboard: v1ConsumerProviderPresenter,
  mt_2026_01_01_magnetar: v1ConsumerProviderPresenter
});

// export let ssoTenantPresenter = declarePresenter(ssoTenantType, {
//   mt_2025_01_01_dashboard: v1SsoTenantPresenter,
//   mt_2026_01_01_magnetar: v1SsoTenantPresenter,
// });

// export let ssoTenantSetupPresenter = declarePresenter(ssoTenantSetupType, {
//   mt_2025_01_01_dashboard: v1SsoTenantSetupPresenter,
//   mt_2026_01_01_magnetar: v1SsoTenantSetupPresenter,
// });

// export let ssoUserPresenter = declarePresenter(ssoUserType, {
//   mt_2025_01_01_dashboard: v1SsoUserPresenter,
//   mt_2026_01_01_magnetar: v1SsoUserPresenter,
// });

// export let ssoUserProfilePresenter = declarePresenter(ssoUserProfileType, {
//   mt_2025_01_01_dashboard: v1SsoUserProfilePresenter,
//   mt_2026_01_01_magnetar: v1SsoUserProfilePresenter,
// });

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

// export let consumerGroupPresenter = declarePresenter(consumerGroupType, {
//   mt_2025_01_01_dashboard: v1ConsumerGroupPresenter,
//   mt_2026_01_01_magnetar: v1ConsumerGroupPresenter,
// });

// export let consumerAuthFactorPresenter = declarePresenter(consumerAuthFactorType, {
//   mt_2025_01_01_dashboard: v1ConsumerAuthFactorPresenter,
//   mt_2026_01_01_magnetar: v1ConsumerAuthFactorPresenter,
// });

// export let consumerAccessPresenter = declarePresenter(consumerAccessType, {
//   mt_2025_01_01_dashboard: v1ConsumerAccessPresenter,
//   mt_2026_01_01_magnetar: v1ConsumerAccessPresenter,
// });

// export let consumerProfilePresenter = declarePresenter(consumerProfileType, {
//   mt_2025_01_01_dashboard: v1ConsumerProfilePresenter,
//   mt_2026_01_01_magnetar: v1ConsumerProfilePresenter,
// });

// export let consumerSessionPresenter = declarePresenter(consumerSessionType, {
//   mt_2025_01_01_dashboard: v1ConsumerSessionPresenter,
//   mt_2026_01_01_magnetar: v1ConsumerSessionPresenter,
// });

// export let consumerServerRequestPresenter = declarePresenter(consumerServerRequestType, {
//   mt_2025_01_01_dashboard: v1ConsumerServerRequestPresenter,
//   mt_2026_01_01_magnetar: v1ConsumerServerRequestPresenter,
// });

export let magicMcpServerPresenter = declarePresenter(magicMcpServerType, {
  mt_2025_01_01_dashboard: v1MagicMcpServerPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpServerPresenter
});

export let magicMcpSessionPresenter = declarePresenter(magicMcpSessionType, {
  mt_2025_01_01_dashboard: v1MagicMcpSessionPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpSessionPresenter
});

export let magicMcpTokenPresenter = declarePresenter(magicMcpTokenType, {
  mt_2025_01_01_dashboard: v1MagicMcpTokenPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpTokenPresenter
});

export let magicMcpGroupPresenter = declarePresenter(magicMcpGroupType, {
  mt_2025_01_01_dashboard: v1MagicMcpGroupPresenter,
  mt_2026_01_01_magnetar: v1MagicMcpGroupPresenter
});

export let publisherPresenter = declarePresenter(publisherType, {
  mt_2025_01_01_dashboard: v1PublisherPresenter,
  mt_2026_01_01_magnetar: v1PublisherPresenter
});

export let providerVersionPresenter = declarePresenter(providerVersionType, {
  mt_2025_01_01_dashboard: v1ProviderVersionPresenter,
  mt_2026_01_01_magnetar: v1ProviderVersionPresenter
});

export let providerPresenter = declarePresenter(providerType, {
  mt_2025_01_01_dashboard: dashboardProviderPresenter,
  mt_2026_01_01_magnetar: v1ProviderPresenter
});

export let providerTypePresenter = declarePresenter(providerTypeType, {
  mt_2025_01_01_dashboard: v1ProviderTypePresenter,
  mt_2026_01_01_magnetar: v1ProviderTypePresenter
});

export let providerCategoryPresenter = declarePresenter(providerListingCategoryType, {
  mt_2025_01_01_dashboard: v1ProviderListingCategoryPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingCategoryPresenter
});

export let providerCollectionPresenter = declarePresenter(providerListingCollectionType, {
  mt_2025_01_01_dashboard: v1ProviderListingCollectionPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingCollectionPresenter
});

export let providerGroupPresenter = declarePresenter(providerListingGroupType, {
  mt_2025_01_01_dashboard: v1ProviderListingGroupPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingGroupPresenter
});

export let providerListingPresenter = declarePresenter(providerListingType, {
  mt_2025_01_01_dashboard: v1ProviderListingPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingPresenter
});

export let providerToolPresenter = declarePresenter(providerToolType, {
  mt_2025_01_01_dashboard: v1ProviderToolPresenter,
  mt_2026_01_01_magnetar: v1ProviderToolPresenter
});

export let providerAuthMethodPresenter = declarePresenter(providerAuthMethodType, {
  mt_2025_01_01_dashboard: v1ProviderAuthMethodPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthMethodPresenter
});

export let providerSpecificationPresenter = declarePresenter(providerSpecificationType, {
  mt_2025_01_01_dashboard: v1ProviderSpecificationPresenter,
  mt_2026_01_01_magnetar: v1ProviderSpecificationPresenter
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

export let providerAuthCredentialsPresenter = declarePresenter(providerAuthCredentialsType, {
  mt_2025_01_01_dashboard: v1ProviderAuthCredentialsPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthCredentialsPresenter
});

export let providerSetupSessionPresenter = declarePresenter(providerSetupSessionType, {
  mt_2025_01_01_dashboard: v1SetupSessionPresenter,
  mt_2026_01_01_magnetar: v1SetupSessionPresenter
});

export let providerAuthImportPresenter = declarePresenter(providerAuthImportType, {
  mt_2025_01_01_dashboard: v1ProviderAuthImportPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthImportPresenter
});

export let providerAuthExportPresenter = declarePresenter(providerAuthExportType, {
  mt_2025_01_01_dashboard: v1ProviderAuthExportPresenter,
  mt_2026_01_01_magnetar: v1ProviderAuthExportPresenter
});

// =============================================================================
// Session Template & Session-Nested Presenters
// =============================================================================

export let sessionTemplatePresenter = declarePresenter(sessionTemplateType, {
  mt_2025_01_01_dashboard: v1SessionTemplatePresenter,
  mt_2026_01_01_magnetar: v1SessionTemplatePresenter
});

export let sessionTemplateProviderPresenter = declarePresenter(sessionTemplateProviderType, {
  mt_2025_01_01_dashboard: v1SessionTemplateProviderPresenter,
  mt_2026_01_01_magnetar: v1SessionTemplateProviderPresenter
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

// Provider API session-nested presenters (Magnetar only)
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

// =============================================================================
// Custom Provider Presenters
// =============================================================================

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

// =============================================================================
// SCM Presenters
// =============================================================================

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
