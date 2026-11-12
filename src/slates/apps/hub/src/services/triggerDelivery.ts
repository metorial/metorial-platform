import { createError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { chunk } from 'lodash';
import type { SlateWebhookRegistration } from '../../prisma/generated/client';
import { db } from '../db';
import { acceptWebhookRequest } from '../lib/ingestWebhookRequest';
import {
  authenticateTriggerDeliveryConfigPush,
  isTriggerDeliveryConfig,
  requestsTriggerInfrastructure
} from './triggerInfrastructure';

let DELIVERY_PAGE_SIZE = 500;

let DELIVERY_CONCURRENCY = 10;

type GroupRegistration = { triggerGroup: { spec: { invocation: unknown } } };

class triggerDeliveryServiceImpl {
  // A trigger group's spec never changes, so a registration of a group that asks for managed
  // delivery either is a delivery config or receives requests from `receiveDelivery` only.
  servesRegistration(registration: GroupRegistration) {
    return requestsTriggerInfrastructure(registration.triggerGroup.spec.invocation);
  }

  isDeliveryConfig(registration: Pick<SlateWebhookRegistration, 'type'> & GroupRegistration) {
    return isTriggerDeliveryConfig(registration);
  }

  // One delivery config serves every registration that was given its descriptor. The request
  // is handed unchanged to each registration it addresses, which verifies it again on its
  // own terms.
  async receiveDelivery(d: {
    registration: Pick<SlateWebhookRegistration, 'id' | 'owner' | 'secretOid' | 'tenantOid'> &
      GroupRegistration;
    request: PrismaJson.SlateWebhookEventRequest;
  }) {
    let authorization = d.request.headers.authorization;

    let delivery = await authenticateTriggerDeliveryConfigPush({
      registration: d.registration,
      request: new Request(d.request.url, {
        method: d.request.method,
        headers: authorization ? { authorization } : {},
        body: d.request.body ? Buffer.from(d.request.body.content, 'base64') : undefined
      })
    });
    if (!delivery.ok) {
      throw new ServiceError(
        createError({
          status: delivery.status,
          code: 'trigger_delivery_rejected',
          message: 'This delivery could not be accepted.'
        })
      );
    }
    if (!delivery.routingKeys.length) return { accepted: 0 };

    // A failed hand-off rejects the whole delivery so the sender repeats it. Registrations
    // that already accepted it see it twice and drop the repeat by its idempotency key.
    let accepted = 0;
    let cursor: bigint | undefined;

    while (true) {
      let routes = await db.triggerDeliveryRoute.findMany({
        where: {
          bindingId: d.registration.id,
          routingKey: { in: delivery.routingKeys },
          webhookRegistrationOid: cursor ? { gt: cursor } : undefined,
          webhookRegistration: {
            status: 'active',
            // A tenant's config is only ever handed to that tenant's registrations.
            tenantOid: d.registration.owner === 'tenant' ? d.registration.tenantOid : undefined
          }
        },
        distinct: ['webhookRegistrationOid'],
        orderBy: { webhookRegistrationOid: 'asc' },
        take: DELIVERY_PAGE_SIZE,
        select: { webhookRegistrationOid: true }
      });

      // The sender waits on this request, so a key many registrations share must not be
      // handed off one registration at a time.
      for (let batch of chunk(routes, DELIVERY_CONCURRENCY)) {
        await Promise.all(
          batch.map(route =>
            acceptWebhookRequest({
              registration: { oid: route.webhookRegistrationOid },
              request: d.request
            })
          )
        );
      }

      accepted += routes.length;
      if (routes.length < DELIVERY_PAGE_SIZE) break;
      cursor = routes[routes.length - 1]!.webhookRegistrationOid;
    }

    return { accepted };
  }
}

export let triggerDeliveryService = Service.create(
  'triggerDeliveryService',
  () => new triggerDeliveryServiceImpl()
).build();
