import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialEndpointManager, MetorialSDKError } from '@metorial/util-endpoint';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  mapDashboardInstanceFilesGetOutput,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceAgentsEndpoint,
  MetorialDashboardInstanceAgentsInstancesEndpoint,
  MetorialDashboardInstanceAssistantsEndpoint,
  MetorialDashboardInstanceCallbacksDestinationsEndpoint,
  MetorialDashboardInstanceCallbacksEndpoint,
  MetorialDashboardInstanceCallbacksEventsEndpoint,
  MetorialDashboardInstanceCallbacksInstancesEndpoint,
  MetorialDashboardInstanceCallbacksNotificationsEndpoint,
  MetorialDashboardInstanceConsumersEndpoint,
  MetorialDashboardInstanceConsumersProfilesEndpoint,
  MetorialDashboardInstanceConsumerSurfacesEndpoint,
  MetorialDashboardInstanceConversationsEndpoint,
  MetorialDashboardInstanceConversationsMessagesEndpoint,
  MetorialDashboardInstanceCustomProvidersCodeEndpoint,
  MetorialDashboardInstanceCustomProvidersCommitsEndpoint,
  MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomProvidersEndpoint,
  MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint,
  MetorialDashboardInstanceCustomProvidersVersionsEndpoint,
  MetorialDashboardInstanceDocumentsEndpoint,
  MetorialDashboardInstanceDocumentsParticipantsEndpoint,
  MetorialDashboardInstanceDocumentsPermissionsEndpoint,
  MetorialDashboardInstanceDocumentsVersionsEndpoint,
  MetorialDashboardInstanceFileLinksEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceIdentitiesCredentialsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationRequestsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationsEndpoint,
  MetorialDashboardInstanceIdentitiesEndpoint,
  MetorialDashboardInstanceIdentityActorsEndpoint,
  MetorialDashboardInstanceIntegrationInstanceGroupProvidersEndpoint,
  MetorialDashboardInstanceIntegrationInstanceGroupsEndpoint,
  MetorialDashboardInstanceIntegrationInstanceProvidersEndpoint,
  MetorialDashboardInstanceIntegrationInstancesEndpoint,
  MetorialDashboardInstanceIntegrationProvidersEndpoint,
  MetorialDashboardInstanceIntegrationsEndpoint,
  MetorialDashboardInstanceIntegrationSetupSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpEndpointsEndpoint,
  MetorialDashboardInstanceMagicMcpGroupsEndpoint,
  MetorialDashboardInstanceMagicMcpServersEndpoint,
  MetorialDashboardInstanceMagicMcpServersProvidersEndpoint,
  MetorialDashboardInstanceMagicMcpServersSessionEndpoint,
  MetorialDashboardInstanceMagicMcpSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpTokensEndpoint,
  MetorialDashboardInstancePortalsAccessRequestsEndpoint,
  MetorialDashboardInstancePortalsAuthAppEndpoint,
  MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint,
  MetorialDashboardInstancePortalsAuthSsoTenantsEndpoint,
  MetorialDashboardInstancePortalsConsumerAccessEndpoint,
  MetorialDashboardInstancePortalsConsumerAccessListingsEndpoint,
  MetorialDashboardInstancePortalsConsumerGroupsEndpoint,
  MetorialDashboardInstancePortalsConsumerInvitesEndpoint,
  MetorialDashboardInstancePortalsConsumerProfilesEndpoint,
  MetorialDashboardInstancePortalsEndpoint,
  MetorialDashboardInstancePortalsSurfaceProviderGroupsEndpoint,
  MetorialDashboardInstanceProviderAuthConfigErrorsEndpoint,
  MetorialDashboardInstanceProviderAuthConfigErrorsGroupsEndpoint,
  MetorialDashboardInstanceProviderAuthConfigEventsEndpoint,
  MetorialDashboardInstanceProviderCategoriesEndpoint,
  MetorialDashboardInstanceProviderCollectionsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsExportsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsImportsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint,
  MetorialDashboardInstanceProviderGroupsEndpoint,
  MetorialDashboardInstanceProviderInvocationsEndpoint,
  MetorialDashboardInstanceProviderListingsEndpoint,
  MetorialDashboardInstanceProviderRunsEndpoint,
  MetorialDashboardInstanceProvidersAuthMethodsEndpoint,
  MetorialDashboardInstanceProvidersEndpoint,
  MetorialDashboardInstanceProvidersSpecificationsEndpoint,
  MetorialDashboardInstanceProvidersToolsEndpoint,
  MetorialDashboardInstanceProvidersTriggersEndpoint,
  MetorialDashboardInstanceProvidersVersionsEndpoint,
  MetorialDashboardInstanceProviderTemplatesEndpoint,
  MetorialDashboardInstancePublishersEndpoint,
  MetorialDashboardInstanceScmAccountsEndpoint,
  MetorialDashboardInstanceScmConnectionsEndpoint,
  MetorialDashboardInstanceScmInstallationEndpoint,
  MetorialDashboardInstanceScmProvidersEndpoint,
  MetorialDashboardInstanceScmReposEndpoint,
  MetorialDashboardInstanceSessionsConnectionsEndpoint,
  MetorialDashboardInstanceSessionsEndpoint,
  MetorialDashboardInstanceSessionsErrorGroupsEndpoint,
  MetorialDashboardInstanceSessionsErrorsEndpoint,
  MetorialDashboardInstanceSessionsEventsEndpoint,
  MetorialDashboardInstanceSessionsMessagesEndpoint,
  MetorialDashboardInstanceSessionsParticipantsEndpoint,
  MetorialDashboardInstanceSessionsProvidersEndpoint,
  MetorialDashboardInstanceSessionTemplatesEndpoint,
  MetorialDashboardInstanceSessionTemplatesProvidersEndpoint,
  MetorialDashboardInstanceSkillGroupsEndpoint,
  MetorialDashboardInstanceSkillGroupsItemsEndpoint,
  MetorialDashboardInstanceSkillsEndpoint,
  MetorialDashboardInstanceSkillsItemsEndpoint,
  MetorialDashboardInstanceSkillsParticipantsEndpoint,
  MetorialDashboardInstanceSkillsVersionsEndpoint,
  MetorialDashboardInstanceSkillsVersionsSnapshotEndpoint,
  MetorialDashboardInstanceSkillTemplatesEndpoint,
  MetorialDashboardInstanceSkillTemplatesItemsEndpoint,
  MetorialDashboardInstanceStoresEndpoint,
  MetorialDashboardInstanceStoresItemsEndpoint,
  MetorialDashboardInstanceStoresParticipantsEndpoint,
  MetorialDashboardInstanceStoresPermissionsEndpoint,
  MetorialDashboardInstanceToolCallsEndpoint,
  MetorialDashboardOauthAuthorizationRequestsEndpoint,
  MetorialDashboardOrganizationsAccessPoliciesEndpoint,
  MetorialDashboardOrganizationsAccessRolesEndpoint,
  MetorialDashboardOrganizationsApiKeysEndpoint,
  MetorialDashboardOrganizationsEndpoint,
  MetorialDashboardOrganizationsInstancesEndpoint,
  MetorialDashboardOrganizationsInvitesEndpoint,
  MetorialDashboardOrganizationsJoinEndpoint,
  MetorialDashboardOrganizationsMembersEndpoint,
  MetorialDashboardOrganizationsMembersPoliciesEndpoint,
  MetorialDashboardOrganizationsOauthAppsClientSecretsEndpoint,
  MetorialDashboardOrganizationsOauthAppsEndpoint,
  MetorialDashboardOrganizationsOauthAuthorizationLogsEndpoint,
  MetorialDashboardOrganizationsOauthAuthorizationsEndpoint,
  MetorialDashboardOrganizationsOauthCliDevicesEndpoint,
  MetorialDashboardOrganizationsOauthInstallationsEndpoint,
  MetorialDashboardOrganizationsOauthScopesEndpoint,
  MetorialDashboardOrganizationsProjectsBrandingEndpoint,
  MetorialDashboardOrganizationsProjectsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint,
  MetorialDashboardOrganizationsTeamsEndpoint,
  MetorialDashboardOrganizationsTeamsMembersEndpoint,
  MetorialDashboardOrganizationsTeamsPoliciesEndpoint,
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialOrganizationsFlagsEndpoint,
  MetorialOrganizationsProfileEndpoint
} from './gen/src/mt_2025_01_01_dashboard';

