import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  SlateTriggerDestinationStatus,
  SlateTriggerDestinationType,
  type SlateTriggerDestination,
  type Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { assertPublicHttpUrl } from '../lib/validateHttpUrl';
import { getTenantAndSenderForSignal, signal } from '../signal';

let include = {};

const normalizeEventTypes = (eventTypes?: string[] | null) =>
  eventTypes && eventTypes.length > 0 ? eventTypes : [];

class slateTriggerDestinationServiceImpl {
  async createTriggerDestination(d: {
    tenant: Tenant;
    input: {
      name: string;
      description?: string;
      url: string;
      method?: 'POST' | 'PUT' | 'PATCH';
      eventTypes?: string[];
    };
  }) {
    await assertPublicHttpUrl(d.input.url);

    let { sender, tenant: signalTenant } = await getTenantAndSenderForSignal(d.tenant);

    let res = await signal.eventDestination.create({
      tenantId: signalTenant.id,
      senderId: sender.id,
      name: d.input.name,
      description: d.input.description,
      eventTypes: d.input.eventTypes?.length ? d.input.eventTypes : null,
      variant: {
        type: SlateTriggerDestinationType.http_endpoint,
        url: d.input.url,
        method: d.input.method ?? 'POST'
      }
    });

    return await db.slateTriggerDestination.create({
      data: {
        ...getId('slateTriggerDestination'),

        tenantOid: d.tenant.oid,

        name: res.name,
        description: res.description ?? undefined,
        type: SlateTriggerDestinationType.http_endpoint,
        status: SlateTriggerDestinationStatus.active,

        url: res.webhook?.url ?? d.input.url,
        method: res.webhook?.method ?? d.input.method ?? 'POST',
        eventTypes: normalizeEventTypes(res.eventTypes ?? undefined),

        signalDestinationId: res.id
      },
      include
    });
  }

  async updateTriggerDestination(d: {
    tenant: Tenant;
    destination: SlateTriggerDestination;
    input: {
      name?: string;
      description?: string;
      url?: string;
      method?: 'POST' | 'PUT' | 'PATCH';
      eventTypes?: string[];
    };
  }) {
    if (d.destination.status === SlateTriggerDestinationStatus.inactive) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive trigger destination.'
        })
      );
    }

    if (d.input.url) {
      await assertPublicHttpUrl(d.input.url);
    }

    let { tenant: signalTenant } = await getTenantAndSenderForSignal(d.tenant);

    let res = await signal.eventDestination.update({
      tenantId: signalTenant.id,
      eventDestinationId: d.destination.signalDestinationId!,
      name: d.input.name,
      description: d.input.description,
      eventTypes:
        d.input.eventTypes === undefined
          ? undefined
          : d.input.eventTypes.length
            ? d.input.eventTypes
            : null,
      variant:
        d.input.url || d.input.method
          ? {
              type: SlateTriggerDestinationType.http_endpoint,
              url: d.input.url ?? d.destination.url,
              method: d.input.method ?? (d.destination.method as 'POST' | 'PUT' | 'PATCH')
            }
          : undefined
    });

    return await db.slateTriggerDestination.update({
      where: { oid: d.destination.oid },
      data: {
        name: res.name,
        description: res.description ?? undefined,
        url: res.webhook?.url ?? d.destination.url,
        method: res.webhook?.method ?? d.destination.method,
        eventTypes: normalizeEventTypes(res.eventTypes ?? undefined)
      },
      include
    });
  }

  async deleteTriggerDestination(d: { tenant: Tenant; destination: SlateTriggerDestination }) {
    if (d.destination.status === SlateTriggerDestinationStatus.inactive) {
      throw new ServiceError(
        badRequestError({
          message: 'Trigger destination is already inactive.'
        })
      );
    }

    let { tenant: signalTenant } = await getTenantAndSenderForSignal(d.tenant);

    await signal.eventDestination.delete({
      tenantId: signalTenant.id,
      eventDestinationId: d.destination.signalDestinationId!
    });

    await db.slateTriggerDestination.update({
      where: { oid: d.destination.oid },
      data: {
        status: SlateTriggerDestinationStatus.inactive
      }
    });

    return d.destination;
  }

  async getTriggerDestinationById(d: { tenant: Tenant; id: string }) {
    let destination = await db.slateTriggerDestination.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!destination) throw new ServiceError(notFoundError('slate.trigger.destination'));
    return destination;
  }

  async listTriggerDestinations(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateTriggerDestination.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: SlateTriggerDestinationStatus.active
            },
            include
          })
      )
    );
  }
}

export let slateTriggerDestinationService = Service.create(
  'slateTriggerDestinationService',
  () => new slateTriggerDestinationServiceImpl()
).build();
