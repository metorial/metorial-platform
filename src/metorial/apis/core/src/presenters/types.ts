import {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyInstance,
  AccessPolicyProject,
  AccessPolicyRole,
  AccessPolicyVersion,
  AccessRole,
  AccessRoleVersion,
  AccessTag,
  AccessTagEntity,
  AccessTagPolicy,
  ApiKey,
  ApiKeySecret,
  ApiKeyType,
  CliDevice,
  Consumer,
  ConsumerAccess,
  ConsumerAccessListing,
  ConsumerAccessRequest,
  ConsumerAuthAttempt,
  ConsumerAuthClient,
  ConsumerAuthClientSurface,
  ConsumerAuthTestAuthorization,
  ConsumerGroup,
  ConsumerIntegration,
  ConsumerIntegrationEndpoint,
  ConsumerIntegrationSession,
  ConsumerInvite,
  ConsumerProfile,
  ConsumerProfileGroup,
  ConsumerSession,
  ConsumerSurface,
  ConsumerSurfaceProviderGroup,
  ConsumerToken,
  Instance,
  InstanceConsumer,
  MachineAccess,
  MagicMcpEndpoint,
  MagicMcpEndpointServer,
  MagicMcpGroup,
  MagicMcpGroupToken,
  MagicMcpServer,
  MagicMcpServerAlias,
  MagicMcpSession,
  MagicMcpToken,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthAuthorization,
  OAuthInstallation,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMember,
  Portal,
  Prisma,
  Profile,
  Project,
  Sandbox,
  ProviderTemplate,
  Secret,
  SecretType,
  ServiceAccount,
  ServiceAccountCredential,
  Skill,
  SkillAgent,
  SkillConfiguration,
  SkillDestinationSync,
  SkillExport,
  SkillForkSync,
  SkillGroup,
  SkillMarketplace,
  SkillMarketplacePlugin,
  SkillMarketplaceRepository,
  SkillMergeRequest,
  SkillMergeRequestComment,
  SkillMergeRequestEvent,
  SkillMergeRequestItem,
  SkillParticipant,
  SkillPlugin,
  SkillPluginRepository,
  SkillPluginSkill,
  SkillTemplate,
  SkillVersion,
  Store,
  StoreItem,
  StoreParticipant,
  Document,
  DocumentParticipant,
  DocumentVersion,
  File,
  FileLink,
  Team,
  TeamMember,
  TeamProject,
  User,
  UserStatus,
  UserType
} from '@metorial/db';
import {
  resourceActorPresentationInclude,
  type ResourceActorPresentationRecord
} from '@metorial/module-resource-tenant';
import type {
  AssistantConversationItemWithMessage,
  AssistantConversationWithAssistant,
  AvailableAssistant
} from '@metorial/module-assistant';
import {
  ConsumerAresApp,
  ConsumerAresSsoConnection,
  ConsumerAresSsoTenant,
  ConsumerAresSsoTenantSetup,
  ConsumerActivityAgent,
  ConsumerActivitySessionConnection,
  ConsumerProviderCatalogEntry,
  EnrichedConsumerSurface
} from '@metorial/module-consumer';
import { Flags } from '@metorial/module-flags';
import type {
  OAuthAuthorizationLogWithRelations,
  OAuthAuthorizationRequestWithRelations
} from '@metorial/module-machine-access';
import type { EnrichedProviderTemplate } from '@metorial/module-magic';
import type { PolicyDocument, ProjectBrandOverride } from '@metorial/module-organization';
import {
  SubspaceAgent,
  SubspaceAgentInstance,
  SubspaceAuthConfigError,
  SubspaceAuthConfigErrorGlobal,
  SubspaceAuthConfigEvent,
  SubspaceBucket,
  SubspaceCallback,
  SubspaceCallbackDestination,
  SubspaceCallbackEvent,
  SubspaceCallbackInstance,
  SubspaceCallbackNotification,
  SubspaceCustomProvider,
  SubspaceCustomProviderCommit,
  SubspaceCustomProviderDeployment,
  SubspaceCustomProviderDeploymentLogs,
  SubspaceCustomProviderEnvironment,
  SubspaceCustomProviderVersion,
  SubspaceEnclave,
  SubspaceEnclaveNetworkLogs,
  SubspaceFirewall,
  SubspaceFirewallBinding,
  SubspaceIdentity,
  SubspaceIdentityActor,
  SubspaceIdentityCredential,
  SubspaceIdentityDelegation,
  SubspaceIdentityDelegationConfig,
  SubspaceIdentityDelegationRequest,
  SubspaceIntegration,
  SubspaceIntegrationInstance,
  SubspaceIntegrationInstanceGroup,
  SubspaceIntegrationInstanceGroupProvider,
  SubspaceIntegrationInstanceProvider,
  SubspaceIntegrationProvider,
  SubspaceIntegrationSetupSession,
  SubspaceMagicMcpServerProvider,
  SubspaceMonitor,
  SubspaceMonitorAlert,
  SubspaceNetwork,
  SubspaceNetworkPolicy,
  SubspaceNetworkPolicyRule,
  SubspaceProvider,
  SubspaceProviderAuthConfig,
  SubspaceProviderAuthConfigSchema,
  SubspaceProviderAuthCredentials,
  SubspaceProviderAuthExport,
  SubspaceProviderAuthImport,
  SubspaceProviderAuthImportSchema,
  SubspaceProviderAuthMethod,
  SubspaceProviderConfig,
  SubspaceProviderConfigSchema,
  SubspaceProviderConfigVault,
  SubspaceProviderDeployment,
  SubspaceProviderInvocation,
  SubspaceProviderListing,
  SubspaceProviderListingCategory,
  SubspaceProviderListingCollection,
  SubspaceProviderListingGroup,
  SubspaceProviderOAuthSetup,
  SubspaceProviderRun,
  SubspaceProviderRunLogs,
  SubspaceProviderSetupSession,
  SubspaceProviderSpecification,
  SubspaceProviderSpecificationChangeNotification,
  SubspaceProviderTool,
  SubspaceProviderTrigger,
  SubspaceProviderType,
  SubspaceProviderVersion,
  SubspaceProtoGuardAlert,
  SubspaceProtoGuardConfig,
  SubspacePublisher,
  SubspaceScmAccountPreviews,
  SubspaceScmConnection,
  SubspaceScmConnectionSetupSession,
  SubspaceScmProvider,
  SubspaceScmProviderSetupSession,
  SubspaceScmRepository,
  SubspaceScmRepositoryPreviews,
  SubspaceSession,
  SubspaceSessionConnection,
  SubspaceSessionError,
  SubspaceSessionErrorGroup,
  SubspaceSessionEvent,
  SubspaceSessionMessage,
  SubspaceSessionParticipant,
  SubspaceSessionProvider,
  SubspaceSessionTemplate,
  SubspaceSessionTemplateProvider,
  SubspaceSessionWarning,
  SubspaceToolCall
} from '@metorial/module-subspace';
import type {
  SkillGroupItemResource,
  SkillGroupResource,
  SkillItemResource,
  SkillResource,
  SkillSyncRepositoryCheck,
  SkillTemplateItemResource,
  SkillTemplateResource
} from '@metorial/cargo-module-skill';
import { PresentableType } from '@metorial/presenter';

