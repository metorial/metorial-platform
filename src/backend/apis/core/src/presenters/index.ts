import { declarePresenter } from '@metorial/presenter';
import { dashboardApiKeyPresenter, v1ApiKeyPresenter } from './implementation/apiKey';
import { v1BootPresenter } from './implementation/boot';
import { v1CallbackPresenter } from './implementation/callback';
import { v1CallbackDestinationPresenter } from './implementation/callbackDestination';
import { v1CallbackEventPresenter } from './implementation/callbackEvent';
import { v1CallbackNotificationPresenter } from './implementation/callbackNotification';
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
import { v1FilePresenter } from './implementation/file';
import { v1FileLinkPresenter } from './implementation/fileLink';
import { v1InstancePresenter } from './implementation/instance';
import { v1MachineAccessPresenter } from './implementation/machineAccess';
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
import { v1ProfilePresenter } from './implementation/profile';
import { v1ProjectPresenter } from './implementation/project';
import { v1ProviderOauthConnectionPresenter } from './implementation/providerOauthConnection';
import { v1ProviderOauthConnectionAuthenticationPresenter } from './implementation/providerOauthConnectionAuthentication';
import { v1ProviderOauthConnectionEventPresenter } from './implementation/providerOauthConnectionEvent';
import { v1ProviderOauthConnectionProfilePresenter } from './implementation/providerOauthConnectionProfile';
import { v1ProviderOauthConnectionTemplatePresenter } from './implementation/providerOauthConnectionTemplate';
import { v1ProviderOauthConnectionTemplateEvaluationPresenter } from './implementation/providerOauthConnectionTemplateEvaluation';
import { v1ProviderOauthDiscoveryPresenter } from './implementation/providerOauthDiscovery';
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
import { v1ServerDeploymentPresenter } from './implementation/serverDeployment';
import { v1ServerDeploymentConfigPresenter } from './implementation/serverDeploymentConfig';
import {
  dashboardServerImplementationPresenter,
  v1ServerImplementationPresenter
} from './implementation/serverImplementation';
import {
  dashboardServerListingPresenter,
  v1ServerListingPresenter
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
import { v1UsagePresenter } from './implementation/usage';
import { v1UserPresenter } from './implementation/user';
import {
  apiKeyType,
  bootType,
  callbackDestinationType,
  callbackEventType,
  callbackNotificationType,
  callbackType,
  customServerCodeEditorTokenType,
  customServerDeploymentType,
  customServerEventType,
  customServerType,
  customServerVersionType,
  fileLinkType,
  fileType,
  instanceType,
  machineAccessType,
  magicMcpServerType,
  magicMcpSessionType,
  magicMcpTokenType,
  managedServerTemplateType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  profileType,
  projectType,
  providerOauthConnectionAuthenticationType,
  providerOauthConnectionDiscoveryType,
  providerOauthConnectionEventType,
  providerOauthConnectionProfileType,
  providerOauthConnectionTemplateEvaluationType,
  providerOauthConnectionTemplateType,
  providerOauthConnectionType,
  providerOauthTakeoutType,
  remoteServerType,
  scmAccountPreviewType,
  scmInstallationType,
  scmInstallType,
  scmRepoPreviewType,
  scmRepoType,
  secretType,
  serverCapabilitiesType,
  serverDeploymentConfigType,
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
  usageType,
  userType
} from './types';

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_pulsar: v1ApiKeyPresenter,
  mt_2025_01_01_dashboard: dashboardApiKeyPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  mt_2025_01_01_pulsar: v1InstancePresenter,
  mt_2025_01_01_dashboard: v1InstancePresenter
});

export let machineAccessPresenter = declarePresenter(machineAccessType, {
  mt_2025_01_01_pulsar: v1MachineAccessPresenter,
  mt_2025_01_01_dashboard: v1MachineAccessPresenter
});

export let organizationActorPresenter = declarePresenter(organizationActorType, {
  mt_2025_01_01_pulsar: v1OrganizationActorPresenter,
  mt_2025_01_01_dashboard: v1OrganizationActorPresenter
});

export let organizationInvitePresenter = declarePresenter(organizationInviteType, {
  mt_2025_01_01_pulsar: v1OrganizationInvitePresenter,
  mt_2025_01_01_dashboard: v1OrganizationInvitePresenter
});

