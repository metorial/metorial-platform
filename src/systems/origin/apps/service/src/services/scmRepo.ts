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
import { createGitHubInstallationClient } from '../lib/githubApp';
import { createGitLabClientWithToken } from '../lib/gitlab';
import { createRepoWebhookQueue } from '../queues/scm/createRepoWebhook';
import { createHandleRepoPushQueue } from '../queues/scm/handleRepoPush';
import type { ScmAccountPreview, ScmRepoPreview } from '../types';

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
      if (!i.installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(
        i.installation.accessToken,
        i.installation.backend
      );

      // Get user's groups/namespaces
      let groups = await gitlab.Groups.all({ minAccessLevel: 10, perPage: 100 });
      let user = await gitlab.Users.showCurrentUser();

      return [
        {
          provider: i.installation.provider,
          externalId: user.id.toString(),
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
        let response = await octokit.request('GET /installation/repositories', {
          per_page: 100,
          page
        });

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
      if (!i.installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(
        i.installation.accessToken,
        i.installation.backend
      );

      let allProjects: any[] = [];

      // If external account ID matches user ID, list user's projects; otherwise list group projects
      if (i.externalAccountId == i.installation.externalAccountId) {
        allProjects = await gitlab.Projects.all({ membership: true, perPage: 100 });
      } else {
        // List projects for a specific group
        let groupId = parseInt(i.externalAccountId!);
        allProjects = await gitlab.Groups.allProjects(groupId, { perPage: 100 });
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
        throw error;
      }
    }

    if (i.installation.provider == 'gitlab') {
      if (!i.installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(
        i.installation.accessToken,
        i.installation.backend
      );

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
        throw error;
      }
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
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

      let repoRes = await octokit.request('GET /repositories/{repository_id}', {
        repository_id: parseInt(i.externalId)
      });

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

    if (i.installation.provider == 'gitlab') {
      if (!i.installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(
        i.installation.accessToken,
        i.installation.backend
      );

      let project = await gitlab.Projects.show(parseInt(i.externalId));

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
        name: project.name,
        identifier: `${hostname}/${project.path_with_namespace}`,
        provider: i.installation.provider,
        externalId: project.id.toString(),
        tenantOid: i.installation.tenantOid,
        backendOid: i.installation.backendOid,
        accountOid: account.oid,
        installationOid: i.installation.oid,
        externalIsPrivate: project.visibility === 'private',
        externalName: project.path,
        defaultBranch: project.default_branch,
        externalOwner: project.namespace.path,
        externalUrl: project.web_url
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
        throw error;
      }

      return await this.linkRepository({
        installation: i.installation,
        externalId: repoRes.data.id.toString()
      });
    }

    if (i.installation.provider == 'gitlab') {
      if (!i.installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(
        i.installation.accessToken,
        i.installation.backend
      );

      // Always pass namespaceId to create in the correct namespace (user or group)
      let projectRes = await gitlab.Projects.create({
        name: i.name,
        description: i.description,
        visibility: i.isPrivate ? 'private' : 'public',
        namespaceId: parseInt(i.externalAccountId)
      });

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

    if (pathParts.length < 2) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid repository URL format. Expected: https://provider.com/owner/repo'
        })
      );
    }

    let ownerName = pathParts[0];
    let repoName = pathParts[1]?.replace(/\.git$/, '');

    if (!ownerName || !repoName) {
      throw new ServiceError(
        badRequestError({ message: 'Could not parse repository owner and name from URL' })
      );
    }

    // Determine provider from hostname
    let provider: 'github' | 'gitlab';
    if (hostname === 'github.com' || hostname.includes('github')) {
      provider = 'github';
    } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
      provider = 'gitlab';
    } else {
      throw new ServiceError(
        badRequestError({
          message: 'Unsupported repository provider. Only GitHub and GitLab are supported.'
        })
      );
    }

    // Find all installations for this tenant, actor, and provider
    let installations = await db.scmInstallation.findMany({
      where: {
        tenantOid: i.tenant.oid,
        ownerActorOid: i.actor.oid,
        provider
      },
      include: {
        backend: true
      }
    });

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

    let hmac = crypto.createHmac('sha256', webhook.signingSecret);
    let digest = 'sha256=' + hmac.update(i.payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(i.signature), Buffer.from(digest))) {
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

        throw e;
      }
    }

    if (i.repo.provider == 'gitlab') {
      let installation = await db.scmInstallation.findUniqueOrThrow({
        where: { oid: i.repo.installationOid },
        include: { backend: true }
      });
      if (!installation.accessToken) {
        throw new ServiceError(badRequestError({ message: 'Access token not found' }));
      }
      let gitlab = createGitLabClientWithToken(installation.accessToken, installation.backend);

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

            pusherEmail: commit.author_email || null,
            pusherName: commit.author_name || null,

            senderIdentifier: `${hostname}/${commit.author_name}`,
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

        throw e;
      }
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }
}

export let scmRepoService = Service.create(
  'scmRepoService',
  () => new scmRepoServiceImpl()
).build();
