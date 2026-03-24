import { randomBytes } from 'crypto';
import { generateCustomId } from '@lowerdeck/id';
import type {
  EventDestination,
  EventDestinationInstance,
  PrismaClient,
  WebhookDestinationWebhook
} from '../../../prisma/generated/client';
import { getId, snowflake } from '../../id';

const include = {
  currentInstance: {
    include: {
      webhook: true
    }
  }
};

export const EventDestinationFixtures = (db: PrismaClient) => {
  const defaultEventDestination = async (data: {
    tenantOid: bigint;
    senderOid: bigint;
    overrides?: Partial<EventDestination>;
    webhookOverrides?: Partial<WebhookDestinationWebhook>;
    instanceOverrides?: Partial<EventDestinationInstance>;
  }): Promise<
    EventDestination & {
      currentInstance:
        | (EventDestinationInstance & {
            webhook: WebhookDestinationWebhook | null;
          })
        | null;
    }
  > => {
    const destinationId = getId('eventDestination');
    const webhookId = getId('eventDestinationWebhook');
    const name =
      data.overrides?.name ?? `Test Destination ${randomBytes(4).toString('hex')}`;

    return db.$transaction(async tx => {
      const webhook = await tx.webhookDestinationWebhook.create({
        data: {
          ...webhookId,
          url: data.webhookOverrides?.url ?? 'https://example.com/webhook',
          method: data.webhookOverrides?.method ?? 'POST',
          signingSecret:
            data.webhookOverrides?.signingSecret ??
            generateCustomId('metorial_whsec_', 50),
          tenantOid: data.tenantOid,
          createdAt: data.webhookOverrides?.createdAt ?? new Date(),
          ...data.webhookOverrides
        }
      });

      const destination = await tx.eventDestination.create({
        data: {
          ...destinationId,
          status: data.overrides?.status ?? 'active',
          type: data.overrides?.type ?? 'http_endpoint',
          eventTypes: data.overrides?.eventTypes ?? [],
          hasEventTypesFilter:
            data.overrides?.hasEventTypesFilter ??
            !!data.overrides?.eventTypes?.length,
          name,
          description: data.overrides?.description ?? null,
          retryType: data.overrides?.retryType ?? 'linear',
          retryDelaySeconds: data.overrides?.retryDelaySeconds ?? 30,
          retryMaxAttempts: data.overrides?.retryMaxAttempts ?? 5,
          tenantOid: data.tenantOid,
          senderOid: data.senderOid,
          createdAt: data.overrides?.createdAt ?? new Date(),
          updatedAt: data.overrides?.updatedAt ?? new Date(),
          ...data.overrides
        }
      });

      const instance = await tx.eventDestinationInstance.create({
        data: {
          oid: data.instanceOverrides?.oid ?? snowflake.nextId(),
          type: data.instanceOverrides?.type ?? 'http_endpoint',
          webhookOid: webhook.oid,
          destinationOid: destination.oid,
          createdAt: data.instanceOverrides?.createdAt ?? new Date(),
          ...data.instanceOverrides
        }
      });

      return tx.eventDestination.update({
        where: { oid: destination.oid },
        data: { currentInstanceOid: instance.oid },
        include
      });
    });
  };

  return {
    default: defaultEventDestination
  };
};
