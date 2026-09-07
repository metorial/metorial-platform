import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  type Prisma,
  type Tenant,
  type WebhookRegistrationStatus
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
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

export type ListWebhookRegistrationsParams = {
  ids?: string[];
  providerIds?: string[];
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
  isSetupComplete: webhookRegistration.status !== 'awaiting_setup',
  provider: {
    id: webhookRegistration.provider.id,
    name: webhookRegistration.provider.name
  },
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
              providers ? { providerOid: providers.in } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean) as Prisma.WebhookRegistrationWhereInput[]
          },
          include: webhookRegistrationInclude
        })
      )
    );
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
            'Only providers that expose a manually registered webhook trigger group can receive webhook registrations.'
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

    return { provider, providerVariant };
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

    let { provider, providerVariant } = await this.resolveProviderForRegistration({
      tenant: d.tenant,
      environment: d.environment,
      provider: d.provider
    });

    let created = await db.webhookRegistration.create({
      data: {
        ...getId('webhookRegistration'),
        status: 'awaiting_setup',

        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,

        providerOid: provider.oid,
        providerVariantOid: providerVariant.oid,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid
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
    if (d.webhookRegistration.status === 'archived') return d.webhookRegistration;

    return await db.webhookRegistration.update({
      where: { oid: d.webhookRegistration.oid },
      data: {
        status: 'archived',
        archivedAt: new Date()
      },
      include: webhookRegistrationInclude
    });
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
