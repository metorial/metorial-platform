import { declarePresenter } from '@metorial/presenter';
import { dashboardApiKeyPresenter, v1ApiKeyPresenter } from './implementation/apiKey';
import { v1BootPresenter } from './implementation/boot';
import { v1FilePresenter } from './implementation/file';
import { v1FileLinkPresenter } from './implementation/fileLink';
import { v1InstancePresenter } from './implementation/instance';
import { v1MachineAccessPresenter } from './implementation/machineAccess';
import { v1OrganizationPresenter } from './implementation/organization';
import { v1OrganizationActorPresenter } from './implementation/organizationActor';
import { v1OrganizationInvitePresenter } from './implementation/organizationInvite';
import { v1OrganizationMemberPresenter } from './implementation/organizationMember';
import { v1ProfilePresenter } from './implementation/profile';
import { v1ProjectPresenter } from './implementation/project';
import { v1SecretPresenter } from './implementation/secret';
import { v1TeamPresenter } from './implementation/team';
import { v1TeamRolePresenter } from './implementation/teamRole';
import { v1TeamRolePermissionsPresenter } from './implementation/teamRolePermissions';
import { v1UsagePresenter } from './implementation/usage';
import { v1UserPresenter } from './implementation/user';

// Provider API presenters
import {
  v1AuthConfigPresenter,
  v1AuthCredentialsPresenter,
  v1AuthExportPresenter,
  v1AuthImportPresenter,
  v1AuthImportSchemaPresenter,
  v1AuthMethodPresenter,
  v1CategoryPresenter,
  v1CollectionPresenter,
  v1ConfigPresenter,
  v1ConfigPreviewPresenter,
  v1ConfigSchemaPresenter,
  v1CustomProviderCommitPresenter,
  v1CustomProviderDeploymentLogsPresenter,
  v1CustomProviderDeploymentPresenter,
  v1CustomProviderEnvironmentPresenter,
  // Custom Provider presenters
  v1CustomProviderPresenter,
  v1CustomProviderVersionPresenter,
  v1DeploymentPresenter,
  v1DeploymentPreviewPresenter,
  v1GroupPresenter,
  v1ProviderConfigVaultPresenter,
  v1ProviderListingPresenter,
  v1ProviderPresenter,
  v1ProviderRunLogsPresenter,
  v1ProviderRunPresenter,
  v1ProviderSessionPresenter,
  v1PublisherPresenter,
  v1SessionErrorGroupPresenter,
  v1SessionErrorPresenter,
  v1SessionParticipantPresenter,
  v1SessionProviderPresenter,
  v1SessionTemplatePresenter,
  v1SessionTemplateProviderPresenter,
  v1SetupSessionPresenter,
  v1SpecificationPresenter,
  v1SubspaceSessionConnectionPresenter,
  v1SubspaceSessionEventPresenter,
  v1SubspaceSessionMessagePresenter,
  v1ToolPresenter,
  v1VersionPresenter
} from './implementation/provider';

import {
  apiKeyType,
  authConfigType,
  authCredentialsType,
  authExportType,
  authImportSchemaType,
  authImportType,
  authMethodType,
  bootType,
  // callbackDestinationType,
  // callbackEventType,
  // callbackNotificationType,
  // callbackType,
  categoryType,
  collectionType,
  configPreviewType,
  configSchemaType,
  configType,
  configVaultType,
  customProviderCommitType,
  customProviderDeploymentLogsType,
  customProviderDeploymentType,
  customProviderEnvironmentType,
  // Custom Provider types
  customProviderType,
  customProviderVersionType,
  deploymentPreviewType,
  deploymentType,
  fileLinkType,
  fileType,
  groupType,
  instanceType,
  machineAccessType,
  // magicMcpGroupType,
  // magicMcpServerType,
  // magicMcpSessionType,
  // magicMcpTokenType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  // portalType,
  profileType,
  projectType,
  providerListingType,
  providerRunLogsType,
  providerRunType,
  providerSessionType,
  providerType,
  publisherType,
  secretType,
  sessionErrorGroupType,
  sessionErrorType,
  sessionParticipantType,
  sessionProviderType,
  sessionTemplateProviderType,
  sessionTemplateType,
  setupSessionType,
  specificationType,
  // ssoTenantSetupType,
  // ssoTenantType,
  // ssoUserProfileType,
  // ssoUserType,
  subspaceSessionConnectionType,
  subspaceSessionEventType,
  subspaceSessionMessageType,
  teamRolePermissionsType,
  teamRoleType,
  teamType,
  toolType,
  usageType,
  userType,
  versionType
} from './types';

