import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  ScmRepositoryWebhook
} from '../../prisma/generated/client';
import { env } from '../env';
import { createBitbucketClientWithInstallation } from './bitbucket';
import { createGitHubInstallationClient } from './githubApp';
import { createGitLabClientWithInstallation } from './gitlab';

export let repositoryWebhookEvents = [
  'push',
  'pull_request',
  'pull_request_review',
  'ci_status',
  'ci_check'
] as const;

export type RepositoryWebhookEvent = (typeof repositoryWebhookEvents)[number];

type RepositoryWithInstallation = ScmRepository & {
  installation: ScmInstallation & { backend: ScmBackend };
};

type WebhookReference = Pick<
  ScmRepositoryWebhook,
  'id' | 'externalId' | 'signingSecret'
>;

export type RepositoryWebhookState = {
  externalId: string;
  active: boolean;
  callbackUrl: string;
  registeredEvents: RepositoryWebhookEvent[];
};

let eventMappings = {
  github: {
    push: ['push'],
    pull_request: ['pull_request'],
    pull_request_review: ['pull_request_review'],
    ci_status: ['status'],
    ci_check: ['check_run', 'check_suite']
  },
  gitlab: {
    push: ['push_events'],
    pull_request: ['merge_requests_events'],
    ci_status: ['pipeline_events']
  },
  bitbucket: {
    push: ['repo:push'],
    pull_request: [
      'pullrequest:created',
      'pullrequest:updated',
      'pullrequest:fulfilled',
      'pullrequest:rejected'
    ],
    pull_request_review: ['pullrequest:approved', 'pullrequest:unapproved'],
    ci_status: ['repo:commit_status_created', 'repo:commit_status_updated']
  },
  bitbucket_data_center: {
    push: ['repo:refs_changed'],
    pull_request: ['pr:opened', 'pr:modified', 'pr:merged', 'pr:declined'],
    pull_request_review: ['pr:reviewer:approved']
  }
} satisfies Record<
  string,
  Partial<Record<RepositoryWebhookEvent, readonly string[]>>
>;

let mappingFor = (
  repo: RepositoryWithInstallation
): Partial<Record<RepositoryWebhookEvent, readonly string[]>> => {
  if (repo.provider === 'github') return eventMappings.github;
  if (repo.provider === 'gitlab') return eventMappings.gitlab;
  return repo.installation.backend.type === 'bitbucket_data_center'
    ? eventMappings.bitbucket_data_center
    : eventMappings.bitbucket;
};

export let getDesiredRepositoryWebhookEvents = (
  repo: RepositoryWithInstallation
): RepositoryWebhookEvent[] =>
  repositoryWebhookEvents.filter(event => mappingFor(repo)[event] != null);

export let getNativeRepositoryWebhookEvents = (repo: RepositoryWithInstallation) =>
  getDesiredRepositoryWebhookEvents(repo).flatMap(event => mappingFor(repo)[event] ?? []);

export let normalizeRepositoryWebhookEvents = (
  repo: RepositoryWithInstallation,
  nativeEvents: Iterable<string>
): RepositoryWebhookEvent[] => {
  let registered = new Set(nativeEvents);
  return getDesiredRepositoryWebhookEvents(repo).filter(event =>
    (mappingFor(repo)[event] ?? []).every(nativeEvent => registered.has(nativeEvent))
  );
};

export let equalRepositoryWebhookEvents = (
  left: Iterable<RepositoryWebhookEvent>,
  right: Iterable<RepositoryWebhookEvent>
) => {
  let a = [...new Set(left)].sort();
  let b = [...new Set(right)].sort();
  return a.length === b.length && a.every((event, index) => event === b[index]);
};

let providerPath = (provider: ScmRepository['provider']) =>
  provider === 'github' ? 'gh' : provider === 'gitlab' ? 'gl' : 'bb';

export let getRepositoryWebhookCallbackUrl = (
  provider: ScmRepository['provider'],
  webhookId: string
) =>
  `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/webhook-ingest/${providerPath(provider)}/${webhookId}`;

export let getRepositoryWebhookCallbackPrefix = (provider: ScmRepository['provider']) =>
  `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/webhook-ingest/${providerPath(provider)}/`;

let gitLabNativeEvents = (hook: any) =>
  [
    (hook.push_events ?? hook.pushEvents) && 'push_events',
    (hook.merge_requests_events ?? hook.mergeRequestsEvents) && 'merge_requests_events',
    (hook.pipeline_events ?? hook.pipelineEvents) && 'pipeline_events'
  ].filter((event): event is string => Boolean(event));

export let readProviderRepositoryWebhook = async (
  repo: RepositoryWithInstallation,
  webhook: WebhookReference
): Promise<RepositoryWebhookState> => {
  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) throw new Error('Installation ID not found');
    let github = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );
    let response = await github.request('GET /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: repo.externalOwner,
      repo: repo.externalName,
      hook_id: parseInt(webhook.externalId)
    });
    return {
      externalId: response.data.id.toString(),
      active: response.data.active,
      callbackUrl: String(response.data.config?.url ?? ''),
      registeredEvents: normalizeRepositoryWebhookEvents(repo, response.data.events)
    };
  }

  if (repo.provider === 'gitlab') {
    let gitlab = await createGitLabClientWithInstallation(repo.installation);
    let hook = await gitlab.ProjectHooks.show(
      parseInt(repo.externalId),
      parseInt(webhook.externalId)
    );
    return {
      externalId: hook.id.toString(),
      active: true,
      callbackUrl: String(hook.url),
      registeredEvents: normalizeRepositoryWebhookEvents(repo, gitLabNativeEvents(hook))
    };
  }

  let bitbucket = await createBitbucketClientWithInstallation(repo.installation);
  let hook = await bitbucket.getWebhook(repo.externalId, webhook.externalId);
  return {
    externalId: hook.id,
    active: hook.active,
    callbackUrl: hook.url,
    registeredEvents: normalizeRepositoryWebhookEvents(repo, hook.events)
  };
};