export let organizationMemberPresenter = declarePresenter(organizationMemberType, {
  mt_2025_01_01_pulsar: v1OrganizationMemberPresenter,
  mt_2025_01_01_dashboard: v1OrganizationMemberPresenter
});

export let organizationPresenter = declarePresenter(organizationType, {
  mt_2025_01_01_pulsar: v1OrganizationPresenter,
  mt_2025_01_01_dashboard: v1OrganizationPresenter
});

export let projectPresenter = declarePresenter(projectType, {
  mt_2025_01_01_pulsar: v1ProjectPresenter,
  mt_2025_01_01_dashboard: v1ProjectPresenter
});

export let userPresenter = declarePresenter(userType, {
  mt_2025_01_01_pulsar: v1UserPresenter,
  mt_2025_01_01_dashboard: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  mt_2025_01_01_pulsar: v1BootPresenter,
  mt_2025_01_01_dashboard: v1BootPresenter
});

export let filePresenter = declarePresenter(fileType, {
  mt_2025_01_01_pulsar: v1FilePresenter,
  mt_2025_01_01_dashboard: v1FilePresenter
});

export let fileLinkPresenter = declarePresenter(fileLinkType, {
  mt_2025_01_01_pulsar: v1FileLinkPresenter,
  mt_2025_01_01_dashboard: v1FileLinkPresenter
});

export let secretPresenter = declarePresenter(secretType, {
  mt_2025_01_01_pulsar: v1SecretPresenter,
  mt_2025_01_01_dashboard: v1SecretPresenter
});

export let serverPresenter = declarePresenter(serverType, {
  mt_2025_01_01_pulsar: v1ServerPresenter,
  mt_2025_01_01_dashboard: v1ServerPresenter
});

export let serverVariantPresenter = declarePresenter(serverVariantType, {
  mt_2025_01_01_pulsar: v1ServerVariantPresenter,
  mt_2025_01_01_dashboard: v1ServerVariantPresenter
});

export let serverVersionPresenter = declarePresenter(serverVersionType, {
  mt_2025_01_01_pulsar: v1ServerVersionPresenter,
  mt_2025_01_01_dashboard: v1ServerVersionPresenter
});

export let serverListingPresenter = declarePresenter(serverListingType, {
  mt_2025_01_01_pulsar: v1ServerListingPresenter,
  mt_2025_01_01_dashboard: dashboardServerListingPresenter
});

export let serverListingCategoryPresenter = declarePresenter(serverListingCategoryType, {
  mt_2025_01_01_pulsar: v1ServerListingCategoryPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCategoryPresenter
});

export let serverListingCollectionPresenter = declarePresenter(serverListingCollectionType, {
  mt_2025_01_01_pulsar: v1ServerListingCollectionPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCollectionPresenter
});

export let serverImplementationPresenter = declarePresenter(serverImplementationType, {
  mt_2025_01_01_pulsar: v1ServerImplementationPresenter,
  mt_2025_01_01_dashboard: dashboardServerImplementationPresenter
});

export let serverDeploymentPresenter = declarePresenter(serverDeploymentType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentPresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentPresenter
});

export let serverDeploymentConfigPresenter = declarePresenter(serverDeploymentConfigType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentConfigPresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentConfigPresenter
});

export let usagePresenter = declarePresenter(usageType, {
  mt_2025_01_01_pulsar: v1UsagePresenter,
  mt_2025_01_01_dashboard: v1UsagePresenter
});

export let sessionPresenter = declarePresenter(sessionType, {
  mt_2025_01_01_pulsar: v1SessionPresenter,
  mt_2025_01_01_dashboard: v1DashboardSessionPresenter
});

export let serverRunPresenter = declarePresenter(serverRunType, {
  mt_2025_01_01_pulsar: v1ServerRunPresenter,
  mt_2025_01_01_dashboard: v1ServerRunPresenter
});

export let serverRunErrorPresenter = declarePresenter(serverRunErrorType, {
  mt_2025_01_01_pulsar: v1ServerRunErrorPresenter,
  mt_2025_01_01_dashboard: v1ServerRunErrorPresenter
});