type UserPresenterInput = {
  id: string;
  status: UserStatus;
  type: 'consumer' | UserType;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  image: PrismaJson.EntityImage;
  createdAt: Date;
  updatedAt: Date;
};

export let bootType = PresentableType.create<{
  user: UserPresenterInput;
  organizations: (Organization & {
    member?: OrganizationMember & {
      actor: OrganizationActor & {
        teams: (TeamMember & {
          team: Team;
        })[];
      };
    };
  })[];
  projects: (Project & { organization: Organization })[];
  instances: (Instance & { project: Project; organization: Organization })[];
}>()('boot');

export let userType = PresentableType.create<{
  user: UserPresenterInput;
}>()('user');

export let projectType = PresentableType.create<{
  project: Project & { organization: Organization };
}>()('project');

export let projectRetentionType = PresentableType.create<{
  project: Project;
}>()('project_retention');

export let projectAuthConfigConfigurationType = PresentableType.create<{
  project: Project;
  allowAuthConfigExport: boolean;
  allowAuthConfigImport: boolean;
  consumerAuthClientRegistrationsPerHourLimit: number;
  consumerAuthClientRegistrationsPerMinuteLimit: number;
}>()('project_auth_config_configuration');

export let projectToolCallingConfigurationType = PresentableType.create<{
  project: Project;
  collectOperationDescriptionForToolCalls: boolean;
  messageProcessingTimeoutMs: number;
}>()('project_tool_calling_configuration');

export let projectIntegrationNamingConfigurationType = PresentableType.create<{
  project: Project;
  useIntegrationNames: boolean;
}>()('project_integration_naming_configuration');

export let tokenType = PresentableType.create<{
  token: {
    type:
      | 'fine_grained_token'
      | ApiKeyType
      | 'oauth_access_token'
      | 'unknown_token'
      | 'user_auth_token';

    organization?: Organization;
    instance?: Instance & { project: Project };
    actor?: OrganizationActor;
    member?: OrganizationMember & { actor: OrganizationActor };
    user?: User;
  };
}>()('token');

export let consumerOAuthTestAuthorizationType = PresentableType.create<{
  testAuthorization: ConsumerAuthTestAuthorization;
  url: string;
}>()('consumer_oauth_test_authorization');

export let projectBrandType = PresentableType.create<{
  projectBrand: ProjectBrandOverride;
}>()('projectBrand');

export let instanceType = PresentableType.create<{
  instance: Instance & {
    project: Project;
    organization: Organization;
    sandbox?: Sandbox | null;
  };
}>()('instance');

export let instanceListType = PresentableType.create<{
  instances: (Instance & {
    project: Project;
    organization: Organization;
    sandbox?: Sandbox | null;
  })[];
}>()('instanceList');

export let sandboxType = PresentableType.create<{
  sandbox: Sandbox & {
    creatorActor: OrganizationActor & { organization: Organization };
    instance: Instance & { project: Project; organization: Organization };
  };
}>()('sandbox');

export let organizationType = PresentableType.create<{
  organization: Organization;
}>()('organization');

export let organizationInviteType = PresentableType.create<{
  organizationInvite: OrganizationInvite & {
    organization: Organization;
    invitedBy: OrganizationActor;
  };
}>()('organization_invite');

export let organizationMemberType = PresentableType.create<{
  organizationMember: OrganizationMember & {
    organization: Organization;
    actor: OrganizationActor & {
      teams: (TeamMember & { team: Team })[];
    };
    policies?: (AccessPolicyAssignment & {
      accessPolicy: AccessPolicy;
    })[];
    user: { id: string; email: string; name: string; image: PrismaJson.EntityImage };
  };
}>()('organization_member');

export let organizationActorType = PresentableType.create<{
  organizationActor: OrganizationActor & {
    organization: Organization;
    teams?: (TeamMember & { team: Team })[] | null | undefined;
  };
}>()('organization_actor');

export let assistantType = PresentableType.create<{
  assistant: AvailableAssistant;
  organization: Organization;
}>()('assistant');

export let assistantConversationType = PresentableType.create<{
  assistantConversation: AssistantConversationWithAssistant;
  organization: Organization;
  instance: Instance;
}>()('assistant_conversation');

export let assistantMessageType = PresentableType.create<{
  assistantConversationItem: AssistantConversationItemWithMessage;
}>()('assistant_message');

export let machineAccessType = PresentableType.create<{
  machineAccess: MachineAccess & {
    organization: Organization | null;
    actor: OrganizationActor | null;
    instance: (Instance & { project: Project }) | null;
    user: User | null;
  };
}>()('machine_access');

export let apiKeyType = PresentableType.create<{
  apiKey: ApiKey & {
    machineAccess: MachineAccess & {
      organization: Organization | null;
      actor: OrganizationActor | null;
      instance: (Instance & { project: Project }) | null;
      user: User | null;
    };
  };
  secret?: ApiKeySecret;
  canReveal: boolean;
}>()('api_key');

export let oauthApplicationType = PresentableType.create<{
  oauthApplication: OAuthApplication & {
    organization: Organization | null;
    clientSecrets?: OAuthApplicationClientSecret[] | null;
  };
}>()('oauth_application');

export let oauthApplicationClientSecretType = PresentableType.create<{
  oauthApplicationClientSecret: OAuthApplicationClientSecret;
  secret?: string | null;
}>()('oauth_application_client_secret');

export let oauthInstallationType = PresentableType.create<{
  oauthInstallation: OAuthInstallation & {
    organization: Organization;
    oauthApplication: OAuthApplication & {
      organization: Organization | null;
    };
    serverSideMachineAccess:
      | (MachineAccess & {
          organization: Organization | null;
          actor: OrganizationActor | null;
          instance: (Instance & { project: Project }) | null;
          user: User | null;
        })
      | null;
  };
}>()('oauth_installation');

export let cliDeviceType = PresentableType.create<{
  cliDevice: CliDevice & {
    organization: Organization;
    user: User;
    oauthAuthorization: OAuthAuthorization;
  };
}>()('cli_device');

export let oauthAuthorizationType = PresentableType.create<{
  oauthAuthorization: OAuthAuthorization & {
    oauthApplication: OAuthApplication & {
      organization: Organization | null;
    };
    oauthInstallation: OAuthInstallation & {
      organization: Organization;
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
      };
      serverSideMachineAccess: MachineAccess | null;
    };
    organizationMember: OrganizationMember | null;
    machineAccess: MachineAccess & {
      organization: Organization | null;
      actor: OrganizationActor | null;
      instance: (Instance & { project: Project }) | null;
      user: User | null;
    };
    user: User | null;
  };
}>()('oauth_authorization');

export let oauthAuthorizationRequestType = PresentableType.create<{
  oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations;
}>()('oauth_authorization_request');

export let oauthAuthorizationLogType = PresentableType.create<{
  oauthAuthorizationLog: OAuthAuthorizationLogWithRelations;
}>()('oauth_authorization_log');

export let serviceAccountType = PresentableType.create<{
  serviceAccount: ServiceAccount & {
    organization: Organization;
    policies?: (AccessPolicyAssignment & {
      accessPolicy: AccessPolicy;
    })[];
    oauthApplication: OAuthApplication & {
      organization: Organization | null;
      clientSecrets?: OAuthApplicationClientSecret[] | null;
    };
  };
}>()('service_account');