// =============================================================================
// Core API Presenters (available in all versions)
// =============================================================================

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_dashboard: v1ApiKeyPresenter,
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

// export let portalPresenter = declarePresenter(portalType, {
//   mt_2025_01_01_dashboard: v1PortalPresenter,
//   mt_2026_01_01_magnetar: v1PortalPresenter,
// });

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

// export let magicMcpServerPresenter = declarePresenter(magicMcpServerType, {
//   mt_2025_01_01_dashboard: v1DashboardMagicMcpServerPresenter,
//   mt_2026_01_01_magnetar: v1DashboardMagicMcpServerPresenter,
// });

// export let magicMcpSessionPresenter = declarePresenter(magicMcpSessionType, {
//   mt_2025_01_01_dashboard: v1DashboardMagicMcpSessionPresenter,
//   mt_2026_01_01_magnetar: v1DashboardMagicMcpSessionPresenter,
// });

// export let magicMcpTokenPresenter = declarePresenter(magicMcpTokenType, {
//   mt_2025_01_01_dashboard: v1MagicMcpTokenPresenter,
//   mt_2026_01_01_magnetar: v1MagicMcpTokenPresenter,
// });

// export let magicMcpGroupPresenter = declarePresenter(magicMcpGroupType, {
//   mt_2025_01_01_dashboard: v1MagicMcpGroupPresenter,
//   mt_2026_01_01_magnetar: v1MagicMcpGroupPresenter,
// });

export let publisherPresenter = declarePresenter(publisherType, {
  mt_2025_01_01_dashboard: v1PublisherPresenter,
  mt_2026_01_01_magnetar: v1PublisherPresenter
});

export let providerVersionPresenter = declarePresenter(versionType, {
  mt_2025_01_01_dashboard: v1VersionPresenter,
  mt_2026_01_01_magnetar: v1VersionPresenter
});

export let providerPresenter = declarePresenter(providerType, {
  mt_2025_01_01_dashboard: v1ProviderPresenter,
  mt_2026_01_01_magnetar: v1ProviderPresenter
});

export let providerCategoryPresenter = declarePresenter(categoryType, {
  mt_2025_01_01_dashboard: v1CategoryPresenter,
  mt_2026_01_01_magnetar: v1CategoryPresenter
});

export let providerCollectionPresenter = declarePresenter(collectionType, {
  mt_2025_01_01_dashboard: v1CollectionPresenter,
  mt_2026_01_01_magnetar: v1CollectionPresenter
});

export let providerGroupPresenter = declarePresenter(groupType, {
  mt_2025_01_01_dashboard: v1GroupPresenter,
  mt_2026_01_01_magnetar: v1GroupPresenter
});

export let providerListingPresenter = declarePresenter(providerListingType, {
  mt_2025_01_01_dashboard: v1ProviderListingPresenter,
  mt_2026_01_01_magnetar: v1ProviderListingPresenter
});

export let providerToolPresenter = declarePresenter(toolType, {
  mt_2025_01_01_dashboard: v1ToolPresenter,
  mt_2026_01_01_magnetar: v1ToolPresenter
});

export let providerAuthMethodPresenter = declarePresenter(authMethodType, {
  mt_2025_01_01_dashboard: v1AuthMethodPresenter,
  mt_2026_01_01_magnetar: v1AuthMethodPresenter
});

export let providerSpecificationPresenter = declarePresenter(specificationType, {
  mt_2025_01_01_dashboard: v1SpecificationPresenter,
  mt_2026_01_01_magnetar: v1SpecificationPresenter
});

export let providerDeploymentPresenter = declarePresenter(deploymentType, {
  mt_2025_01_01_dashboard: v1DeploymentPresenter,
  mt_2026_01_01_magnetar: v1DeploymentPresenter
});

