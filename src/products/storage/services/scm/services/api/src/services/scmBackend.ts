import { getAllowedScmBackendIds } from '../lib/scmPolicy';
import { checkEdition } from '@metorial/editions';
import {
  assertScmBackendAllowed,
  assertScmTypeAllowed,
  isScmBackendAllowed,
  normalizeScmBackendUrls
} from '../lib/scmPolicy';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { ScmBackend, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env, SCM_GITHUB_APP_PRIVATE_KEY } from '../env';
import { getId } from '../id';
import {
  discardBackendSecrets,
  discardNebulaSecrets,
  writeBackendSecrets
} from '../lib/scmCredentials';
import { assertScmBackendUrlsValid } from '../lib/scmFetch';

class scmBackendServiceImpl {
  async ensureDefaultBackends() {
    if (checkEdition('on-prem')) return;

    // Ensure default GitHub.com backend exists (if credentials provided)
    if (
      env.gh.SCM_GITHUB_APP_ID &&
      env.gh.SCM_GITHUB_APP_SLUG &&
      SCM_GITHUB_APP_PRIVATE_KEY &&
      env.gh.SCM_GITHUB_APP_CLIENT_ID &&
      env.gh.SCM_GITHUB_APP_CLIENT_SECRET
    ) {
      await db.scmBackend.upsert({
        where: {
          defaultIdentifier: 'default::github_com'
        },
        create: {
          ...getId('scmBackend'),
          defaultIdentifier: 'default::github_com',
          type: 'github',
          name: 'GitHub',
          description: 'GitHub.com',
          apiUrl: 'https://api.github.com',
          webUrl: 'https://github.com',
          appId: env.gh.SCM_GITHUB_APP_ID,
          appSlug: env.gh.SCM_GITHUB_APP_SLUG,
          appPrivateKey: SCM_GITHUB_APP_PRIVATE_KEY,
          clientId: env.gh.SCM_GITHUB_APP_CLIENT_ID,
          clientSecret: env.gh.SCM_GITHUB_APP_CLIENT_SECRET,
          isDefault: true
        },
        update: {
          appId: env.gh.SCM_GITHUB_APP_ID,
          appSlug: env.gh.SCM_GITHUB_APP_SLUG,
          appPrivateKey: SCM_GITHUB_APP_PRIVATE_KEY,
          clientId: env.gh.SCM_GITHUB_APP_CLIENT_ID,
          clientSecret: env.gh.SCM_GITHUB_APP_CLIENT_SECRET
        }
      });
    }

    // Ensure default GitLab.com backend exists (if credentials provided)
    if (env.gl.SCM_GITLAB_CLIENT_ID && env.gl.SCM_GITLAB_CLIENT_SECRET) {
      await db.scmBackend.upsert({
        where: {
          defaultIdentifier: 'default::gitlab_com'
        },
        create: {
          ...getId('scmBackend'),
          defaultIdentifier: 'default::gitlab_com',
          type: 'gitlab',
          name: 'GitLab',
          description: 'GitLab.com',
          apiUrl: 'https://gitlab.com/api/v4',
          webUrl: 'https://gitlab.com',
          clientId: env.gl.SCM_GITLAB_CLIENT_ID,
          clientSecret: env.gl.SCM_GITLAB_CLIENT_SECRET,
          isDefault: true
        },
        update: {
          clientId: env.gl.SCM_GITLAB_CLIENT_ID,
          clientSecret: env.gl.SCM_GITLAB_CLIENT_SECRET
        }
      });
    }

    if (env.bb.SCM_BITBUCKET_CLIENT_ID && env.bb.SCM_BITBUCKET_CLIENT_SECRET) {
      await db.scmBackend.upsert({
        where: { defaultIdentifier: 'default::bitbucket_cloud' },
        create: {
          ...getId('scmBackend'),
          defaultIdentifier: 'default::bitbucket_cloud',
          type: 'bitbucket',
          name: 'Bitbucket',
          description: 'Bitbucket Cloud',
          apiUrl: 'https://api.bitbucket.org/2.0',
          webUrl: 'https://bitbucket.org',
          clientId: env.bb.SCM_BITBUCKET_CLIENT_ID,
          clientSecret: env.bb.SCM_BITBUCKET_CLIENT_SECRET,
          isDefault: true
        },
        update: {
          clientId: env.bb.SCM_BITBUCKET_CLIENT_ID,
          clientSecret: env.bb.SCM_BITBUCKET_CLIENT_SECRET
        }
      });
    }
  }

  async getDefaultGithubBackend(): Promise<ScmBackend> {
    await this.ensureDefaultBackends();

    let backend = await db.scmBackend.findFirst({
      where: {
        type: 'github',
        apiUrl: 'https://api.github.com',
        isDefault: true
      }
    });

    if (!backend) {
      throw new ServiceError(notFoundError('scm_backend'));
    }

    assertScmBackendAllowed(backend);

    return backend;
  }

