import type {
  SkillGroupItemResource,
  SkillGroupResource,
  SkillItemResource,
  SkillResource,
  SkillSyncRepositoryCheck,
  SkillTemplateItemResource,
  SkillTemplateResource
} from '@metorial/cargo-module-skill';
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
  Document,
  DocumentParticipant,
  File,
  FileLink,
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
  Namespace,
  NamespaceCompartment,
  NamespaceProperty,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthAuthorization,
  OAuthInstallation,
  Organization,
  OrganizationActor,
  OrganizationConfig,
  OrganizationConfigType,
  OrganizationInvite,
  OrganizationLayout,
  OrganizationLayoutType,
  OrganizationMember,
  Portal,
  Prisma,
  Profile,
  Project,
  ProviderTemplate,
  Sandbox,
  Secret,
  SecretType,
  ServiceAccount,
  ServiceAccountCredential,
  Skill,
  SkillConfiguration,
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
  Store,
  StoreParticipant,
  Team,
  TeamMember,
  TeamProject,
  User,
  UserStatus,
  UserType
} from '@metorial/db';
import type {
  AvailableProductAssistant,
  ProductAssistantConversationItemWithMessage,
  ProductAssistantConversationWithAssistant
} from '@metorial/module-product-assistant';
import {
  ConsumerActivityAgent,
  ConsumerActivitySessionConnection,
  ConsumerAresApp,
  ConsumerAresSsoConnection,
  ConsumerAresSsoTenant,
  ConsumerAresSsoTenantSetup,
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
  resourceActorPresentationInclude,
  type ResourceActorPresentationRecord
} from '@metorial/module-resource-tenant';
import type { Prisma as SubspacePrisma, SessionWarning } from '@metorial-subspace/db';
import type {
  CallbackInstanceReceiver,
  callbackDeliveryService,
  callbackEventService
} from '@metorial-subspace/module-callback';
import type { publisherService } from '@metorial-subspace/module-catalog';
import type {
  customProviderDeploymentService,
  scmConnectionService,
  scmConnectionSetupSessionService,
  scmProviderService,
  scmProviderSetupSessionService,
  scmRepositoryService
} from '@metorial-subspace/module-custom-provider';
import type { EnclaveNetworkLogsResponse } from '@metorial-subspace/module-enclave';
import type {
  ProviderVariantEnrichment,
  ProviderVersionEnrichment
} from '@metorial-subspace/provider-utils';
import type {
  providerInvocationService,
  providerRunLogsService
} from '@metorial-subspace/module-session';
import type {
  integrationInclude,
  integrationInstanceGroupInclude,
  integrationInstanceGroupProviderInclude,
  integrationInstanceInclude,
  integrationInstanceProviderInclude,
  integrationProviderInclude,
  integrationSetupSessionInclude,
  magicMcpServerProviderInclude
} from '@metorial-subspace/module-integration';
import { PresentableType } from '@metorial/presenter';

type RawProvider = SubspacePrisma.ProviderGetPayload<{
  include: {
    entry: true;
    publisher: true;
    ownerTenant: true;
    defaultVariant: {
      include: {
        backend: true;
        publisher: true;
        slate: true;
        currentVersion: {
          include: {
            specification: {
              omit: {
                value: true;
              };
            };
          };
        };
        provider: true;
      };
    };
    type: true;
  };
}>;

type RawProviderListing = SubspacePrisma.ProviderListingGetPayload<{
  omit: {
    readme: true;
  };
  include: {
    categories: true;
    collections: true;
    groups: true;
    publisher: true;
    provider: {
      include: {
        entry: true;
        publisher: true;
        ownerTenant: true;
        defaultVariant: {
          include: {
            backend: true;
            publisher: true;
            slate: true;
            currentVersion: {
              include: {
                specification: {
                  omit: {
                    value: true;
                  };
                };
              };
            };
            provider: true;
          };
        };
        type: true;
      };
    };
  };
}>;

type RawIdentityActor = SubspacePrisma.IdentityActorGetPayload<{
  include: {
    agent: true;
  };
}> & {
  consumer?: Prisma.InstanceConsumerGetPayload<{
    include: {
      consumer: {
        include: {
          organizationMember: true;
          profiles: {
            include: {
              surface: true;
            };
          };
        };
      };
    };
  }>;
};

type RawIdentityCredential = SubspacePrisma.IdentityCredentialGetPayload<{
  include: {
    identity: true;
    provider: true;
    deployment: true;
    config: true;
    authConfig: true;
    delegationConfig: true;
    integrationInstance: true;
    integrationInstanceProvider: true;
  };
}>;

type RawIdentity = SubspacePrisma.IdentityGetPayload<{
  include: {
    ownedByIntegrationInstance: {
      select: {
        id: true;
      };
    };
    actor: {
      include: {
        agent: true;
      };
    };
    delegationConfig: true;
    credentials: {
      include: {
        identity: true;
        provider: true;
        deployment: true;
        config: true;
        authConfig: true;
        delegationConfig: true;
        integrationInstance: true;
        integrationInstanceProvider: true;
      };
    };
  };
}>;

type RawIdentityDelegation = SubspacePrisma.IdentityDelegationGetPayload<{
  include: {
    identity: true;
    delegationConfig: true;
    attestation: true;
    request: {
      include: {
        requester: {
          include: {
            agent: true;
          };
        };
        identity: true;
      };
    };
    parties: {
      include: {
        actor: {
          include: {
            agent: true;
          };
        };
      };
    };
    credentials: {
      include: {
        credential: true;
      };
    };
  };
}>;

