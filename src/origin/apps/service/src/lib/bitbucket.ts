import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import type { ScmBackend, ScmInstallation } from '../../prisma/generated/client';
import { db } from '../db';
import { withScmProviderError, wrapScmProviderError } from './scmProviderError';

type BitbucketInstallation = ScmInstallation & { backend: ScmBackend };
type BitbucketCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type BitbucketAccount = {
  id: string;
  name: string;
  slug: string;
  type: 'user' | 'organization';
  imageUrl: string | null;
};

export type BitbucketRepository = {
  id: string;
  name: string;
  slug: string;
  owner: BitbucketAccount;
  isPrivate: boolean;
  defaultBranch: string;
  webUrl: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BitbucketPullRequest = {
  id: string;
  url: string;
  state: string;
  mergeSha?: string;
  version?: number;
};

export type BitbucketPullRequestStatus = BitbucketPullRequest & {
  approvals: number;
  changesRequested: number;
  mergeability: 'mergeable' | 'blocked' | 'conflicting' | 'unknown';
};

let tokenRefreshes = new Map<bigint, Promise<BitbucketCredentials>>();

let isDataCenter = (backend: ScmBackend) => backend.type === 'bitbucket_data_center';
let trimSlash = (value: string) => value.replace(/\/+$/, '');
let encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');

let readErrorBody = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return '';
  }
};

export class BitbucketClient {
  constructor(
    private backend: ScmBackend,
    private accessToken: string
  ) {}