export let serviceAccountCredentialType = PresentableType.create<{
  serviceAccountCredential: ServiceAccountCredential & {
    serviceAccount: ServiceAccount & {
      organization: Organization;
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
      };
    };
    oauthAuthorization: OAuthAuthorization & {
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
      };
      oauthInstallation: OAuthInstallation & {
        organization: Organization;
        oauthApplication: OAuthApplication & {
          organization: Organization | null;
        };
        serverSideMachineAccess: MachineAccess | null;
      };
      organizationMember: OrganizationMember | null;
      machineAccess: MachineAccess & {
        organization: Organization | null;
        actor: OrganizationActor | null;
        instance: (Instance & { project: Project }) | null;
        user: User | null;
      };
      user: User | null;
    };
  };
}>()('service_account_credential');

export let fileType = PresentableType.create<{
  file: File & {
    purpose: Prisma.FilePurposeGetPayload<{}>;
    createdByResourceActor?: ResourceActorPresentationRecord | null;
    effectiveStoreId?: string;
    signedDownloadUrl?: string;
  };
}>()('file');

export let fileLinkType = PresentableType.create<{
  fileLink: FileLink & {
    file: File;
  };
}>()('fileLink');

export let documentType = PresentableType.create<{
  document: Prisma.DocumentGetPayload<{
    include: {
      parentDocument: true;
      content: true;
      currentVersion: true;
      file: {
        include: {
          purpose: true;
        };
      };
    };
  }> & {
    createdByResourceActor?: ResourceActorPresentationRecord | null;
    resolvedTitle?: string;
    resolvedContent?: string;
  };
}>()('document');

export let documentEditTokenType = PresentableType.create<{
  token: {
    token: string;
    expiresAt: Date;
    documentId: string;
  };
}>()('document.edit_token');

export let documentPermissionsType = PresentableType.create<{
  permissions: {
    documentId: string;
    isOwner: boolean;
    hasFullAccess: boolean;
    permissions: ('content_read' | 'content_write')[];
    relevantStoreIds: string[];
    readableStoreIds: string[];
    writableStoreIds: string[];
  };
}>()('documentPermissions');

export let documentVersionType = PresentableType.create<{
  documentVersion: Prisma.DocumentVersionGetPayload<{
    include: {
      document: true;
      previousVersion: true;
      content: true;
      documentVersionEditors: {
        include: {
          resourceActor: {
            include: typeof resourceActorPresentationInclude;
          };
        };
      };
    };
  }>;
}>()('documentVersion');

export let documentParticipantType = PresentableType.create<{
  documentParticipant: DocumentParticipant & {
    document: Document;
    resourceActor: ResourceActorPresentationRecord;
  };
}>()('documentParticipant');

export let storeType = PresentableType.create<{
  store: Store;
}>()('store');

export let storePermissionsType = PresentableType.create<{
  permissions: {
    storeId: string;
    hasFullAccess: boolean;
    permissions: ('content_read' | 'content_write')[];
    relevantStoreIds: string[];
    readableStoreIds: string[];
    writableStoreIds: string[];
  };
}>()('storePermissions');

export let storeItemType = PresentableType.create<{
  storeItem: Prisma.StoreItemGetPayload<{
    include: {
      store: {
        select: {
          id: true;
        };
      };
      directory: {
        select: {
          id: true;
          path: true;
          isAutoCreated: true;
        };
      };
      parentDirectory: {
        select: {
          id: true;
          path: true;
          isAutoCreated: true;
        };
      };
      file: {
        include: {
          purpose: true;
        };
      };
      document: {
        include: {
          parentDocument: true;
          content: true;
          currentVersion: true;
          file: {
            include: {
              purpose: true;
            };
          };
        };
      };
    };
  }>;
}>()('storeItem');

export let storeItemListType = PresentableType.create<{
  storeItems: Prisma.StoreItemGetPayload<{
    include: {
      store: {
        select: {
          id: true;
        };
      };
      directory: {
        select: {
          id: true;
          path: true;
          isAutoCreated: true;
        };
      };
      parentDirectory: {
        select: {
          id: true;
          path: true;
          isAutoCreated: true;
        };
      };
      file: {
        include: {
          purpose: true;
        };
      };
      document: {
        include: {
          parentDocument: true;
          content: true;
          currentVersion: true;
          file: {
            include: {
              purpose: true;
            };
          };
        };
      };
    };
  }>[];
}>()('storeItemList');

export let storeParticipantType = PresentableType.create<{
  storeParticipant: StoreParticipant & {
    store: Store;
    resourceActor: ResourceActorPresentationRecord;
  };
}>()('storeParticipant');

export let skillAgentType = PresentableType.create<{
  skillAgent: Prisma.SkillAgentGetPayload<{
    include: {
      skill: {
        include: {
          store: true;
        };
      };
      storeItem: {
        select: {
          id: true;
          path: true;
        };
      };
      document: {
        select: {
          id: true;
        };
      };
    };
  }>;
}>()('skillAgent');

export let skillConfigurationType = PresentableType.create<{
  skillConfiguration: SkillConfiguration;
}>()('skillConfiguration');

export let skillExportType = PresentableType.create<{
  skillExport: SkillExport & {
    file:
      | (Prisma.FileGetPayload<{
          include: {
            purpose: true;
            createdByResourceActor: {
              include: typeof resourceActorPresentationInclude;
            };
          };
        }> & {
          effectiveStoreId?: string;
          signedDownloadUrl?: string;
        })
      | null;
    fileLink: (FileLink & { file: File }) | null;
    creatorResourceActor: ResourceActorPresentationRecord | null;
  };
}>()('skillExport');

export let skillImportType = PresentableType.create<{
  skillImport: Prisma.SkillImportGetPayload<{
    include: {
      items: {
        include: {
          skill: true;
        };
      };
    };
  }>;
}>()('skillImport');

export let skillForkSyncType = PresentableType.create<{
  skillForkSync: SkillForkSync & {
    forkSkill: Skill;
    upstreamSkill: Skill;
    generatedMergeRequest: SkillMergeRequest | null;
  };
}>()('skillForkSync');

export let skillMarketplaceType = PresentableType.create<{
  skillMarketplace: Prisma.SkillMarketplaceGetPayload<{
    include: {
      destination: {
        include: {
          syncs: true;
        };
      };
      skillConfiguration: {
        select: {
          id: true;
        };
      };
      plugins: {
        include: {
          skillConfiguration: {
            select: {
              id: true;
            };
          };
          skillPlugin: {
            include: {
              destination: {
                include: {
                  syncs: true;
                };
              };
              skillConfiguration: {
                select: {
                  id: true;
                };
              };
              skillPluginSkills: {
                include: {
                  skillConfiguration: {
                    select: {
                      id: true;
                    };
                  };
                  skill: true;
                };
              };
            };
          };
        };
      };
    };
  }>;
}>()('skillMarketplace');

export let skillMarketplacePluginType = PresentableType.create<{
  skillMarketplacePlugin: SkillMarketplacePlugin & {
    skillConfiguration: {
      id: string;
    } | null;
    skillMarketplace?: {
      id: string;
    } | null;
    skillPlugin?: Prisma.SkillPluginGetPayload<{
      include: {
        destination: {
          include: {
            syncs: true;
          };
        };
        skillConfiguration: {
          select: {
            id: true;
          };
        };
        skillPluginSkills: {
          include: {
            skillConfiguration: {
              select: {
                id: true;
              };
            };
            skill: true;
          };
        };
      };
    }> | null;
  };
}>()('skillMarketplacePlugin');