type RawIdentityDelegationConfig = SubspacePrisma.IdentityDelegationConfigGetPayload<{
  include: {
    currentVersion: true;
  };
}>;

type RawIdentityDelegationRequest = SubspacePrisma.IdentityDelegationRequestGetPayload<{
  include: {
    delegation: {
      include: {
        identity: true;
        delegationConfig: true;
        attestation: true;
        request: {
          include: {
            requester: {
              include: {
                agent: true;
              };
            };
            identity: true;
          };
        };
        parties: {
          include: {
            actor: {
              include: {
                agent: true;
              };
            };
          };
        };
        credentials: {
          include: {
            credential: true;
          };
        };
      };
    };
    requester: {
      include: {
        agent: true;
      };
    };
    identity: true;
  };
}>;

type RawProviderVersion = SubspacePrisma.ProviderVersionGetPayload<{
  include: {
    provider: true;
    specification: {
      omit: {
        value: true;
      };
    };
  };
}>;

type RawProviderDeployment = SubspacePrisma.ProviderDeploymentGetPayload<{
  include: {
    provider: true;
    defaultConfig: true;
    providerVariant: true;
    enclave: {
      select: {
        id: true;
      };
    };
    currentVersion: {
      include: {
        lockedVersion: {
          include: {
            specification: true;
          };
        };
      };
    };
  };
}>;

type RawProviderDeploymentPreview = SubspacePrisma.ProviderDeploymentGetPayload<{
  include: {
    provider: true;
  };
}>;

type RawProviderConfigPreview = SubspacePrisma.ProviderConfigGetPayload<{
  include: {
    provider: true;
  };
}>;

type RawProviderConfigVault = SubspacePrisma.ProviderConfigVaultGetPayload<{
  include: {
    provider: true;
    deployment: true;
  };
}>;

type RawProviderConfig = SubspacePrisma.ProviderConfigGetPayload<{
  include: {
    provider: true;
    deployment: true;
    specification: {
      omit: {
        value: true;
      };
    };
    fromVault: {
      include: {
        deployment: true;
      };
    };
  };
}>;

type RawProviderConfigSchema = SubspacePrisma.ProviderSpecificationGetPayload<{
  include: {
    provider: true;
  };
}>;

type RawProviderTool = SubspacePrisma.ProviderToolGetPayload<{
  include: {
    provider: true;
    specification: {
      omit: {
        value: true;
      };
    };
  };
}>;

export type RawProviderTrigger = SubspacePrisma.ProviderTriggerGetPayload<{
  include: {
    provider: true;
    specification: {
      omit: {
        value: true;
      };
    };
  };
}>;

export type RawProviderAuthMethod = SubspacePrisma.ProviderAuthMethodGetPayload<{
  include: {
    provider: true;
    specification: {
      omit: {
        value: true;
      };
    };
  };
}>;

type RawProviderSpecification = SubspacePrisma.ProviderSpecificationGetPayload<{
  include: {
    provider: true;
    providerTools: true;
    providerAuthMethods: true;
    providerTriggers: true;
  };
}>;

type RawProviderSpecificationChangeNotification =
  SubspacePrisma.ProviderSpecificationChangeNotificationGetPayload<{
    include: {
      version: {
        include: {
          provider: true;
        };
      };
      deploymentConfigPair: true;
      versionSpecificationChange: {
        include: {
          fromSpecification: true;
          toSpecification: true;
          fromVersion: true;
          toVersion: true;
        };
      };
      pairSpecificationChange: {
        include: {
          fromSpecification: true;
          toSpecification: true;
          fromPairVersion: {
            include: {
              version: true;
            };
          };
          toPairVersion: {
            include: {
              version: true;
            };
          };
        };
      };
    };
  }>;

export type RawCustomProvider = SubspacePrisma.CustomProviderGetPayload<{
  include: {
    provider: {
      include: {
        entry: true;
        publisher: true;
        ownerTenant: true;
        type: true;
        defaultVariant: {
          include: {
            provider: true;
            currentVersion: {
              include: {
                specification: {
                  omit: {
                    value: true;
                  };
                };
              };
            };
          };
        };
      };
    };
    scmRepo: true;
    draftCodeBucket: {
      include: {
        scmRepo: true;
      };
    };
  };
}> &
  Partial<ProviderVariantEnrichment>;

export type RawCustomProviderDeployment = SubspacePrisma.CustomProviderDeploymentGetPayload<{
  include: {
    customProvider: {
      include: {
        provider: true;
      };
    };
    creatorActor: true;
    customProviderVersion: true;
    commit: true;
    scmRepoPush: {
      include: {
        repo: true;
      };
    };
    immutableCodeBucket: {
      include: {
        scmRepo: true;
      };
    };
  };
}>;

export type RawCustomProviderEnvironment = SubspacePrisma.CustomProviderEnvironmentGetPayload<{
  include: {
    customProvider: {
      include: {
        provider: true;
      };
    };
    environment: true;
    providerEnvironment: {
      include: {
        currentVersion: true;
      };
    };
  };
}>;

