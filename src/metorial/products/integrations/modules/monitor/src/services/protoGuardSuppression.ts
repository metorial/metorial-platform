import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type ProtoGuardFilter,
  type ProtoGuardSuppression,
  type ProtoGuardSuppressionStatus,
  type Provider,
  type Tenant
} from '@metorial-subspace/db';
import {
  resolveMetorialFacing,
  toProviderEventBase,
  type MetorialFacing
} from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceProtoGuardSuppression } from '@metorial/fabric';

let MAX_REASON_LENGTH = 1000;
let MAX_TOOL_KEY_LENGTH = 512;
let MAX_CONTENT_HMAC_LENGTH = 128;

export let protoGuardSuppressionInclude = {
  filter: true,
  provider: true
} as const;

type SuppressionWithRelations = ProtoGuardSuppression & {
  filter: ProtoGuardFilter;
  provider: Provider | null;
};

let toAuditPayload = (
  suppression: SuppressionWithRelations
): AuditSubspaceProtoGuardSuppression => ({
  id: suppression.id,
  status: suppression.status,
  reason: suppression.reason,
  filter: {
    id: suppression.filter.id,
    key: suppression.filter.key,
    name: suppression.filter.name
  },
  providerId: suppression.provider?.id ?? null,
  toolKey: suppression.toolKey,
  hasContentHmac: suppression.contentHmac != null,
  expiresAt: suppression.expiresAt,
  archivedAt: suppression.archivedAt,
  createdAt: suppression.createdAt
});

let assertMaxLength = (field: string, value: string | null | undefined, max: number) => {
  if (value == null || value.length <= max) return;

  throw new ServiceError(
    badRequestError({
      code: `invalid_${field}`,
      message: `The ${field} must be at most ${max} characters long.`
    })
  );
};

let assertExpiresAt = (expiresAt: Date | null | undefined) => {
  if (expiresAt == null || expiresAt.getTime() > Date.now()) return;

  throw new ServiceError(
    badRequestError({
      code: 'invalid_expires_at',
      message: 'The expiry of a suppression must be in the future.'
    })
  );
};

class ProtoGuardSuppressionServiceImpl {
  async listSuppressions(
    d: MetorialFacing<{
      statuses?: ProtoGuardSuppressionStatus[];
      filterIds?: string[];
      providerIds?: string[];
    }>
  ) {
    let { tenant } = await resolveMetorialFacing(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.protoGuardSuppression.findMany({
            ...opts,
            where: {
              tenantOid: tenant.oid,
              status: d.statuses ? { in: d.statuses } : 'active',
              ...(d.filterIds
                ? {
                    filter: { OR: [{ id: { in: d.filterIds } }, { key: { in: d.filterIds } }] }
                  }
                : {}),
              ...(d.providerIds ? { provider: { id: { in: d.providerIds } } } : {})
            },
            include: protoGuardSuppressionInclude
          })
      )
    );
  }

  async getSuppressionById(d: MetorialFacing<{ suppressionId: string }>) {
    let { tenant } = await resolveMetorialFacing(d);
    return this.getSuppressionByIdInternal({ tenant, suppressionId: d.suppressionId });
  }

  private async getSuppressionByIdInternal(d: { tenant: Tenant; suppressionId: string }) {
    let suppression = await db.protoGuardSuppression.findFirst({
      where: { id: d.suppressionId, tenantOid: d.tenant.oid },
      include: protoGuardSuppressionInclude
    });
    if (!suppression) {
      throw new ServiceError(notFoundError('protoguard_suppression', d.suppressionId));
    }

    return suppression;
  }

  async createSuppression(
    d: MetorialFacing<{
      input: {
        filterId: string;
        providerId?: string | null;
        toolKey?: string | null;
        contentHmac?: string | null;
        reason?: string | null;
        expiresAt?: Date | null;
      };
    }>
  ) {
    let { tenant } = await resolveMetorialFacing(d);

    assertMaxLength('reason', d.input.reason, MAX_REASON_LENGTH);
    assertMaxLength('tool_key', d.input.toolKey, MAX_TOOL_KEY_LENGTH);
    assertMaxLength('content_hmac', d.input.contentHmac, MAX_CONTENT_HMAC_LENGTH);
    assertExpiresAt(d.input.expiresAt);

    let [filter, provider] = await Promise.all([
      this.findFilter(d.input.filterId),
      d.input.providerId ? this.findProvider({ tenant, providerId: d.input.providerId }) : null
    ]);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.suppression.created:before', {
      ...eventBase,
      filterId: filter.id
    });

    let suppression = await db.protoGuardSuppression.create({
      data: {
        ...getId('protoGuardSuppression'),
        reason: d.input.reason || null,
        toolKey: d.input.toolKey || null,
        contentHmac: d.input.contentHmac || null,
        expiresAt: d.input.expiresAt ?? null,

        tenantOid: tenant.oid,
        projectOid: tenant.projectOid,
        filterOid: filter.oid,
        providerOid: provider?.oid ?? null
      },
      include: protoGuardSuppressionInclude
    });

    await Fabric.fire('protoguard.suppression.created:after', {
      ...eventBase,
      suppression: toAuditPayload(suppression)
    });

    return suppression;
  }

  async archiveSuppression(
    d: MetorialFacing<{ suppression: ProtoGuardSuppression & { tenantOid: bigint } }>
  ) {
    if (d.suppression.status == 'archived') {
      throw new ServiceError(
        badRequestError({
          code: 'suppression_archived',
          message: 'This suppression has already been archived.'
        })
      );
    }

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.suppression.archived:before', {
      ...eventBase,
      suppressionId: d.suppression.id
    });

    let suppression = await db.protoGuardSuppression.update({
      where: { oid: d.suppression.oid },
      data: { status: 'archived', archivedAt: new Date() },
      include: protoGuardSuppressionInclude
    });

    await Fabric.fire('protoguard.suppression.archived:after', {
      ...eventBase,
      suppression: toAuditPayload(suppression)
    });

    return suppression;
  }

  private async findFilter(filterId: string) {
    let filter = await db.protoGuardFilter.findFirst({
      where: { OR: [{ id: filterId }, { key: filterId }] }
    });
    if (!filter) throw new ServiceError(notFoundError('protoguard_filter', filterId));

    return filter;
  }

  private async findProvider(d: { tenant: Tenant; providerId: string }) {
    let provider = await db.provider.findFirst({
      where: {
        id: d.providerId,
        OR: [{ access: 'public' }, { ownerTenantOid: d.tenant.oid }]
      }
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.providerId));

    return provider;
  }
}

export let protoGuardSuppressionService = Service.create(
  'protoGuardSuppressionService',
  () => new ProtoGuardSuppressionServiceImpl()
).build();