  private async request<T>(
    path: string,
    options?: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    let url = new URL(path, `${trimSlash(this.backend.apiUrl)}/`);
    for (let [key, value] of Object.entries(options?.query ?? {})) {
      if (value != null) url.searchParams.set(key, String(value));
    }

    let isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
    let response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(options?.body == null || isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers
      },
      body:
        options?.body == null
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body)
    });

    if (!response.ok) {
      let error = new Error(
        `Bitbucket request failed (${response.status}): ${await readErrorBody(response)}`
      ) as Error & { status: number; response: { status: number } };
      error.status = response.status;
      error.response = { status: response.status };
      throw error;
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async allCloud<T>(
    path: string,
    query?: Record<string, string | number | undefined>
  ) {
    let values: T[] = [];
    let next: string | undefined = path;
    let first = true;
    while (next) {
      let page: { values: T[]; next?: string } = first
        ? await this.request(next, { query: { pagelen: 100, ...query } })
        : await this.request(next);
      values.push(...page.values);
      next = page.next;
      first = false;
    }
    return values;
  }

  private async allDataCenter<T>(
    path: string,
    query?: Record<string, string | number | undefined>
  ) {
    let values: T[] = [];
    let start = 0;
    while (true) {
      let page = await this.request<{
        values: T[];
        isLastPage: boolean;
        nextPageStart?: number;
      }>(path, { query: { limit: 100, start, ...query } });
      values.push(...page.values);
      if (page.isLastPage || page.nextPageStart == null) break;
      start = page.nextPageStart;
    }
    return values;
  }

  async getCurrentUser(): Promise<BitbucketAccount> {
    if (!isDataCenter(this.backend)) {
      let user = await this.request<{
        uuid: string;
        username?: string;
        nickname?: string;
        display_name: string;
        links?: { avatar?: { href?: string } };
      }>('user');
      return {
        id: user.uuid,
        name: user.display_name,
        slug: user.username ?? user.nickname ?? user.uuid,
        type: 'user',
        imageUrl: user.links?.avatar?.href ?? null
      };
    }

    let identityUrl = `${trimSlash(this.backend.webUrl)}/plugins/servlet/applinks/whoami`;
    let identityResponse = await fetch(identityUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    let username =
      identityResponse.headers.get('x-ausername') ?? (await identityResponse.text()).trim();

    if (!username) {
      let propertiesResponse = await fetch(
        `${trimSlash(this.backend.apiUrl)}/application-properties`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      username = propertiesResponse.headers.get('x-ausername') ?? '';
    }
    if (!username) {
      throw new ServiceError(
        unauthorizedError({ message: 'Could not identify the Bitbucket Data Center user' })
      );
    }

    let user: {
      id: number;
      name: string;
      displayName: string;
      slug?: string;
      avatarUrl?: string;
    };
    try {
      user = await this.request(`users/${encodeURIComponent(username)}`);
    } catch {
      user = { id: 0, name: username, displayName: username, slug: username };
    }
    return {
      id: user.id ? user.id.toString() : username,
      name: user.displayName,
      slug: user.slug ?? user.name,
      type: 'user',
      imageUrl: user.avatarUrl ?? null
    };
  }

  async listAccounts(): Promise<BitbucketAccount[]> {
    if (!isDataCenter(this.backend)) {
      let workspaces = await this.allCloud<{
        workspace: {
          uuid: string;
          name?: string;
          slug: string;
          links?: { avatar?: { href?: string } };
        };
      }>('user/workspaces');
      return workspaces.map(workspace => ({
        id: workspace.workspace.uuid,
        name: workspace.workspace.name ?? workspace.workspace.slug,
        slug: workspace.workspace.slug,
        type: 'organization' as const,
        imageUrl: workspace.workspace.links?.avatar?.href ?? null
      }));
    }

    let user = await this.getCurrentUser();
    let projects = await this.allDataCenter<{
      id: number;
      key: string;
      name: string;
      avatarUrl?: string;
    }>('projects');
    return [
      { ...user, slug: `~${user.slug}` },
      ...projects.map(project => ({
        id: project.id.toString(),
        name: project.name,
        slug: project.key,
        type: 'organization' as const,
        imageUrl: project.avatarUrl ?? null
      }))
    ];
  }

  async listRepositories(accountSlug?: string): Promise<BitbucketRepository[]> {
    if (!isDataCenter(this.backend)) {
      let workspaces = accountSlug
        ? [accountSlug]
        : (await this.listAccounts()).map(x => x.slug);
      let repositories = await Promise.all(
        workspaces.map(workspace =>
          this.allCloud<any>(`repositories/${encodeURIComponent(workspace)}`, {
            role: 'member'
          })
        )
      );
      return repositories.flat().map(repo => this.normalizeCloudRepository(repo));
    }

    let repos = accountSlug
      ? await this.allDataCenter<any>(`projects/${encodeURIComponent(accountSlug)}/repos`)
      : await this.allDataCenter<any>('repos');
    return repos.map(repo => this.normalizeDataCenterRepository(repo));
  }

  async listRepositoryPage(i: {
    accountSlug?: string;
    cursor?: string;
    limit: number;
  }): Promise<{ repositories: BitbucketRepository[]; nextCursor?: string }> {
    if (!isDataCenter(this.backend)) {
      let path =
        i.cursor ??
        (i.accountSlug ? `repositories/${encodeURIComponent(i.accountSlug)}` : 'repositories');
      let page = await this.request<{ values: any[]; next?: string }>(path, {
        query: i.cursor ? undefined : { pagelen: i.limit, role: 'member' }
      });
      return {
        repositories: page.values.map(repo => this.normalizeCloudRepository(repo)),
        nextCursor: page.next
      };
    }

    let start = i.cursor ? Number(i.cursor) : 0;
    if (!Number.isInteger(start) || start < 0) {
      throw new ServiceError(
        badRequestError({ message: 'Invalid Bitbucket repository cursor' })
      );
    }
    let path = i.accountSlug ? `projects/${encodeURIComponent(i.accountSlug)}/repos` : 'repos';
    let page = await this.request<{
      values: any[];
      isLastPage: boolean;
      nextPageStart?: number;
    }>(path, { query: { limit: i.limit, start } });
    return {
      repositories: page.values.map(repo => this.normalizeDataCenterRepository(repo)),
      nextCursor:
        page.isLastPage || page.nextPageStart == null ? undefined : String(page.nextPageStart)
    };
  }

  async getRepository(owner: string, repo: string): Promise<BitbucketRepository> {
    if (!isDataCenter(this.backend)) {
      let result = await this.request<any>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      );
      return this.normalizeCloudRepository(result);
    }
    let result = await this.request<any>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}`
    );
    let normalized = this.normalizeDataCenterRepository(result);
    try {
      normalized.defaultBranch = await this.getDefaultBranch(normalized.id);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
    return normalized;
  }

  async getRepositoryById(externalId: string): Promise<BitbucketRepository> {
    let [owner, repo] = externalId.split('/');
    if (!owner || !repo) {
      throw new ServiceError(badRequestError({ message: 'Invalid Bitbucket repository ID' }));
    }
    return this.getRepository(owner, repo);
  }

  async createRepository(i: {
    accountSlug: string;
    name: string;
    description?: string;
    isPrivate: boolean;
  }): Promise<BitbucketRepository> {
    let slug = i.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!isDataCenter(this.backend)) {
      let repo = await this.request<any>(
        `repositories/${encodeURIComponent(i.accountSlug)}/${encodeURIComponent(slug)}`,
        {
          method: 'POST',
          body: {
            scm: 'git',
            name: i.name,
            description: i.description,
            is_private: i.isPrivate
          }
        }
      );
      return this.normalizeCloudRepository(repo);
    }
    let repo = await this.request<any>(`projects/${encodeURIComponent(i.accountSlug)}/repos`, {
      method: 'POST',
      body: { name: i.name, scmId: 'git', forkable: true }
    });
    return this.normalizeDataCenterRepository(repo);
  }

  async createWebhook(i: { repository: BitbucketRepository; url: string; secret: string }) {
    let [owner, repo] = i.repository.id.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      let hook = await this.request<{ uuid: string }>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
        {
          method: 'POST',
          body: {
            description: 'Metorial repository sync',
            url: i.url,
            active: true,
            secret: i.secret,
            events: [
              'repo:push',
              'pullrequest:created',
              'pullrequest:updated',
              'pullrequest:approved',
              'pullrequest:unapproved',
              'pullrequest:fulfilled',
              'pullrequest:rejected',
              'repo:commit_status_created',
              'repo:commit_status_updated'
            ]
          }
        }
      );
      return hook.uuid;
    }
    let hook = await this.request<{ id: number }>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/webhooks`,
      {
        method: 'POST',
        body: {
          name: 'Metorial repository sync',
          url: i.url,
          active: true,
          secret: i.secret,
          events: [
            'repo:refs_changed',
            'pr:opened',
            'pr:modified',
            'pr:reviewer:approved',
            'pr:merged',
            'pr:declined'
          ]
        }
      }
    );
    return hook.id.toString();
  }

  async listWebhooks(repositoryId: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let path = !isDataCenter(this.backend)
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/webhooks`;
    let hooks = !isDataCenter(this.backend)
      ? await this.allCloud<any>(path)
      : await this.allDataCenter<any>(path);
    return hooks.map(hook => ({
      id: String(hook.uuid ?? hook.id),
      url: String(hook.url)
    }));
  }

  async deleteWebhook(repositoryId: string, webhookId: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let path = !isDataCenter(this.backend)
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${encodeURIComponent(webhookId)}`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/webhooks/${encodeURIComponent(webhookId)}`;
    await this.request(path, { method: 'DELETE' });
  }

  async updateWebhook(i: {
    repositoryId: string;
    webhookId: string;
    url: string;
    secret: string;
  }) {
    let [owner, repo] = i.repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let dataCenter = isDataCenter(this.backend);
    let path = !dataCenter
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${encodeURIComponent(i.webhookId)}`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/webhooks/${encodeURIComponent(i.webhookId)}`;
    await this.request(path, {
      method: 'PUT',
      body: {
        description: 'Metorial repository sync',
        name: 'Metorial repository sync',
        url: i.url,
        active: true,
        secret: i.secret,
        events: !dataCenter
          ? [
              'repo:push',
              'pullrequest:created',
              'pullrequest:updated',
              'pullrequest:approved',
              'pullrequest:unapproved',
              'pullrequest:fulfilled',
              'pullrequest:rejected',
              'repo:commit_status_created',
              'repo:commit_status_updated'
            ]
          : [
              'repo:refs_changed',
              'pr:opened',
              'pr:modified',
              'pr:reviewer:approved',
              'pr:merged',
              'pr:declined'
            ]
      }
    });
  }

  async getBranch(repositoryId: string, branch: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      let result = await this.request<{ target: { hash: string } }>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refs/branches/${encodeURIComponent(branch)}`
      );
      return result.target.hash;
    }
    let result = await this.request<{ latestCommit: string }>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/branches`,
      { query: { filterText: branch } }
    );
    if ('latestCommit' in result) return result.latestCommit;
    let page = result as unknown as { values: { displayId: string; latestCommit: string }[] };
    let match = page.values.find(value => value.displayId === branch);
    if (!match) throw Object.assign(new Error('Branch not found'), { status: 404 });
    return match.latestCommit;
  }

  async getDefaultBranch(repositoryId: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      return (await this.getRepository(owner, repo)).defaultBranch;
    }
    let branch = await this.request<{ displayId: string }>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/branches/default`
    );
    return branch.displayId;
  }

  async createBranch(repositoryId: string, branch: string, from: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      let targetHash = await this.getBranch(repositoryId, from);
      await this.request(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refs/branches`,
        { method: 'POST', body: { name: branch, target: { hash: targetHash } } }
      );
      return;
    }
    await this.request(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/branches`,
      {
        method: 'POST',
        body: { name: branch, startPoint: from }
      }
    );
  }

  async initializeRepository(repositoryId: string, branch: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let body = new FormData();
    body.set('branch', branch);
    body.set('message', 'Initialize repository');
    if (!isDataCenter(this.backend)) {
      body.set('/README.md', new Blob([`# ${repo}\n`]), 'README.md');
      await this.request(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/src`,
        { method: 'POST', body }
      );
      return;
    }
    body.set('content', `# ${repo}\n`);
    await this.request(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/browse/README.md`,
      { method: 'PUT', body }
    );
  }

  async deleteBranch(repositoryId: string, branch: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      await this.request(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refs/branches/${encodeURIComponent(branch)}`,
        { method: 'DELETE' }
      );
      return;
    }
    await this.request(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/branches`,
      {
        method: 'DELETE',
        body: { name: branch, dryRun: false }
      }
    );
  }

  async createPullRequest(i: {
    repositoryId: string;
    source: string;
    destination: string;
    title: string;
    description?: string;
  }): Promise<BitbucketPullRequest> {
    let [owner, repo] = i.repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      let pr = await this.request<any>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests`,
        {
          method: 'POST',
          body: {
            title: i.title,
            description: i.description,
            source: { branch: { name: i.source } },
            destination: { branch: { name: i.destination } },
            close_source_branch: false
          }
        }
      );
      return { id: pr.id.toString(), url: pr.links.html.href, state: pr.state };
    }
    let pr = await this.request<any>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests`,
      {
        method: 'POST',
        body: {
          title: i.title,
          description: i.description,
          fromRef: {
            id: `refs/heads/${i.source}`,
            repository: { slug: repo, project: { key: owner } }
          },
          toRef: {
            id: `refs/heads/${i.destination}`,
            repository: { slug: repo, project: { key: owner } }
          }
        }
      }
    );
    return {
      id: pr.id.toString(),
      url: pr.links.self[0].href,
      state: pr.state,
      version: pr.version
    };
  }

  async findOpenPullRequest(repositoryId: string, source: string, destination: string) {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    if (!isDataCenter(this.backend)) {
      let prs = await this.allCloud<any>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests`,
        { state: 'OPEN' }
      );
      let pr = prs.find(
        value =>
          value.source.branch.name === source && value.destination.branch.name === destination
      );
      return pr
        ? ({
            id: pr.id.toString(),
            url: pr.links.html.href,
            state: pr.state
          } satisfies BitbucketPullRequest)
        : undefined;
    }
    let prs = await this.allDataCenter<any>(
      `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests`,
      { state: 'OPEN' }
    );
    let pr = prs.find(
      value => value.fromRef.displayId === source && value.toRef.displayId === destination
    );
    return pr
      ? ({
          id: pr.id.toString(),
          url: pr.links.self[0].href,
          state: pr.state,
          version: pr.version
        } satisfies BitbucketPullRequest)
      : undefined;
  }

  async getPullRequest(repositoryId: string, id: string): Promise<BitbucketPullRequest> {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let path = !isDataCenter(this.backend)
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${encodeURIComponent(id)}`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests/${encodeURIComponent(id)}`;
    let pr = await this.request<any>(path);
    return {
      id: pr.id.toString(),
      url: !isDataCenter(this.backend) ? pr.links.html.href : pr.links.self[0].href,
      state: pr.state,
      mergeSha: pr.merge_commit?.hash ?? pr.properties?.mergeCommit?.id,
      version: pr.version
    };
  }

  async getPullRequestStatus(
    repositoryId: string,
    id: string
  ): Promise<BitbucketPullRequestStatus> {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let dataCenter = isDataCenter(this.backend);
    let path = !dataCenter
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${encodeURIComponent(id)}`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests/${encodeURIComponent(id)}`;
    let pr = await this.request<any>(path);
    let participants = pr.participants ?? pr.reviewers ?? [];
    let properties = pr.properties ?? {};
    let conflicted =
      properties.mergeResult?.outcome === 'CONFLICTED' ||
      properties.conflicted === true ||
      (pr.merge_commit == null && pr.reason === 'CONFLICTING');
    let blocked =
      properties.mergeResult?.outcome === 'VETOED' ||
      properties.openTaskCount > 0 ||
      pr.task_count > 0;

    return {
      id: pr.id.toString(),
      url: !dataCenter ? pr.links.html.href : pr.links.self[0].href,
      state: pr.state,
      mergeSha: pr.merge_commit?.hash ?? properties.mergeCommit?.id,
      version: pr.version,
      approvals: participants.filter((participant: any) => participant.approved === true)
        .length,
      changesRequested: participants.filter(
        (participant: any) =>
          participant.status === 'NEEDS_WORK' || participant.state === 'changes_requested'
      ).length,
      mergeability: conflicted ? 'conflicting' : blocked ? 'blocked' : 'unknown'
    };
  }

  async declinePullRequest(repositoryId: string, id: string) {
    let existing = await this.getPullRequest(repositoryId, id);
    if (!['OPEN'].includes(existing.state.toUpperCase())) return;
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let path = !isDataCenter(this.backend)
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${encodeURIComponent(id)}/decline`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests/${encodeURIComponent(id)}/decline`;
    await this.request(path, {
      method: 'POST',
      query: isDataCenter(this.backend) ? { version: existing.version } : undefined,
      body: {}
    });
  }

  async getCiChecks(
    repositoryId: string,
    commit: string
  ): Promise<
    {
      name: string;
      status: 'pending' | 'success' | 'failed' | 'unknown';
      url: string | null;
      summary: string | null;
    }[]
  > {
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let statuses: any[];
    if (!isDataCenter(this.backend)) {
      statuses = await this.allCloud<any>(
        `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${encodeURIComponent(commit)}/statuses`
      );
    } else {
      statuses = await this.allDataCenter<any>(
        `${trimSlash(this.backend.webUrl)}/rest/build-status/1.0/commits/${encodeURIComponent(commit)}`
      );
    }
    return statuses.map(status => {
      let state = String(status.state ?? status.status).toUpperCase();
      return {
        name: String(status.name ?? status.key ?? 'Build check'),
        status: ['FAILED', 'ERROR', 'STOPPED', 'CANCELLED'].includes(state)
          ? 'failed'
          : ['SUCCESSFUL', 'SUCCESS', 'COMPLETED'].includes(state)
            ? 'success'
            : ['INPROGRESS', 'IN_PROGRESS', 'PENDING'].includes(state)
              ? 'pending'
              : 'unknown',
        url: typeof status.url === 'string' ? status.url : null,
        summary: typeof status.description === 'string' ? status.description : null
      };
    });
  }

  async getCiState(repositoryId: string, commit: string) {
    let checks = await this.getCiChecks(repositoryId, commit);
    if (checks.some(check => check.status === 'failed')) return 'failed' as const;
    if (checks.some(check => ['pending', 'unknown'].includes(check.status))) {
      return 'pending' as const;
    }
    return 'success' as const;
  }

  async mergePullRequest(repositoryId: string, id: string): Promise<BitbucketPullRequest> {
    let existing = await this.getPullRequest(repositoryId, id);
    if (['MERGED', 'FULFILLED'].includes(existing.state.toUpperCase())) return existing;
    let [owner, repo] = repositoryId.split('/');
    if (!owner || !repo) throw new Error('Invalid Bitbucket repository ID');
    let path = !isDataCenter(this.backend)
      ? `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${encodeURIComponent(id)}/merge`
      : `projects/${encodeURIComponent(owner)}/repos/${encodeURIComponent(repo)}/pull-requests/${encodeURIComponent(id)}/merge`;
    let pr = await this.request<any>(path, {
      method: 'POST',
      query: isDataCenter(this.backend) ? { version: existing.version } : undefined,
      body: {}
    });

    if (!pr.id && !isDataCenter(this.backend)) {
      for (let attempt = 0; attempt < 60; attempt++) {
        await delay(1000);
        let current = await this.getPullRequest(repositoryId, id);
        if (['MERGED', 'FULFILLED'].includes(current.state.toUpperCase())) return current;
        if (['DECLINED', 'SUPERSEDED'].includes(current.state.toUpperCase())) {
          throw new ServiceError(
            badRequestError({ message: `Bitbucket pull request became ${current.state}` })
          );
        }
      }
      throw new ServiceError(
        badRequestError({ message: 'Timed out waiting for Bitbucket pull request merge' })
      );
    }

    return {
      id: pr.id.toString(),
      url: !isDataCenter(this.backend) ? pr.links.html.href : pr.links.self[0].href,
      state: pr.state,
      mergeSha: pr.merge_commit?.hash ?? pr.properties?.mergeCommit?.id,
      version: pr.version
    };
  }

  private normalizeCloudRepository(repo: any): BitbucketRepository {
    return {
      id: `${repo.workspace.slug}/${repo.slug}`,
      name: repo.name,
      slug: repo.slug,
      owner: {
        id: repo.workspace.uuid,
        name: repo.workspace.name ?? repo.workspace.slug,
        slug: repo.workspace.slug,
        type: 'organization',
        imageUrl: repo.workspace.links?.avatar?.href ?? null
      },
      isPrivate: repo.is_private,
      defaultBranch: repo.mainbranch?.name ?? 'main',
      webUrl: repo.links.html.href,
      createdAt: repo.created_on,
      updatedAt: repo.updated_on
    };
  }

  private normalizeDataCenterRepository(repo: any): BitbucketRepository {
    let project = repo.project;
    return {
      id: `${project.key}/${repo.slug}`,
      name: repo.name,
      slug: repo.slug,
      owner: {
        id: project.id.toString(),
        name: project.name,
        slug: project.key,
        type: 'organization',
        imageUrl: project.avatarUrl ?? null
      },
      isPrivate: !repo.public,
      defaultBranch:
        (typeof repo.defaultBranch === 'string'
          ? repo.defaultBranch
          : repo.defaultBranch?.displayId) ?? 'main',
      webUrl: `${trimSlash(this.backend.webUrl)}/projects/${encodePath(project.key)}/repos/${encodePath(repo.slug)}/browse`
    };
  }
}