export let skillMarketplaceRepositoryType = PresentableType.create<{
  skillMarketplaceRepository: SkillMarketplaceRepository & {
    skillMarketplace: SkillMarketplace;
    skillRepository: Prisma.SkillRepositoryGetPayload<{
      include: {
        marketplaceRepository: true;
        pluginRepository: true;
      };
    }> & {
      originRepository: {
        id: string;
        provider: 'github' | 'gitlab' | 'bitbucket';
        externalName: string;
        externalUrl: string;
        externalIsPrivate: boolean;
        defaultBranch: string;
      } | null;
    };
  };
}>()('skillMarketplaceRepository');

export let skillPluginType = PresentableType.create<{
  skillPlugin: Prisma.SkillPluginGetPayload<{
    include: {
      destination: {
        include: {
          syncs: true;
        };
      };
      skillConfiguration: {
        select: {
          id: true;
        };
      };
      skillPluginSkills: {
        include: {
          skillConfiguration: {
            select: {
              id: true;
            };
          };
          skill: true;
        };
      };
    };
  }>;
}>()('skillPlugin');

export let skillPluginRepositoryType = PresentableType.create<{
  skillPluginRepository: SkillPluginRepository & {
    skillPlugin: SkillPlugin;
    skillRepository: Prisma.SkillRepositoryGetPayload<{
      include: {
        marketplaceRepository: true;
        pluginRepository: true;
      };
    }> & {
      originRepository: {
        id: string;
        provider: 'github' | 'gitlab' | 'bitbucket';
        externalName: string;
        externalUrl: string;
        externalIsPrivate: boolean;
        defaultBranch: string;
      } | null;
    };
  };
}>()('skillPluginRepository');

export let skillPluginSkillType = PresentableType.create<{
  skillPluginSkill: SkillPluginSkill & {
    skillConfiguration: {
      id: string;
    } | null;
    skill: Skill;
  };
}>()('skillPluginSkill');

export let skillSyncType = PresentableType.create<{
  skillSync: Prisma.SkillDestinationSyncGetPayload<{
    include: {
      destination: {
        include: {
          skillMarketplace: {
            select: {
              id: true;
              resourceTenantOid: true;
              resourceGroupOid: true;
            };
          };
          skillPlugin: {
            select: {
              id: true;
              resourceTenantOid: true;
              resourceGroupOid: true;
            };
          };
        };
      };
      repositoryPropagations: {
        include: {
          skillRepository: true;
        };
      };
    };
  }>;
}>()('skillSync');

export let skillSyncRepositoryChecksType = PresentableType.create<{
  repositoryChecks: SkillSyncRepositoryCheck[];
}>()('skillSyncRepositoryChecks');

export let skillParticipantType = PresentableType.create<{
  skillParticipant: SkillParticipant & {
    skill: Skill;
    resourceActor: ResourceActorPresentationRecord;
  };
}>()('skillParticipant');

export let skillVersionType = PresentableType.create<{
  skillVersion: Prisma.SkillVersionGetPayload<{
    include: {
      skill: {
        select: {
          id: true;
          store: {
            select: {
              id: true;
            };
          };
        };
      };
      storeVersion: {
        select: {
          id: true;
        };
      };
    };
  }>;
}>()('skillVersion');

export let skillVersionSnapshotType = PresentableType.create<{
  skillVersionSnapshot: {
    id: string;
    skillId: string;
    storeId: string;
    storeVersionId: string;
    versionNumber: number;
    createdAt: Date;
    items: {
      id: string;
      kind: 'file' | 'document' | 'directory';
      path: string;
      fileId?: string;
      documentId?: string;
      documentVersionId?: string;
      content?: string;
      createdAt: Date;
    }[];
  };
}>()('skillVersionSnapshot');

export let skillMergeRequestType = PresentableType.create<{
  skillMergeRequest: Prisma.SkillMergeRequestGetPayload<{
    include: {
      sourceSkill: true;
      targetSkill: true;
      baseTargetSkillVersion: true;
      requestedSourceSkillVersion: true;
      requestedTargetSkillVersion: true;
      preMergeTargetSkillVersion: true;
      mergedTargetSkillVersion: true;
      rollbackTargetSkillVersion: true;
      createdByResourceActor: {
        include: typeof resourceActorPresentationInclude;
      };
      _count: {
        select: {
          items: true;
          comments: true;
        };
      };
    };
  }>;
}>()('skillMergeRequest');

export let skillMergeRequestItemType = PresentableType.create<{
  skillMergeRequestItem: SkillMergeRequestItem & {
    skillMergeRequest: SkillMergeRequest;
    resolvedByResourceActor: ResourceActorPresentationRecord | null;
  };
}>()('skillMergeRequestItem');

export let skillMergeRequestCommentType = PresentableType.create<{
  skillMergeRequestComment: SkillMergeRequestComment & {
    skillMergeRequestItem: SkillMergeRequestItem | null;
    resourceActor: ResourceActorPresentationRecord;
    inReplyToComment: SkillMergeRequestComment | null;
  };
}>()('skillMergeRequestComment');

export let skillMergeRequestEventType = PresentableType.create<{
  skillMergeRequestEvent: SkillMergeRequestEvent & {
    resourceActor: ResourceActorPresentationRecord | null;
    comment:
      | (SkillMergeRequestComment & {
          skillMergeRequestItem: SkillMergeRequestItem | null;
          resourceActor: ResourceActorPresentationRecord;
          inReplyToComment: SkillMergeRequestComment | null;
        })
      | null;
  };
}>()('skillMergeRequestEvent');

export let skillMergePlanType = PresentableType.create<{
  skillMergePlan: {
    mergeRequest: Prisma.SkillMergeRequestGetPayload<{
      include: {
        sourceSkill: true;
        targetSkill: true;
        baseTargetSkillVersion: true;
        requestedSourceSkillVersion: true;
        requestedTargetSkillVersion: true;
        preMergeTargetSkillVersion: true;
        mergedTargetSkillVersion: true;
        rollbackTargetSkillVersion: true;
        createdByResourceActor: {
          include: typeof resourceActorPresentationInclude;
        };
        _count: {
          select: {
            items: true;
            comments: true;
          };
        };
      };
    }>;
    items: {
      item: SkillMergeRequestItem & {
        skillMergeRequest: SkillMergeRequest;
        resolvedByResourceActor: ResourceActorPresentationRecord | null;
      };
      base?: {
        kind: 'file' | 'document' | 'directory';
        path: string;
        fileId?: string;
        documentId?: string;
        documentTitle?: string;
        documentVersionId?: string;
        content?: string;
      };
      source?: {
        kind: 'file' | 'document' | 'directory';
        path: string;
        fileId?: string;
        documentId?: string;
        documentTitle?: string;
        documentVersionId?: string;
        content?: string;
      };
      target?: {
        kind: 'file' | 'document' | 'directory';
        path: string;
        fileId?: string;
        documentId?: string;
        documentTitle?: string;
        documentVersionId?: string;
        content?: string;
      };
      documentMerge?: {
        baseContent?: string;
        sourceContent?: string;
        targetContent?: string;
        hasConflict: boolean;
      };
    }[];
  };
}>()('skillMergePlan');

export let secretType = PresentableType.create<{
  secret: Secret & { type: SecretType; organization: Organization; instance: Instance };
}>()('secret');

