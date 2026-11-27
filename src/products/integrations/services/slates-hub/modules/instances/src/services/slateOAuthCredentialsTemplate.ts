import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Prisma,
  type Slate,
  type SlateOAuthCredentials,
  type SlateOAuthCredentialsTemplate,
  type SlateOAuthCredentialsTemplateStatus,
  type Tenant
} from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { getId } from '@mtsrc/slates-hub-db/id';
import { createCredentialsUpdateEventsQueue } from '../queues/instance/credentials';
import { secretService } from '@mtsrc/slates-hub-module-secrets/secret';
import { globalTenant } from '@mtsrc/slates-hub-module-tenants/tenant';

let include = { slate: true } as const;

let isUniqueViolation = (error: unknown) => (error as { code?: string }).code === 'P2002';

let normalizeFixedInput = (fixedInput: Record<string, string> | null | undefined) => {
  if (!fixedInput) return null;

  let entries = Object.entries(fixedInput)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key && value);

  return entries.length ? Object.fromEntries(entries) : null;
};

let templateFieldsForCopy = (template: SlateOAuthCredentialsTemplate) => ({
  clientId: template.clientId,
  scopes: template.scopes,
  authMethodKey: template.authMethodKey,
  fixedInput: template.fixedInput ?? undefined
});