export let serverRunErrorGroupPresenter = declarePresenter(serverRunErrorGroupType, {
  mt_2025_01_01_pulsar: v1ServerRunErrorGroupPresenter,
  mt_2025_01_01_dashboard: v1ServerRunErrorGroupPresenter
});

export let serverSessionPresenter = declarePresenter(serverSessionType, {
  mt_2025_01_01_pulsar: v1ServerSessionPresenter,
  mt_2025_01_01_dashboard: v1ServerSessionPresenter
});

export let sessionConnectionPresenter = declarePresenter(sessionConnectionType, {
  mt_2025_01_01_pulsar: v1SessionConnectionPresenter,
  mt_2025_01_01_dashboard: v1SessionConnectionPresenter
});

export let sessionEventPresenter = declarePresenter(sessionEventType, {
  mt_2025_01_01_pulsar: v1SessionEventPresenter,
  mt_2025_01_01_dashboard: v1SessionEventPresenter
});

export let sessionMessagePresenter = declarePresenter(sessionMessageType, {
  mt_2025_01_01_pulsar: v1SessionMessagePresenter,
  mt_2025_01_01_dashboard: dashboardSessionMessagePresenter
});

export let serverCapabilitiesPresenter = declarePresenter(serverCapabilitiesType, {
  mt_2025_01_01_pulsar: v1ServerCapabilitiesPresenter,
  mt_2025_01_01_dashboard: v1ServerCapabilitiesPresenter
});

export let profilePresenter = declarePresenter(profileType, {
  mt_2025_01_01_pulsar: v1ProfilePresenter,
  mt_2025_01_01_dashboard: v1ProfilePresenter
});

export let serverOAuthSessionPresenter = declarePresenter(serverOauthSessionType, {
  mt_2025_01_01_pulsar: v1ServerOauthSessionPresenter,
  mt_2025_01_01_dashboard: v1ServerOauthSessionPresenter
});

export let providerOauthConnectionPresenter = declarePresenter(providerOauthConnectionType, {
  mt_2025_01_01_pulsar: v1ProviderOauthConnectionPresenter,
  mt_2025_01_01_dashboard: v1ProviderOauthConnectionPresenter
});

export let providerOauthConnectionAuthenticationPresenter = declarePresenter(
  providerOauthConnectionAuthenticationType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionAuthenticationPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionAuthenticationPresenter
  }
);

export let providerOauthConnectionEventPresenter = declarePresenter(
  providerOauthConnectionEventType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionEventPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionEventPresenter
  }
);

export let providerOauthConnectionProfilePresenter = declarePresenter(
  providerOauthConnectionProfileType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionProfilePresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionProfilePresenter
  }
);

export let providerOauthConnectionTemplatePresenter = declarePresenter(
  providerOauthConnectionTemplateType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionTemplatePresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionTemplatePresenter
  }
);

export let providerOauthConnectionTemplateEvaluationPresenter = declarePresenter(
  providerOauthConnectionTemplateEvaluationType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthConnectionTemplateEvaluationPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthConnectionTemplateEvaluationPresenter
  }
);

export let providerOauthDiscoveryPresenter = declarePresenter(
  providerOauthConnectionDiscoveryType,
  {
    mt_2025_01_01_pulsar: v1ProviderOauthDiscoveryPresenter,
    mt_2025_01_01_dashboard: v1ProviderOauthDiscoveryPresenter
  }
);

export let providerOauthTakeoutPresenter = declarePresenter(providerOauthTakeoutType, {
  mt_2025_01_01_pulsar: v1ProviderOauthTakeoutPresenter,
  mt_2025_01_01_dashboard: v1ProviderOauthTakeoutPresenter
});

export let remoteServerPresenter = declarePresenter(remoteServerType, {
  mt_2025_01_01_dashboard: v1RemoteServerPresenter,
  mt_2025_01_01_pulsar: v1RemoteServerPresenter
});

export let customServerPresenter = declarePresenter(customServerType, {
  mt_2025_01_01_pulsar: v1CustomServerPresenter,
  mt_2025_01_01_dashboard: dashboardCustomServerPresenter
});