  async getScmBackendById(d: { tenant: Tenant; backendId: string }) {
    let backend = await db.scmBackend.findFirst({
      where: {
        id: d.backendId,
        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      }
    });

    if (!backend) {
      throw new ServiceError(notFoundError('scm_backend'));
    }

    assertScmBackendAllowed(backend);

    return backend;
  }

  async listScmBackends(d: { tenant: Tenant }) {
    let allowed = await getAllowedScmBackendIds(d.tenant.oid);
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmBackend.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
              oid: allowed ? { in: allowed } : undefined
            }
          })
      )
    );
  }

  async createScmBackend(d: {
    tenant: Tenant;
    type: ScmBackend['type'];
    name: string;
    description?: string;
    apiUrl: string;
    webUrl: string;
    appId?: string;
    appSlug?: string;
    appPrivateKey?: string;
    appWebhookSecret?: string;
    clientId: string;
    clientSecret: string;
  }) {
    if (checkEdition('on-prem')) {
      assertScmTypeAllowed(d.type);
      let urls = normalizeScmBackendUrls(d.type, d.webUrl);
      d = { ...d, ...urls };
      assertScmBackendAllowed({
        ...urls,
        type: d.type,
        isDefault: false,
        tenantOid: d.tenant.oid
      });
    }

    try {
      new URL(d.apiUrl);
      new URL(d.webUrl);
    } catch {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid URL format'
        })
      );
    }

    assertScmBackendUrlsValid(d.apiUrl, d.webUrl);

    if (
      (d.type === 'github_enterprise' || (checkEdition('on-prem') && d.type === 'github')) &&
      (!d.appId || !d.appSlug || !d.appPrivateKey)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'GitHub Enterprise backends require appId, appSlug, and appPrivateKey'
        })
      );
    }

    let ids = getId('scmBackend');
    let secrets = await writeBackendSecrets({
      backend: {
        id: ids.id,
        tenantOid: d.tenant.oid,
        clientSecret: null,
        clientSecretNebulaSecretId: null,
        appPrivateKey: null,
        appPrivateKeyNebulaSecretId: null,
        appWebhookSecret: null,
        appWebhookSecretNebulaSecretId: null
      },
      secrets: {
        clientSecret: d.clientSecret,
        appPrivateKey: d.appPrivateKey,
        ...(checkEdition('on-prem') && d.appWebhookSecret !== undefined
          ? { appWebhookSecret: d.appWebhookSecret }
          : {})
      }
    });

    try {
      return await db.scmBackend.create({
        data: {
          ...ids,
          tenantOid: d.tenant.oid,
          type: d.type,
          name: d.name,
          description: d.description,
          apiUrl: d.apiUrl,
          webUrl: d.webUrl,
          appId: d.appId,
          appSlug: d.appSlug,
          clientId: d.clientId,
          isDefault: false,
          ...secrets.patch
        }
      });
    } catch (error) {
      await discardNebulaSecrets({
        tenantOid: d.tenant.oid,
        nebulaSecretIds: secrets.createdNebulaSecretIds
      });

      throw error;
    }
  }

  async updateScmBackend(d: {
    backend: ScmBackend;
    name?: string;
    description?: string;
    appId?: string;
    appSlug?: string;
    appPrivateKey?: string;
    appWebhookSecret?: string;
    clientId?: string;
    clientSecret?: string;
  }) {
    assertScmBackendAllowed(d.backend);

    if (d.backend.isDefault) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update default backend'
        })
      );
    }

    let secrets = await writeBackendSecrets({
      backend: d.backend,
      secrets: {
        clientSecret: d.clientSecret,
        appPrivateKey: d.appPrivateKey,
        ...(checkEdition('on-prem') && d.appWebhookSecret !== undefined
          ? { appWebhookSecret: d.appWebhookSecret }
          : {})
      }
    });

    try {
      return await db.scmBackend.update({
        where: { oid: d.backend.oid },
        data: {
          name: d.name,
          description: d.description,
          appId: d.appId,
          appSlug: d.appSlug,
          clientId: d.clientId,
          ...secrets.patch
        }
      });
    } catch (error) {
      await discardNebulaSecrets({
        tenantOid: d.backend.tenantOid,
        nebulaSecretIds: secrets.createdNebulaSecretIds
      });

      throw error;
    }
  }

  async deleteScmBackend(d: { backend: ScmBackend }) {
    assertScmBackendAllowed(d.backend);

    if (d.backend.isDefault) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete default backend'
        })
      );
    }

    await db.scmBackend.delete({
      where: { oid: d.backend.oid }
    });

    await discardBackendSecrets(d.backend);
  }
}

export let scmBackendService = Service.create(
  'scmBackendService',
  () => new scmBackendServiceImpl()
).build();
