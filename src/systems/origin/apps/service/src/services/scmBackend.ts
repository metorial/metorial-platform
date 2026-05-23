import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { ScmBackend, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env, SCM_GITHUB_APP_PRIVATE_KEY } from '../env';
import { getId } from '../id';

class scmBackendServiceImpl {
  async ensureDefaultBackends() {
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

    return backend;
  }

  async listScmBackends(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmBackend.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            }
          })
      )
    );
  }

  async createScmBackend(d: {
    tenant: Tenant;
    type: 'github_enterprise' | 'gitlab_selfhosted';
    name: string;
    description?: string;
    apiUrl: string;
    webUrl: string;
    appId?: string;
    appSlug?: string;
    appPrivateKey?: string;
    clientId: string;
    clientSecret: string;
  }) {
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

    if (d.type === 'github_enterprise' && (!d.appId || !d.appSlug || !d.appPrivateKey)) {
      throw new ServiceError(
        badRequestError({
          message: 'GitHub Enterprise backends require appId, appSlug, and appPrivateKey'
        })
      );
    }

    return db.scmBackend.create({
      data: {
        ...getId('scmBackend'),
        tenantOid: d.tenant.oid,
        type: d.type,
        name: d.name,
        description: d.description,
        apiUrl: d.apiUrl,
        webUrl: d.webUrl,
        appId: d.appId,
        appSlug: d.appSlug,
        appPrivateKey: d.appPrivateKey,
        clientId: d.clientId,
        clientSecret: d.clientSecret,
        isDefault: false
      }
    });
  }

  async updateScmBackend(d: {
    backend: ScmBackend;
    name?: string;
    description?: string;
    appId?: string;
    appSlug?: string;
    appPrivateKey?: string;
    clientId?: string;
    clientSecret?: string;
  }) {
    if (d.backend.isDefault) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update default backend'
        })
      );
    }

    return db.scmBackend.update({
      where: { oid: d.backend.oid },
      data: {
        name: d.name,
        description: d.description,
        appId: d.appId,
        appSlug: d.appSlug,
        appPrivateKey: d.appPrivateKey,
        clientId: d.clientId,
        clientSecret: d.clientSecret
      }
    });
  }

  async deleteScmBackend(d: { backend: ScmBackend }) {
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
  }
}

export let scmBackendService = Service.create(
  'scmBackendService',
  () => new scmBackendServiceImpl()
).build();
