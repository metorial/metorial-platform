import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import crypto from 'crypto';
import type {
  Actor,
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { createBitbucketClientWithInstallation } from '../lib/bitbucket';
import { createGitHubInstallationClient } from '../lib/githubApp';
import { createGitLabClientWithInstallation } from '../lib/gitlab';
import {
  getGitLabNamespaceId,
  getGitLabPersonalNamespaceId,
  isGitLabNamespaceError
} from '../lib/gitlabNamespace';
import {
  getScmProviderErrorStatus,
  withScmProviderError,
  wrapScmProviderError
} from '../lib/scmProviderError';
import { createRepoWebhookQueue } from '../queues/scm/createRepoWebhook';
import { createHandleRepoPushQueue } from '../queues/scm/handleRepoPush';
import type { ScmAccountPreview, ScmRepoPreview } from '../types';

let getGitLabPersonalNamespaceIdForUser = async (gitlab: any, user: any) => {
  let namespaces = await withScmProviderError<any[]>(
    'gitlab',
    'list personal namespaces',
    () => gitlab.Namespaces.all({ ownedOnly: true, perPage: 100 })
  );
  return getGitLabPersonalNamespaceId(user, namespaces);
};

let verifyHmacSignature = (payload: string, signature: string, secret: string) => {
  let normalized = signature.includes('=') ? signature : `sha256=${signature}`;
  let digest = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  let received = Buffer.from(normalized);
  let expected = Buffer.from(digest);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

class scmRepoServiceImpl {
  async listAccountPreviews(i: { installation: ScmInstallation & { backend: ScmBackend } }) {
    if (i.installation.provider == 'github') {
      // For GitHub Apps, the installation is tied to a single account
      // Return that account directly from the installation data
      return [
        {
          provider: i.installation.provider,
          externalId: i.installation.externalAccountId,
          name: i.installation.externalAccountLogin,
          identifier: `github.com/${i.installation.externalAccountLogin}`
        } satisfies ScmAccountPreview
      ];
    }

    if (i.installation.provider == 'gitlab') {
      let gitlab = await createGitLabClientWithInstallation(i.installation);

      // Only show group namespaces where the token can normally create projects.
      let groups = await withScmProviderError('gitlab', 'list groups', () =>
        gitlab.Groups.all({ minAccessLevel: 30, perPage: 100 })
      );
      let user = await withScmProviderError('gitlab', 'load the authenticated user', () =>
        gitlab.Users.showCurrentUser()
      );
      let personalNamespaceId = await getGitLabPersonalNamespaceIdForUser(gitlab, user);

      return [
        {
          provider: i.installation.provider,
          externalId: personalNamespaceId.toString(),
          name: user.username,
          identifier: `${new URL(i.installation.backend.webUrl).hostname}/${user.username}`
        } satisfies ScmAccountPreview,
        ...groups.map(
          g =>
            ({
              provider: i.installation.provider,
              externalId: g.id.toString(),
              name: g.path,
              identifier: `${new URL(i.installation.backend.webUrl).hostname}/${g.full_path}`
            }) satisfies ScmAccountPreview
        )
      ];
    }

    if (i.installation.provider == 'bitbucket') {
      let client = await createBitbucketClientWithInstallation(i.installation);
      let accounts = await withScmProviderError('bitbucket', 'list accounts', () =>
        client.listAccounts()
      );
      let hostname = new URL(i.installation.backend.webUrl).hostname;
      return accounts.map(
        account =>
          ({
            provider: i.installation.provider,
            externalId: account.id,
            name: account.name,
            identifier: `${hostname}/${account.slug}`
          }) satisfies ScmAccountPreview
      );
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async listRepositoryPreviews(i: {
    installation: ScmInstallation & { backend: ScmBackend };
    externalAccountId?: string;
  }) {
    if (i.installation.provider == 'github') {
      if (!i.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }
      let octokit = await createGitHubInstallationClient(
        i.installation.externalInstallationId,
        i.installation.backend
      );

      // For GitHub Apps, use the installation repositories endpoint
      // This lists all repositories the installation has access to
      let allRepos: any[] = [];
      let page = 1;

      while (true) {
        let response = await withScmProviderError(
          'github',
          'list installation repositories',
          () =>
            octokit.request('GET /installation/repositories', {
              per_page: 100,
              page
            })
        );

        allRepos.push(...response.data.repositories);

        if (response.data.repositories.length < 100) break;
        page++;
      }

      // Filter by externalAccountId if provided (to support account-specific filtering in UI)
      let filteredRepos = i.externalAccountId
        ? allRepos.filter(r => r.owner.id.toString() === i.externalAccountId)
        : allRepos;

      return filteredRepos.map(
        r =>
          ({
            provider: i.installation.provider,
            name: r.name,
            identifier: `github.com/${r.full_name}`,
            externalId: r.id.toString(),
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
            updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
            lastPushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
            account: {
              externalId: r.owner.id.toString(),
              name: r.owner.login,
              identifier: `github.com/${r.owner.login}`,
              provider: i.installation.provider
            }
          }) satisfies ScmRepoPreview
      );
    }

    if (i.installation.provider == 'gitlab') {
      let gitlab = await createGitLabClientWithInstallation(i.installation);

      let allProjects: any[] = [];
      let user = await withScmProviderError('gitlab', 'load the authenticated user', () =>
        gitlab.Users.showCurrentUser()
      );
      let personalNamespaceId = (
        await getGitLabPersonalNamespaceIdForUser(gitlab, user)
      ).toString();

      // Existing clients can still supply the installation's user ID. New account previews
      // supply the actual personal namespace ID required by GitLab's project APIs.
      if (
        !i.externalAccountId ||
        i.externalAccountId == personalNamespaceId ||
        i.externalAccountId == i.installation.externalAccountId
      ) {
        allProjects = await withScmProviderError('gitlab', 'list user projects', () =>
          gitlab.Users.allProjects(user.id, { perPage: 100 })
        );
      } else {
        // List projects for a specific group
        let groupId = getGitLabNamespaceId(i.externalAccountId);
        allProjects = await withScmProviderError('gitlab', 'list group projects', () =>
          gitlab.Groups.allProjects(groupId, { perPage: 100 })
        );
      }

      let hostname = new URL(i.installation.backend.webUrl).hostname;

      return allProjects.map(
        (p: any) =>
          ({
            provider: i.installation.provider,
            name: p.name,
            identifier: `${hostname}/${p.path_with_namespace}`,
            externalId: p.id.toString(),
            createdAt: p.created_at ? new Date(p.created_at) : new Date(),
            updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
            lastPushedAt: p.last_activity_at ? new Date(p.last_activity_at) : null,
            account: {
              externalId: i.externalAccountId!,
              name: p.namespace.path,
              identifier: `${hostname}/${p.namespace.full_path}`,
              provider: i.installation.provider
            }
          }) satisfies ScmRepoPreview
      );
    }

    if (i.installation.provider == 'bitbucket') {
      let client = await createBitbucketClientWithInstallation(i.installation);
      let accounts = await client.listAccounts();
      let selected = i.externalAccountId
        ? accounts.find(account => account.id === i.externalAccountId)
        : undefined;
      let repos = await withScmProviderError('bitbucket', 'list repositories', () =>
        client.listRepositories(selected?.slug)
      );
      let hostname = new URL(i.installation.backend.webUrl).hostname;
      return repos.map(
        repo =>
          ({
            provider: i.installation.provider,
            name: repo.name,
            identifier: `${hostname}/${repo.owner.slug}/${repo.slug}`,
            externalId: repo.id,
            createdAt: repo.createdAt ? new Date(repo.createdAt) : new Date(),
            updatedAt: repo.updatedAt ? new Date(repo.updatedAt) : new Date(),
            lastPushedAt: repo.updatedAt ? new Date(repo.updatedAt) : null,
            account: {
              externalId: repo.owner.id,
              name: repo.owner.name,
              identifier: `${hostname}/${repo.owner.slug}`,
              provider: i.installation.provider
            }
          }) satisfies ScmRepoPreview
      );
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async getRepositoryByPath(i: {
    installation: ScmInstallation & { backend: ScmBackend };
    owner: string;
    repo: string;
  }): Promise<{ externalId: string; name: string; identifier: string }> {
    if (i.installation.provider == 'github') {
      if (!i.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }
      let octokit = await createGitHubInstallationClient(
        i.installation.externalInstallationId,
        i.installation.backend
      );

      try {
        let repoRes = await octokit.request('GET /repos/{owner}/{repo}', {
          owner: i.owner,
          repo: i.repo
        });

        return {
          externalId: repoRes.data.id.toString(),
          name: repoRes.data.name,
          identifier: `github.com/${repoRes.data.full_name}`
        };
      } catch (error: any) {
        if (error.status === 404) {
          throw new ServiceError(
            badRequestError({
              message: `Repository ${i.owner}/${i.repo} not found or installation does not have access`
            })
          );
        }
        throw wrapScmProviderError('github', error, 'load the repository');
      }
    }

    if (i.installation.provider == 'gitlab') {
      let gitlab = await createGitLabClientWithInstallation(i.installation);

      let hostname = new URL(i.installation.backend.webUrl).hostname;
      let projectPath = `${i.owner}/${i.repo}`;

      try {
        let project = await gitlab.Projects.show(encodeURIComponent(projectPath));

        return {
          externalId: project.id.toString(),
          name: project.name,
          identifier: `${hostname}/${project.path_with_namespace}`
        };
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new ServiceError(
            badRequestError({
              message: `Repository ${i.owner}/${i.repo} not found or installation does not have access`
            })
          );
        }
        throw wrapScmProviderError('gitlab', error, 'load the repository');
      }
    }

    if (i.installation.provider == 'bitbucket') {
      let client = await createBitbucketClientWithInstallation(i.installation);
      try {
        let repo = await client.getRepository(i.owner, i.repo);
        return { externalId: repo.id, name: repo.name, identifier: repo.webUrl };
      } catch (error) {
        if (getScmProviderErrorStatus(error) === 404) {
          throw new ServiceError(
            badRequestError({
              message: `Repository ${i.owner}/${i.repo} not found or installation does not have access`
            })
          );
        }
        throw wrapScmProviderError('bitbucket', error, 'load the repository');
      }
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async getManyScmReposByIds(i: { tenant: Tenant; scmRepoIds: string[] }) {
    if (i.scmRepoIds.length === 0) return [];

    return await db.scmRepository.findMany({
      where: {
        tenantOid: i.tenant.oid,
        id: { in: i.scmRepoIds }
      },
      include: {
        account: true
      }
    });
  }

  async linkRepository(i: {
    installation: ScmInstallation & { backend: ScmBackend };
    externalId: string;
  }) {
    if (i.installation.provider == 'github') {
      if (!i.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }
      let octokit = await createGitHubInstallationClient(
        i.installation.externalInstallationId,
        i.installation.backend
      );

      let repoRes = await withScmProviderError('github', 'load the repository', () =>
        octokit.request('GET /repositories/{repository_id}', {
          repository_id: parseInt(i.externalId)
        })
      );

      let accountData = {
        name: repoRes.data.owner.login,
        identifier: `github.com/${repoRes.data.owner.login}`,
        provider: i.installation.provider,
        type:
          repoRes.data.owner.type.toLowerCase() === 'user'
            ? ('user' as const)
            : ('organization' as const),
        externalId: repoRes.data.owner.id.toString()
      };

      let account = await db.scmAccount.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: repoRes.data.owner.id.toString()
          }
        },
        update: accountData,
        create: {
          ...getId('scmAccount'),
          tenantOid: i.installation.tenantOid,
          backendOid: i.installation.backendOid,
          ...accountData
        }
      });

      let repoData = {
        name: repoRes.data.name,
        identifier: `github.com/${repoRes.data.full_name}`,
        provider: i.installation.provider,
        externalId: repoRes.data.id.toString(),
        tenantOid: i.installation.tenantOid,
        backendOid: i.installation.backendOid,
        accountOid: account.oid,
        installationOid: i.installation.oid,
        externalIsPrivate: repoRes.data.private,
        externalName: repoRes.data.name,
        defaultBranch: repoRes.data.default_branch,
        externalOwner: repoRes.data.owner.login,
        externalUrl: repoRes.data.html_url
      };

      let repo = await db.scmRepository.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: i.externalId
          }
        },
        update: repoData,
        create: {
          ...getId('scmRepository'),
          ...repoData
        },
        include: {
          account: true
        }
      });

      await createRepoWebhookQueue.add({ repoId: repo.id });

      return repo;
    }

    if (i.installation.provider == 'bitbucket') {
      let client = await createBitbucketClientWithInstallation(i.installation);
      let externalRepo = await withScmProviderError('bitbucket', 'load the repository', () =>
        client.getRepositoryById(i.externalId)
      );
      let hostname = new URL(i.installation.backend.webUrl).hostname;
      let accountData = {
        name: externalRepo.owner.name,
        identifier: `${hostname}/${externalRepo.owner.slug}`,
        provider: i.installation.provider,
        type: externalRepo.owner.type,
        externalId: externalRepo.owner.id
      };
      let account = await db.scmAccount.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: externalRepo.owner.id
          }
        },
        update: accountData,
        create: {
          ...getId('scmAccount'),
          tenantOid: i.installation.tenantOid,
          backendOid: i.installation.backendOid,
          ...accountData
        }
      });
      let repoData = {
        name: externalRepo.name,
        identifier: `${hostname}/${externalRepo.owner.slug}/${externalRepo.slug}`,
        provider: i.installation.provider,
        externalId: externalRepo.id,
        tenantOid: i.installation.tenantOid,
        backendOid: i.installation.backendOid,
        accountOid: account.oid,
        installationOid: i.installation.oid,
        externalIsPrivate: externalRepo.isPrivate,
        externalName: externalRepo.slug,
        defaultBranch: externalRepo.defaultBranch,
        externalOwner: externalRepo.owner.slug,
        externalUrl: externalRepo.webUrl
      };
      let repo = await db.scmRepository.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: externalRepo.id
          }
        },
        update: repoData,
        create: { ...getId('scmRepository'), ...repoData },
        include: { account: true }
      });
      await createRepoWebhookQueue.add({ repoId: repo.id });
      return repo;
    }

    if (i.installation.provider == 'gitlab') {
      let gitlab = await createGitLabClientWithInstallation(i.installation);

      let project = await withScmProviderError('gitlab', 'load the repository', () =>
        gitlab.Projects.show(parseInt(i.externalId))
      );

      let hostname = new URL(i.installation.backend.webUrl).hostname;

      let accountData = {
        name: project.namespace.name,
        identifier: `${hostname}/${project.namespace.full_path}`,
        provider: i.installation.provider,
        type:
          project.namespace.kind === 'user' ? ('user' as const) : ('organization' as const),
        externalId: project.namespace.id.toString()
      };

      let account = await db.scmAccount.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: project.namespace.id.toString()
          }
        },
        update: accountData,
        create: {
          ...getId('scmAccount'),
          tenantOid: i.installation.tenantOid,
          backendOid: i.installation.backendOid,
          ...accountData
        }
      });

      let repoData = {
        name: String(project.name),
        identifier: `${hostname}/${project.path_with_namespace}`,
        provider: i.installation.provider,
        externalId: project.id.toString(),
        tenantOid: i.installation.tenantOid,
        backendOid: i.installation.backendOid,
        accountOid: account.oid,
        installationOid: i.installation.oid,
        externalIsPrivate: project.visibility === 'private',
        externalName: String(project.path),
        defaultBranch: String(project.default_branch),
        externalOwner: String(project.namespace.path),
        externalUrl: String(project.web_url)
      };

      let repo = await db.scmRepository.upsert({
        where: {
          tenantOid_backendOid_externalId: {
            tenantOid: i.installation.tenantOid,
            backendOid: i.installation.backendOid,
            externalId: i.externalId
          }
        },
        update: repoData,
        create: {
          ...getId('scmRepository'),
          ...repoData
        },
        include: {
          account: true
        }
      });

      await createRepoWebhookQueue.add({ repoId: repo.id });

      return repo;
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async createRepository(i: {
    installation: ScmInstallation & { backend: ScmBackend };
    externalAccountId: string;
    name: string;
    description?: string;
    isPrivate: boolean;
  }) {
    if (i.installation.provider == 'github') {
      if (!i.installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }
      let octokit = await createGitHubInstallationClient(
        i.installation.externalInstallationId,
        i.installation.backend
      );

      // For GitHub Apps:
      // - Organizations: use /orgs/{org}/repos
      // - Users: use /user/repos (requires Repository Administration: Read & Write permission)
      let repoRes;

      try {
        if (i.installation.accountType === 'organization') {
          repoRes = await octokit.request('POST /orgs/{org}/repos', {
            org: i.installation.externalAccountLogin,
            name: i.name,
            description: i.description,
            private: i.isPrivate
          });
        } else {
          repoRes = await octokit.request('POST /user/repos', {
            name: i.name,
            description: i.description,
            private: i.isPrivate
          });
        }
      } catch (error: any) {
        // Handle repository name conflict
        if (error.status === 422 && error.response?.data?.errors) {
          let errors = error.response.data.errors;
          let nameError = errors.find((e: any) => e.field === 'name');
          if (nameError) {
            throw new ServiceError(
              badRequestError({
                message: `Repository name "${i.name}" already exists in this account. Please choose a different name.`
              })
            );
          }
        }
        throw wrapScmProviderError('github', error, 'create the repository');
      }

      return await this.linkRepository({
        installation: i.installation,
        externalId: repoRes.data.id.toString()
      });
    }

    if (i.installation.provider == 'bitbucket') {
      let client = await createBitbucketClientWithInstallation(i.installation);
      let accounts = await client.listAccounts();
      let account = accounts.find(value => value.id === i.externalAccountId);
      if (!account) {
        throw new ServiceError(
          badRequestError({ message: 'The selected Bitbucket account is unavailable' })
        );
      }
      let repo = await withScmProviderError('bitbucket', 'create the repository', () =>
        client.createRepository({
          accountSlug: account.slug,
          name: i.name,
          description: i.description,
          isPrivate: i.isPrivate
        })
      );
      return this.linkRepository({ installation: i.installation, externalId: repo.id });
    }

    if (i.installation.provider == 'gitlab') {
      let gitlab = await createGitLabClientWithInstallation(i.installation);

      let namespaceId = getGitLabNamespaceId(i.externalAccountId);

      // Older clients use the installation's GitLab user ID. Resolve it to the
      // personal namespace ID, which is the value required by Projects.create.
      if (i.externalAccountId == i.installation.externalAccountId) {
        let user = await withScmProviderError('gitlab', 'load the authenticated user', () =>
          gitlab.Users.showCurrentUser()
        );
        namespaceId = await getGitLabPersonalNamespaceIdForUser(gitlab, user);
      }

      let projectRes;
      try {
        projectRes = await gitlab.Projects.create({
          name: i.name,
          description: i.description,
          visibility: i.isPrivate ? 'private' : 'public',
          namespaceId
        });
      } catch (error: any) {
        if (isGitLabNamespaceError(error)) {
          throw new ServiceError(
            badRequestError({
              message:
                'The selected GitLab namespace is invalid or you do not have permission to create projects in it'
            })
          );
        }
        throw wrapScmProviderError('gitlab', error, 'create the repository');
      }

      return await this.linkRepository({
        installation: i.installation,
        externalId: projectRes.id.toString()
      });
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async searchAndLinkRepositoryByUrl(i: {
    tenant: Tenant;
    actor: Actor;
    repositoryUrl: string;
  }) {
    // Parse repository URL
    let url: URL;
    try {
      url = new URL(i.repositoryUrl);
    } catch {
      throw new ServiceError(badRequestError({ message: 'Invalid repository URL' }));
    }

    let hostname = url.hostname;
    let pathParts = url.pathname.split('/').filter(p => p);

    let allInstallations = await db.scmInstallation.findMany({
      where: {
        tenantOid: i.tenant.oid,
        ownerActorOid: i.actor.oid
      },
      include: {
        backend: true
      }
    });
    let hostInstallation = allInstallations.find(
      installation => new URL(installation.backend.webUrl).hostname === hostname
    );

    if (pathParts.length < 2) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid repository URL format. Expected: https://provider.com/owner/repo'
        })
      );
    }

    let ownerName = pathParts[0];
    let repoName = pathParts[1]?.replace(/\.git$/, '');
    if (hostInstallation?.backend.type === 'bitbucket_data_center') {
      if (pathParts[0] === 'projects' && pathParts[2] === 'repos') {
        ownerName = pathParts[1];
        repoName = pathParts[3]?.replace(/\.git$/, '');
      } else if (pathParts[0] === 'scm') {
        ownerName = pathParts[1];
        repoName = pathParts[2]?.replace(/\.git$/, '');
      }
    }

    if (!ownerName || !repoName) {
      throw new ServiceError(
        badRequestError({ message: 'Could not parse repository owner and name from URL' })
      );
    }

    // Determine provider from hostname
    let provider: 'github' | 'gitlab' | 'bitbucket';
    if (hostInstallation) {
      provider = hostInstallation.provider;
    } else if (hostname === 'github.com' || hostname.includes('github')) {
      provider = 'github';
    } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
      provider = 'gitlab';
    } else if (hostname === 'bitbucket.org' || hostname.includes('bitbucket')) {
      provider = 'bitbucket';
    } else {
      throw new ServiceError(
        badRequestError({
          message:
            'Unsupported repository provider. Only GitHub, GitLab, and Bitbucket are supported.'
        })
      );
    }

    // Find all installations for this tenant, actor, and provider
    let installations = allInstallations.filter(
      installation =>
        installation.provider === provider &&
        (new URL(installation.backend.webUrl).hostname === hostname ||
          ['github.com', 'gitlab.com', 'bitbucket.org'].includes(hostname))
    );

    if (installations.length === 0) {
      throw new ServiceError(
        badRequestError({
          message: `No ${provider} installation found. Please connect a ${provider} account first.`
        })
      );
    }

    // Try each installation to find one with access to the repository
    for (let installation of installations) {
      try {
        let repoInfo = await this.getRepositoryByPath({
          installation,
          owner: ownerName,
          repo: repoName
        });

        return await this.linkRepository({
          installation,
          externalId: repoInfo.externalId
        });
      } catch (error) {
        continue;
      }
    }

    throw new ServiceError(
      badRequestError({
        message:
          `Repository ${ownerName}/${repoName} not found or no ${provider} installation has access to it. ` +
          `Please ensure you have connected a ${provider} account with access to this repository.`
      })
    );
  }

  async getScmRepoById(i: { tenant: Tenant; scmRepoId: string }) {
    let repo = await db.scmRepository.findFirst({
      where: {
        tenantOid: i.tenant.oid,
        id: i.scmRepoId
      },
      include: {
        account: true
      }
    });
    if (!repo) {
      throw new ServiceError(
        badRequestError({
          message: 'SCM Repository not found'
        })
      );
    }
    return repo;
  }

  async receiveGitHubWebhookEvent(i: {
    webhookId: string;
    idempotencyKey: string;
    eventType: string;
    payload: string;
    signature: string;
  }) {
    let webhook = await db.scmRepositoryWebhook.findUnique({
      where: { id: i.webhookId },
      include: { repo: true }
    });
    if (!webhook) {
      throw new ServiceError(badRequestError({ message: 'Invalid webhook' }));
    }

    if (!verifyHmacSignature(i.payload, i.signature, webhook.signingSecret)) {
      throw new ServiceError(badRequestError({ message: 'Invalid signature' }));
    }

    let event = JSON.parse(i.payload) as {
      ref: string;
      before: string;
      after: string;
      pusher: { name: string; email: string };
      repository: { id: number; name: string; full_name: string; owner: { login: string } };
      sender: { id: number; login: string };
      commits: {
        id: string;
        message: string;
        timestamp: string;
        url: string;
        author: { name: string; email: string };
      }[];
    };

    if (webhook.repo.provider == 'github') {
      await db.scmRepositoryWebhookReceivedEvent.create({
        data: {
          webhookOid: webhook.oid,
          eventType: i.eventType,
          payload: i.payload,
          idempotencyKey: i.idempotencyKey
        }
      });

      let branchName = event.ref?.replace('refs/heads/', '');

      if (i.eventType == 'push') {
        let push = await db.scmRepositoryPush.create({
          data: {
            ...getId('scmRepositoryPush'),
            repoOid: webhook.repo.oid,
            tenantOid: webhook.repo.tenantOid,

            sha: event.after,
            branchName,

            pusherEmail: event.pusher.email,
            pusherName: event.pusher.name,

            senderIdentifier: `github.com/${event.sender.login}`,
            commitMessage: event.commits?.[0]?.message || null
          }
        });

        await createHandleRepoPushQueue.add({ pushId: push.id });
      }

      return;
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async receiveGitLabWebhookEvent(i: {
    webhookId: string;
    idempotencyKey: string;
    eventType: string;
    payload: string;
    token: string;
  }) {
    let webhook = await db.scmRepositoryWebhook.findUnique({
      where: { id: i.webhookId },
      include: { repo: { include: { installation: { include: { backend: true } } } } }
    });
    if (!webhook) {
      throw new ServiceError(badRequestError({ message: 'Invalid webhook' }));
    }

    // Verify token
    if (i.token !== webhook.signingSecret) {
      throw new ServiceError(badRequestError({ message: 'Invalid token' }));
    }

    let event = JSON.parse(i.payload) as {
      object_kind: string;
      ref: string;
      before: string;
      after: string;
      user_username: string;
      user_email: string;
      user_name: string;
      project: {
        id: number;
        name: string;
        path_with_namespace: string;
        default_branch: string;
      };
      commits: {
        id: string;
        message: string;
        timestamp: string;
        url: string;
        author: { name: string; email: string };
      }[];
    };

    if (webhook.repo.provider == 'gitlab') {
      await db.scmRepositoryWebhookReceivedEvent.create({
        data: {
          webhookOid: webhook.oid,
          eventType: i.eventType,
          payload: i.payload,
          idempotencyKey: i.idempotencyKey
        }
      });

      let branchName = event.ref?.replace('refs/heads/', '');

      if (i.eventType == 'Push Hook') {
        let hostname = new URL(webhook.repo.installation.backend.webUrl).hostname;

        let push = await db.scmRepositoryPush.create({
          data: {
            ...getId('scmRepositoryPush'),
            repoOid: webhook.repo.oid,
            tenantOid: webhook.repo.tenantOid,

            sha: event.after,
            branchName,

            pusherEmail: event.user_email,
            pusherName: event.user_name,

            senderIdentifier: `${hostname}/${event.user_username}`,
            commitMessage: event.commits?.[0]?.message || null
          }
        });

        await createHandleRepoPushQueue.add({ pushId: push.id });
      }
    }
  }

  async receiveBitbucketWebhookEvent(i: {
    webhookId: string;
    idempotencyKey: string;
    eventType: string;
    payload: string;
    signature: string;
  }) {
    let webhook = await db.scmRepositoryWebhook.findUnique({
      where: { id: i.webhookId },
      include: { repo: { include: { installation: { include: { backend: true } } } } }
    });
    if (!webhook || webhook.repo.provider !== 'bitbucket') {
      throw new ServiceError(badRequestError({ message: 'Invalid webhook' }));
    }
    if (!verifyHmacSignature(i.payload, i.signature, webhook.signingSecret)) {
      throw new ServiceError(badRequestError({ message: 'Invalid signature' }));
    }

    let event = JSON.parse(i.payload) as any;
    let isCloud = webhook.repo.installation.backend.type === 'bitbucket';
    let isPush = isCloud ? i.eventType === 'repo:push' : i.eventType === 'repo:refs_changed';
    let actor = event.actor ?? event.user ?? {};
    let hostname = new URL(webhook.repo.installation.backend.webUrl).hostname;
    let changes: any[] = isCloud ? (event.push?.changes ?? []) : (event.changes ?? []);
    let pushes: {
      id: string;
      repoOid: bigint;
      tenantOid: bigint;
      sha: string;
      branchName: string;
      pusherEmail: string | null;
      pusherName: string | null;
      senderIdentifier: string;
      commitMessage: string | null;
    }[] = [];

    if (!isPush) changes = [];
    for (let change of changes) {
      let isBranch = isCloud
        ? change?.new?.type === 'branch'
        : change?.ref?.type === 'BRANCH' || change?.refId?.startsWith('refs/heads/');
      let isDeletion = isCloud ? change?.new == null : change?.type === 'DELETE';
      if (!isBranch || isDeletion) continue;

      let branchName = isCloud
        ? change.new.name
        : (change?.ref?.displayId ?? change?.refId?.replace('refs/heads/', ''));
      let sha = isCloud ? change.new.target?.hash : change?.toHash;
      if (!branchName || !sha || /^0+$/.test(sha)) continue;

      pushes.push({
        ...getId('scmRepositoryPush'),
        repoOid: webhook.repo.oid,
        tenantOid: webhook.repo.tenantOid,
        sha,
        branchName,
        pusherEmail: actor.emailAddress ?? null,
        pusherName: actor.display_name ?? actor.displayName ?? actor.name ?? null,
        senderIdentifier: `${hostname}/${actor.nickname ?? actor.name ?? actor.slug ?? 'unknown'}`,
        commitMessage: isCloud ? (change.new.target?.message ?? null) : null
      });
    }

    let persistedPushes: { id: string }[];
    try {
      persistedPushes = await db.$transaction(async tx => {
        let receivedEvent = await tx.scmRepositoryWebhookReceivedEvent.create({
          data: {
            webhookOid: webhook.oid,
            eventType: i.eventType,
            payload: i.payload,
            idempotencyKey: i.idempotencyKey
          }
        });
        let createdPushes: { id: string }[] = [];
        for (let push of pushes) {
          createdPushes.push(
            await tx.scmRepositoryPush.create({
              data: {
                ...push,
                webhookReceivedEventOid: receivedEvent.oid
              },
              select: { id: true }
            })
          );
        }
        return createdPushes;
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      let existing = await db.scmRepositoryWebhookReceivedEvent.findUniqueOrThrow({
        where: {
          webhookOid_idempotencyKey: {
            webhookOid: webhook.oid,
            idempotencyKey: i.idempotencyKey
          }
        },
        include: {
          pushes: {
            where: { webhookDispatchedAt: null },
            select: { id: true }
          }
        }
      });
      persistedPushes = existing.pushes;
    }

    for (let push of persistedPushes) {
      await createHandleRepoPushQueue.add({ pushId: push.id }, { id: push.id });
      await db.scmRepositoryPush.update({
        where: { id: push.id },
        data: { webhookDispatchedAt: new Date() }
      });
    }
  }

  async createPushForCurrentCommitOnDefaultBranch(i: {
    repo: ScmRepository;
    branchName?: string;
  }) {
    let branch = i.branchName ?? i.repo.defaultBranch;

    if (i.repo.provider == 'github') {
      let installation = await db.scmInstallation.findUniqueOrThrow({
        where: { oid: i.repo.installationOid },
        include: { backend: true }
      });
      if (!installation.externalInstallationId) {
        throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
      }
      let octokit = await createGitHubInstallationClient(
        installation.externalInstallationId,
        installation.backend
      );

      try {
        let refRes = await octokit.request(
          'GET /repos/{owner}/{repo}/git/refs/heads/{branch}',
          {
            owner: i.repo.externalOwner,
            repo: i.repo.externalName,
            branch: branch
          }
        );

        let commitRes = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
          owner: i.repo.externalOwner,
          repo: i.repo.externalName,
          ref: refRes.data.object.sha
        });

        let push = await db.scmRepositoryPush.create({
          data: {
            ...getId('scmRepositoryPush'),
            repoOid: i.repo.oid,
            tenantOid: i.repo.tenantOid,

            sha: commitRes.data.sha,
            branchName: branch,

            pusherEmail: commitRes.data.commit.author?.email || null,
            pusherName: commitRes.data.commit.author?.name || null,

            senderIdentifier: `github.com/${commitRes.data.author?.login || 'unknown'}`,
            commitMessage: commitRes.data.commit.message
          },
          include: { repo: { include: { account: true } } }
        });

        await createHandleRepoPushQueue.add({ pushId: push.id });

        return push;
      } catch (e: any) {
        if (e.message.includes('Git Repository is empty')) {
          return null;
        }

        throw wrapScmProviderError('github', e, 'load the latest repository commit');
      }
    }

    if (i.repo.provider == 'gitlab') {
      let installation = await db.scmInstallation.findUniqueOrThrow({
        where: { oid: i.repo.installationOid },
        include: { backend: true }
      });
      let gitlab = await createGitLabClientWithInstallation(installation);

      try {
        let commits = await gitlab.Commits.all(parseInt(i.repo.externalId), {
          refName: branch,
          perPage: 1
        });

        if (!commits || commits.length === 0) {
          return null;
        }

        let commit = commits[0]!;
        let hostname = new URL(installation.backend.webUrl).hostname;

        let push = await db.scmRepositoryPush.create({
          data: {
            ...getId('scmRepositoryPush'),
            repoOid: i.repo.oid,
            tenantOid: i.repo.tenantOid,

            sha: commit.id,
            branchName: branch,

            pusherEmail: commit.author_email != null ? String(commit.author_email) : null,
            pusherName: commit.author_name != null ? String(commit.author_name) : null,

            senderIdentifier: `${hostname}/${commit.author_name != null ? String(commit.author_name) : 'unknown'}`,
            commitMessage: commit.message
          },
          include: { repo: { include: { account: true } } }
        });

        await createHandleRepoPushQueue.add({ pushId: push.id });

        return push;
      } catch (e: any) {
        if (e.message.includes('empty') || e.message.includes('404')) {
          return null;
        }

        throw wrapScmProviderError('gitlab', e, 'load the latest repository commit');
      }
    }

    if (i.repo.provider == 'bitbucket') {
      let installation = await db.scmInstallation.findUniqueOrThrow({
        where: { oid: i.repo.installationOid },
        include: { backend: true }
      });
      let client = await createBitbucketClientWithInstallation(installation);
      try {
        let sha = await client.getBranch(i.repo.externalId, branch);
        let hostname = new URL(installation.backend.webUrl).hostname;
        let push = await db.scmRepositoryPush.create({
          data: {
            ...getId('scmRepositoryPush'),
            repoOid: i.repo.oid,
            tenantOid: i.repo.tenantOid,
            sha,
            branchName: branch,
            pusherEmail: null,
            pusherName: null,
            senderIdentifier: `${hostname}/unknown`,
            commitMessage: null
          },
          include: { repo: { include: { account: true } } }
        });
        await createHandleRepoPushQueue.add({ pushId: push.id });
        return push;
      } catch (error) {
        if (getScmProviderErrorStatus(error) === 404) return null;
        throw wrapScmProviderError('bitbucket', error, 'load the latest repository commit');
      }
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }
}

export let scmRepoService = Service.create(
  'scmRepoService',
  () => new scmRepoServiceImpl()
).build();