export let providerDeploymentPreviewPresenter = declarePresenter(deploymentPreviewType, {
  mt_2025_01_01_dashboard: v1DeploymentPreviewPresenter,
  mt_2026_01_01_magnetar: v1DeploymentPreviewPresenter
});

export let providerConfigPresenter = declarePresenter(configType, {
  mt_2025_01_01_dashboard: v1ConfigPresenter,
  mt_2026_01_01_magnetar: v1ConfigPresenter
});

export let providerConfigPreviewPresenter = declarePresenter(configPreviewType, {
  mt_2025_01_01_dashboard: v1ConfigPreviewPresenter,
  mt_2026_01_01_magnetar: v1ConfigPreviewPresenter
});

export let providerConfigVaultPresenter = declarePresenter(configVaultType, {
  mt_2025_01_01_dashboard: v1ProviderConfigVaultPresenter,
  mt_2026_01_01_magnetar: v1ProviderConfigVaultPresenter
});

export let providerAuthConfigPresenter = declarePresenter(authConfigType, {
  mt_2025_01_01_dashboard: v1AuthConfigPresenter,
  mt_2026_01_01_magnetar: v1AuthConfigPresenter
});

export let providerAuthCredentialsPresenter = declarePresenter(authCredentialsType, {
  mt_2025_01_01_dashboard: v1AuthCredentialsPresenter,
  mt_2026_01_01_magnetar: v1AuthCredentialsPresenter
});

export let providerSetupSessionPresenter = declarePresenter(setupSessionType, {
  mt_2025_01_01_dashboard: v1SetupSessionPresenter,
  mt_2026_01_01_magnetar: v1SetupSessionPresenter
});

export let providerAuthImportPresenter = declarePresenter(authImportType, {
  mt_2025_01_01_dashboard: v1AuthImportPresenter,
  mt_2026_01_01_magnetar: v1AuthImportPresenter
});

export let providerAuthExportPresenter = declarePresenter(authExportType, {
  mt_2025_01_01_dashboard: v1AuthExportPresenter,
  mt_2026_01_01_magnetar: v1AuthExportPresenter
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
  mt_2025_01_01_dashboard: v1ProviderSessionPresenter,
  mt_2026_01_01_magnetar: v1ProviderSessionPresenter
});

// Provider API session-nested presenters (Magnetar only)
export let subspaceSessionMessagePresenter = declarePresenter(subspaceSessionMessageType, {
  mt_2025_01_01_dashboard: v1SubspaceSessionMessagePresenter,
  mt_2026_01_01_magnetar: v1SubspaceSessionMessagePresenter
});

export let subspaceSessionConnectionPresenter = declarePresenter(
  subspaceSessionConnectionType,
  {
    mt_2025_01_01_dashboard: v1SubspaceSessionConnectionPresenter,
    mt_2026_01_01_magnetar: v1SubspaceSessionConnectionPresenter
  }
);

export let subspaceSessionEventPresenter = declarePresenter(subspaceSessionEventType, {
  mt_2025_01_01_dashboard: v1SubspaceSessionEventPresenter,
  mt_2026_01_01_magnetar: v1SubspaceSessionEventPresenter
});

export let providerRunLogsPresenter = declarePresenter(providerRunLogsType, {
  mt_2025_01_01_dashboard: v1ProviderRunLogsPresenter,
  mt_2026_01_01_magnetar: v1ProviderRunLogsPresenter
});

export let configSchemaPresenter = declarePresenter(configSchemaType, {
  mt_2025_01_01_dashboard: v1ConfigSchemaPresenter,
  mt_2026_01_01_magnetar: v1ConfigSchemaPresenter
});

export let authImportSchemaPresenter = declarePresenter(authImportSchemaType, {
  mt_2025_01_01_dashboard: v1AuthImportSchemaPresenter,
  mt_2026_01_01_magnetar: v1AuthImportSchemaPresenter
});

// =============================================================================
// Custom Provider Presenters
// =============================================================================

export let subspaceCustomProviderPresenter = declarePresenter(customProviderType, {
  mt_2025_01_01_dashboard: v1CustomProviderPresenter,
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
    mt_2025_01_01_dashboard: v1CustomProviderDeploymentPresenter,
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

export { presentSubspaceSessionMessageAs } from './implementation/provider';