export let getBitbucketOAuthUrl = (i: {
  backend: ScmBackend;
  redirectUri: string;
  state: string;
}) => {
  let url = new URL(
    isDataCenter(i.backend)
      ? `${trimSlash(i.backend.webUrl)}/rest/oauth2/latest/authorize`
      : 'https://bitbucket.org/site/oauth2/authorize'
  );
  url.searchParams.set('client_id', i.backend.clientId!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', i.state);
  url.searchParams.set('redirect_uri', i.redirectUri);
  return url.toString();
};

let exchangeBitbucketToken = async (i: {
  backend: ScmBackend;
  grant: { code: string; redirectUri: string } | { refreshToken: string };
}): Promise<BitbucketCredentials> => {
  let tokenUrl = isDataCenter(i.backend)
    ? `${trimSlash(i.backend.webUrl)}/rest/oauth2/latest/token`
    : 'https://bitbucket.org/site/oauth2/access_token';
  let body = new URLSearchParams();
  if ('code' in i.grant) {
    body.set('grant_type', 'authorization_code');
    body.set('code', i.grant.code);
    body.set('redirect_uri', i.grant.redirectUri);
  } else {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', i.grant.refreshToken);
  }

  let response = await withScmProviderError('bitbucket', 'exchange the OAuth token', () =>
    fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${i.backend.clientId}:${i.backend.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })
  );
  if (!response.ok) {
    throw wrapScmProviderError(
      'bitbucket',
      { response: { status: response.status } },
      'exchange the OAuth token'
    );
  }
  let data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  let refreshToken =
    data.refresh_token ?? ('refreshToken' in i.grant ? i.grant.refreshToken : '');
  if (!refreshToken) {
    throw new ServiceError(
      unauthorizedError({ message: 'Bitbucket did not return a refresh token' })
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000)
  };
};

