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
  MetorialDashboardInstanceDocumentsEditTokenEndpoint,
  MetorialDashboardInstanceDocumentsEndpoint,
  MetorialDashboardInstanceDocumentsParticipantsEndpoint,
  MetorialDashboardInstanceDocumentsPermissionsEndpoint,
  MetorialDashboardInstanceDocumentsVersionsEndpoint,
  MetorialDashboardInstanceEnclavesEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceFilesLinksEndpoint,
  MetorialDashboardInstanceFirewallBindingsEndpoint,
  MetorialDashboardInstanceFirewallsEndpoint,
  MetorialDashboardInstanceFirewallsNetworkPoliciesEndpoint,
  MetorialDashboardInstanceIdentitiesCredentialsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationRequestsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationsEndpoint,
  MetorialDashboardInstanceIdentitiesEndpoint,
  MetorialDashboardInstanceIdentityActorsEndpoint,
  MetorialDashboardInstanceIntegrationsEndpoint,
  MetorialDashboardInstanceIntegrationsInstanceGroupsEndpoint,
  MetorialDashboardInstanceIntegrationsInstanceGroupsProvidersEndpoint,
  MetorialDashboardInstanceIntegrationsInstancesEndpoint,
  MetorialDashboardInstanceIntegrationsInstancesProvidersEndpoint,
  MetorialDashboardInstanceIntegrationsProvidersEndpoint,
  MetorialDashboardInstanceIntegrationsSetupSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpEndpointsEndpoint,
  MetorialDashboardInstanceMagicMcpGroupsEndpoint,
  MetorialDashboardInstanceMagicMcpServersEndpoint,
  MetorialDashboardInstanceMagicMcpServersProvidersEndpoint,
  MetorialDashboardInstanceMagicMcpServersSessionEndpoint,
  MetorialDashboardInstanceMagicMcpSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpTokensEndpoint,
  MetorialDashboardInstanceMonitorAlertsEndpoint,
  MetorialDashboardInstanceMonitorsEndpoint,
  MetorialDashboardInstanceNetworkPoliciesEndpoint,
  MetorialDashboardInstanceNetworkPoliciesRulesEndpoint,
  MetorialDashboardInstanceNetworksEndpoint,
  MetorialDashboardInstancePortalsAccessEndpoint,
  MetorialDashboardInstancePortalsAccessRequestsEndpoint,
  MetorialDashboardInstancePortalsConsumerGroupsEndpoint,
  MetorialDashboardInstancePortalsConsumerInvitesEndpoint,
  MetorialDashboardInstancePortalsConsumerProfilesEndpoint,
  MetorialDashboardInstancePortalsEndpoint,
  MetorialDashboardInstancePortalsListingsEndpoint,
  MetorialDashboardInstancePortalsSurfaceProviderGroupsEndpoint,
  MetorialDashboardInstanceProtoGuardAlertsEndpoint,
  MetorialDashboardInstanceProtoGuardConfigEndpoint,
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
  MetorialDashboardInstanceSkillsAgentsEndpoint,
  MetorialDashboardInstanceSkillsConfigurationsEndpoint,
  MetorialDashboardInstanceSkillsEndpoint,
  MetorialDashboardInstanceSkillsExportsEndpoint,
  MetorialDashboardInstanceSkillsForkSyncsEndpoint,
  MetorialDashboardInstanceSkillsGroupsEndpoint,
  MetorialDashboardInstanceSkillsGroupsItemsEndpoint,
  MetorialDashboardInstanceSkillsImportsEndpoint,
  MetorialDashboardInstanceSkillsItemsEndpoint,
  MetorialDashboardInstanceSkillsMarketplacesEndpoint,
  MetorialDashboardInstanceSkillsMarketplacesPluginsEndpoint,
  MetorialDashboardInstanceSkillsMarketplacesRepositoriesEndpoint,
  MetorialDashboardInstanceSkillsMergeRequestsCommentsEndpoint,
  MetorialDashboardInstanceSkillsMergeRequestsEndpoint,
  MetorialDashboardInstanceSkillsMergeRequestsEventsEndpoint,
  MetorialDashboardInstanceSkillsMergeRequestsItemsEndpoint,
  MetorialDashboardInstanceSkillsMergeRequestsPlanEndpoint,
  MetorialDashboardInstanceSkillsParticipantsEndpoint,
  MetorialDashboardInstanceSkillsPluginsEndpoint,
  MetorialDashboardInstanceSkillsPluginsRepositoriesEndpoint,
  MetorialDashboardInstanceSkillsPluginsSkillsEndpoint,
  MetorialDashboardInstanceSkillsSyncsEndpoint,
  MetorialDashboardInstanceSkillsTemplatesEndpoint,
  MetorialDashboardInstanceSkillsTemplatesItemsEndpoint,
  MetorialDashboardInstanceSkillsVersionsEndpoint,
  MetorialDashboardInstanceSkillsVersionsSnapshotEndpoint,
  MetorialDashboardInstancesResourceCountsEndpoint,
  MetorialDashboardInstanceStoresEndpoint,
  MetorialDashboardInstanceStoresItemsEndpoint,
  MetorialDashboardInstanceStoresParticipantsEndpoint,
  MetorialDashboardInstanceStoresPermissionsEndpoint,
  MetorialDashboardInstanceToolCallsEndpoint,
  MetorialDashboardOauthAuthorizationRequestsEndpoint,
  MetorialDashboardOrganizationsAccessPoliciesEndpoint,
  MetorialDashboardOrganizationsAccessRolesEndpoint,
  MetorialDashboardOrganizationsApiKeysEndpoint,
  MetorialDashboardOrganizationsAuditLogStreamsEndpoint,
  MetorialDashboardOrganizationsAuditLogStreamsEventsEndpoint,
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
  MetorialDashboardOrganizationsSandboxesEndpoint,
  MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint,
  MetorialDashboardOrganizationsTeamsEndpoint,
  MetorialDashboardOrganizationsTeamsMembersEndpoint,
  MetorialDashboardOrganizationsTeamsPoliciesEndpoint,
  MetorialDashboardProjectsConfigureAuthConfigEndpoint,
  MetorialDashboardProjectsConfigureIntegrationNamingEndpoint,
  MetorialDashboardProjectsConfigureRetentionEndpoint,
  MetorialDashboardProjectsConfigureToolCallingEndpoint,
  MetorialDashboardProjectsKeyProvidersEndpoint,
  MetorialDashboardProjectsKeyProvidersErrorsEndpoint,
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

