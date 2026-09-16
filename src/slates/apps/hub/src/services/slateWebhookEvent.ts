import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SlateWebhookEventStatus,
  SlateWebhookRegistration,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import {
  ingestWebhookRequest,
  MAX_WEBHOOK_BODY_BYTES,
  payloadTooLargeError
} from '../lib/ingestWebhookRequest';
import { getLocalhostWebhookUrl, getWebhookUrl } from '../lib/webhookUrl';

let include = { webhookRegistration: { include: { slate: true, triggerGroup: true } } };

let visibleTo = (tenant: Tenant): Prisma.SlateWebhookEventWhereInput => ({
  OR: [
    { webhookRegistration: { tenantOid: tenant.oid } },
    {
      triggerRawEvents: {
        some: {
          triggerRegistrationInstance: { triggerRegistration: { tenantOid: tenant.oid } }
        }
      }
    },
    {
      triggerEvents: {
        some: {
          triggerRegistrationInstance: { triggerRegistration: { tenantOid: tenant.oid } }
        }
      }
    }
  ]
});

class slateWebhookEventServiceImpl {
  async getSlateWebhookEventById(d: { tenant: Tenant; id: string }) {
    let event = await db.slateWebhookEvent.findFirst({
      where: { id: d.id, ...visibleTo(d.tenant) },
      include
    });
    if (!event) throw new ServiceError(notFoundError('webhook_event'));
    return event;
  }

  async listSlateWebhookEvents(d: {
    tenant: Tenant;
    webhookRegistrationIds?: string[];
    slateIds?: string[];
    statuses?: SlateWebhookEventStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookEvent.findMany({
            ...opts,
            where: {
              status: d.statuses?.length ? { in: d.statuses } : undefined,

              webhookRegistration:
                d.webhookRegistrationIds || d.slateIds
                  ? {
                      id: d.webhookRegistrationIds
                        ? { in: d.webhookRegistrationIds }
                        : undefined,
                      slate: d.slateIds ? { id: { in: d.slateIds } } : undefined
                    }
                  : undefined,

              // Visibility is per-event not per-registration,
              // that also means that above webhook id filter is fine because
              // the user will still only ever see their events
              ...visibleTo(d.tenant)
            },
            include
          })
      )
    );
  }

  async getManySlateWebhookEventsByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.slateWebhookEvent.findMany({
      where: { id: { in: d.ids }, ...visibleTo(d.tenant) },
      include
    });
  }

  async listWebhookEventsForAdmin(d: {
    webhookRegistration: { oid: bigint };
    statuses?: SlateWebhookEventStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookEvent.findMany({
            ...opts,
            where: {
              webhookRegistrationOid: d.webhookRegistration.oid,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include,
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }]
          })
      )
    );
  }

  async sendWebhookEventForAdmin(d: {
    registration: Pick<SlateWebhookRegistration, 'oid' | 'status' | 'urlKey'>;
    input: {
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      body?: string | null;
      useLocalhostUrl?: boolean;
    };
  }) {
    let extraPath = (d.input.path ?? '').trim();
    if (extraPath && !extraPath.startsWith('/')) extraPath = `/${extraPath}`;
    if (extraPath.includes('://') || extraPath.startsWith('//')) {
      throw new ServiceError(
        badRequestError({ message: 'path must be a relative URL path, not an absolute URL.' })
      );
    }

    let bodyText = d.input.body ?? null;
    if (bodyText !== null && Buffer.byteLength(bodyText, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      throw new ServiceError(payloadTooLargeError);
    }

    let baseUrl =
      d.input.useLocalhostUrl === false
        ? getWebhookUrl(d.registration)
        : getLocalhostWebhookUrl(d.registration);
    let url = `${baseUrl}${extraPath}`;
    let parsed = new URL(url);

    let headers: Record<string, string> = {
      'content-type': 'application/json',
      host: parsed.host,
      ...(d.input.headers ?? {})
    };

    return ingestWebhookRequest({
      registration: d.registration,
      request: {
        method: (d.input.method ?? 'POST').toUpperCase(),
        url,
        headers,
        body:
          bodyText && bodyText.length > 0
            ? { encoding: 'base64', content: Buffer.from(bodyText, 'utf8').toString('base64') }
            : null
      }
    });
  }
}

export let slateWebhookEventService = Service.create(
  'slateWebhookEventService',
  () => new slateWebhookEventServiceImpl()
).build();