export type RawCustomProviderVersion = SubspacePrisma.CustomProviderVersionGetPayload<{
  include: {
    customProvider: {
      include: {
        provider: true;
      };
    };
    deployment: {
      include: {
        commit: true;
        scmRepoPush: {
          include: {
            repo: true;
          };
        };
      };
    };
    providerVersion: true;
    immutableCodeBucket: {
      include: {
        scmRepo: true;
      };
    };
    customProviderEnvironmentVersions: {
      include: {
        customProviderEnvironment: {
          include: {
            environment: true;
            providerEnvironment: {
              include: {
                currentVersion: true;
              };
            };
          };
        };
      };
    };
    creatorActor: true;
  };
}> &
  Partial<ProviderVersionEnrichment>;

export type RawCustomProviderCommit = SubspacePrisma.CustomProviderCommitGetPayload<{
  include: {
    customProvider: {
      include: {
        provider: true;
      };
    };
    toEnvironment: {
      include: {
        environment: true;
        providerEnvironment: {
          include: {
            currentVersion: true;
          };
        };
      };
    };
    fromEnvironment: {
      include: {
        environment: true;
        providerEnvironment: {
          include: {
            currentVersion: true;
          };
        };
      };
    };
    targetCustomProviderVersion: {
      include: {
        deployment: {
          include: {
            commit: true;
            scmRepoPush: {
              include: {
                repo: true;
              };
            };
          };
        };
        providerVersion: true;
        immutableCodeBucket: {
          include: {
            scmRepo: true;
          };
        };
        customProviderEnvironmentVersions: {
          include: {
            customProviderEnvironment: {
              include: {
                environment: true;
                providerEnvironment: {
                  include: {
                    currentVersion: true;
                  };
                };
              };
            };
          };
        };
        creatorActor: true;
      };
    };
    toEnvironmentVersionBefore: {
      include: {
        deployment: {
          include: {
            commit: true;
            scmRepoPush: {
              include: {
                repo: true;
              };
            };
          };
        };
        providerVersion: true;
        immutableCodeBucket: {
          include: {
            scmRepo: true;
          };
        };
        customProviderEnvironmentVersions: {
          include: {
            customProviderEnvironment: {
              include: {
                environment: true;
                providerEnvironment: {
                  include: {
                    currentVersion: true;
                  };
                };
              };
            };
          };
        };
        creatorActor: true;
      };
    };
    creatorActor: true;
    customProviderDeployment: true;
    scmRepoPush: {
      include: {
        repo: true;
      };
    };
  };
}>;

export type RawCustomProviderDeploymentLogs = Awaited<
  ReturnType<typeof customProviderDeploymentService.getLogs>
>;

export type RawScmRepo = SubspacePrisma.ScmRepoGetPayload<{}>;
export type RawCodeBucket = SubspacePrisma.CodeBucketGetPayload<{
  include: {
    scmRepo: true;
  };
}>;

type SubspaceIntegration = SubspacePrisma.IntegrationGetPayload<{
  include: typeof integrationInclude;
}>;
type SubspaceIntegrationInstance = SubspacePrisma.IntegrationInstanceGetPayload<{
  include: typeof integrationInstanceInclude;
}>;
type SubspaceIntegrationInstanceGroup = SubspacePrisma.IntegrationInstanceGroupGetPayload<{
  include: typeof integrationInstanceGroupInclude;
}>;
type SubspaceIntegrationInstanceGroupProvider =
  SubspacePrisma.IntegrationInstanceGroupProviderGetPayload<{
    include: typeof integrationInstanceGroupProviderInclude;
  }>;
type SubspaceIntegrationInstanceProvider =
  SubspacePrisma.IntegrationInstanceProviderGetPayload<{
    include: typeof integrationInstanceProviderInclude;
  }>;
type SubspaceIntegrationProvider = SubspacePrisma.IntegrationProviderGetPayload<{
  include: typeof integrationProviderInclude;
}>;
type SubspaceIntegrationSetupSession = SubspacePrisma.IntegrationSetupSessionGetPayload<{
  include: typeof integrationSetupSessionInclude;
}>;
type SubspaceMagicMcpServerProvider = SubspacePrisma.MagicMcpServerProviderGetPayload<{
  include: typeof magicMcpServerProviderInclude;
}>;