export let keyProviderType = PresentableType.create<{
  keyProvider: import('@metorial/module-secrets').NebulaKeyProvider;
}>()('key_provider');

export let keyProviderErrorType = PresentableType.create<{
  keyProviderError: import('@metorial/module-secrets').NebulaKeyProviderError;
}>()('key_provider_error');

export let keyProviderSetupInfoType = PresentableType.create<{
  setupInfo: import('@metorial/module-secrets').NebulaKeyProviderSetupInfo;
}>()('key_provider_setup_info');

export let keyProviderValidationType = PresentableType.create<{
  validation: import('@metorial/module-secrets').NebulaKeyProviderValidation;
}>()('key_provider_validation');

export let usageType = PresentableType.create<{
  timeline: {
    entityId: string;
    entityType: string;
    ownerId: string;
    entries: {
      ts: Date;
      count: number;
    }[];
  }[];
}>()('usage');

export let profileType = PresentableType.create<{
  profile: Profile;
}>()('profile');

export let flagsType = PresentableType.create<{
  flags: Flags;
}>()('flags');

export let magicMcpServerType = PresentableType.create<{
  magicMcpServer: MagicMcpServer & {
    aliases: MagicMcpServerAlias[];
    accessTagEntities?: (AccessTagEntity & {
      accessTagPolicy: AccessTagPolicy;
      accessTag: AccessTag & {
        consumerGroup:
          | (ConsumerGroup & {
              personalOwner:
                | (ConsumerProfile & {
                    consumer: Consumer;
                  })
                | null;
            })
          | null;
      };
    })[];
    consumerIntegrations: (ConsumerIntegration & {
      consumer: Consumer;
      consumerProfile: ConsumerProfile;
    })[];
  };
  integration?: SubspaceIntegration | null;
  integrationInstance?: SubspaceIntegrationInstance | null;
  magicMcpServerProviders?: SubspaceMagicMcpServerProvider[] | null;
  portal?: Portal | null;
}>()('magic_mcp.server');

export let magicMcpServerProviderType = PresentableType.create<{
  magicMcpServer: MagicMcpServer;
  magicMcpServerProvider: SubspaceMagicMcpServerProvider;
}>()('magic_mcp.server.provider');

export let magicMcpEndpointType = PresentableType.create<{
  magicMcpEndpoint: MagicMcpEndpoint & {
    consumerProfile: ConsumerProfile | null;
    consumerIntegrationEndpoints: (ConsumerIntegrationEndpoint & {
      consumer: Consumer;
      consumerProfile: ConsumerProfile;
    })[];
    servers: (MagicMcpEndpointServer & {
      magicMcpServer: MagicMcpServer & {
        aliases: MagicMcpServerAlias[];
      };
    })[];
  };
  portal?: Portal | null;
}>()('magic_mcp.endpoint');

export let magicMcpSessionType = PresentableType.create<{
  magicMcpSession: MagicMcpSession & {
    magicMcpServer:
      | (MagicMcpServer & {
          aliases: MagicMcpServerAlias[];
          consumerIntegrations: (ConsumerIntegration & {
            consumer: Consumer;
            consumerProfile: ConsumerProfile;
          })[];
        })
      | null;
    magicMcpEndpoint:
      | (MagicMcpEndpoint & {
          consumerProfile: ConsumerProfile | null;
          consumerIntegrationEndpoints: (ConsumerIntegrationEndpoint & {
            consumer: Consumer;
            consumerProfile: ConsumerProfile;
          })[];
          servers: (MagicMcpEndpointServer & {
            magicMcpServer: MagicMcpServer & {
              aliases: MagicMcpServerAlias[];
              consumerIntegrations: (ConsumerIntegration & {
                consumer: Consumer;
                consumerProfile: ConsumerProfile;
              })[];
            };
          })[];
        })
      | null;
    consumerIntegrationSessions: (ConsumerIntegrationSession & {
      consumer: Consumer;
      consumerProfile: ConsumerProfile;
      consumerIntegration: ConsumerIntegration & {
        consumer: Consumer;
        consumerProfile: ConsumerProfile;
      };
    })[];
  };
}>()('magic_mcp.session');

export let magicMcpTokenType = PresentableType.create<{
  magicMcpToken: MagicMcpToken & {
    consumerTokens: (ConsumerToken & {
      consumer: Consumer;
      consumerProfile: ConsumerProfile;
    })[];
    magicMcpServer: MagicMcpServer | null;
    magicMcpEndpoint:
      | (MagicMcpEndpoint & {
          servers: MagicMcpEndpointServer[];
        })
      | null;
    groups: (MagicMcpGroupToken & {
      magicMcpGroup: MagicMcpGroup;
    })[];
  };
}>()('magic_mcp.token');

export let consumerTokenType = PresentableType.create<{
  consumerToken: ConsumerToken & {
    consumer: Consumer;
    consumerProfile: ConsumerProfile;
  };
}>()('consumer.token');

export let consumerIntegrationType = PresentableType.create<{
  consumerIntegration: ConsumerIntegration & {
    consumer: Consumer;
    consumerProfile: ConsumerProfile;
  };
}>()('consumer.integration');

export let consumerIntegrationEndpointType = PresentableType.create<{
  consumerIntegrationEndpoint: ConsumerIntegrationEndpoint & {
    consumer: Consumer;
    consumerProfile: ConsumerProfile;
  };
}>()('consumer.integration_endpoint');

export let consumerIntegrationSessionType = PresentableType.create<{
  consumerIntegrationSession: ConsumerIntegrationSession & {
    consumer: Consumer;
    consumerProfile: ConsumerProfile;
    consumerIntegration: ConsumerIntegration & {
      consumer: Consumer;
      consumerProfile: ConsumerProfile;
    };
  };
}>()('consumer.integration_session');

export let magicMcpGroupType = PresentableType.create<{
  magicMcpGroup: MagicMcpGroup;
}>()('magic_mcp.group');

export let consumerGroupType = PresentableType.create<{
  consumerGroup: ConsumerGroup;
}>()('consumer.group');

export let consumerAccessType = PresentableType.create<{
  consumerAccess: ConsumerAccess & {
    consumerGroup: ConsumerGroup;
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
    skill: Skill | null;
    skillTemplate: SkillTemplate | null;
    skillGroup: SkillGroup | null;
    skillMarketplace: SkillMarketplace | null;
    listing: ConsumerAccessListing | null;
  };
}>()('consumer.access');

export let consumerAccessListingType = PresentableType.create<{
  consumerAccessListing: ConsumerAccessListing & {
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
    skill: Skill | null;
    skillTemplate: SkillTemplate | null;
    skillGroup: SkillGroup | null;
    skillMarketplace: SkillMarketplace | null;
    consumerSurfaceProviderGroups: {
      consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
    }[];
  };
}>()('consumer.access_listing');

export let consumerAccessRequestType = PresentableType.create<{
  consumerAccessRequest: ConsumerAccessRequest & {
    consumerProfile: ConsumerProfile & {
      consumer: Consumer;
      personalConsumerGroup: ConsumerGroup;
    };
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
  };
}>()('consumer.access_request');

export let consumerInviteType = PresentableType.create<{
  consumerInvite: ConsumerInvite & {
    consumerProfile: ConsumerProfile;
    invitedBy: OrganizationActor;
    surface: ConsumerSurface & {
      portal: Portal | null;
    };
  };
}>()('consumer.invite');

