import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  type Prisma,
  type Provider,
  type ProviderAuthCredentials,
  type Tenant,
  type WebhookRegistrationPurpose,
  type WebhookRegistrationStatus
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { type AuditSubspaceWebhookRegistration, Fabric } from '@metorial/fabric';
import {
  webhookRegistrationInclude,
  type WebhookRegistrationWithRelations
} from '../lib/webhookRegistrationIncludes';
import { webhookRegistrationDeleteQueue } from '../queues/delete/webhookRegistration';

export type ListWebhookRegistrationsParams = {
  ids?: string[];
  providerIds?: string[];
  authCredentialsIds?: string[];
  search?: string;
  status?: WebhookRegistrationStatus[];
  allowDeleted?: boolean;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetWebhookRegistrationByIdParams = {
  webhookRegistrationId: string;
  allowDeleted?: boolean;
};

export type CreateWebhookRegistrationParams = {
  provider: { id: string };
  authCredentials?: { id: string };
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type FinishWebhookRegistrationSetupParams = {
  webhookRegistration: WebhookRegistrationWithRelations;
  input: { userConfig: Record<string, any> };
};

export type UpdateWebhookRegistrationParams = {
  webhookRegistration: WebhookRegistrationWithRelations;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
  };
};

export type ArchiveWebhookRegistrationParams = {
  webhookRegistration: WebhookRegistrationWithRelations;
};

export let toAuditWebhookRegistration = (
  webhookRegistration: WebhookRegistrationWithRelations
): AuditSubspaceWebhookRegistration => ({
  id: webhookRegistration.id,
  status: webhookRegistration.status,
  name: webhookRegistration.name,
  description: webhookRegistration.description,
  metadata: webhookRegistration.metadata,
  purpose: webhookRegistration.purpose,
  isSetupComplete: webhookRegistration.status !== 'awaiting_setup',
  provider: {
    id: webhookRegistration.provider.id,
    name: webhookRegistration.provider.name
  },
  authCredentialsId: webhookRegistration.authCredentials?.id ?? null,
  archivedAt: webhookRegistration.archivedAt
});

class webhookRegistrationServiceImpl {
  async listWebhookRegistrations(d: MetorialFacing<ListWebhookRegistrationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listWebhookRegistrationsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listWebhookRegistrationsInternal(
    d: { tenant: Tenant; environment: Environment } & ListWebhookRegistrationsParams
  ) {
    let solution = await getMetorialSolution();
    let providers = await resolveProviders(
      { tenant: d.tenant, environment: d.environment, solution },
      d.providerIds
    );
    let search = d.search?.trim();
    let servingOids = d.authCredentialsIds
      ? await this.getDeliverySetupOidsServingAuthCredentials({
          tenant: d.tenant,
          environment: d.environment,
          authCredentialsIds: d.authCredentialsIds
        })
      : undefined;

    return Paginator.create<WebhookRegistrationWithRelations>(({ prisma }) =>
      prisma(async opts =>
        db.webhookRegistration.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              search ? { id: search } : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              servingOids ? { oid: { in: servingOids } } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean) as Prisma.WebhookRegistrationWhereInput[]
          },
          include: webhookRegistrationInclude
        })
      )
    );
  }

  // Whether two credentials records are the same OAuth app is only known to the backend.
  private async getDeliverySetupOidsServingAuthCredentials(d: {
    tenant: Tenant;
    environment: Environment;
    authCredentialsIds: string[];
  }) {
    let authCredentials =
      await providerAuthCredentialsService.getManyProviderAuthCredentialsByIdsInternal({
        tenant: d.tenant,
        environment: d.environment,
        ids: d.authCredentialsIds
      });

    let byBackend = new Map<bigint, ProviderAuthCredentials[]>();
    for (let credentials of authCredentials) {
      let group = byBackend.get(credentials.backendOid) ?? [];
      group.push(credentials);
      byBackend.set(credentials.backendOid, group);
    }

    let oids = await Promise.all(
      Array.from(byBackend.values()).map(async group => {
        let backend = await getBackend({ entity: group[0]! });
        if (!backend.callbacks) return [];

        let res = await backend.callbacks.listDeliverySetupsServingAuthCredentials({
          tenant: d.tenant,
          authCredentials: group
        });
        return res.webhookRegistrationOids;
      })
    );

    return oids.flat();
  }

  async getWebhookRegistrationById(d: MetorialFacing<GetWebhookRegistrationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getWebhookRegistrationByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getWebhookRegistrationByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetWebhookRegistrationByIdParams
  ) {
    let solution = await getMetorialSolution();

    let webhookRegistration = await db.webhookRegistration.findFirst({
      where: {
        id: d.webhookRegistrationId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: webhookRegistrationInclude
    });
    if (!webhookRegistration) {
      throw new ServiceError(notFoundError('webhook_registration', d.webhookRegistrationId));
    }

    return webhookRegistration;
  }

  private async resolveProviderForRegistration(d: {
    tenant: Tenant;
    environment: Environment;
    provider: { id: string };
  }) {
    let solution = await getMetorialSolution();
    let providers = await resolveProviders(
      { tenant: d.tenant, environment: d.environment, solution },
      [d.provider.id]
    );

    let provider = providers?.oids.length
      ? await db.provider.findFirst({
          where: { oid: { in: providers.oids } },
          include: { type: true, defaultVariant: true }
        })
      : null;
    if (!provider) throw new ServiceError(notFoundError('provider', d.provider.id));

    let attributes = provider.type.attributes;
    if (
      attributes.triggers.status !== 'enabled' ||
      attributes.triggers.webhookRegistration.status !== 'supported'
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'webhook_registration_not_supported',
          message: 'This provider does not support registering webhook receivers.',
          description:
            'Only providers with a manually registered webhook trigger group, or an automatically registered one that needs a delivery setup, can receive webhook registrations.'
        })
      );
    }

    let providerVariant = provider.defaultVariant;
    if (!providerVariant) {
      throw new ServiceError(
        badRequestError({
          code: 'provider_variant_missing',
          message: 'This provider has no default variant to register a webhook receiver on.'
        })
      );
    }

    let purpose: WebhookRegistrationPurpose =
      attributes.triggers.webhookRegistration.purpose ?? 'webhook_receiver';

    return { provider, providerVariant, purpose };
  }

  private async resolveAuthCredentialsForRegistration(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider;
    purpose: WebhookRegistrationPurpose;
    authCredentials?: { id: string };
  }) {
    if (d.purpose === 'webhook_receiver') {
      if (d.authCredentials) {
        throw new ServiceError(
          badRequestError({
            code: 'auth_credentials_not_applicable',
            message:
              'This provider takes a webhook receiver, which is not tied to OAuth credentials. Leave out `auth_credentials_id`.'
          })
        );
      }

      return null;
    }

    if (!d.authCredentials) {
      throw new ServiceError(
        badRequestError({
          code: 'auth_credentials_required',
          message:
            'A delivery setup is created for your own OAuth app. Pass the `auth_credentials_id` of the OAuth credentials your connection uses.'
        })
      );
    }

    let authCredentials =
      await providerAuthCredentialsService.getProviderAuthCredentialsByIdInternal({
        tenant: d.tenant,
        environment: d.environment,
        providerAuthCredentialsId: d.authCredentials.id
      });

    if (authCredentials.providerOid !== d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          code: 'auth_credentials_provider_mismatch',
          message:
            'These OAuth credentials belong to another provider. Use the OAuth credentials of the provider you are setting up delivery for.'
        })
      );
    }

    if (authCredentials.origin !== 'tenant_created') {
      throw new ServiceError(
        badRequestError({
          code: 'auth_credentials_managed',
          message:
            'These OAuth credentials are managed by Metorial, which already delivers their events. A delivery setup is only needed for your own OAuth app.'
        })
      );
    }

    if (authCredentials.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          code: 'auth_credentials_inactive',
          message:
            'These OAuth credentials are archived. Use the active OAuth credentials of your own OAuth app.'
        })
      );
    }

    return authCredentials;
  }

  async createWebhookRegistration(d: MetorialFacing<CreateWebhookRegistrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.webhook_registration.created:before', eventBase);

    let webhookRegistration = await this.createWebhookRegistrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.webhook_registration.created:after', {
      ...eventBase,
      webhookRegistration: toAuditWebhookRegistration(webhookRegistration)
    });

    return webhookRegistration;
  }

  async createWebhookRegistrationInternal(
    d: { tenant: Tenant; environment: Environment } & CreateWebhookRegistrationParams
  ) {
    let solution = await getMetorialSolution();

    let { provider, providerVariant, purpose } = await this.resolveProviderForRegistration({
      tenant: d.tenant,
      environment: d.environment,
      provider: d.provider
    });
    let authCredentials = await this.resolveAuthCredentialsForRegistration({
      tenant: d.tenant,
      environment: d.environment,
      provider,
      purpose,
      authCredentials: d.authCredentials
    });

    let created = await db.webhookRegistration.create({
      data: {
        ...getId('webhookRegistration'),
        status: 'awaiting_setup',
        purpose,

        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,

        providerOid: provider.oid,
        providerVariantOid: providerVariant.oid,
        authCredentialsOid: authCredentials?.oid,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid!,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid!
      }
    });

    let backend = await getBackend({ entity: providerVariant });
    if (!backend.callbacks) {
      await db.webhookRegistration.update({
        where: { oid: created.oid },
        data: { status: 'deleted' }
      });

      throw new ServiceError(
        badRequestError({
          code: 'webhook_registration_not_supported',
          message: 'This provider does not support registering webhook receivers.'
        })
      );
    }

    let res: Awaited<ReturnType<typeof backend.callbacks.createWebhookRegistration>>;
    try {
      res = await backend.callbacks.createWebhookRegistration({
        tenant: d.tenant,
        provider,
        providerVariant,
        authCredentials,
        webhookRegistration: created
      });
    } catch (error) {
      await db.webhookRegistration.update({
        where: { oid: created.oid },
        data: { status: 'deleted' }
      });

      throw error;
    }

    return await db.webhookRegistration.update({
      where: { oid: created.oid },
      data: {
        receiveUrl: res.receiveUrl,
        setup: res.setup
      },
      include: webhookRegistrationInclude
    });
  }

  async finishWebhookRegistrationSetup(
    d: MetorialFacing<FinishWebhookRegistrationSetupParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.webhook_registration.setup_completed:before', eventBase);

    let webhookRegistration = await this.finishWebhookRegistrationSetupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.webhook_registration.setup_completed:after', {
      ...eventBase,
      webhookRegistration: toAuditWebhookRegistration(webhookRegistration)
    });

    return webhookRegistration;
  }

  async finishWebhookRegistrationSetupInternal(
    d: { tenant: Tenant; environment: Environment } & FinishWebhookRegistrationSetupParams
  ) {
    if (d.webhookRegistration.status !== 'awaiting_setup') {
      throw new ServiceError(
        badRequestError({
          code: 'webhook_registration_not_awaiting_setup',
          message: 'This webhook registration is not awaiting setup.'
        })
      );
    }

    let backend = await this.getCallbacksBackend(d.webhookRegistration);

    let res = await backend.finishWebhookRegistrationSetup({
      tenant: d.tenant,
      webhookRegistration: d.webhookRegistration,
      userConfig: d.input.userConfig
    });

    return await db.webhookRegistration.update({
      where: { oid: d.webhookRegistration.oid },
      data: {
        status: 'active',
        receiveUrl: res.receiveUrl
      },
      include: webhookRegistrationInclude
    });
  }

  async updateWebhookRegistration(d: MetorialFacing<UpdateWebhookRegistrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.webhook_registration.updated:before', eventBase);

    let webhookRegistration = await this.updateWebhookRegistrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.webhook_registration.updated:after', {
      ...eventBase,
      webhookRegistration: toAuditWebhookRegistration(webhookRegistration),
      previousWebhookRegistration: toAuditWebhookRegistration(d.webhookRegistration)
    });

    return webhookRegistration;
  }

  async updateWebhookRegistrationInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateWebhookRegistrationParams
  ) {
    if (d.webhookRegistration.status === 'archived') {
      throw new ServiceError(
        badRequestError({
          code: 'webhook_registration_archived',
          message: 'An archived webhook registration cannot be updated.'
        })
      );
    }

    let backend = await this.getCallbacksBackend(d.webhookRegistration);

    await backend.updateWebhookRegistration({
      tenant: d.tenant,
      webhookRegistration: d.webhookRegistration,
      input: d.input
    });

    return await db.webhookRegistration.update({
      where: { oid: d.webhookRegistration.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include: webhookRegistrationInclude
    });
  }

  async archiveWebhookRegistration(d: MetorialFacing<ArchiveWebhookRegistrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.webhook_registration.archived:before', eventBase);

    let webhookRegistration = await this.archiveWebhookRegistrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.webhook_registration.archived:after', {
      ...eventBase,
      webhookRegistration: toAuditWebhookRegistration(webhookRegistration)
    });

    return webhookRegistration;
  }

  async archiveWebhookRegistrationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveWebhookRegistrationParams
  ) {
    let webhookRegistration =
      d.webhookRegistration.status === 'archived'
        ? d.webhookRegistration
        : await db.webhookRegistration.update({
            where: { oid: d.webhookRegistration.oid },
            data: {
              status: 'archived',
              archivedAt: new Date()
            },
            include: webhookRegistrationInclude
          });

    // Queued so a backend failure is retried instead of failing the delete; nightly cleanup backs it up.
    await webhookRegistrationDeleteQueue.add({
      webhookRegistrationId: webhookRegistration.id
    });

    return webhookRegistration;
  }

  async getCallbacksBackend(webhookRegistration: WebhookRegistrationWithRelations) {
    let backend = await getBackend({ entity: webhookRegistration.providerVariant });
    if (!backend.callbacks) {
      throw new ServiceError(
        badRequestError({
          code: 'webhook_registration_not_supported',
          message: 'This provider does not support registering webhook receivers.'
        })
      );
    }

    return backend.callbacks;
  }

  async getCallbacksBackends() {
    let backends = await db.backend.findMany({ select: { oid: true } });

    let resolved = await Promise.all(
      backends.map(async backend => await getBackend({ entity: { backendOid: backend.oid } }))
    );

    return resolved.flatMap(backend => (backend.callbacks ? [backend.callbacks] : []));
  }
}

export let webhookRegistrationService = Service.create(
  'webhookRegistration',
  () => new webhookRegistrationServiceImpl()
).build();