class slateOAuthCredentialsTemplateServiceImpl {
  async listTemplates(d: {
    status?: SlateOAuthCredentialsTemplateStatus;
    slateIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateOAuthCredentialsTemplate.findMany({
            ...opts,
            where: {
              status: d.status,
              slate: d.slateIds ? { id: { in: d.slateIds } } : undefined
            },
            include
          })
      )
    );
  }

  async getTemplateById(d: { templateId: string }) {
    let template = await db.slateOAuthCredentialsTemplate.findUnique({
      where: { id: d.templateId },
      include
    });
    if (!template) throw new ServiceError(notFoundError('slate.oauth_credentials_template'));

    return template;
  }

  async createTemplate(d: {
    slate: Slate;
    name: string;
    description?: string;
    authMethodKey: string;
    fixedInput?: Record<string, string>;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }) {
    let fixedInput = normalizeFixedInput(d.fixedInput);
    await this.assertAuthMethod({
      slate: d.slate,
      authMethodKey: d.authMethodKey,
      fixedInput
    });

    let secret = await secretService.createSecret({
      tenant: globalTenant,
      purpose: 'slate_oauth_credentials',
      secretData: { clientId: d.clientId, clientSecret: d.clientSecret }
    });

    try {
      return await db.slateOAuthCredentialsTemplate.create({
        data: {
          ...getId('slateOAuthCredentialsTemplate'),
          name: d.name,
          description: d.description,
          slateOid: d.slate.oid,
          authMethodKey: d.authMethodKey,
          fixedInput: fixedInput ?? undefined,
          clientId: d.clientId,
          scopes: d.scopes,
          secretOid: secret.oid
        },
        include
      });
    } catch (error) {
      await secretService.DANGEROUSLY_deleteSecret({ secret, tenant: globalTenant });
      throw error;
    }
  }

  async updateTemplate(d: {
    template: SlateOAuthCredentialsTemplate & { slate: Slate };
    name?: string;
    description?: string | null;
    fixedInput?: Record<string, string> | null;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  }) {
    let fixedInput =
      d.fixedInput === undefined ? undefined : normalizeFixedInput(d.fixedInput);
    if (fixedInput !== undefined) {
      await this.assertAuthMethod({
        slate: d.template.slate,
        authMethodKey: d.template.authMethodKey,
        fixedInput
      });
    }

    let fieldsChanged =
      (d.name !== undefined && d.name !== d.template.name) ||
      (d.description !== undefined && d.description !== d.template.description) ||
      (d.clientId !== undefined && d.clientId !== d.template.clientId) ||
      (d.scopes !== undefined &&
        [...d.scopes].sort().join(' ') !== [...d.template.scopes].sort().join(' ')) ||
      (fixedInput !== undefined &&
        JSON.stringify(fixedInput) !== JSON.stringify(d.template.fixedInput ?? null));
    let secretChanged =
      d.clientSecret !== undefined ||
      (d.clientId !== undefined && d.clientId !== d.template.clientId);

    if (!fieldsChanged && !secretChanged) return d.template;

    let newSecret = secretChanged
      ? await secretService.createSecret({
          tenant: globalTenant,
          purpose: 'slate_oauth_credentials',
          secretData: {
            clientId: d.clientId ?? d.template.clientId,
            clientSecret:
              d.clientSecret ??
              (await this.readTemplateSecret(d.template, 'tmpl-upd')).clientSecret
          }
        })
      : null;

    let updated: SlateOAuthCredentialsTemplate & { slate: Slate };
    try {
      updated = await db.slateOAuthCredentialsTemplate.update({
        where: { oid: d.template.oid },
        data: {
          name: d.name,
          description: d.description,
          clientId: d.clientId,
          scopes: d.scopes,
          fixedInput: fixedInput === null ? Prisma.DbNull : (fixedInput ?? undefined),
          secretOid: newSecret?.oid,
          version: fieldsChanged ? { increment: 1 } : undefined,
          secretVersion: secretChanged ? { increment: 1 } : undefined
        },
        include
      });
    } catch (error) {
      if (newSecret) {
        await secretService.DANGEROUSLY_deleteSecret({
          secret: newSecret,
          tenant: globalTenant
        });
      }
      throw error;
    }

    if (newSecret) {
      await secretService.DANGEROUSLY_deleteSecret({
        secretOid: d.template.secretOid,
        tenant: globalTenant
      });
    }

    return updated;
  }

  async archiveTemplate(d: { template: SlateOAuthCredentialsTemplate }) {
    return await db.slateOAuthCredentialsTemplate.update({
      where: { oid: d.template.oid },
      data: { status: 'archived', archivedAt: new Date(), version: { increment: 1 } },
      include
    });
  }

  async restoreTemplate(d: { template: SlateOAuthCredentialsTemplate }) {
    return await db.slateOAuthCredentialsTemplate.update({
      where: { oid: d.template.oid },
      data: { status: 'active', archivedAt: null, version: { increment: 1 } },
      include
    });
  }

  async deleteTemplate(d: { template: SlateOAuthCredentialsTemplate }) {
    let inUse = await db.slateAuthConfig.count({
      where: { oauthCredentials: { templateOid: d.template.oid } }
    });

    if (inUse > 0) {
      throw new ServiceError(
        badRequestError({
          code: 'oauth_credentials_template_in_use',
          message:
            'Projects are still connected through these credentials. Archive them instead to stop new connections.'
        })
      );
    }

    let copies = await db.slateOAuthCredentials.findMany({
      where: { templateOid: d.template.oid },
      include: { tenant: true }
    });

    for (let copy of copies) {
      await this.deleteCopy(copy);
    }

    await db.slateOAuthCredentialsTemplate.delete({ where: { oid: d.template.oid } });
    await secretService.DANGEROUSLY_deleteSecret({
      secretOid: d.template.secretOid,
      tenant: globalTenant
    });
  }

  async getReplicationStatus(d: { template: SlateOAuthCredentialsTemplate }) {
    let [copies, current, inUse] = await Promise.all([
      db.slateOAuthCredentials.count({ where: { templateOid: d.template.oid } }),
      db.slateOAuthCredentials.count({
        where: {
          templateOid: d.template.oid,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion
        }
      }),
      db.slateOAuthCredentials.count({
        where: { templateOid: d.template.oid, authConfigs: { some: {} } }
      })
    ]);

    return { copies, current, stale: copies - current, inUse };
  }

  async replicateTemplate(d: {
    tenant: Tenant;
    template: SlateOAuthCredentialsTemplate;
  }): Promise<SlateOAuthCredentials | null> {
    let copy = await db.slateOAuthCredentials.findUnique({
      where: {
        tenantOid_templateOid: { tenantOid: d.tenant.oid, templateOid: d.template.oid }
      }
    });

    // Archived templates keep existing copies current (so rotated secrets still reach connected
    // projects) but are never copied into tenants that don't have them yet.
    if (!copy && d.template.status !== 'active') return null;

    if (
      copy &&
      copy.templateVersion === d.template.version &&
      copy.templateSecretVersion === d.template.secretVersion
    )
      return copy;

    if (!copy) return await this.createCopy(d);

    let secretChanged = copy.templateSecretVersion !== d.template.secretVersion;
    let newSecret = secretChanged
      ? await secretService.createSecret({
          tenant: d.tenant,
          purpose: 'slate_oauth_credentials',
          secretData: await this.readTemplateSecret(d.template, `tmpl-repl copy:${copy.id}`)
        })
      : null;

    let updated: SlateOAuthCredentials;
    try {
      updated = await db.slateOAuthCredentials.update({
        where: { oid: copy.oid },
        data: {
          ...templateFieldsForCopy(d.template),
          fixedInput: d.template.fixedInput ?? Prisma.DbNull,
          secretOid: newSecret?.oid,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion
        }
      });
    } catch (error) {
      if (newSecret) {
        await secretService.DANGEROUSLY_deleteSecret({ secret: newSecret, tenant: d.tenant });
      }
      throw error;
    }

    if (newSecret) {
      await secretService.DANGEROUSLY_deleteSecret({
        secretOid: copy.secretOid,
        tenant: d.tenant
      });
      await createCredentialsUpdateEventsQueue.add({ credentialsOid: copy.oid });
    }

    return updated;
  }

  private async createCopy(d: {
    tenant: Tenant;
    template: SlateOAuthCredentialsTemplate;
  }): Promise<SlateOAuthCredentials | null> {
    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_oauth_credentials',
      secretData: await this.readTemplateSecret(d.template, `tmpl-repl tenant:${d.tenant.id}`)
    });

    try {
      return await db.slateOAuthCredentials.create({
        data: {
          ...getId('slateOAuthCredentials'),
          ...templateFieldsForCopy(d.template),
          slateOid: d.template.slateOid,
          tenantOid: d.tenant.oid,
          secretOid: secret.oid,
          templateOid: d.template.oid,
          templateVersion: d.template.version,
          templateSecretVersion: d.template.secretVersion
        }
      });
    } catch (error) {
      await secretService.DANGEROUSLY_deleteSecret({ secret, tenant: d.tenant });

      if (isUniqueViolation(error)) return await this.replicateTemplate(d);
      throw error;
    }
  }

  private async deleteCopy(copy: SlateOAuthCredentials & { tenant: Tenant }) {
    let setups = await db.slateInstanceOAuthSetup.findMany({
      where: { oauthCredentialsOid: copy.oid },
      select: { secretOid: true }
    });

    await db.slateInstanceOAuthSetup.deleteMany({ where: { oauthCredentialsOid: copy.oid } });
    await db.slateOAuthCredentials.delete({ where: { oid: copy.oid } });

    for (let secretOid of [copy.secretOid, ...setups.map(setup => setup.secretOid)]) {
      await secretService.DANGEROUSLY_deleteSecret({ secretOid, tenant: copy.tenant });
    }
  }

  private async readTemplateSecret(template: SlateOAuthCredentialsTemplate, note: string) {
    return await secretService.DANGEROUSLY_decryptSecret({
      secretOid: template.secretOid,
      purpose: 'slate_oauth_credentials',
      tenant: globalTenant,
      note: `${note} tmpl:${template.id}`
    });
  }

  private async assertAuthMethod(d: {
    slate: Slate;
    authMethodKey: string;
    fixedInput: Record<string, string> | null;
  }) {
    if (!d.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({ message: 'Provider does not have a current version set.' })
      );
    }

    let authMethod = await db.slateAuthMethod.findFirst({
      where: {
        slateOid: d.slate.oid,
        key: d.authMethodKey,
        type: 'oauth',
        slateSpecifications: {
          some: {
            specification: { slateVersions: { some: { oid: d.slate.currentVersionOid } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!authMethod) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_auth_method',
          message: 'The provider has no OAuth auth method with this key.'
        })
      );
    }

    let properties = Object.keys(
      (authMethod.spec.inputSchema as { properties?: Record<string, unknown> } | undefined)
        ?.properties ?? {}
    );
    let unknownKeys = Object.keys(d.fixedInput ?? {}).filter(key => !properties.includes(key));

    if (unknownKeys.length) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_fixed_input',
          message: `The auth method does not accept these setup fields: ${unknownKeys.join(', ')}`
        })
      );
    }
  }
}

export let slateOAuthCredentialsTemplateService = Service.create(
  'slateOAuthCredentialsTemplateService',
  () => new slateOAuthCredentialsTemplateServiceImpl()
).build();
