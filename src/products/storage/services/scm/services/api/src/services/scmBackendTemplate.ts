import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  ScmBackend,
  ScmBackendTemplate,
  ScmBackendTemplateStatus,
  ScmBackendType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import {
  type BackendSecretField,
  discardBackendSecrets,
  discardNebulaSecrets,
  discardTemplateSecrets,
  hasTemplateSecret,
  readTemplateSecret,
  templateSecretPointers,
  writeBackendSecrets,
  writeTemplateSecrets
} from '../lib/scmCredentials';
import {
  assertScmProviderAllowed,
  assertScmTypeAllowed,
  normalizeScmBackendUrls
} from '../lib/scmPolicy';

let secretFields: BackendSecretField[] = ['clientSecret', 'appPrivateKey', 'appWebhookSecret'];

let gitHubTypes: ScmBackendType[] = ['github', 'github_enterprise'];

let isUniqueViolation = (error: unknown) => (error as { code?: string }).code === 'P2002';

let templateFieldsForCopy = (template: ScmBackendTemplate) => ({
  type: template.type,
  name: template.name,
  description: template.description,
  apiUrl: template.apiUrl,
  webUrl: template.webUrl,
  appId: template.appId,
  appSlug: template.appSlug,
  clientId: template.clientId
});

class scmBackendTemplateServiceImpl {
  async listTemplates(d: { status?: ScmBackendTemplateStatus }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmBackendTemplate.findMany({
            ...opts,
            where: { status: d.status }
          })
      )
    );
  }

  async getTemplateById(d: { templateId: string }) {
    let template = await db.scmBackendTemplate.findUnique({ where: { id: d.templateId } });
    if (!template) throw new ServiceError(notFoundError('scm_backend_template'));

    return template;
  }

  async createTemplate(d: {
    type: ScmBackendType;
    name: string;
    description?: string;
    webUrl: string;
    appId?: string;
    appSlug?: string;
    appPrivateKey?: string;
    appWebhookSecret?: string;
    clientId: string;
    clientSecret: string;
  }) {
    assertScmTypeAllowed(d.type);
    let urls = normalizeScmBackendUrls(d.type, d.webUrl);
    assertScmProviderAllowed({ type: d.type, ...urls });

    if (gitHubTypes.includes(d.type) && (!d.appId || !d.appSlug || !d.appPrivateKey)) {
      throw new ServiceError(
        badRequestError({
          message: 'GitHub providers require an app ID, app slug and app private key'
        })
      );
    }

    let ids = getId('scmBackendTemplate');
    let secrets = await writeTemplateSecrets({
      template: {
        id: ids.id,
        clientSecretNebulaSecretId: null,
        appPrivateKeyNebulaSecretId: null,
        appWebhookSecretNebulaSecretId: null
      },
      secrets: {
        clientSecret: d.clientSecret,
        appPrivateKey: d.appPrivateKey,
        appWebhookSecret: d.appWebhookSecret
      }
    });

    try {
      return await db.scmBackendTemplate.create({
        data: {
          ...ids,
          ...urls,
          type: d.type,
          name: d.name,
          description: d.description,
          appId: d.appId,
          appSlug: d.appSlug,
          clientId: d.clientId,
          ...secrets.patch
        }
      });
    } catch (error) {
      await discardTemplateSecrets(secrets.createdNebulaSecretIds);
      throw error;
    }
  }

  async updateTemplate(d: {
    template: ScmBackendTemplate;
    name?: string;
    description?: string | null;
    appId?: string;
    appSlug?: string;
    clientId?: string;
    clientSecret?: string;
    appPrivateKey?: string;
    appWebhookSecret?: string;
  }) {
    let fields = {
      name: d.name,
      description: d.description,
      appId: d.appId,
      appSlug: d.appSlug,
      clientId: d.clientId
    };
    let fieldsChanged = Object.entries(fields).some(
      ([key, value]) => value !== undefined && value !== d.template[key as keyof typeof fields]
    );
    let secretsChanged = [d.clientSecret, d.appPrivateKey, d.appWebhookSecret].some(
      value => value !== undefined
    );

    if (!fieldsChanged && !secretsChanged) return d.template;

    let secrets = await writeTemplateSecrets({
      template: d.template,
      secrets: {
        clientSecret: d.clientSecret,
        appPrivateKey: d.appPrivateKey,
        appWebhookSecret: d.appWebhookSecret
      }
    });

    try {
      return await db.scmBackendTemplate.update({
        where: { oid: d.template.oid },
        data: {
          ...fields,
          ...secrets.patch,
          version: fieldsChanged ? { increment: 1 } : undefined,
          secretVersion: secretsChanged ? { increment: 1 } : undefined
        }
      });
    } catch (error) {
      await discardTemplateSecrets(secrets.createdNebulaSecretIds);
      throw error;
    }
  }

  async archiveTemplate(d: { template: ScmBackendTemplate }) {
    return await db.scmBackendTemplate.update({
      where: { oid: d.template.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });
  }

  async restoreTemplate(d: { template: ScmBackendTemplate }) {
    return await db.scmBackendTemplate.update({
      where: { oid: d.template.oid },
      data: { status: 'active', archivedAt: null }
    });
  }

  async deleteTemplate(d: { template: ScmBackendTemplate }) {
    let installations = await db.scmInstallation.count({
      where: { backend: { templateOid: d.template.oid } }
    });

    if (installations > 0) {
      throw new ServiceError(
        badRequestError({
          message:
            'Projects are still connected through this provider. Archive it instead to stop new connections.'
        })
      );
    }

    let copies = await db.scmBackend.findMany({ where: { templateOid: d.template.oid } });

    for (let copy of copies) {
      await db.scmBackend.delete({ where: { oid: copy.oid } });
      await discardBackendSecrets(copy);
    }

    await db.scmBackendTemplate.delete({ where: { oid: d.template.oid } });
    await discardTemplateSecrets(templateSecretPointers(d.template));
  }

  async getReplicationStatus(d: { template: ScmBackendTemplate }) {
    let [copies, current, installations] = await Promise.all([
      db.scmBackend.count({ where: { templateOid: d.template.oid } }),
      db.scmBackend.count({
        where: {
          templateOid: d.template.oid,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion
        }
      }),
      db.scmInstallation.count({ where: { backend: { templateOid: d.template.oid } } })
    ]);

    return { copies, current, stale: copies - current, installations };
  }

  async replicateTemplate(d: {
    tenant: Tenant;
    template: ScmBackendTemplate;
  }): Promise<ScmBackend | null> {
    let copy = await db.scmBackend.findUnique({
      where: {
        tenantOid_templateOid: { tenantOid: d.tenant.oid, templateOid: d.template.oid }
      }
    });

    // Archived templates keep their existing copies up to date (so rotated secrets still reach
    // connected projects) but are never copied into projects that don't have them yet.
    if (!copy && d.template.status !== 'active') return null;

    if (
      copy &&
      copy.templateVersion === d.template.version &&
      copy.templateSecretVersion === d.template.secretVersion
    )
      return copy;

    if (!copy) return await this.createCopy(d);

    let needsSecrets = copy.templateSecretVersion !== d.template.secretVersion;
    let secrets = needsSecrets
      ? await writeBackendSecrets({
          backend: copy,
          secrets: await this.readTemplateSecretValues(d.template)
        })
      : { patch: {}, createdNebulaSecretIds: [] };

    try {
      return await db.scmBackend.update({
        where: { oid: copy.oid },
        data: {
          ...templateFieldsForCopy(d.template),
          ...secrets.patch,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion
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

  private async createCopy(d: { tenant: Tenant; template: ScmBackendTemplate }) {
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
      secrets: await this.readTemplateSecretValues(d.template)
    });

    try {
      return await db.scmBackend.create({
        data: {
          ...ids,
          ...templateFieldsForCopy(d.template),
          ...secrets.patch,
          tenantOid: d.tenant.oid,
          templateOid: d.template.oid,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion,
          isDefault: false
        }
      });
    } catch (error) {
      await discardNebulaSecrets({
        tenantOid: d.tenant.oid,
        nebulaSecretIds: secrets.createdNebulaSecretIds
      });

      if (isUniqueViolation(error)) return await this.replicateTemplate(d);
      throw error;
    }
  }

  private async readTemplateSecretValues(template: ScmBackendTemplate) {
    let values: { [Field in BackendSecretField]?: string } = {};

    for (let field of secretFields) {
      if (!hasTemplateSecret(template, field)) continue;

      let value = await readTemplateSecret(template, field, 'origin:scm-template:replicate');
      if (value) values[field] = value;
    }

    return values;
  }
}

export let scmBackendTemplateService = Service.create(
  'scmBackendTemplateService',
  () => new scmBackendTemplateServiceImpl()
).build();
