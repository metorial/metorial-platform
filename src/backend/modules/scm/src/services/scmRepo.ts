import { db, ID, ScmInstallation } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Octokit } from '@octokit/core';
import { ScmAccountPreview, ScmRepoPreview } from '../types';

class scmRepoServiceImpl {
  async listAccountPreviews(i: { installation: ScmInstallation; search?: string }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

      let orgs = await octokit.request('GET /user/orgs', {
        per_page: 100,
        query: i.search
      });

      return orgs.data.map(
        o =>
          ({
            provider: i.installation.provider,
            externalId: o.id.toString(),
            name: o.login,
            identifier: `github.com/${o.login}`
          }) satisfies ScmAccountPreview
      );
    }

    throw new ServiceError(badRequestError({ message: 'Unsupported provider' }));
  }

  async listRepositoryPreviews(i: {
    installation: ScmInstallation;
    search?: string;
    externalAccountId?: string;
  }) {
    if (i.installation.provider == 'github') {
      let octokit = new Octokit({ auth: i.installation.accessToken });

      let repo = await octokit.request('GET /orgs/{org}/repos', {
        org: i.externalAccountId!,
        per_page: 100,
        query: i.search
      });

      return repo.data.map(
        r =>
          ({
            provider: i.installation.provider,
            name: r.name,
            identifier: `github.com/${r.full_name}`,
            externalId: r.id.toString(),
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
        installationOid: i.installation.oid
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
}

export let scmRepoService = Service.create(
  'scmRepoService',
  () => new scmRepoServiceImpl()
).build();