export let customServerVersionPresenter = declarePresenter(customServerVersionType, {
  mt_2025_01_01_pulsar: v1CustomServerVersionPresenter,
  mt_2025_01_01_dashboard: dashboardCustomServerVersionPresenter
});

export let customServerEventPresenter = declarePresenter(customServerEventType, {
  mt_2025_01_01_pulsar: v1CustomServerEventPresenter,
  mt_2025_01_01_dashboard: v1CustomServerEventPresenter
});

export let customServerDeploymentPresenter = declarePresenter(customServerDeploymentType, {
  mt_2025_01_01_pulsar: v1CustomServerDeploymentPresenter,
  mt_2025_01_01_dashboard: v1CustomServerDeploymentPresenter
});

export let customServerCodeEditorTokenTypePresenter = declarePresenter(
  customServerCodeEditorTokenType,
  {
    mt_2025_01_01_pulsar: v1CustomServerCodeEditorTokenPresenter,
    mt_2025_01_01_dashboard: v1CustomServerCodeEditorTokenPresenter
  }
);

export let managedServerTemplateTypePresenter = declarePresenter(managedServerTemplateType, {
  mt_2025_01_01_pulsar: v1ManagedServerTemplatePresenter,
  mt_2025_01_01_dashboard: v1ManagedServerTemplatePresenter
});

export let magicMcpServerPresenter = declarePresenter(magicMcpServerType, {
  mt_2025_01_01_pulsar: v1MagicMcpServerPresenter,
  mt_2025_01_01_dashboard: v1DashboardMagicMcpServerPresenter
});

export let magicMcpSessionPresenter = declarePresenter(magicMcpSessionType, {
  mt_2025_01_01_pulsar: v1MagicMcpSessionPresenter,
  mt_2025_01_01_dashboard: v1DashboardMagicMcpSessionPresenter
});

export let magicMcpTokenPresenter = declarePresenter(magicMcpTokenType, {
  mt_2025_01_01_pulsar: v1MagicMcpTokenPresenter,
  mt_2025_01_01_dashboard: v1MagicMcpTokenPresenter
});

export let scmInstallPresenter = declarePresenter(scmInstallType, {
  mt_2025_01_01_pulsar: v1ScmInstallPresenter,
  mt_2025_01_01_dashboard: v1ScmInstallPresenter
});

export let scmRepoPreviewPresenter = declarePresenter(scmRepoPreviewType, {
  mt_2025_01_01_pulsar: v1ScmRepoPreviewPresenter,
  mt_2025_01_01_dashboard: v1ScmRepoPreviewPresenter
});

export let scmAccountPreviewPresenter = declarePresenter(scmAccountPreviewType, {
  mt_2025_01_01_pulsar: v1ScmAccountPreviewPresenter,
  mt_2025_01_01_dashboard: v1ScmAccountPreviewPresenter
});

export let scmRepoPresenter = declarePresenter(scmRepoType, {
  mt_2025_01_01_pulsar: v1ScmRepoPresenter,
  mt_2025_01_01_dashboard: v1ScmRepoPresenter
});

export let scmInstallationPresenter = declarePresenter(scmInstallationType, {
  mt_2025_01_01_pulsar: v1ScmInstallationPresenter,
  mt_2025_01_01_dashboard: v1ScmInstallationPresenter
});

export let callbackPresenter = declarePresenter(callbackType, {
  mt_2025_01_01_pulsar: v1CallbackPresenter,
  mt_2025_01_01_dashboard: v1CallbackPresenter
});

export let callbackEventPresenter = declarePresenter(callbackEventType, {
  mt_2025_01_01_pulsar: v1CallbackEventPresenter,
  mt_2025_01_01_dashboard: v1CallbackEventPresenter
});

export let callbackNotificationPresenter = declarePresenter(callbackNotificationType, {
  mt_2025_01_01_pulsar: v1CallbackNotificationPresenter,
  mt_2025_01_01_dashboard: v1CallbackNotificationPresenter
});

export let callbackDestinationPresenter = declarePresenter(callbackDestinationType, {
  mt_2025_01_01_pulsar: v1CallbackDestinationPresenter,
  mt_2025_01_01_dashboard: v1CallbackDestinationPresenter
});
