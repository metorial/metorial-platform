import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackDestination,
  CallbackDestinationStatus,
  db,
  getId,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import { callbackRegistrationService } from './callbackRegistration';
import { getTenantForSignal, signal } from '../signal';

type SignalDestination = Awaited<ReturnType<typeof signal.eventDestination.get>>;
type EnrichedCallbackDestination = CallbackDestination & {
  signalDestination?: SignalDestination | null;
};

class callbackDestinationServiceImpl {
  private async getSignalDestination(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }) {
    let eventDestinationId = d.callbackDestination.signalEventDestinationId;
    if (!eventDestinationId) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_destination_signing_unavailable',
          message:
            'The destination must be attached to a synchronized callback before its signing secret can be managed.'
        })
      );
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    return { eventDestinationId, signalTenant };
  }

  async enrichCallbackDestination(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }): Promise<EnrichedCallbackDestination> {
    let eventDestinationId =
      d.callbackDestination.signalEventDestinationId ?? d.callbackDestination.id;

    try {
      let signalTenant = await getTenantForSignal(d.tenant);
      let signalDestination = await signal.eventDestination.get({
        tenantId: signalTenant.id,
        eventDestinationId
      });

      return {
        ...d.callbackDestination,
        signalDestination
      };
    } catch {
      return d.callbackDestination;
    }
  }

  async enrichCallbackDestinations(d: {
    tenant: Tenant;
    callbackDestinations: CallbackDestination[];
  }) {
    return await Promise.all(
      d.callbackDestinations.map(callbackDestination =>
        this.enrichCallbackDestination({ tenant: d.tenant, callbackDestination })
      )
    );
  }

  private normalizeAndValidateEndpoint(d: { url: string; method?: 'POST' | 'PUT' | 'PATCH' }) {
    let parsed: URL;
    try {
      parsed = new URL(d.url);
    } catch {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_callback_destination_url',
          message: 'Callback destination URL must be a valid absolute URL.'
        })
      );
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_callback_destination_url',
          message: 'Callback destination URL must use http or https.'
        })
      );
    }

    return {
      url: parsed.toString(),
      method: d.method ?? 'POST'
    } as const;
  }

  async listCallbackDestinations(d: {
    tenant: Tenant;
    solution: Solution;
    callbackIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackDestination.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            status: {
              notIn: [CallbackDestinationStatus.archived, CallbackDestinationStatus.deleted]
            },
            AND: [
              d.callbackIds?.length
                ? {
                    callbackDestinationLinks: {
                      some: {
                        callback: {
                          id: { in: d.callbackIds },
                          tenantOid: d.tenant.oid,
                          solutionOid: d.solution.oid
                        }
                      }
                    }
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          }
        })
      )
    );
  }

  async getCallbackDestinationById(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestinationId: string;
  }) {
    let callbackDestination = await db.callbackDestination.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        id: d.callbackDestinationId,
        status: {
          notIn: [CallbackDestinationStatus.archived, CallbackDestinationStatus.deleted]
        }
      }
    });
    if (!callbackDestination) {
      throw new ServiceError(notFoundError('callback.destination', d.callbackDestinationId));
    }

    return callbackDestination;
  }

  async createCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      url: string;
    };
  }) {
    let endpoint = this.normalizeAndValidateEndpoint({
      url: d.input.url,
      method: 'POST'
    });

    return await db.callbackDestination.create({
      data: {
        ...getId('callbackDestination'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        status: CallbackDestinationStatus.active,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        url: endpoint.url,
        method: endpoint.method
      }
    });
  }

  async updateCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestination: CallbackDestination;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      url?: string;
    };
  }) {
    let destination = d.callbackDestination;

    let endpoint = d.input.url
      ? this.normalizeAndValidateEndpoint({
          url: d.input.url ?? destination.url,
          method: destination.method as 'POST' | 'PUT' | 'PATCH'
        })
      : null;

    let updated = await db.callbackDestination.update({
      where: { oid: destination.oid },
      data: {
        name: d.input.name ?? destination.name,
        description: d.input.description ?? destination.description,
        metadata: d.input.metadata ?? destination.metadata,
        url: endpoint?.url ?? destination.url,
        method: endpoint?.method ?? destination.method
      }
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: updated.oid },
      select: { callback: { select: { id: true } } }
    });
    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.syncCallback({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: updated.oid }
    });
  }

  async archiveCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestination: CallbackDestination;
  }) {
    let destination = d.callbackDestination;

    let archived = await db.callbackDestination.update({
      where: { oid: destination.oid },
      data: {
        status: CallbackDestinationStatus.archived
      }
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: destination.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.syncCallback({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: archived.oid }
    });
  }

  async rotateSigningSecret(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
    graceMs?: number;
  }) {
    if (
      d.graceMs !== undefined &&
      (!Number.isInteger(d.graceMs) ||
        (d.graceMs !== 0 && (d.graceMs < 60_000 || d.graceMs > 7 * 86_400_000)))
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_secret_grace_invalid',
          message:
            'The signing-secret grace period must be zero or between one minute and seven days.'
        })
      );
    }

    let { eventDestinationId, signalTenant } = await this.getSignalDestination(d);
    return await signal.eventDestination.rotateSigningSecret({
      tenantId: signalTenant.id,
      eventDestinationId,
      graceMs: d.graceMs
    });
  }

  async revokeSigningSecret(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
    secretId: string;
  }) {
    let { eventDestinationId, signalTenant } = await this.getSignalDestination(d);
    return await signal.eventDestination.revokeSigningSecret({
      tenantId: signalTenant.id,
      eventDestinationId,
      secretId: d.secretId
    });
  }

  async consumeSigningSecretReceipt(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
    receiptId: string;
    receiptToken: string;
  }) {
    let { eventDestinationId, signalTenant } = await this.getSignalDestination(d);
    try {
      return await signal.eventDestination.consumeSigningSecretReceipt({
        tenantId: signalTenant.id,
        eventDestinationId,
        receiptId: d.receiptId,
        receiptToken: d.receiptToken
      });
    } catch {
      throw new ServiceError(
        badRequestError({
          code: 'secret_issuance_receipt_denied',
          message: 'The one-time secret receipt is invalid, expired, or already consumed.'
        })
      );
    }
  }
}

export let callbackDestinationService = Service.create(
  'callbackDestinationService',
  () => new callbackDestinationServiceImpl()
).build();
