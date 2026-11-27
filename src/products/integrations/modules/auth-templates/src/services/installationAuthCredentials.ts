import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Tenant } from '@metorial-subspace/db';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import { getTenantForSlates, slatesClient } from '@metorial-subspace/provider-slates';

let PROVIDER_SEARCH_LIMIT = 50;

type HubTemplate = Awaited<ReturnType<typeof slatesClient.slateOAuthCredentialsTemplate.get>>;

let providerInclude = { defaultVariant: { include: { slate: true } } } as const;

let publicProviderWhere = { access: 'public' as const };

let findProviderForSlate = async (slateId: string) =>
  await db.provider.findFirst({
    where: { ...publicProviderWhere, defaultVariant: { slate: { id: slateId } } },
    include: providerInclude,
    orderBy: { createdAt: 'asc' }
  });

let presentProvider = (provider: { id: string; name: string; slug: string } | null) =>
  provider ? { id: provider.id, name: provider.name, slug: provider.slug } : null;

class installationAuthCredentialsServiceImpl {
  async listEligibleProviders(d: { search?: string }) {
    let search = d.search?.trim();

    let providers = await db.provider.findMany({
      where: {
        ...publicProviderWhere,
        status: 'active',
        isDisabled: false,
        defaultVariant: { slateOid: { not: null } },
        authMethods: { some: { type: 'oauth' } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { slug: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          : {})
      },
      include: { defaultVariant: { include: { currentVersion: true } } },
      orderBy: { name: 'asc' },
      take: PROVIDER_SEARCH_LIMIT
    });

    let specificationOids = providers
      .map(provider => provider.defaultVariant?.currentVersion?.specificationOid)
      .filter((oid): oid is bigint => oid != null);

    let authMethods = await db.providerAuthMethod.findMany({
      where: {
        type: 'oauth',
        providerOid: { in: providers.map(provider => provider.oid) },
        specificationOid: { in: specificationOids }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });

    return providers
      .map(provider => ({
        ...presentProvider(provider)!,
        description: provider.description,
        authMethods: authMethods
          .filter(
            method =>
              method.providerOid === provider.oid &&
              method.specificationOid ===
                provider.defaultVariant?.currentVersion?.specificationOid
          )
          .map(method => ({
            key: method.key,
            name: method.name,
            description: method.description,
            inputJsonSchema: method.value.inputJsonSchema,
            scopes: method.value.scopes ?? []
          }))
      }))
      .filter(provider => provider.authMethods.length);
  }

  async listTemplates(d: {
    status?: 'active' | 'archived';
    limit?: number;
    after?: string;
    before?: string;
  }) {
    let list = await slatesClient.slateOAuthCredentialsTemplate.list({
      status: d.status,
      limit: d.limit,
      after: d.after,
      before: d.before,
      order: 'asc'
    });

    return { ...list, items: await this.withProviders(list.items) };
  }

  async getTemplate(d: { templateId: string }) {
    let template = await slatesClient.slateOAuthCredentialsTemplate.get({
      templateId: d.templateId
    });

    let [withProvider] = await this.withProviders([template]);
    return withProvider!;
  }

  async createTemplate(d: {
    providerId: string;
    authMethodKey: string;
    name: string;
    description?: string;
    fixedInput?: Record<string, string>;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }) {
    let provider = await db.provider.findFirst({
      where: { ...publicProviderWhere, id: d.providerId },
      include: providerInclude
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.providerId));

    let slate = provider.defaultVariant?.slate;
    if (!slate) {
      throw new ServiceError(
        badRequestError({
          message: 'This provider does not support centrally managed credentials',
          code: 'provider_not_supported'
        })
      );
    }

    let template = await slatesClient.slateOAuthCredentialsTemplate.create({
      slateId: slate.id,
      authMethodKey: d.authMethodKey,
      name: d.name,
      description: d.description,
      fixedInput: d.fixedInput,
      clientId: d.clientId,
      clientSecret: d.clientSecret,
      scopes: d.scopes
    });

    return { ...template, provider: presentProvider(provider) };
  }

  async updateTemplate(d: {
    templateId: string;
    name?: string;
    description?: string | null;
    fixedInput?: Record<string, string> | null;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  }) {
    let template = await slatesClient.slateOAuthCredentialsTemplate.update(d);

    let [withProvider] = await this.withProviders([template]);
    return withProvider!;
  }

  async archiveTemplate(d: { templateId: string }) {
    let template = await slatesClient.slateOAuthCredentialsTemplate.archive(d);

    let [withProvider] = await this.withProviders([template]);
    return withProvider!;
  }

  async restoreTemplate(d: { templateId: string }) {
    let template = await slatesClient.slateOAuthCredentialsTemplate.restore(d);

    let [withProvider] = await this.withProviders([template]);
    return withProvider!;
  }

  async deleteTemplate(d: { templateId: string }) {
    let inUse =
      await providerAuthCredentialsService.countInstallationTemplateCopiesInUseInternal({
        templateId: d.templateId
      });
    if (inUse > 0) {
      throw new ServiceError(
        badRequestError({
          message: `These credentials are used by ${inUse} connection${inUse == 1 ? '' : 's'}. Archive them instead, or remove those connections first.`,
          code: 'auth_credentials_template_in_use'
        })
      );
    }

    await slatesClient.slateOAuthCredentialsTemplate.delete(d);
    await providerAuthCredentialsService.deleteInstallationTemplateCopiesInternal(d);
  }

  async getReplicationStatus(d: { templateId: string }) {
    return await slatesClient.slateOAuthCredentialsTemplate.getReplicationStatus(d);
  }

  async replicate(d: { tenant: Tenant; templateId: string }) {
    let slatesTenant = await getTenantForSlates(d.tenant);

    let { template, copy } = await slatesClient.slateOAuthCredentialsTemplate.replicate({
      tenantId: slatesTenant.id,
      templateId: d.templateId
    });
    if (!copy) return null;

    let provider = await findProviderForSlate(template.slateId);
    let slateOid = provider?.defaultVariant?.slateOid;
    if (!provider || slateOid == null) return null;

    let fixedInput = template.fixedInput as Record<string, string>;

    return await providerAuthCredentialsService.upsertInstallationTemplateCopyInternal({
      tenant: d.tenant,
      provider,
      templateId: template.id,
      slateCredentials: { id: copy.id, slateOid },
      status: template.status,
      name: template.name,
      description: template.description,
      scopes: template.scopes,
      fixedAuthMethodKey: template.authMethodKey,
      fixedAuthInput: Object.keys(fixedInput).length ? fixedInput : null
    });
  }

  private async withProviders<T extends Pick<HubTemplate, 'slateId'>>(templates: T[]) {
    let slateIds = [...new Set(templates.map(template => template.slateId))];

    let providers = slateIds.length
      ? await db.provider.findMany({
          where: {
            ...publicProviderWhere,
            defaultVariant: { slate: { id: { in: slateIds } } }
          },
          include: providerInclude,
          orderBy: { createdAt: 'asc' }
        })
      : [];

    return templates.map(template => ({
      ...template,
      provider: presentProvider(
        providers.find(provider => provider.defaultVariant?.slate?.id === template.slateId) ??
          null
      )
    }));
  }
}

export let installationAuthCredentialsService = Service.create(
  'installationAuthCredentials',
  () => new installationAuthCredentialsServiceImpl()
).build();
