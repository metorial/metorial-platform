import { createError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { chunk } from 'lodash';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { db } from '../db';
import { triggerDeliveryConfigServiceInternal } from '../internal/triggerDeliveryConfigServiceInternal';
import { acceptWebhookRequest } from '../lib/ingestWebhookRequest';
import { getActiveSlateVersion } from '../lib/slateVersion';
import { getTriggerDeliveryConfigSpec } from '../lib/triggerDeliveryConfig';
import { slateInvocationService } from './slateInvocation';
import { globalTenant } from './tenant';

let DELIVERY_PAGE_SIZE = 500;

let DELIVERY_CONCURRENCY = 10;

let deliveryUnavailableError = createError({
  status: 503,
  code: 'trigger_delivery_unavailable',
  message: 'This delivery could not be checked right now. Send it again later.'
});

type DeliveryConfigRegistration = Pick<
  SlateWebhookRegistration,
  'id' | 'owner' | 'secretOid' | 'tenantOid'
> & { slate: Slate; triggerGroup: Pick<SlateTriggerGroup, 'key'> };

class triggerDeliveryServiceImpl {
  // Its webhooks arrive only through the delivery config of its group, never on its own URL.
  servesRegistration(registration: { triggerGroup: Pick<SlateTriggerGroup, 'spec'> }) {
    return !!getTriggerDeliveryConfigSpec(registration.triggerGroup);
  }

  // One config serves every registration given its routing keys;
  // each gets the request unchanged and verifies it again.
  async receiveDelivery(d: {
    registration: DeliveryConfigRegistration;
    request: PrismaJson.SlateWebhookEventRequest;
  }) {
    let routingKeys = await this.authenticateDelivery(d);
    if (!routingKeys.length) return { accepted: 0 };

    // A failed hand-off rejects the delivery for a resend; earlier acceptors dedupe it by idempotency key.
    let accepted = 0;
    let cursor: bigint | undefined;

    while (true) {
      let routes = await db.triggerDeliveryRoute.findMany({
        where: {
          bindingId: d.registration.id,
          routingKey: { in: routingKeys },
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

      // The sender is waiting, so a widely shared key must not be handed off one at a time.
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

  // When the integration cannot be asked, the push is refused rather than acknowledged, so the
  // sender sends it again.
  private async authenticateDelivery(d: {
    registration: DeliveryConfigRegistration;
    request: PrismaJson.SlateWebhookEventRequest;
  }) {
    let tenant =
      d.registration.owner === 'global'
        ? globalTenant
        : await db.tenant.findUniqueOrThrow({ where: { oid: d.registration.tenantOid! } });
    let deliveryConfig = await triggerDeliveryConfigServiceInternal.decryptDeliveryConfig({
      registration: d.registration,
      tenant
    });

    let result;
    try {
      result = await slateInvocationService.authenticateWebhookDelivery({
        stack: await slateInvocationService.createInvocation({
          participants: [],
          slateVersion: await getActiveSlateVersion({ slate: d.registration.slate }),
          tenant
        }),
        triggerGroupId: d.registration.triggerGroup.key,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        body: d.request.body,
        deliveryConfig
      });
    } catch (error) {
      console.error(`TRIGGER.delivery.authenticate.failed cfg:${d.registration.id}`, error);
      throw new ServiceError(deliveryUnavailableError);
    }
    if (result.status === 'error') throw new ServiceError(deliveryUnavailableError);

    let rejected = result.data.rejected;
    if (rejected) {
      throw new ServiceError(
        createError({
          status: rejected.status,
          code: 'trigger_delivery_rejected',
          message: 'This delivery could not be accepted.'
        })
      );
    }

    return result.data.routingKeys;
  }
}

export let triggerDeliveryService = Service.create(
  'triggerDeliveryService',
  () => new triggerDeliveryServiceImpl()
).build();