export let consumerType = PresentableType.create<{
  consumer: InstanceConsumer & {
    consumer: Consumer & {
      organizationMember: OrganizationMember | null;
      profiles: (ConsumerProfile & {
        surface: ConsumerSurface;
      })[];
    };
  };
}>()('consumer');

export let consumerAndProfileType = PresentableType.create<{
  consumer: InstanceConsumer & {
    consumer: Consumer & {
      organizationMember: OrganizationMember | null;
      profiles: (ConsumerProfile & {
        surface: ConsumerSurface;
      })[];
    };
  };
  consumerProfile: ConsumerProfile & {
    consumer: Consumer;
    surface: EnrichedConsumerSurface;
    groups: (ConsumerProfileGroup & {
      group: ConsumerGroup;
    })[];
  };
  assignedConsumerGroups:
    | (ConsumerGroup & {
        assignedVia: 'default' | 'manual' | 'sso' | 'user';
      })[]
    | undefined;
}>()('consumer_and_profile');

export let consumerSurfaceType = PresentableType.create<{
  consumerSurface: EnrichedConsumerSurface;
}>()('consumer.surface');

export let consumerSurfaceProviderGroupType = PresentableType.create<{
  consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
}>()('consumer.surface_provider_group');

export let consumerProfileType = PresentableType.create<{
  consumerProfile: ConsumerProfile & {
    consumer: Consumer;
    surface: EnrichedConsumerSurface;
    groups: (ConsumerProfileGroup & {
      group: ConsumerGroup;
    })[];
  };
  instanceConsumer: InstanceConsumer | null;
  assignedConsumerGroups:
    | (ConsumerGroup & {
        assignedVia: 'default' | 'manual' | 'sso' | 'user';
      })[]
    | undefined;
}>()('consumer.profile');

export let consumerSessionType = PresentableType.create<{
  consumerSession: ConsumerSession;
}>()('consumer.session');

export let consumerProviderType = PresentableType.create<{
  consumerProvider: ConsumerProviderCatalogEntry;
}>()('consumer.provider');

export let consumerActivityAgentType = PresentableType.create<ConsumerActivityAgent>()(
  'consumer.activity_agent'
);

export let consumerActivitySessionConnectionType =
  PresentableType.create<ConsumerActivitySessionConnection>()(
    'consumer.activity_session_connection'
  );

export let portalOAuthClientType = PresentableType.create<{
  portalAuthClient: ConsumerAuthClient & {
    consumerAuthClientSurfaces: (ConsumerAuthClientSurface & {
      consumerSurface: ConsumerSurface & {
        portal: Portal | null;
      };
    })[];
    skillPlugin: SkillPlugin | null;
    magicMcpServer: MagicMcpServer | null;
    magicMcpEndpoint: MagicMcpEndpoint | null;
  };
}>()('portal.oauth_client');

export let portalOAuthAuthorizationType = PresentableType.create<{
  portalOAuthAuthorization: ConsumerAuthAttempt & {
    consumerAuthClient: ConsumerAuthClient & {
      consumerAuthClientSurfaces: (ConsumerAuthClientSurface & {
        consumerSurface: ConsumerSurface & {
          portal: Portal | null;
        };
      })[];
      skillPlugin: SkillPlugin | null;
      magicMcpServer: MagicMcpServer | null;
      magicMcpEndpoint: MagicMcpEndpoint | null;
    };
    consumerProfile: ConsumerProfile | null;
    magicMcpEndpoint: MagicMcpEndpoint | null;
    skillPlugin:
      | (SkillPlugin & {
          organization: Organization;
          instance: Instance & {
            project: Project;
            organization: Organization;
          };
        })
      | null;
    skillPluginSupportedProviderIds?: string[];
  };
}>()('portal.oauth_authorization');

export let callbackType = PresentableType.create<{
  callback: SubspaceCallback;
}>()('callback');

export let callbackEventType = PresentableType.create<{
  callbackEvent: SubspaceCallbackEvent;
}>()('callback.event');

export let callbackDestinationType = PresentableType.create<{
  callbackDestination: SubspaceCallbackDestination;
}>()('callback.destination');

export let callbackNotificationType = PresentableType.create<{
  callbackNotification: SubspaceCallbackNotification;
}>()('callback.notification');

export let callbackInstanceType = PresentableType.create<{
  callbackInstance: SubspaceCallbackInstance;
}>()('callback.instance');

export let portalType = PresentableType.create<{
  portal: Portal & {
    surface: EnrichedConsumerSurface;
    organization: Organization;
  };
  portalUrl: string;
}>()('portal');

export let providerTemplateType = PresentableType.create<{
  providerTemplate: EnrichedProviderTemplate;
}>()('provider.template');

export let portalAuthAppType = PresentableType.create<{
  app: ConsumerAresApp;
  consumerSurface: ConsumerSurface;
}>()('portal.auth.app');

export let portalAuthSsoTenantType = PresentableType.create<{
  ssoTenant: ConsumerAresSsoTenant;
}>()('portal.auth.sso_tenant');

export let portalAuthSsoConnectionType = PresentableType.create<{
  ssoConnection: ConsumerAresSsoConnection;
}>()('portal.auth.sso_connection');

export let portalAuthSsoTenantSetupType = PresentableType.create<{
  ssoTenantSetup: ConsumerAresSsoTenantSetup;
}>()('portal.auth.sso_tenant_setup');

// export let consumerAuthFactorType = PresentableType.create<{
//   consumerAuthFactor: ConsumerSurfaceAuthFactor;
// }>()('consumer.auth_factor');

// export let consumerGroupType = PresentableType.create<{
//   consumerGroup: ConsumerGroup;
// }>()('consumer.group');

// export let consumerAccessType = PresentableType.create<{
//   consumerAccess: ConsumerAccess & {
//     consumerGroup: ConsumerGroup;
//     serverDeploymentTemplate: (ServerDeploymentTemplate & { server: Server }) | null;
//   };
// }>()('consumer.access');

// export let consumerServerRequestType = PresentableType.create<{
//   consumerServerRequest: ConsumerServerRequest & {
//     server: Server;
//     consumerProfile: ConsumerProfile;
//   };
// }>()('consumer.server_request');

// export let consumerProfileType = PresentableType.create<{
//   consumerProfile: ConsumerProfile & {
//     consumer: Consumer;
//     groups: (ConsumerProfileGroup & {
//       group: ConsumerGroup;
//     })[];
//   };
//   assignedConsumerGroups:
//     | (ConsumerGroup & {
//         assignedVia: 'default' | 'manual' | 'sso' | 'user';
//       })[]
//     | undefined;
// }>()('consumer.profile');

// export let consumerSessionType = PresentableType.create<{
//   consumerSession: ConsumerSession;
// }>()('consumer.session');

export let teamType = PresentableType.create<{
  team: Team & {
    organization: Organization;
    projects: (TeamProject & { project: Project })[];
    policies?: (AccessPolicyAssignment & {
      accessPolicy: AccessPolicy;
    })[];
  };
}>()('management.team');

export let accessRoleType = PresentableType.create<{
  accessRole: AccessRole & {
    organization: Organization;
  };
}>()('management.access_role');

export let accessRoleVersionType = PresentableType.create<{
  accessRoleVersion: AccessRoleVersion & {
    accessRole: AccessRole & {
      organization: Organization;
    };
  };
}>()('management.access_role_version');