let fetchWithRetry = createFetchWithRetry();

let fetchWithRetryAndLogging = async (
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> => {
  console.log('[Metorial API] Fetching:', {
    input,
    init
  });

  try {
    return await fetchWithRetry(input, init);
  } catch (error) {
    console.error('[Metorial API] Fetch failed:', {
      input,
      init,
      error
    });
    throw error;
  }
};

export type AssistantRequestDeltaEvent = {
  event: string;
  data: unknown;
  rawData: string;
  id?: string;
};

export type AssistantRequestDeltaConnectionOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  lastEventId?: string;
  onOpen?: (response: Response) => void | Promise<void>;
  onEvent?: (event: AssistantRequestDeltaEvent) => void | Promise<void>;
  onSnapshot?: (event: AssistantRequestDeltaEvent) => void | Promise<void>;
  onDelta?: (event: AssistantRequestDeltaEvent) => void | Promise<void>;
  onError?: (event: AssistantRequestDeltaEvent) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
};

export type AssistantRequestDeltaConnection = {
  close: () => void;
  done: Promise<void>;
};

let parseSseEventData = (rawData: string) => {
  if (!rawData) return null;

  try {
    return JSON.parse(rawData);
  } catch {
    return rawData;
  }
};

let createSseParseStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AssistantRequestDeltaEvent) => void | Promise<void>
) => {
  let reader = stream.getReader();
  let decoder = new TextDecoder();
  let buffer = '';

  let flushBlock = async (block: string) => {
    let event = 'message';
    let id: string | undefined;
    let dataParts: string[] = [];

    for (let rawLine of block.split(/\r?\n/)) {
      if (!rawLine || rawLine.startsWith(':')) continue;

      let separator = rawLine.indexOf(':');
      let field = separator == -1 ? rawLine : rawLine.slice(0, separator);
      let value = separator == -1 ? '' : rawLine.slice(separator + 1).replace(/^ /, '');

      if (field == 'event') event = value;
      if (field == 'id') id = value;
      if (field == 'data') dataParts.push(value);
    }

    if (!dataParts.length) return;

    let rawData = dataParts.join('\n');
    await onEvent({
      event,
      id,
      rawData,
      data: parseSseEventData(rawData)
    });
  };

  while (true) {
    let { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (let part of parts) {
      await flushBlock(part);
    }

    if (done) {
      if (buffer.trim()) {
        await flushBlock(buffer);
      }
      break;
    }
  }
};

let createAssistantRequestDeltaConnection = (
  manager: MetorialEndpointManager<any>,
  assistantRequestId: string,
  opts: AssistantRequestDeltaConnectionOptions = {}
): AssistantRequestDeltaConnection => {
  let controller = new AbortController();
  let parentSignal = opts.signal;

  if (parentSignal?.aborted) {
    controller.abort(parentSignal.reason);
  } else if (parentSignal) {
    parentSignal.addEventListener('abort', () => controller.abort(parentSignal.reason), {
      once: true
    });
  }

  let done = (async () => {
    let headers = new Headers({
      ...manager.getHeaders(manager.config),
      Accept: 'text/event-stream',
      ...(opts.headers ?? {})
    });

    if (opts.lastEventId) {
      headers.set('Last-Event-ID', opts.lastEventId);
    }

    let url = new URL(manager.apiHost);
    url.pathname =
      url.pathname.replace(/\/$/, '') +
      `/assistant-live/requests/${assistantRequestId}/deltas`;

    let response = await manager.fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
      redirect: 'follow',
      referrerPolicy: 'no-referrer-when-downgrade',
      cache: 'no-cache',
      mode: 'cors',
      signal: controller.signal
    });

    await opts.onOpen?.(response);

    if (!response.ok) {
      let data: any;

      try {
        data = await response.json();
      } catch {
        data = {
          status: response.status,
          code: 'sse_connection_failed',
          message: `Failed to open assistant delta stream (${response.status})`
        };
      }

      throw new MetorialSDKError(data);
    }

    let contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      throw new MetorialSDKError({
        status: response.status,
        code: 'invalid_sse_response',
        message: 'Expected assistant delta stream to return text/event-stream'
      });
    }

    if (!response.body) {
      throw new MetorialSDKError({
        status: response.status,
        code: 'empty_sse_response',
        message: 'Assistant delta stream response body was empty'
      });
    }

    try {
      await createSseParseStream(response.body, async event => {
        await opts.onEvent?.(event);

        if (event.event == 'snapshot') {
          await opts.onSnapshot?.(event);
        } else if (event.event == 'delta') {
          await opts.onDelta?.(event);
        } else if (event.event == 'error') {
          await opts.onError?.(event);
        }
      });
    } finally {
      await opts.onClose?.();
    }
  })();

  return {
    close: () => controller.abort(),
    done
  };
};