export type MetorialFileUploadMode = 'direct' | 'presigned';

export let smallFileDirectUploadMaxBytes = 1024 * 1024;

let presignedUploadHostSuffixes = [
  '.metorial.com',
  '.metorial.app',
  '.metorial.net',
  '.metorial.cloud',
  '.metorial-staging.com'
];

export let supportsPresignedUpload = (apiHost: string) => {
  try {
    let hostname = new URL(apiHost).hostname.toLowerCase();
    return presignedUploadHostSuffixes.some(suffix => hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

export let getUploadFileName = (input: {
  file: File | Blob;
  title?: string;
  store?: { path: string };
}) =>
  (input.file as File).name?.trim() ||
  input.store?.path.split('/').filter(Boolean).at(-1)?.trim() ||
  input.title?.trim() ||
  '';

export type MetorialFileUploadProgress = {
  loaded: number;
  total: number;
  ratio: number;
};

let notifyUploadProgress = (
  onProgress: ((progress: MetorialFileUploadProgress) => void) | undefined,
  loaded: number,
  total: number
) => {
  if (!onProgress) return;

  onProgress({
    loaded,
    total,
    ratio: total > 0 ? Math.min(1, loaded / total) : 0
  });
};

let sendWithUploadProgress = (opts: {
  url: string;
  method: string;
  body: Blob | FormData | string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  onProgress?: (progress: MetorialFileUploadProgress) => void;
}) =>
  new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
    if (typeof XMLHttpRequest == 'undefined') {
      fetch(opts.url, {
        method: opts.method,
        body: opts.body,
        headers: opts.headers,
        credentials: opts.credentials ?? 'same-origin',
        redirect: 'follow',
        referrerPolicy: 'no-referrer-when-downgrade',
        cache: 'no-cache',
        mode: 'cors'
      })
        .then(async res => {
          resolve({
            ok: res.ok,
            status: res.status,
            text: await res.text()
          });
        })
        .catch(reject);
      return;
    }

    let xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    xhr.withCredentials = opts.credentials == 'include';

    for (let [key, value] of Object.entries(opts.headers ?? {})) {
      if (value == null || value == '') continue;
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = event => {
      notifyUploadProgress(
        opts.onProgress,
        event.loaded,
        event.lengthComputable ? event.total : 0
      );
    };

    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText
      });
    };
    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.onabort = () => reject(new Error('File upload was aborted'));
    xhr.send(opts.body);
  });

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
  sandboxes: new MetorialDashboardOrganizationsSandboxesEndpoint(manager),
  projects: Object.assign(new MetorialDashboardOrganizationsProjectsEndpoint(manager), {
    branding: new MetorialDashboardOrganizationsProjectsBrandingEndpoint(manager),
    configureAuthConfig: new MetorialDashboardProjectsConfigureAuthConfigEndpoint(manager),
    configureIntegrationNaming:
      new MetorialDashboardProjectsConfigureIntegrationNamingEndpoint(manager),
    configureRetention: new MetorialDashboardProjectsConfigureRetentionEndpoint(manager),
    configureToolCalling: new MetorialDashboardProjectsConfigureToolCallingEndpoint(manager),
    keyProviders: Object.assign(new MetorialDashboardProjectsKeyProvidersEndpoint(manager), {
      errors: new MetorialDashboardProjectsKeyProvidersErrorsEndpoint(manager)
    })
  }),
  user: new MetorialManagementUserEndpoint(manager),

  apiKeys: new MetorialDashboardOrganizationsApiKeysEndpoint(manager),

  auth: new MetorialAuthEndpoint(manager),

  dashboard: new MetorialDashboardEndpoint(manager),

  files: Object.assign(new MetorialDashboardInstanceFilesEndpoint(manager), {
    links: new MetorialDashboardInstanceFilesLinksEndpoint(manager),
    upload: async (input: {
      instanceId: string;
      file: File | Blob;
      purpose: string;
      title?: string;
      store?: {
        id: string;
        path: string;
      };
      storeReplace?: boolean;
      mode?: MetorialFileUploadMode;
      onProgress?: (progress: MetorialFileUploadProgress) => void;
    }) => {
      let base = manager.apiHost;
      if (!base.endsWith('/')) base += '/';

      let mode =
        input.mode ??
        (supportsPresignedUpload(base) && input.file.size > smallFileDirectUploadMaxBytes
          ? 'presigned'
          : 'direct');
      let requestHeaders = manager.getHeaders(manager.config) as Record<string, string>;

      let parseFilesResponse = (status: number, text: string) => {
        let json = text ? JSON.parse(text) : {};

        if (status < 200 || status >= 300) {
          throw new MetorialSDKError(
            json?.code
              ? json
              : {
                  status,
                  code: 'file_upload_failed',
                  message: `File upload failed with status ${status}`
                }
          );
        }

        return json;
      };

      let postFiles = async (
        body: FormData | string,
        onProgress?: typeof input.onProgress
      ) => {
        let res =
          typeof body != 'string' && onProgress
            ? await sendWithUploadProgress({
                url: `${base}files`,
                method: 'POST',
                body,
                headers: requestHeaders,
                credentials: 'include',
                onProgress
              })
            : await fetch(`${base}files`, {
                method: 'POST',
                body,
                headers: {
                  ...requestHeaders,
                  ...(typeof body == 'string' ? { 'Content-Type': 'application/json' } : {})
                },
                credentials: 'include',
                redirect: 'follow',
                referrerPolicy: 'no-referrer-when-downgrade',
                cache: 'no-cache',
                mode: 'cors'
              }).then(async response => ({
                ok: response.ok,
                status: response.status,
                text: await response.text()
              }));

        return parseFilesResponse(res.status, res.text);
      };

      let directUpload = async () => {
        let body = new FormData();
        body.append('file', input.file);
        body.append('purpose', input.purpose);
        body.append('instance_id', input.instanceId);
        if (input.title) body.append('title', input.title);
        if (input.store) {
          body.append('store_id', input.store.id);
          body.append('path', input.store.path);
        }
        if (input.storeReplace) body.append('store_replace', 'true');

        notifyUploadProgress(input.onProgress, 0, input.file.size);
        let json = await postFiles(body, input.onProgress);
        notifyUploadProgress(input.onProgress, input.file.size, input.file.size);
        return json;
      };

      let presignedUpload = async () => {
        let pending = await postFiles(
          JSON.stringify({
            mode: 'get_upload_url',
            instance_id: input.instanceId,
            purpose: input.purpose,
            file_name: getUploadFileName(input),
            file_size: input.file.size,
            ...(input.file.type ? { file_type: input.file.type } : {}),
            ...(input.title ? { title: input.title } : {}),
            ...(input.store ? { store_id: input.store.id, path: input.store.path } : {}),
            ...(input.storeReplace ? { store_replace: true } : {})
          })
        );

        notifyUploadProgress(input.onProgress, 0, input.file.size);

        let uploaded = input.onProgress
          ? await sendWithUploadProgress({
              url: pending.upload.url,
              method: pending.upload.method ?? 'PUT',
              body: input.file,
              headers: input.file.type ? { 'Content-Type': input.file.type } : undefined,
              onProgress: input.onProgress
            })
          : await fetch(pending.upload.url, {
              method: pending.upload.method ?? 'PUT',
              body: input.file,
              ...(input.file.type ? { headers: { 'Content-Type': input.file.type } } : {}),
              cache: 'no-cache',
              mode: 'cors'
            }).then(async response => ({
              ok: response.ok,
              status: response.status,
              text: await response.text()
            }));

        if (!uploaded.ok) {
          throw new Error(`Object store rejected the upload with status ${uploaded.status}`);
        }

        notifyUploadProgress(input.onProgress, input.file.size, input.file.size);

        return await postFiles(
          JSON.stringify({
            mode: 'complete',
            instance_id: input.instanceId,
            file_upload_id: pending.id
          })
        );
      };

      console.log('Uploading file:', {
        mode,
        name: getUploadFileName(input),
        size: input.file.size,
        purpose: input.purpose
      });

      let attempt = 0;
      while (true) {
        try {
          let json = mode == 'presigned' ? await presignedUpload() : await directUpload();

          return mapDashboardInstanceFilesGetOutput.transformFrom(json);
        } catch (error) {
          if (!(error instanceof MetorialSDKError) && attempt < 2) {
            console.warn('File upload failed, retrying...', error);
            attempt++;
            continue;
          }

          console.error('File upload failed:', error);

          if (error instanceof MetorialSDKError) throw error;

          throw new MetorialSDKError({
            status: 500,
            code: 'file_upload_failed',
            message: 'File upload failed due to an unexpected error'
          });
        }
      }
    }
  }),

  documents: Object.assign(new MetorialDashboardInstanceDocumentsEndpoint(manager), {
    editToken: new MetorialDashboardInstanceDocumentsEditTokenEndpoint(manager),
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
    agents: new MetorialDashboardInstanceSkillsAgentsEndpoint(manager),
    configurations: new MetorialDashboardInstanceSkillsConfigurationsEndpoint(manager),
    forkSyncs: new MetorialDashboardInstanceSkillsForkSyncsEndpoint(manager),
    items: new MetorialDashboardInstanceSkillsItemsEndpoint(manager),
    mergeRequests: Object.assign(
      new MetorialDashboardInstanceSkillsMergeRequestsEndpoint(manager),
      {
        plan: new MetorialDashboardInstanceSkillsMergeRequestsPlanEndpoint(manager),
        items: new MetorialDashboardInstanceSkillsMergeRequestsItemsEndpoint(manager),
        comments: new MetorialDashboardInstanceSkillsMergeRequestsCommentsEndpoint(manager),
        events: new MetorialDashboardInstanceSkillsMergeRequestsEventsEndpoint(manager)
      }
    ),
    participants: new MetorialDashboardInstanceSkillsParticipantsEndpoint(manager),
    versions: Object.assign(new MetorialDashboardInstanceSkillsVersionsEndpoint(manager), {
      snapshot: new MetorialDashboardInstanceSkillsVersionsSnapshotEndpoint(manager)
    })
  }),

  skillTemplates: Object.assign(
    new MetorialDashboardInstanceSkillsTemplatesEndpoint(manager),
    {
      items: new MetorialDashboardInstanceSkillsTemplatesItemsEndpoint(manager)
    }
  ),

  skillGroups: Object.assign(new MetorialDashboardInstanceSkillsGroupsEndpoint(manager), {
    items: new MetorialDashboardInstanceSkillsGroupsItemsEndpoint(manager)
  }),

  skillMarketplaces: Object.assign(
    new MetorialDashboardInstanceSkillsMarketplacesEndpoint(manager),
    {
      plugins: new MetorialDashboardInstanceSkillsMarketplacesPluginsEndpoint(manager),
      repositories: new MetorialDashboardInstanceSkillsMarketplacesRepositoriesEndpoint(
        manager
      )
    }
  ),

  skillPlugins: Object.assign(new MetorialDashboardInstanceSkillsPluginsEndpoint(manager), {
    skills: new MetorialDashboardInstanceSkillsPluginsSkillsEndpoint(manager),
    repositories: new MetorialDashboardInstanceSkillsPluginsRepositoriesEndpoint(manager)
  }),

  skillExports: new MetorialDashboardInstanceSkillsExportsEndpoint(manager),
  skillImports: new MetorialDashboardInstanceSkillsImportsEndpoint(manager),

  skillSyncs: new MetorialDashboardInstanceSkillsSyncsEndpoint(manager),

  networks: new MetorialDashboardInstanceNetworksEndpoint(manager),
  resourceCounts: new MetorialDashboardInstancesResourceCountsEndpoint(manager),
  networkPolicies: Object.assign(
    new MetorialDashboardInstanceNetworkPoliciesEndpoint(manager),
    { rules: new MetorialDashboardInstanceNetworkPoliciesRulesEndpoint(manager) }
  ),
  enclaves: new MetorialDashboardInstanceEnclavesEndpoint(manager),
  firewalls: Object.assign(new MetorialDashboardInstanceFirewallsEndpoint(manager), {
    networkPolicies: new MetorialDashboardInstanceFirewallsNetworkPoliciesEndpoint(manager)
  }),
  firewallBindings: new MetorialDashboardInstanceFirewallBindingsEndpoint(manager),

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
    consumerAccess: new MetorialDashboardInstancePortalsAccessEndpoint(manager),
    consumerAccessListings: new MetorialDashboardInstancePortalsListingsEndpoint(manager),
    consumerProfiles: new MetorialDashboardInstancePortalsConsumerProfilesEndpoint(manager),
    consumerInvites: new MetorialDashboardInstancePortalsConsumerInvitesEndpoint(manager),
    providerGroups: new MetorialDashboardInstancePortalsSurfaceProviderGroupsEndpoint(manager),
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

  auditLogStreams: Object.assign(
    new MetorialDashboardOrganizationsAuditLogStreamsEndpoint(manager),
    {
      events: new MetorialDashboardOrganizationsAuditLogStreamsEventsEndpoint(manager)
    }
  ),

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
    tools: new MetorialDashboardInstanceProvidersToolsEndpoint(manager),
    versions: new MetorialDashboardInstanceProvidersVersionsEndpoint(manager),
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
  monitorAlerts: new MetorialDashboardInstanceMonitorAlertsEndpoint(manager),
  monitors: new MetorialDashboardInstanceMonitorsEndpoint(manager),
  protoGuardAlerts: new MetorialDashboardInstanceProtoGuardAlertsEndpoint(manager),
  protoGuardConfig: new MetorialDashboardInstanceProtoGuardConfigEndpoint(manager),
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
    providers: new MetorialDashboardInstanceIntegrationsProvidersEndpoint(manager),
    instances: Object.assign(
      new MetorialDashboardInstanceIntegrationsInstancesEndpoint(manager),
      {
        providers: new MetorialDashboardInstanceIntegrationsInstancesProvidersEndpoint(manager)
      }
    ),
    groups: Object.assign(
      new MetorialDashboardInstanceIntegrationsInstanceGroupsEndpoint(manager),
      {
        providers: new MetorialDashboardInstanceIntegrationsInstanceGroupsProvidersEndpoint(
          manager
        )
      }
    ),
    setupSessions: new MetorialDashboardInstanceIntegrationsSetupSessionsEndpoint(manager)
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