export let accessPolicyType = PresentableType.create<{
  accessPolicy: AccessPolicy & {
    organization: Organization;
    accessPolicyRoles: (AccessPolicyRole & {
      accessRole: AccessRole;
    })[];
    accessPolicyProjects: (AccessPolicyProject & {
      project: Project;
    })[];
    accessPolicyInstances: (AccessPolicyInstance & {
      instance: Instance & {
        project: Project;
        organization: Organization;
      };
    })[];
  };
}>()('management.access_policy');

export let accessPolicyVersionType = PresentableType.create<{
  accessPolicyVersion: AccessPolicyVersion & {
    accessPolicy: AccessPolicy & {
      organization: Organization;
    };
    document: PolicyDocument;
  };
}>()('management.access_policy_version');

export let accessPolicyPreviewType = PresentableType.create<{
  accessPolicy: AccessPolicy;
}>()('management.access_policy#preview');

export let oauthScopePermissionsType = PresentableType.create<{
  permissions: {
    identifier: string;
    name: string;
    description: string;
    dependencies: string[];
  }[];
}>()('management.oauth.scopes');

export let publisherType = PresentableType.create<{ publisher: SubspacePublisher }>()(
  'publisher'
);

export let agentType = PresentableType.create<{
  agent: SubspaceAgent;
}>()('agent');

export let agentInstanceType = PresentableType.create<{
  agentInstance: SubspaceAgentInstance;
}>()('agent.instance');

export let providerVersionType = PresentableType.create<{
  version: SubspaceProviderVersion;
}>()('version');

export let providerType = PresentableType.create<{ provider: SubspaceProvider }>()('provider');

export let identityType = PresentableType.create<{
  identity: SubspaceIdentity;
}>()('identity');

export let identityActorType = PresentableType.create<{
  identityActor: SubspaceIdentityActor;
}>()('identity.actor');

export let identityCredentialType = PresentableType.create<{
  identityCredential: SubspaceIdentityCredential;
}>()('identity.credential');

export let identityDelegationType = PresentableType.create<{
  identityDelegation: SubspaceIdentityDelegation;
}>()('identity.delegation');

export let identityDelegationConfigType = PresentableType.create<{
  identityDelegationConfig: SubspaceIdentityDelegationConfig;
}>()('identity.delegation_config');

export let identityDelegationRequestType = PresentableType.create<{
  identityDelegationRequest: SubspaceIdentityDelegationRequest;
}>()('identity.delegation_request');

export let providerTypeType = PresentableType.create<{
  providerType: SubspaceProviderType;
}>()('provider.type');

export let providerListingCategoryType = PresentableType.create<{
  category: SubspaceProviderListingCategory;
}>()('category');

export let providerListingCollectionType = PresentableType.create<{
  collection: SubspaceProviderListingCollection;
}>()('collection');

export let providerListingGroupType = PresentableType.create<{
  group: SubspaceProviderListingGroup;
}>()('group');

export let providerListingType = PresentableType.create<{
  providerListing: SubspaceProviderListing;
}>()('providerListing');

export let providerToolType = PresentableType.create<{ tool: SubspaceProviderTool }>()('tool');

export let providerToolsType = PresentableType.create<{
  items: SubspaceProviderTool[];
}>()('provider.tools');

export let providerTriggerType = PresentableType.create<{
  trigger: SubspaceProviderTrigger;
}>()('provider.capabilities.trigger');

export let providerAuthMethodType = PresentableType.create<{
  authMethod: SubspaceProviderAuthMethod;
}>()('provider.capabilities.auth_method');

export let providerSpecificationType = PresentableType.create<{
  specification: SubspaceProviderSpecification;
}>()('specification');

export let providerSpecificationChangeNotificationType = PresentableType.create<{
  notification: SubspaceProviderSpecificationChangeNotification;
}>()('provider.specification_change_notification');

export let monitorType = PresentableType.create<{
  monitor: SubspaceMonitor;
}>()('monitor');

export let monitorAlertType = PresentableType.create<{
  alert: SubspaceMonitorAlert;
}>()('monitor.alert');

export let protoGuardAlertType = PresentableType.create<{
  alert: SubspaceProtoGuardAlert;
}>()('protoguard.alert');

export let protoGuardConfigType = PresentableType.create<{
  config: SubspaceProtoGuardConfig;
}>()('protoguard.filter_config');

export let deploymentPreviewType = PresentableType.create<{
  deployment: NonNullable<SubspaceProviderAuthConfig['deploymentPreview']>;
}>()('deploymentPreview');

export let configPreviewType = PresentableType.create<{
  config: NonNullable<SubspaceProviderDeployment['defaultConfig']>;
}>()('configPreview');

export let authConfigPreviewType = PresentableType.create<{
  authConfig: NonNullable<SubspaceCallbackInstance['authConfig']>;
}>()('configPreview');

export let providerDeploymentType = PresentableType.create<{
  deployment: SubspaceProviderDeployment;
}>()('deployment');

export let providerConfigVaultType = PresentableType.create<{
  configVault: SubspaceProviderConfigVault;
}>()('configVault');

export let providerConfigType = PresentableType.create<{ config: SubspaceProviderConfig }>()(
  'config'
);

export let providerAuthConfigType = PresentableType.create<{
  authConfig: SubspaceProviderAuthConfig;
}>()('provider.auth_config');

export let providerAuthConfigEventType = PresentableType.create<{
  authConfigEvent: SubspaceAuthConfigEvent;
}>()('provider.auth_config_event');

export let providerAuthConfigErrorType = PresentableType.create<{
  authConfigError: SubspaceAuthConfigError;
}>()('provider.auth_config_error');

export let providerAuthConfigErrorGroupType = PresentableType.create<{
  authConfigErrorGroup: SubspaceAuthConfigErrorGlobal;
}>()('provider.auth_config_error_group');

export let providerAuthCredentialsType = PresentableType.create<{
  authCredentials: SubspaceProviderAuthCredentials;
}>()('provider.auth_credentials');

export let providerSetupSessionType = PresentableType.create<{
  setupSession: SubspaceProviderSetupSession;
}>()('setupSession');

export let providerAuthImportType = PresentableType.create<{
  authImport: SubspaceProviderAuthImport;
}>()('authImport');

export let providerAuthExportType = PresentableType.create<{
  authExport: SubspaceProviderAuthExport;
  value?: Record<string, any>;
}>()('authExport');

export let sessionTemplateType = PresentableType.create<{
  sessionTemplate: SubspaceSessionTemplate;
}>()('sessionTemplate');

export let sessionTemplateProviderType = PresentableType.create<{
  sessionTemplateProvider: SubspaceSessionTemplateProvider;
}>()('sessionTemplateProvider');

export let skillType = PresentableType.create<{
  skill: SkillResource;
}>()('skill');

export let skillGroupType = PresentableType.create<{
  skillGroup: SkillGroupResource;
}>()('skill.group');

export let skillGroupItemType = PresentableType.create<{
  skillGroupItem: SkillGroupItemResource;
}>()('skill.group.item');

export let skillItemType = PresentableType.create<{
  skillItem: SkillItemResource;
}>()('skill.item');

export let skillTemplateType = PresentableType.create<{
  skillTemplate: SkillTemplateResource;
}>()('skill.template');