export let createMetorialDashboardSDK = sdkBuilder.build(
  (soft: {
    apiVersion?: '2025-01-01-dashboard';
    headers?: Record<string, string>;
    apiHost?: string;
    organizationId?: string;
    instanceId?: string;
    metorialInstance?: string;

    consumer?: {
      apiKey: `${MetorialKeyPrefix}${string}` | string;
      consumerToken: string;
    };
  }) => ({
    ...soft,

    apiKey: soft.consumer?.apiKey,
    headers: {
      ...soft.headers,
      ...(soft.consumer
        ? {
            'Metorial-Consumer-Session-Client-Secret': soft.consumer.consumerToken
          }
        : {})
    },

    apiVersion: '2025-01-01-dashboard',
    fetch: (a: any, b: any) => {
      let url = new URL(a);
      if (soft.metorialInstance) {
        url.searchParams.set('_m', soft.metorialInstance);
      }
      if (soft.consumer) {
        url.searchParams.set('_c', '1');
      }
      a = url.toString();

      return fetchWithRetryAndLogging(a, b);
    },

    enableDebugLogging: true
  })
)(manager => ({
  organizations: Object.assign(new MetorialDashboardOrganizationsEndpoint(manager), {
    invites: new MetorialDashboardOrganizationsInvitesEndpoint(manager),
    flags: new MetorialOrganizationsFlagsEndpoint(manager),

    members: Object.assign(new MetorialDashboardOrganizationsMembersEndpoint(manager), {
      policies: new MetorialDashboardOrganizationsMembersPoliciesEndpoint(manager)
    })
  }),

  organizationJoins: new MetorialDashboardOrganizationsJoinEndpoint(manager),

  profile: new MetorialOrganizationsProfileEndpoint(manager),

  instances: new MetorialDashboardOrganizationsInstancesEndpoint(manager),
  projects: Object.assign(new MetorialDashboardOrganizationsProjectsEndpoint(manager), {
    branding: new MetorialDashboardOrganizationsProjectsBrandingEndpoint(manager)
  }),
  user: new MetorialManagementUserEndpoint(manager),

  apiKeys: new MetorialDashboardOrganizationsApiKeysEndpoint(manager),

  auth: new MetorialAuthEndpoint(manager),

  dashboard: new MetorialDashboardEndpoint(manager),

  files: Object.assign(new MetorialDashboardInstanceFilesEndpoint(manager), {
    links: new MetorialDashboardInstanceFileLinksEndpoint(manager),
    upload: async (input: {
      instanceId: string;
      file: File | Blob;
      purpose: string;
      title?: string;
      store?: {
        id: string;
        path: string;
      };
    }) => {
      let body = new FormData();
      body.append('file', input.file);
      body.append('purpose', input.purpose);
      body.append('instance_id', input.instanceId);
      if (input.title) body.append('title', input.title);
      if (input.store) {
        body.append('store_id', input.store.id);
        body.append('path', input.store.path);
      }

      return await manager
        ._post({
          path: ['files'],
          body
        })
        .transform(mapDashboardInstanceFilesGetOutput);
    }
  }),

  documents: Object.assign(new MetorialDashboardInstanceDocumentsEndpoint(manager), {
    participants: new MetorialDashboardInstanceDocumentsParticipantsEndpoint(manager),
    permissions: new MetorialDashboardInstanceDocumentsPermissionsEndpoint(manager),
    versions: new MetorialDashboardInstanceDocumentsVersionsEndpoint(manager)
  }),

  stores: Object.assign(new MetorialDashboardInstanceStoresEndpoint(manager), {
    items: new MetorialDashboardInstanceStoresItemsEndpoint(manager),
    participants: new MetorialDashboardInstanceStoresParticipantsEndpoint(manager),
    permissions: new MetorialDashboardInstanceStoresPermissionsEndpoint(manager)
  }),

  skills: Object.assign(new MetorialDashboardInstanceSkillsEndpoint(manager), {
    items: new MetorialDashboardInstanceSkillsItemsEndpoint(manager),
    participants: new MetorialDashboardInstanceSkillsParticipantsEndpoint(manager),
    versions: Object.assign(new MetorialDashboardInstanceSkillsVersionsEndpoint(manager), {
      snapshot: new MetorialDashboardInstanceSkillsVersionsSnapshotEndpoint(manager)
    })
  }),

  skillTemplates: Object.assign(new MetorialDashboardInstanceSkillTemplatesEndpoint(manager), {
    items: new MetorialDashboardInstanceSkillTemplatesItemsEndpoint(manager)
  }),

  skillGroups: Object.assign(new MetorialDashboardInstanceSkillGroupsEndpoint(manager), {
    items: new MetorialDashboardInstanceSkillGroupsItemsEndpoint(manager)
  }),

  magicMcp: {
    servers: Object.assign(new MetorialDashboardInstanceMagicMcpServersEndpoint(manager), {
      providers: new MetorialDashboardInstanceMagicMcpServersProvidersEndpoint(manager),
      session: new MetorialDashboardInstanceMagicMcpServersSessionEndpoint(manager)
    }),
    sessions: new MetorialDashboardInstanceMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialDashboardInstanceMagicMcpTokensEndpoint(manager),
    groups: new MetorialDashboardInstanceMagicMcpGroupsEndpoint(manager),
    endpoints: new MetorialDashboardInstanceMagicMcpEndpointsEndpoint(manager)
  },

  portals: Object.assign(new MetorialDashboardInstancePortalsEndpoint(manager), {
    consumerGroups: new MetorialDashboardInstancePortalsConsumerGroupsEndpoint(manager),
    consumerAccess: new MetorialDashboardInstancePortalsConsumerAccessEndpoint(manager),
    consumerAccessListings: new MetorialDashboardInstancePortalsConsumerAccessListingsEndpoint(
      manager
    ),
    consumerProfiles: new MetorialDashboardInstancePortalsConsumerProfilesEndpoint(manager),
    consumerInvites: new MetorialDashboardInstancePortalsConsumerInvitesEndpoint(manager),
    providerGroups: new MetorialDashboardInstancePortalsSurfaceProviderGroupsEndpoint(manager),
    auth: {
      app: new MetorialDashboardInstancePortalsAuthAppEndpoint(manager),
      ssoTenants: Object.assign(
        new MetorialDashboardInstancePortalsAuthSsoTenantsEndpoint(manager),
        {
          connections: new MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint(
            manager
          )
        }
      )
    },
    accessRequests: new MetorialDashboardInstancePortalsAccessRequestsEndpoint(manager)
  }),

  consumers: Object.assign(new MetorialDashboardInstanceConsumersEndpoint(manager), {
    profiles: new MetorialDashboardInstanceConsumersProfilesEndpoint(manager)
  }),
  consumerSurfaces: new MetorialDashboardInstanceConsumerSurfacesEndpoint(manager),

  accessPolicies: new MetorialDashboardOrganizationsAccessPoliciesEndpoint(manager),
  accessRoles: new MetorialDashboardOrganizationsAccessRolesEndpoint(manager),

  providerTemplates: new MetorialDashboardInstanceProviderTemplatesEndpoint(manager),

  usage: new MetorialDashboardUsageEndpoint(manager),

  oauth: {
    cliDevices: new MetorialDashboardOrganizationsOauthCliDevicesEndpoint(manager),
    authorizationRequests: new MetorialDashboardOauthAuthorizationRequestsEndpoint(manager),
    scopes: new MetorialDashboardOrganizationsOauthScopesEndpoint(manager),
    apps: Object.assign(new MetorialDashboardOrganizationsOauthAppsEndpoint(manager), {
      clientSecrets: new MetorialDashboardOrganizationsOauthAppsClientSecretsEndpoint(manager)
    }),
    authorizationLogs: new MetorialDashboardOrganizationsOauthAuthorizationLogsEndpoint(
      manager
    ),
    installations: new MetorialDashboardOrganizationsOauthInstallationsEndpoint(manager),
    authorizations: new MetorialDashboardOrganizationsOauthAuthorizationsEndpoint(manager)
  },

  assistant: {
    assistants: new MetorialDashboardInstanceAssistantsEndpoint(manager),
    conversations: Object.assign(new MetorialDashboardInstanceConversationsEndpoint(manager), {
      messages: new MetorialDashboardInstanceConversationsMessagesEndpoint(manager)
    }),
    connectRequestDeltas: (
      assistantRequestId: string,
      opts?: AssistantRequestDeltaConnectionOptions
    ) => createAssistantRequestDeltaConnection(manager, assistantRequestId, opts)
  },

  serviceAccounts: Object.assign(
    new MetorialDashboardOrganizationsServiceAccountsEndpoint(manager),
    {
      clientSecrets: new MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint(
        manager
      ),
      credentials: new MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint(
        manager
      ),
      policies: new MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint(manager)
    }
  ),

  teams: Object.assign(new MetorialDashboardOrganizationsTeamsEndpoint(manager), {
    members: new MetorialDashboardOrganizationsTeamsMembersEndpoint(manager),
    policies: new MetorialDashboardOrganizationsTeamsPoliciesEndpoint(manager)
  }),

  customProviders: Object.assign(
    new MetorialDashboardInstanceCustomProvidersEndpoint(manager),
    {
      versions: new MetorialDashboardInstanceCustomProvidersVersionsEndpoint(manager),
      deployments: new MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint(manager),
      commits: new MetorialDashboardInstanceCustomProvidersCommitsEndpoint(manager),
      environments: new MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint(manager),
      code: new MetorialDashboardInstanceCustomProvidersCodeEndpoint(manager)
    }
  ),

  providers: Object.assign(new MetorialDashboardInstanceProvidersEndpoint(manager), {
    versions: new MetorialDashboardInstanceProvidersVersionsEndpoint(manager),
    tools: new MetorialDashboardInstanceProvidersToolsEndpoint(manager),
    triggers: new MetorialDashboardInstanceProvidersTriggersEndpoint(manager),
    authMethods: new MetorialDashboardInstanceProvidersAuthMethodsEndpoint(manager),
    authConfigs: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(manager),
    specifications: new MetorialDashboardInstanceProvidersSpecificationsEndpoint(manager),
    listings: new MetorialDashboardInstanceProviderListingsEndpoint(manager),
    categories: new MetorialDashboardInstanceProviderCategoriesEndpoint(manager),
    collections: new MetorialDashboardInstanceProviderCollectionsEndpoint(manager),
    groups: new MetorialDashboardInstanceProviderGroupsEndpoint(manager),
    publishers: new MetorialDashboardInstancePublishersEndpoint(manager)
  }),

  providerDeployments: Object.assign(
    new MetorialDashboardInstanceProviderDeploymentsEndpoint(manager),
    {
      configs: new MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint(manager),
      configVaults: new MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint(
        manager
      ),
      authConfigs: Object.assign(
        new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(manager),
        {
          exports: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsExportsEndpoint(
            manager
          ),
          imports: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsImportsEndpoint(
            manager
          )
        }
      ),
      authCredentials: new MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint(
        manager
      ),
      setupSessions: new MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint(
        manager
      )
    }
  ),

  callbacks: Object.assign(new MetorialDashboardInstanceCallbacksEndpoint(manager), {
    destinations: new MetorialDashboardInstanceCallbacksDestinationsEndpoint(manager),
    events: new MetorialDashboardInstanceCallbacksEventsEndpoint(manager),
    notifications: new MetorialDashboardInstanceCallbacksNotificationsEndpoint(manager),
    instances: new MetorialDashboardInstanceCallbacksInstancesEndpoint(manager)
  }),

  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    connections: new MetorialDashboardInstanceSessionsConnectionsEndpoint(manager),
    toolCalls: new MetorialDashboardInstanceToolCallsEndpoint(manager),
    providers: new MetorialDashboardInstanceSessionsProvidersEndpoint(manager),
    participants: new MetorialDashboardInstanceSessionsParticipantsEndpoint(manager),
    errors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
    errorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager)
  }),

  agents: Object.assign(new MetorialDashboardInstanceAgentsEndpoint(manager), {
    instances: new MetorialDashboardInstanceAgentsInstancesEndpoint(manager)
  }),

  providerRuns: new MetorialDashboardInstanceProviderRunsEndpoint(manager),
  providerAuthConfigErrors: Object.assign(
    new MetorialDashboardInstanceProviderAuthConfigErrorsEndpoint(manager),
    {
      groups: new MetorialDashboardInstanceProviderAuthConfigErrorsGroupsEndpoint(manager)
    }
  ),
  providerAuthConfigEvents: new MetorialDashboardInstanceProviderAuthConfigEventsEndpoint(
    manager
  ),
  providerInvocations: new MetorialDashboardInstanceProviderInvocationsEndpoint(manager),
  sessionErrors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
  sessionErrorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager),

  sessionTemplates: Object.assign(
    new MetorialDashboardInstanceSessionTemplatesEndpoint(manager),
    {
      providers: new MetorialDashboardInstanceSessionTemplatesProvidersEndpoint(manager)
    }
  ),

  integration: Object.assign(new MetorialDashboardInstanceIntegrationsEndpoint(manager), {
    providers: new MetorialDashboardInstanceIntegrationProvidersEndpoint(manager),
    instances: Object.assign(
      new MetorialDashboardInstanceIntegrationInstancesEndpoint(manager),
      {
        providers: new MetorialDashboardInstanceIntegrationInstanceProvidersEndpoint(manager)
      }
    ),
    groups: Object.assign(
      new MetorialDashboardInstanceIntegrationInstanceGroupsEndpoint(manager),
      {
        providers: new MetorialDashboardInstanceIntegrationInstanceGroupProvidersEndpoint(
          manager
        )
      }
    ),
    setupSessions: new MetorialDashboardInstanceIntegrationSetupSessionsEndpoint(manager)
  }),

  scm: {
    installation: new MetorialDashboardInstanceScmInstallationEndpoint(manager),
    repos: new MetorialDashboardInstanceScmReposEndpoint(manager),
    accounts: new MetorialDashboardInstanceScmAccountsEndpoint(manager),
    connections: new MetorialDashboardInstanceScmConnectionsEndpoint(manager),
    providers: new MetorialDashboardInstanceScmProvidersEndpoint(manager)
  },

  identityActors: new MetorialDashboardInstanceIdentityActorsEndpoint(manager),
  identities: Object.assign(new MetorialDashboardInstanceIdentitiesEndpoint(manager), {
    credentials: new MetorialDashboardInstanceIdentitiesCredentialsEndpoint(manager),
    delegations: new MetorialDashboardInstanceIdentitiesDelegationsEndpoint(manager),
    delegationConfigs: new MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint(
      manager
    ),
    delegationRequests: new MetorialDashboardInstanceIdentitiesDelegationRequestsEndpoint(
      manager
    )
  })
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
