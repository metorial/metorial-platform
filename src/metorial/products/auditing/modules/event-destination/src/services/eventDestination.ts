import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  EventDestination,
  EventDestinationStatus,
  type EventDeliveryRetryStrategy,
  ID,
  Organization,
  WebhookDestination,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  assertDeliveryUrlAllowedForInput,
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_DELAY_SECONDS,
  MIN_RETRY_DELAY_SECONDS
} from '@metorial/module-event-delivery';
import { buildListenerTargetOrBlocks } from '../lib/listenerTargetMatch';

export let eventDestinationInclude = {
  webhookDestination: true,
  listeners: {
    include: {
      instance: true
    }
  }
} as const;

export interface EventDestinationRetryInput {
  strategy?: EventDeliveryRetryStrategy;
  maxAttempts?: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
}

class EventDestinationServiceImpl {
  private assertValidRetryInput(retry: EventDestinationRetryInput) {
    let assertInRange = (
      label: string,
      value: number | undefined,
      min: number,
      max: number
    ) => {
      if (value == undefined) return;
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new ServiceError(
          badRequestError({
            message: `retry.${label} must be a whole number between ${min} and ${max}`
          })
        );
      }
    };

    assertInRange('max_attempts', retry.maxAttempts, 1, MAX_RETRY_ATTEMPTS);
    assertInRange(
      'base_delay_seconds',
      retry.baseDelaySeconds,
      MIN_RETRY_DELAY_SECONDS,
      MAX_RETRY_DELAY_SECONDS
    );
    assertInRange(
      'max_delay_seconds',
      retry.maxDelaySeconds,
      MIN_RETRY_DELAY_SECONDS,
      MAX_RETRY_DELAY_SECONDS
    );
  }

  private assertEventDestinationActive(eventDestination: EventDestination) {
    if (eventDestination.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot perform this action on an archived event destination'
        })
      );
    }
  }

  async listEventDestinations(d: {
    organization: Organization;
    statuses?: EventDestinationStatus[];
    callbackIds?: string[];
    chatConnectionIds?: string[];
  }) {
    let targetBlocks = await buildListenerTargetOrBlocks({
      callbackIds: d.callbackIds,
      chatConnectionIds: d.chatConnectionIds
    });

    // Destination-level: must have *some* listener satisfying each supplied block independently
    // (a destination can hold both a callback listener and a chat listener at once, unlike a
    // single listener row) — so this is AND-of-some, not a single combined OR/AND on one listener.
    let destinationAnd = targetBlocks.map(block => ({ listeners: { some: block } }));

    // Nested include: surface every listener that matches *any* supplied block, for display.
    let nestedListenersWhere =
      targetBlocks.length === 0
        ? undefined
        : targetBlocks.length === 1
          ? targetBlocks[0]
          : { OR: targetBlocks };

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDestination.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid,
            status: d.statuses ? { in: d.statuses } : 'active',
            AND: destinationAnd.length ? destinationAnd : undefined
          },
          include: {
            webhookDestination: true,
            listeners: { where: nestedListenersWhere, include: { instance: true } }
          }
        })
      )
    );
  }

  async getEventDestinationById(d: {
    organization: Organization;
    eventDestinationId: string;
  }) {
    let eventDestination = await db.eventDestination.findFirst({
      where: { id: d.eventDestinationId, organizationOid: d.organization.oid },
      include: eventDestinationInclude
    });

    if (!eventDestination) {
      throw new ServiceError(
        notFoundError('organization.event_destination', d.eventDestinationId)
      );
    }

    return eventDestination;
  }

  async createEventDestination(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string | null;
      type: 'webhook';
      webhook: { url: string };
      retry?: EventDestinationRetryInput;
    };
  }) {
    assertDeliveryUrlAllowedForInput(d.input.webhook.url);
    if (d.input.retry) this.assertValidRetryInput(d.input.retry);

    return withTransaction(async db => {
      await Fabric.fire('organization.event_destination.created:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        input: { type: d.input.type }
      });

      let webhookDestination = await db.webhookDestination.create({
        data: {
          id: await ID.generateId('webhookDestination'),
          url: d.input.webhook.url,
          method: 'POST',
          signingSecret: await ID.generateId('webhookSigningSecret'),
          organizationOid: d.organization.oid
        }
      });

      let eventDestination = await db.eventDestination.create({
        data: {
          id: await ID.generateId('eventDestination'),
          name: d.input.name,
          description: d.input.description,
          status: 'active',
          type: d.input.type,
          retryStrategy: d.input.retry?.strategy,
          retryMaxAttempts: d.input.retry?.maxAttempts,
          retryBaseDelaySeconds: d.input.retry?.baseDelaySeconds,
          retryMaxDelaySeconds: d.input.retry?.maxDelaySeconds,
          organizationOid: d.organization.oid,
          webhookDestinationOid: webhookDestination.oid
        },
        include: eventDestinationInclude
      });

      await Fabric.fire('organization.event_destination.created:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination,
        input: { type: d.input.type }
      });

      return eventDestination;
    });
  }

  async updateEventDestination(d: {
    organization: Organization;
    eventDestination: EventDestination & { webhookDestination: WebhookDestination | null };
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string | null;
      webhook?: { url?: string };
      retry?: EventDestinationRetryInput;
    };
  }) {
    this.assertEventDestinationActive(d.eventDestination);
    if (d.input.webhook?.url) assertDeliveryUrlAllowedForInput(d.input.webhook.url);
    if (d.input.retry) this.assertValidRetryInput(d.input.retry);

    return withTransaction(async db => {
      await Fabric.fire('organization.event_destination.updated:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination: d.eventDestination,
        input: { name: d.input.name, description: d.input.description }
      });

      if (d.input.webhook && d.eventDestination.webhookDestinationOid) {
        await db.webhookDestination.update({
          where: { oid: d.eventDestination.webhookDestinationOid },
          data: {
            url: d.input.webhook.url
          }
        });
      }

      let eventDestination = await db.eventDestination.update({
        where: { oid: d.eventDestination.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          retryStrategy: d.input.retry?.strategy,
          retryMaxAttempts: d.input.retry?.maxAttempts,
          retryBaseDelaySeconds: d.input.retry?.baseDelaySeconds,
          retryMaxDelaySeconds: d.input.retry?.maxDelaySeconds
        },
        include: eventDestinationInclude
      });

      await Fabric.fire('organization.event_destination.updated:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination,
        previousEventDestination: d.eventDestination,
        input: { name: d.input.name, description: d.input.description }
      });

      return eventDestination;
    });
  }

  async archiveEventDestination(d: {
    organization: Organization;
    eventDestination: EventDestination;
    auditScope: AuditScope;
  }) {
    this.assertEventDestinationActive(d.eventDestination);

    return withTransaction(async db => {
      await Fabric.fire('organization.event_destination.archived:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination: d.eventDestination
      });

      let eventDestination = await db.eventDestination.update({
        where: { oid: d.eventDestination.oid },
        data: { status: 'archived', archivedAt: new Date() },
        include: eventDestinationInclude
      });

      await Fabric.fire('organization.event_destination.archived:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination,
        previousEventDestination: d.eventDestination
      });

      return eventDestination;
    });
  }

  async rotateWebhookSecret(d: {
    organization: Organization;
    eventDestination: EventDestination & { webhookDestination: WebhookDestination | null };
    auditScope: AuditScope;
  }) {
    this.assertEventDestinationActive(d.eventDestination);

    if (!d.eventDestination.webhookDestinationOid || !d.eventDestination.webhookDestination) {
      throw new ServiceError(
        badRequestError({ message: 'This event destination has no webhook to rotate' })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('organization.event_destination.webhook_secret_rotated:before', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination: d.eventDestination
      });

      let signingSecret = await ID.generateId('webhookSigningSecret');

      await db.webhookDestination.update({
        where: { oid: d.eventDestination.webhookDestinationOid! },
        data: { signingSecret }
      });

      let eventDestination = await db.eventDestination.findUniqueOrThrow({
        where: { oid: d.eventDestination.oid },
        include: eventDestinationInclude
      });

      await Fabric.fire('organization.event_destination.webhook_secret_rotated:after', {
        organization: d.organization,
        auditScope: d.auditScope,
        eventDestination,
        previousEventDestination: d.eventDestination
      });

      return { eventDestination, signingSecret };
    });
  }
}

export let eventDestinationService = Service.create(
  'eventDestinationService',
  () => new EventDestinationServiceImpl()
).build();