export let exchangeBitbucketOAuthCode = (i: {
  backend: ScmBackend;
  code: string;
  redirectUri: string;
}) => exchangeBitbucketToken({ backend: i.backend, grant: i });

let tokenNeedsRefresh = (expiresAt: Date | null) =>
  !expiresAt || expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

let refreshInstallation = async (
  installation: BitbucketInstallation
): Promise<BitbucketCredentials> => {
  if (!installation.refreshToken) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Bitbucket authentication expired. Reconnect the integration.'
      })
    );
  }
  try {
    let refreshed = await exchangeBitbucketToken({
      backend: installation.backend,
      grant: { refreshToken: installation.refreshToken }
    });
    await db.scmInstallation.update({
      where: { oid: installation.oid },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });
    return refreshed;
  } catch (error) {
    let current = await db.scmInstallation.findUnique({ where: { oid: installation.oid } });
    if (
      current?.accessToken &&
      current.refreshToken &&
      !tokenNeedsRefresh(current.accessTokenExpiresAt) &&
      (current.accessToken !== installation.accessToken ||
        current.refreshToken !== installation.refreshToken)
    ) {
      return {
        accessToken: current.accessToken,
        refreshToken: current.refreshToken,
        expiresAt: current.accessTokenExpiresAt!
      };
    }
    throw error;
  }
};

export let getBitbucketAccessTokenWithInstallation = async (
  installation: BitbucketInstallation
) => {
  if (!installation.accessToken) {
    throw new ServiceError(badRequestError({ message: 'Access token not found' }));
  }
  if (!tokenNeedsRefresh(installation.accessTokenExpiresAt)) return installation.accessToken;
  let refresh = tokenRefreshes.get(installation.oid);
  if (!refresh) {
    refresh = refreshInstallation(installation);
    tokenRefreshes.set(installation.oid, refresh);
    let clear = () => {
      if (tokenRefreshes.get(installation.oid) === refresh)
        tokenRefreshes.delete(installation.oid);
    };
    void refresh.then(clear, clear);
  }
  return (await refresh).accessToken;
};

export let createBitbucketClientWithToken = (token: string, backend: ScmBackend) =>
  new BitbucketClient(backend, token);

export let createBitbucketClientWithInstallation = async (
  installation: BitbucketInstallation
) =>
  createBitbucketClientWithToken(
    await getBitbucketAccessTokenWithInstallation(installation),
    installation.backend
  );