export let createProviderRepositoryWebhook = async (
  repo: RepositoryWithInstallation,
  webhook: Pick<WebhookReference, 'id' | 'signingSecret'>
) => {
  let callbackUrl = getRepositoryWebhookCallbackUrl(repo.provider, webhook.id);

  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) throw new Error('Installation ID not found');
    let github = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );
    let response = await github.request('POST /repos/{owner}/{repo}/hooks', {
      owner: repo.externalOwner,
      repo: repo.externalName,
      config: {
        url: callbackUrl,
        content_type: 'json',
        secret: webhook.signingSecret,
        insecure_ssl: '0'
      },
      events: getNativeRepositoryWebhookEvents(repo),
      active: true
    });
    return response.data.id.toString();
  }

  if (repo.provider === 'gitlab') {
    let gitlab = await createGitLabClientWithInstallation(repo.installation);
    let hook = await gitlab.ProjectHooks.add(parseInt(repo.externalId), callbackUrl, {
      pushEvents: true,
      mergeRequestsEvents: true,
      pipelineEvents: true,
      token: webhook.signingSecret
    });
    return hook.id.toString();
  }

  let bitbucket = await createBitbucketClientWithInstallation(repo.installation);
  let repository = await bitbucket.getRepositoryById(repo.externalId);
  return await bitbucket.createWebhook({
    repository,
    url: callbackUrl,
    secret: webhook.signingSecret,
    events: getNativeRepositoryWebhookEvents(repo)
  });
};

export let updateProviderRepositoryWebhook = async (
  repo: RepositoryWithInstallation,
  webhook: WebhookReference
) => {
  let callbackUrl = getRepositoryWebhookCallbackUrl(repo.provider, webhook.id);

  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) throw new Error('Installation ID not found');
    let github = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );
    await github.request('PATCH /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: repo.externalOwner,
      repo: repo.externalName,
      hook_id: parseInt(webhook.externalId),
      active: true,
      config: {
        url: callbackUrl,
        content_type: 'json',
        secret: webhook.signingSecret,
        insecure_ssl: '0'
      },
      events: getNativeRepositoryWebhookEvents(repo)
    });
    return true;
  }

  if (repo.provider === 'gitlab') {
    let gitlab = await createGitLabClientWithInstallation(repo.installation);
    await gitlab.ProjectHooks.edit(
      parseInt(repo.externalId),
      parseInt(webhook.externalId),
      callbackUrl,
      {
        pushEvents: true,
        mergeRequestsEvents: true,
        pipelineEvents: true,
        token: webhook.signingSecret
      }
    );
    return true;
  }

  let bitbucket = await createBitbucketClientWithInstallation(repo.installation);
  await bitbucket.updateWebhook({
    repositoryId: repo.externalId,
    webhookId: webhook.externalId,
    url: callbackUrl,
    secret: webhook.signingSecret,
    events: getNativeRepositoryWebhookEvents(repo)
  });
  return true;
};

export let deleteProviderRepositoryWebhook = async (
  repo: RepositoryWithInstallation,
  externalId: string
) => {
  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) throw new Error('Installation ID not found');
    let github = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );
    await github.request('DELETE /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: repo.externalOwner,
      repo: repo.externalName,
      hook_id: parseInt(externalId)
    });
    return;
  }

  if (repo.provider === 'gitlab') {
    let gitlab = await createGitLabClientWithInstallation(repo.installation);
    await gitlab.ProjectHooks.remove(parseInt(repo.externalId), parseInt(externalId));
    return;
  }

  let bitbucket = await createBitbucketClientWithInstallation(repo.installation);
  await bitbucket.deleteWebhook(repo.externalId, externalId);
};

export let listManagedProviderRepositoryWebhooks = async (
  repo: RepositoryWithInstallation
): Promise<{ id: string; url: string }[]> => {
  let prefix = getRepositoryWebhookCallbackPrefix(repo.provider);
  let hooks: { id: string; url: string }[];

  if (repo.provider === 'github') {
    if (!repo.installation.externalInstallationId) throw new Error('Installation ID not found');
    let github = await createGitHubInstallationClient(
      repo.installation.externalInstallationId,
      repo.installation.backend
    );
    hooks = [];
    for (let page = 1; ; page++) {
      let response = await github.request('GET /repos/{owner}/{repo}/hooks', {
        owner: repo.externalOwner,
        repo: repo.externalName,
        per_page: 100,
        page
      });
      hooks.push(
        ...response.data.map(hook => ({
          id: hook.id.toString(),
          url: String(hook.config?.url ?? '')
        }))
      );
      if (response.data.length < 100) break;
    }
  } else if (repo.provider === 'gitlab') {
    let gitlab = await createGitLabClientWithInstallation(repo.installation);
    let values = await gitlab.ProjectHooks.all(parseInt(repo.externalId), { perPage: 100 });
    hooks = values.map(hook => ({ id: hook.id.toString(), url: String(hook.url) }));
  } else {
    let bitbucket = await createBitbucketClientWithInstallation(repo.installation);
    hooks = await bitbucket.listWebhooks(repo.externalId);
  }

  return hooks.filter(hook => hook.url.startsWith(prefix));
};