export type PresentedProviderAuthMethod = {
  id: string;
  key: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  capabilities: Record<string, any>;
  inputJsonSchema: Record<string, any> | null;
  outputJsonSchema: Record<string, any> | null;
  scopes:
    | {
        id: string;
        title: string;
        scope: string;
        description?: string | null;
      }[]
    | null;
  specificationId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PresentedProviderTrigger = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  inputJsonSchema: Record<string, any> | null;
  outputJsonSchema: Record<string, any> | null;
  invocation:
    | {
        type: 'polling';
        intervalSeconds: number;
      }
    | {
        type: 'webhook';
        autoRegistration: {
          status: 'supported' | 'unsupported';
        };
        autoUnregistration: {
          status: 'supported' | 'unsupported';
        };
      };
  providerId: string;
  specificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

type RawProviderAuthConfig = SubspacePrisma.ProviderAuthConfigGetPayload<{
  include: {
    provider: true;
    deployment: true;
    authCredentials: true;
    authMethod: {
      include: {
        specification: {
          omit: {
            value: true;
          };
        };
      };
    };
  };
}>;

type RawProviderAuthCredentials = SubspacePrisma.ProviderAuthCredentialsGetPayload<{
  include: {
    provider: true;
  };
}>;

type RawProviderAuthImport = SubspacePrisma.ProviderAuthImportGetPayload<{
  include: {
    authConfig: {
      include: {
        provider: true;
        deployment: true;
        authCredentials: true;
        authMethod: {
          include: {
            specification: {
              omit: {
                value: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type RawProviderAuthExport = SubspacePrisma.ProviderAuthExportGetPayload<{
  include: {
    authConfig: {
      include: {
        provider: true;
        deployment: true;
        authCredentials: true;
        authMethod: {
          include: {
            specification: {
              omit: {
                value: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type RawProviderSetupSession = SubspacePrisma.ProviderSetupSessionGetPayload<{
  include: {
    identity: true;
    identityCredential: true;
    authConfig: {
      include: {
        provider: true;
        deployment: true;
        authCredentials: true;
        authMethod: {
          include: {
            specification: {
              omit: {
                value: true;
              };
            };
          };
        };
      };
    };
    deployment: true;
    provider: true;
    authMethod: {
      include: {
        specification: {
          omit: {
            value: true;
          };
        };
      };
    };
    authCredentials: true;
    config: {
      include: {
        deployment: true;
        specification: {
          omit: {
            value: true;
          };
        };
        fromVault: {
          include: {
            deployment: true;
          };
        };
      };
    };
  };
}>;

type RawAuthConfigEvent = SubspacePrisma.ProviderAuthConfigEventGetPayload<{
  include: {
    authConfig: true;
    authCredentials: true;
    oauthSetup: true;
    provider: true;
    errors: {
      select: {
        id: true;
      };
    };
  };
}>;

type RawAuthConfigError = SubspacePrisma.ProviderAuthConfigErrorGetPayload<{
  include: {
    group: true;
    authConfigEvent: true;
    authConfig: true;
    authCredentials: true;
    oauthSetup: true;
    provider: true;
  };
}>;

type RawAuthConfigErrorGlobal = SubspacePrisma.ProviderAuthConfigErrorGlobalGetPayload<{
  include: {
    provider: true;
    firstOccurrence: true;
  };
}>;

type RawProviderAuthSchema = {
  provider: SubspacePrisma.ProviderGetPayload<Record<string, never>>;
  authMethod: SubspacePrisma.ProviderAuthMethodGetPayload<Record<string, never>>;
  specification: SubspacePrisma.ProviderSpecificationGetPayload<Record<string, never>>;
};

type RawProviderOAuthSetup = SubspacePrisma.ProviderOAuthSetupGetPayload<{
  include: {
    provider: true;
    deployment: true;
    authCredentials: true;
    authConfig: {
      include: {
        deployment: true;
      };
    };
    authMethod: {
      include: {
        specification: {
          omit: {
            value: true;
          };
        };
      };
    };
  };
}>;

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

export type NamespaceWithCompartment = Namespace & { compartment: NamespaceCompartment };

export type NamespacePropertyWithNamespace = NamespaceProperty & {
  namespace: NamespaceWithCompartment;
};

export let namespaceType = PresentableType.create<{
  namespace: NamespaceWithCompartment;
}>()('namespace');

export let namespacePropertyType = PresentableType.create<{
  namespaceProperty: NamespacePropertyWithNamespace;
}>()('namespace_property');

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
    namespaces: NamespacePropertyWithNamespace[];
  })[];
  projects: (Project & { organization: Organization })[];
  instances: (Instance & { project: Project; organization: Organization })[];
  consumers: (Consumer & {
    profiles: (ConsumerProfile & {
      surface: ConsumerSurface & {
        portal: (Portal & { namespaces: NamespacePropertyWithNamespace[] }) | null;
      };
      instance: Instance & { project: Project };
    })[];
    organization: Organization;
  })[];
}>()('boot');

export let userType = PresentableType.create<{
  user: UserPresenterInput;
}>()('user');

export let projectType = PresentableType.create<{
  project: Project & { organization: Organization };
}>()('project');

export let organizationConfigType = PresentableType.create<{
  config: OrganizationConfig & {
    type: OrganizationConfigType;
    user: User | null;
    organization: Organization | null;
  };
}>()('organization_config');

export let organizationLayoutType = PresentableType.create<{
  layout: OrganizationLayout & {
    type: OrganizationLayoutType;
    user: User | null;
    organization: Organization | null;
  };
}>()('organization_layout');

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
    member?: OrganizationMember | null;
  };
}>()('organization_actor');

export let assistantType = PresentableType.create<{
  assistant: AvailableProductAssistant;
  organization: Organization;
}>()('assistant');

export let assistantConversationType = PresentableType.create<{
  assistantConversation: ProductAssistantConversationWithAssistant;
  organization: Organization;
  instance: Instance;
}>()('assistant_conversation');

export let assistantMessageType = PresentableType.create<{
  assistantConversationItem: ProductAssistantConversationItemWithMessage;
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
      sourceFile: true;
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
  portalUrl: string | null;
}>()('consumer.invite');

export let consumerType = PresentableType.create<{
  consumer: InstanceConsumer & {
    consumer: Consumer & {
      user?: User | null;
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
    consumer: Consumer & {
      user?: User | null;
    };
    surface: EnrichedConsumerSurface;
    // groups: (ConsumerProfileGroup & {
    //   group: ConsumerGroup;
    // })[];
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
  callback: SubspacePrisma.CallbackGetPayload<{
    include: {
      providerDeployment: {
        include: {
          provider: { include: { type: true } };
          currentVersion: true;
        };
      };
      callbackProviderTriggers: { include: { providerTrigger: true } };
      callbackDestinationLinks: { include: { callbackDestination: true } };
    };
  }>;
}>()('callback');

export let callbackEventType = PresentableType.create<{
  callbackEvent: Awaited<ReturnType<typeof callbackEventService.getCallbackEvent>>;
}>()('callback.event');

export let callbackDestinationType = PresentableType.create<{
  callbackDestination: SubspacePrisma.CallbackDestinationGetPayload<{}>;
}>()('callback.destination');

export let callbackNotificationType = PresentableType.create<{
  callbackNotification: Awaited<
    ReturnType<typeof callbackDeliveryService.getCallbackDelivery>
  >;
}>()('callback.notification');

export let callbackInstanceType = PresentableType.create<{
  callbackInstance: SubspacePrisma.CallbackInstanceGetPayload<{
    include: {
      providerDeploymentConfigPair: {
        include: {
          providerDeploymentVersion: {
            include: {
              deployment: { include: { provider: true } };
            };
          };
          providerConfigVersion: {
            include: { config: true };
          };
          providerAuthConfigVersion: {
            include: { authConfig: true };
          };
        };
      };
      activeRegistration: true;
    };
  }>;
  receiver?: CallbackInstanceReceiver;
}>()('callback.instance');

export let portalType = PresentableType.create<{
  portal: Portal & {
    surface: EnrichedConsumerSurface;
    organization: Organization;
  };
  portalUrl: string;
  namespaces?: NamespacePropertyWithNamespace[];
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

export let publisherType = PresentableType.create<{
  publisher: Awaited<ReturnType<typeof publisherService.getPublisherById>>;
}>()('publisher');

export let agentType = PresentableType.create<{
  agent: SubspacePrisma.AgentGetPayload<{ include: { actor: true } }>;
}>()('agent');

export let agentInstanceType = PresentableType.create<{
  agentInstance: SubspacePrisma.AgentInstanceGetPayload<{
    include: {
      agent: true;
      agentClient: true;
      agentClientRegistration: true;
    };
  }>;
}>()('agent.instance');

export let providerVersionType = PresentableType.create<{
  version: RawProviderVersion;
}>()('version');

export let providerType = PresentableType.create<{
  provider: RawProvider | NonNullable<RawCustomProvider['provider']>;
  tenant?: SubspacePrisma.TenantGetPayload<{}>;
}>()('provider');

export let identityType = PresentableType.create<{
  identity: RawIdentity;
}>()('identity');

export let identityActorType = PresentableType.create<{
  identityActor: RawIdentityActor;
}>()('identity.actor');

export let identityCredentialType = PresentableType.create<{
  identityCredential: RawIdentityCredential;
}>()('identity.credential');

export let identityDelegationType = PresentableType.create<{
  identityDelegation: RawIdentityDelegation;
}>()('identity.delegation');

export let identityDelegationConfigType = PresentableType.create<{
  identityDelegationConfig: RawIdentityDelegationConfig;
}>()('identity.delegation_config');

export let identityDelegationRequestType = PresentableType.create<{
  identityDelegationRequest: RawIdentityDelegationRequest;
}>()('identity.delegation_request');

export let providerTypeType = PresentableType.create<{
  providerType: RawProvider['type'];
  provider: RawProvider;
  tenant?: SubspacePrisma.TenantGetPayload<{}>;
}>()('provider.type');

export let providerListingCategoryType = PresentableType.create<{
  category: SubspacePrisma.ProviderListingCategoryGetPayload<{}>;
}>()('category');

export let providerListingCollectionType = PresentableType.create<{
  collection: SubspacePrisma.ProviderListingCollectionGetPayload<{}>;
}>()('collection');

export let providerListingGroupType = PresentableType.create<{
  group: SubspacePrisma.ProviderListingGroupGetPayload<{}>;
}>()('group');

export let providerListingType = PresentableType.create<{
  providerListing: RawProviderListing;
  tenant?: SubspacePrisma.TenantGetPayload<{}>;
}>()('providerListing');

export let providerToolType = PresentableType.create<{ tool: RawProviderTool }>()('tool');

export let providerToolsType = PresentableType.create<{
  items: RawProviderTool[];
}>()('provider.tools');

export let providerTriggerType = PresentableType.create<{
  trigger: RawProviderTrigger | PresentedProviderTrigger;
}>()('provider.capabilities.trigger');

export let providerAuthMethodType = PresentableType.create<{
  authMethod: RawProviderAuthMethod | PresentedProviderAuthMethod;
}>()('provider.capabilities.auth_method');

export let providerSpecificationType = PresentableType.create<{
  specification: RawProviderSpecification;
}>()('specification');

export let providerSpecificationChangeNotificationType = PresentableType.create<{
  notification: RawProviderSpecificationChangeNotification;
}>()('provider.specification_change_notification');

export let monitorType = PresentableType.create<{
  monitor: SubspacePrisma.MonitorGetPayload<{
    include: {
      protoGuardFilter: true;
      provider: true;
    };
  }>;
}>()('monitor');

export let monitorAlertType = PresentableType.create<{
  alert: SubspacePrisma.MonitorAlertGetPayload<{
    include: {
      monitor: {
        include: {
          protoGuardFilter: true;
          provider: true;
        };
      };
      protoGuardAlert: {
        include: {
          run: true;
          instances: {
            include: { filter: true };
          };
        };
      };
      specificationChangeNotification: {
        include: {
          version: { include: { provider: true } };
          deploymentConfigPair: true;
          versionSpecificationChange: {
            include: {
              fromSpecification: true;
              toSpecification: true;
              fromVersion: true;
              toVersion: true;
            };
          };
          pairSpecificationChange: {
            include: {
              fromSpecification: true;
              toSpecification: true;
              fromPairVersion: { include: { version: true } };
              toPairVersion: { include: { version: true } };
            };
          };
        };
      };
      monitorAlertEvents: true;
      monitorAlertRecipients: {
        include: { recipient: true };
      };
    };
  }>;
}>()('monitor.alert');

export let protoGuardAlertType = PresentableType.create<{
  alert: SubspacePrisma.ProtoGuardAlertGetPayload<{
    include: {
      run: true;
      session: true;
      message: true;
      connection: true;
      providerRun: true;
      instances: {
        include: { filter: true };
      };
    };
  }>;
}>()('protoguard.alert');

export let protoGuardConfigType = PresentableType.create<{
  config: {
    alertFilterCountThreshold: number;
    filters: {
      filter: SubspacePrisma.ProtoGuardFilterGetPayload<{}>;
      enabled: boolean;
      alertConfidenceThreshold: number;
    }[];
  };
}>()('protoguard.filter_config');

export let deploymentPreviewType = PresentableType.create<{
  deployment: RawProviderDeploymentPreview;
}>()('deploymentPreview');

export let configPreviewType = PresentableType.create<{
  config: RawProviderConfigPreview;
}>()('configPreview');

export let authConfigPreviewType = PresentableType.create<{
  authConfig: Pick<
    SubspacePrisma.ProviderAuthConfigGetPayload<{}>,
    'id' | 'isDefault' | 'name' | 'description' | 'metadata' | 'createdAt' | 'updatedAt'
  > & {
    providerId: string;
  };
}>()('configPreview');

export let providerDeploymentType = PresentableType.create<{
  deployment: RawProviderDeployment;
}>()('deployment');

export let providerConfigVaultType = PresentableType.create<{
  configVault: RawProviderConfigVault;
}>()('configVault');

export let providerConfigType = PresentableType.create<{ config: RawProviderConfig }>()(
  'config'
);

export let providerAuthConfigType = PresentableType.create<{
  authConfig: RawProviderAuthConfig;
}>()('provider.auth_config');

export let providerAuthConfigEventType = PresentableType.create<{
  authConfigEvent: RawAuthConfigEvent;
}>()('provider.auth_config_event');

export let providerAuthConfigErrorType = PresentableType.create<{
  authConfigError: RawAuthConfigError;
}>()('provider.auth_config_error');

export let providerAuthConfigErrorGroupType = PresentableType.create<{
  authConfigErrorGroup: RawAuthConfigErrorGlobal;
}>()('provider.auth_config_error_group');

export let providerAuthCredentialsType = PresentableType.create<{
  authCredentials: RawProviderAuthCredentials;
}>()('provider.auth_credentials');

export let providerSetupSessionType = PresentableType.create<{
  setupSession: RawProviderSetupSession;
}>()('setupSession');

export let providerAuthImportType = PresentableType.create<{
  authImport: RawProviderAuthImport;
}>()('authImport');

export let providerAuthExportType = PresentableType.create<{
  authExport: RawProviderAuthExport;
  value?: Record<string, any>;
}>()('authExport');

type RawSessionTemplateProvider = SubspacePrisma.SessionTemplateProviderGetPayload<{
  include: {
    provider: true;
    deployment: true;
    config: true;
    authConfig: true;
    integrationInstanceProvider: true;
    integrationInstanceGroupProvider: true;
    sessionTemplate: {
      include: {
        integrationInstance: true;
        integrationInstanceGroup: true;
      };
    };
  };
}>;

type RawSessionTemplate = SubspacePrisma.SessionTemplateGetPayload<{
  include: {
    identityActor: true;
    identity: true;
    integrationInstance: true;
    integrationInstanceGroup: true;
    providers: {
      include: {
        provider: true;
        deployment: true;
        config: true;
        authConfig: true;
        integrationInstanceProvider: true;
        integrationInstanceGroupProvider: true;
        sessionTemplate: {
          include: {
            integrationInstance: true;
            integrationInstanceGroup: true;
          };
        };
      };
    };
  };
}>;

export let sessionTemplateType = PresentableType.create<{
  sessionTemplate: RawSessionTemplate;
}>()('sessionTemplate');

export let sessionTemplateProviderType = PresentableType.create<{
  sessionTemplateProvider: RawSessionTemplateProvider;
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

type RawNetwork = SubspacePrisma.NetworkGetPayload<{}>;

type RawEnclave = SubspacePrisma.EnclaveGetPayload<{
  include: {
    enclaveEnvironment: true;
    network: { select: { id: true } };
    providerDeployment: { select: { id: true } };
  };
}>;

type RawFirewall = SubspacePrisma.FirewallGetPayload<{
  include: {
    network: { select: { id: true } };
    networkPolicyLinks: {
      include: {
        networkPolicy: {
          include: { currentVersion: true };
        };
      };
    };
  };
}>;

type RawFirewallBinding = SubspacePrisma.FirewallBindingGetPayload<{
  include: {
    firewall: { select: { id: true; slug: true; name: true } };
    enclave: { select: { id: true; slug: true; name: true } };
    provider: {
      select: { id: true; slug: true; name: true; prettySlug: true };
    };
    network: { select: { id: true; name: true } };
  };
}>;

type RawNetworkPolicy = SubspacePrisma.NetworkPolicyGetPayload<{
  include: {
    currentVersion: true;
    firewallLinks: {
      include: {
        firewall: { select: { id: true } };
      };
    };
  };
}>;

export let networkType = PresentableType.create<{
  network: RawNetwork;
  maskPublicIp?: boolean;
}>()('network');

export let networkLogsType = PresentableType.create<{
  logs: EnclaveNetworkLogsResponse;
}>()('networkLogs');

export let resourceCountsType = PresentableType.create<{
  resources: {
    resource: string;
    count: number;
  }[];
}>()('resourceCounts');

export let enclaveType = PresentableType.create<{
  enclave: RawEnclave;
}>()('enclave');

export let firewallType = PresentableType.create<{
  firewall: RawFirewall;
}>()('firewall');

export let firewallBindingType = PresentableType.create<{
  firewallBinding: RawFirewallBinding;
}>()('firewall.binding');

export let networkPolicyType = PresentableType.create<{
  networkPolicy: RawNetworkPolicy;
}>()('network.policy');

export let networkPolicyRuleType = PresentableType.create<{
  rule: PrismaJson.NetworkPolicyRule;
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

type RawSessionProvider = SubspacePrisma.SessionProviderGetPayload<{
  include: {
    provider: true;
    deployment: true;
    config: true;
    authConfig: true;
    session: true;
    fromTemplate: true;
    fromTemplateProvider: true;
  };
}>;

type RawSessionParticipant = SubspacePrisma.SessionParticipantGetPayload<{
  include: {
    provider: true;
    identityActor: true;
    identity: true;
    agentInstance: {
      include: {
        agent: { include: { actor: true } };
        agentClient: true;
        agentClientRegistration: true;
      };
    };
  };
}> & {
  consumerId?: string | null;
};

type RawSessionConnection = SubspacePrisma.SessionConnectionGetPayload<{
  include: {
    session: true;
    participant: {
      include: {
        provider: true;
        identityActor: true;
        identity: true;
        agentInstance: {
          include: {
            agent: { include: { actor: true } };
            agentClient: true;
            agentClientRegistration: true;
          };
        };
      };
    };
  };
}> & {
  participant: RawSessionParticipant | null;
};

type RawSessionError = SubspacePrisma.SessionErrorGetPayload<{
  include: {
    session: true;
    group: true;
    providerRun: true;
    connection: true;
  };
}>;

type RawSessionErrorGroup = SubspacePrisma.SessionErrorGroupGetPayload<{
  include: {
    provider: true;
    firstOccurrence: true;
  };
}>;

type RawProviderRun = SubspacePrisma.ProviderRunGetPayload<{
  include: {
    session: true;
    sessionProvider: true;
    provider: true;
    connection: true;
  };
}>;

type RawSessionMessageBase = SubspacePrisma.SessionMessageGetPayload<{
  include: {
    session: true;
    sessionProvider: true;
    connection: true;
    providerRun: true;
  };
}>;

type RawToolCallBase = SubspacePrisma.ToolCallGetPayload<{
  include: {
    attachments: true;
    tool: {
      include: {
        provider: true;
        specification: {
          omit: {
            value: true;
          };
        };
      };
    };
  };
}>;

type RawSessionMessage = RawSessionMessageBase & {
  senderParticipant: RawSessionParticipant;
  responderParticipant: RawSessionParticipant | null;
  toolCall: RawToolCallBase | null;
  error: RawSessionError | null;
  parentMessage: SubspacePrisma.SessionMessageGetPayload<{}> | null;
  childMessages: SubspacePrisma.SessionMessageGetPayload<{}>[];
};

type RawToolCall = RawToolCallBase & {
  message: RawSessionMessage;
};

type RawSessionWarning = SessionWarning & {
  session: SubspacePrisma.SessionGetPayload<{}>;
  connection: SubspacePrisma.SessionConnectionGetPayload<{}> | null;
};

type RawSessionEvent = SubspacePrisma.SessionEventGetPayload<{
  include: { session: true };
}> & {
  connection: RawSessionConnection | null;
  providerRun: RawProviderRun | null;
  message: RawSessionMessage | null;
  error: RawSessionError | null;
  warning: RawSessionWarning | null;
};

type RawSession = SubspacePrisma.SessionGetPayload<{
  include: {
    identityActor: true;
    identity: true;
    providers: {
      include: {
        provider: true;
        deployment: true;
        config: true;
        authConfig: true;
        session: true;
        fromTemplate: true;
        fromTemplateProvider: true;
      };
    };
  };
}> & {
  clientSecret?: string | null;
};

type RawProviderInvocation = Awaited<
  ReturnType<typeof providerInvocationService.getProviderInvocation>
>;
type RawProviderRunLogs = Awaited<
  ReturnType<typeof providerRunLogsService.getProviderRunLogs>
>;

export let sessionProviderType = PresentableType.create<{
  sessionProvider: RawSessionProvider;
}>()('sessionProvider');

export let sessionParticipantType = PresentableType.create<{
  sessionParticipant: RawSessionParticipant;
}>()('sessionParticipant');

export let sessionWarningType = PresentableType.create<{
  sessionWarning: RawSessionWarning;
}>()('sessionWarning');

export let sessionErrorType = PresentableType.create<{
  sessionError: RawSessionError;
}>()('sessionError');

export let sessionErrorGroupType = PresentableType.create<{
  sessionErrorGroup: RawSessionErrorGroup;
}>()('sessionErrorGroup');

export let providerRunType = PresentableType.create<{
  providerRun: RawProviderRun;
}>()('providerRun');

export let providerRunLogsType = PresentableType.create<{
  logs: RawProviderRunLogs;
}>()('providerRunLogs');

export let providerInvocationType = PresentableType.create<{
  providerInvocation: RawProviderInvocation;
}>()('providerInvocation');

export let providerInvocationsType = PresentableType.create<{
  items: RawProviderInvocation[];
}>()('providerInvocations');

export let providerSessionType = PresentableType.create<{
  session: RawSession;
}>()('providerSession');

export let sessionMessageType = PresentableType.create<{
  sessionMessage: RawSessionMessage;
}>()('subspaceSessionMessage');

export let sessionConnectionType = PresentableType.create<{
  sessionConnection: RawSessionConnection;
}>()('subspaceSessionConnection');

export let sessionEventType = PresentableType.create<{
  sessionEvent: RawSessionEvent;
}>()('subspaceSessionEvent');

export let configSchemaType = PresentableType.create<{
  schema: RawProviderConfigSchema;
}>()('configSchema');

export let authImportSchemaType = PresentableType.create<{
  schema: RawProviderAuthSchema;
}>()('authImportSchema');

export let authConfigSchemaType = PresentableType.create<{
  schema: RawProviderAuthSchema;
}>()('authConfigSchema');

export let customProviderType = PresentableType.create<{
  customProvider: RawCustomProvider;
  tenant?: SubspacePrisma.TenantGetPayload<{}>;
}>()('customProvider');

export let customProviderVersionType = PresentableType.create<{
  customProviderVersion: RawCustomProviderVersion;
}>()('customProviderVersion');

export let customProviderEnvType = PresentableType.create<{
  customProviderFrom:
    | NonNullable<RawCustomProviderVersion['payload']>['from']
    | RawCustomProvider['payload']['from']
    | null
    | undefined;
}>()('customProviderEnv');

export let customProviderDeploymentType = PresentableType.create<{
  customProviderDeployment: RawCustomProviderDeployment;
}>()('customProviderDeployment');

export let customProviderDeploymentLogsType = PresentableType.create<{
  logs: RawCustomProviderDeploymentLogs;
}>()('customProviderDeploymentLogs');

export let customProviderCommitType = PresentableType.create<{
  customProviderCommit: RawCustomProviderCommit;
}>()('customProviderCommit');

export let customProviderEnvironmentType = PresentableType.create<{
  customProviderEnvironment: RawCustomProviderEnvironment;
}>()('customProviderEnvironment');

export let bucketEditorTokenType = PresentableType.create<{
  token: {
    id: string;
    url: string;
    expiresAt: Date;
  };
}>()('bucketEditorToken');

export let bucketType = PresentableType.create<{
  bucket: RawCodeBucket;
}>()('bucket');

export let actorPreviewType = PresentableType.create<{
  actor: SubspacePrisma.TenantActorGetPayload<{}>;
}>()('actorPreview');

export let scmPushType = PresentableType.create<{
  scmPush: SubspacePrisma.ScmRepoPushGetPayload<{
    include: {
      repo: true;
    };
  }>;
}>()('scmPush');

export let providerOAuthSetupType = PresentableType.create<{
  providerOAuthSetup: RawProviderOAuthSetup;
}>()('providerOAuthSetup');

export let toolCallType = PresentableType.create<{
  toolCall: RawToolCall;
}>()('toolCall');

export type ScmConnection = Awaited<
  ReturnType<typeof scmConnectionService.getScmConnectionById>
>;
export type ScmConnectionSetupSession = Awaited<
  ReturnType<typeof scmConnectionSetupSessionService.createScmConnectionSetupSession>
>;
export type ScmProvider = Awaited<ReturnType<typeof scmProviderService.getScmProviderById>>;
export type ScmProviderSetupSession = Awaited<
  ReturnType<typeof scmProviderSetupSessionService.createScmProviderSetupSession>
>;
export type ScmRepositoryPreviews = Awaited<
  ReturnType<typeof scmRepositoryService.listScmRepositoryPreviews>
>;
export type ScmAccountPreview = Awaited<
  ReturnType<typeof scmRepositoryService.listScmAccountPreviews>
>['accounts'][number];
export type Publisher = Awaited<ReturnType<typeof publisherService.getPublisherById>>;

export let scmConnectionType = PresentableType.create<{
  scmConnection: ScmConnection;
}>()('scmConnection');

export let scmConnectionSetupType = PresentableType.create<{
  scmConnectionSetup: ScmConnectionSetupSession;
}>()('scmConnectionSetup');

export let scmProviderType = PresentableType.create<{
  scmProvider: ScmProvider;
}>()('scmProvider');

export let scmProviderSetupType = PresentableType.create<{
  scmProviderSetup: ScmProviderSetupSession;
}>()('scmProviderSetup');

export let scmRepoType = PresentableType.create<{
  scmRepo: RawScmRepo;
}>()('scmRepo');

export type ScmRepo = RawScmRepo;

export let scmRepoPreviewType = PresentableType.create<{
  repoPreviews: ScmRepositoryPreviews;
}>()('scmRepoPreview');

export let scmAccountPreviewType = PresentableType.create<{
  accountPreviews: ScmAccountPreview[];
}>()('scmAccountPreview');