export let skillTemplateItemType = PresentableType.create<{
  skillTemplateItem: SkillTemplateItemResource;
}>()('skill.template.item');

export let networkType = PresentableType.create<{
  network: SubspaceNetwork;
  maskPublicIp?: boolean;
}>()('network');

export let networkLogsType = PresentableType.create<{
  logs: SubspaceEnclaveNetworkLogs;
}>()('networkLogs');

export let resourceCountsType = PresentableType.create<{
  resources: {
    resource: string;
    count: number;
  }[];
}>()('resourceCounts');

export let enclaveType = PresentableType.create<{
  enclave: SubspaceEnclave;
}>()('enclave');

export let firewallType = PresentableType.create<{
  firewall: SubspaceFirewall;
}>()('firewall');

export let firewallBindingType = PresentableType.create<{
  firewallBinding: SubspaceFirewallBinding;
}>()('firewall.binding');

export let networkPolicyType = PresentableType.create<{
  networkPolicy: SubspaceNetworkPolicy;
}>()('network.policy');

export let networkPolicyRuleType = PresentableType.create<{
  rule: SubspaceNetworkPolicyRule;
}>()('network.policy.rule');

export let integrationType = PresentableType.create<{
  integration: SubspaceIntegration;
}>()('integration');

export let integrationProviderType = PresentableType.create<{
  integrationProvider: SubspaceIntegrationProvider;
}>()('integration.provider');

export let integrationInstanceType = PresentableType.create<{
  integrationInstance: SubspaceIntegrationInstance;
}>()('integration.instance');

export let integrationSetupSessionType = PresentableType.create<{
  integrationSetupSession: SubspaceIntegrationSetupSession;
}>()('integration.setup_session');

export let integrationInstanceProviderType = PresentableType.create<{
  integrationInstanceProvider: SubspaceIntegrationInstanceProvider;
}>()('integration.instance.provider');

export let integrationInstanceGroupType = PresentableType.create<{
  integrationInstanceGroup: SubspaceIntegrationInstanceGroup;
}>()('integration.instance.group');

export let integrationInstanceGroupProviderType = PresentableType.create<{
  integrationInstanceGroupProvider: SubspaceIntegrationInstanceGroupProvider;
}>()('integration.instance.group.provider');

export let sessionProviderType = PresentableType.create<{
  sessionProvider: SubspaceSessionProvider;
}>()('sessionProvider');

export let sessionParticipantType = PresentableType.create<{
  sessionParticipant: SubspaceSessionParticipant;
}>()('sessionParticipant');

export let sessionWarningType = PresentableType.create<{
  sessionWarning: SubspaceSessionWarning;
}>()('sessionWarning');

export let sessionErrorType = PresentableType.create<{
  sessionError: SubspaceSessionError;
}>()('sessionError');

export let sessionErrorGroupType = PresentableType.create<{
  sessionErrorGroup: SubspaceSessionErrorGroup;
}>()('sessionErrorGroup');

export let providerRunType = PresentableType.create<{
  providerRun: SubspaceProviderRun;
}>()('providerRun');

export let providerRunLogsType = PresentableType.create<{
  logs: SubspaceProviderRunLogs;
}>()('providerRunLogs');

export let providerInvocationType = PresentableType.create<{
  providerInvocation: SubspaceProviderInvocation;
}>()('providerInvocation');

export let providerInvocationsType = PresentableType.create<{
  items: SubspaceProviderInvocation[];
}>()('providerInvocations');

export let providerSessionType = PresentableType.create<{
  session: SubspaceSession;
}>()('providerSession');

export let sessionMessageType = PresentableType.create<{
  sessionMessage: SubspaceSessionMessage;
}>()('subspaceSessionMessage');

export let sessionConnectionType = PresentableType.create<{
  sessionConnection: SubspaceSessionConnection;
}>()('subspaceSessionConnection');

export let sessionEventType = PresentableType.create<{
  sessionEvent: SubspaceSessionEvent;
}>()('subspaceSessionEvent');

export let configSchemaType = PresentableType.create<{
  schema: SubspaceProviderConfigSchema;
}>()('configSchema');

export let authImportSchemaType = PresentableType.create<{
  schema: SubspaceProviderAuthImportSchema;
}>()('authImportSchema');

export let authConfigSchemaType = PresentableType.create<{
  schema: SubspaceProviderAuthConfigSchema;
}>()('authConfigSchema');

export let customProviderType = PresentableType.create<{
  customProvider: SubspaceCustomProvider;
}>()('customProvider');

export let customProviderVersionType = PresentableType.create<{
  customProviderVersion: SubspaceCustomProviderVersion;
}>()('customProviderVersion');

export let customProviderEnvType = PresentableType.create<{
  customProviderFrom:
    | SubspaceCustomProviderVersion['from']
    | SubspaceCustomProvider['draft']['from'];
}>()('customProviderEnv');

export let customProviderDeploymentType = PresentableType.create<{
  customProviderDeployment: SubspaceCustomProviderDeployment;
}>()('customProviderDeployment');

export let customProviderDeploymentLogsType = PresentableType.create<{
  logs: SubspaceCustomProviderDeploymentLogs;
}>()('customProviderDeploymentLogs');

export let customProviderCommitType = PresentableType.create<{
  customProviderCommit: SubspaceCustomProviderCommit;
}>()('customProviderCommit');

export let customProviderEnvironmentType = PresentableType.create<{
  customProviderEnvironment: SubspaceCustomProviderEnvironment;
}>()('customProviderEnvironment');

export let bucketEditorTokenType = PresentableType.create<{
  token: {
    id: string;
    url: string;
    expiresAt: Date;
  };
}>()('bucketEditorToken');

export let bucketType = PresentableType.create<{
  bucket: SubspaceBucket;
}>()('bucket');

export let actorPreviewType = PresentableType.create<{
  actor: SubspaceCustomProviderCommit['actor'];
}>()('actorPreview');

export let scmPushType = PresentableType.create<{
  scmPush: NonNullable<SubspaceCustomProviderCommit['scmPush']>;
}>()('scmPush');

export let providerOAuthSetupType = PresentableType.create<{
  providerOAuthSetup: SubspaceProviderOAuthSetup;
}>()('providerOAuthSetup');

export let toolCallType = PresentableType.create<{
  toolCall: SubspaceToolCall;
}>()('toolCall');

export let scmConnectionType = PresentableType.create<{
  scmConnection: SubspaceScmConnection;
}>()('scmConnection');

export let scmConnectionSetupType = PresentableType.create<{
  scmConnectionSetup: SubspaceScmConnectionSetupSession;
}>()('scmConnectionSetup');

export let scmProviderType = PresentableType.create<{
  scmProvider: SubspaceScmProvider;
}>()('scmProvider');

export let scmProviderSetupType = PresentableType.create<{
  scmProviderSetup: SubspaceScmProviderSetupSession;
}>()('scmProviderSetup');

export let scmRepoType = PresentableType.create<{
  scmRepo: SubspaceScmRepository;
}>()('scmRepo');

export type ScmRepo = SubspaceScmRepository;

export let scmRepoPreviewType = PresentableType.create<{
  repoPreviews: SubspaceScmRepositoryPreviews;
}>()('scmRepoPreview');

export let scmAccountPreviewType = PresentableType.create<{
  accountPreviews: SubspaceScmAccountPreviews;
}>()('scmAccountPreview');
