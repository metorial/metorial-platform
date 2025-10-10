import { db, ID, Organization, ScmInstallation } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Octokit } from '@octokit/core';
import { ScmAccountPreview, ScmRepoPreview } from '../types';

class scmRepoServiceImpl {
  async listAccountPreviews(i: { installation: ScmInstallation }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

      let orgs = await octokit.request('GET /user/orgs', {
        per_page: 100
      });

      let user = await octokit.request('GET /user');

      return [
        {
          provider: i.installation.provider,
          externalId: user.data.id.toString(),
          name: user.data.login,
          identifier: `github.com/${user.data.login}`
        } satisfies ScmAccountPreview,
        ...orgs.data.map(
          o =>
            ({
              provider: i.installation.provider,
              externalId: o.id.toString(),
              name: o.login,
              identifier: `github.com/${o.login}`
            }) satisfies ScmAccountPreview
        )
      ];
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async listRepositoryPreviews(i: {
    installation: ScmInstallation;
    externalAccountId?: string;
  }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

      let allRepos: any[] = [];
      let page = 1;

      while (true) {
        let currentRepos =
          i.externalAccountId == i.installation.externalUserId
            ? await octokit.request('GET /user/repos', {
                per_page: 100,
                page,
                visibility: 'all',
                affiliation: 'owner'
              })
            : await octokit.request('GET /orgs/{org}/repos', {
                org: i.externalAccountId!,
                page,
                per_page: 100
              });

        allRepos.push(...currentRepos.data);

        if (currentRepos.data.length < 100) break;
        page++;
      }

      return allRepos.map(
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
              externalId: i.externalAccountId!,
              name: r.owner.login,
              identifier: `github.com/${r.owner.login}`,
              provider: i.installation.provider
            }
          }) satisfies ScmRepoPreview
      );
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async linkRepository(i: { installation: ScmInstallation; externalId: string }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

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
          organizationOid_provider_externalId: {
            organizationOid: i.installation.organizationOid,
            provider: i.installation.provider,
            externalId: repoRes.data.owner.id.toString()
          }
        },
        update: accountData,
        create: {
          id: await ID.generateId('scmAccount'),
          organizationOid: i.installation.organizationOid,
          ...accountData
        }
      });

      let repoData = {
        name: repoRes.data.name,
        identifier: `github.com/${repoRes.data.full_name}`,
        provider: i.installation.provider,
        externalId: repoRes.data.id.toString(),
        organizationOid: i.installation.organizationOid,
        accountOid: account.oid,
        installationOid: i.installation.oid,
        externalIsPrivate: repoRes.data.private,
        externalName: repoRes.data.name,
        defaultBranch: repoRes.data.default_branch,
        externalOwner: repoRes.data.owner.login,
        externalUrl: repoRes.data.html_url
      };

      let repo = await db.scmRepo.upsert({
        where: {
          organizationOid_provider_externalId: {
            organizationOid: i.installation.organizationOid,
            provider: i.installation.provider,
            externalId: i.externalId
          }
        },
        update: repoData,
        create: {
          id: await ID.generateId('scmRepo'),
          ...repoData
        },
        include: {
          account: true
        }
      });

      return repo;
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async createRepository(i: {
    installation: ScmInstallation;
    externalAccountId: string;
    name: string;
    description?: string;
    isPrivate: boolean;
  }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

      let repoRes =
        i.externalAccountId == i.installation.externalUserId
          ? await octokit.request('POST /user/repos', {
              name: i.name,
              description: i.description,
              private: i.isPrivate
            })
          : await octokit.request('POST /orgs/{org}/repos', {
              org: i.externalAccountId,
              name: i.name,
              description: i.description,
              private: i.isPrivate
            });

      return await this.linkRepository({
        installation: i.installation,
        externalId: repoRes.data.id.toString()
      });
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async getScmRepoById(i: { organization: Organization; scmRepoId: string }) {
    let repo = await db.scmRepo.findFirst({
      where: {
        organizationOid: i.organization.oid,
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
}

export let scmRepoService = Service.create(
  'scmRepoService',
  () => new scmRepoServiceImpl()
).build();
