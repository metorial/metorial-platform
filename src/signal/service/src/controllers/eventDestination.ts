import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDestinationPresenter } from '../presenters';
import {
  eventDestinationService,
  senderService,
  webhookDestinationSigningSecretService
} from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let eventDestinationController = app.controller({
  rotateSigningSecret: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string(),
        graceMs: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let destination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });
      let webhook = destination.currentInstance?.webhook;
      if (!webhook) throw new Error('Event destination has no active webhook');
      let result = await webhookDestinationSigningSecretService.rotate({
        tenant: ctx.tenant,
        webhookId: webhook.id,
        graceMs: ctx.input.graceMs
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status,
          validFrom: result.secret.validFrom,
          validUntil: result.secret.validUntil
        },
        secretIssuanceReceipt: result.receipt,
        graceExpiresAt: result.graceExpiresAt,
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  revokeSigningSecret: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string(),
        secretId: v.string()
      })
    )
    .do(async ctx => {
      let destination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });
      let webhook = destination.currentInstance?.webhook;
      if (!webhook) throw new Error('Event destination has no active webhook');
      let result = await webhookDestinationSigningSecretService.revoke({
        tenant: ctx.tenant,
        webhookId: webhook.id,
        secretId: ctx.input.secretId
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status,
          validFrom: result.secret.validFrom,
          validUntil: result.secret.validUntil
        },
        secretIssuanceReceipt: null,
        graceExpiresAt: null,
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  consumeSigningSecretReceipt: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string(),
        receiptId: v.string(),
        receiptToken: v.string()
      })
    )
    .do(async ctx => {
      let destination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });
      let webhook = destination.currentInstance?.webhook;
      if (!webhook) throw new Error('Event destination has no active webhook');
      return await webhookDestinationSigningSecretService.consumeReceipt({
        tenant: ctx.tenant,
        webhookId: webhook.id,
        receiptId: ctx.input.receiptId,
        token: ctx.input.receiptToken
      });
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        senderId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        eventTypes: v.nullable(v.array(v.string())),

        retry: v.optional(
          v.object({
            type: v.enumOf(['exponential', 'linear']),
            delaySeconds: v.number(),
            maxAttempts: v.number()
          })
        ),

        variant: v.object({
          type: v.enumOf(['http_endpoint']),
          url: v.string(),
          method: v.enumOf(['POST', 'PUT', 'PATCH'])
        })
      })
    )
    .do(async ctx => {
      let sender = await senderService.getSenderById({ id: ctx.input.senderId });

      let created = await eventDestinationService.createEventDestination({
        tenant: ctx.tenant,
        sender,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          eventTypes: ctx.input.eventTypes ?? undefined,
          retry: ctx.input.retry,
          variant: ctx.input.variant
        }
      });

      return {
        ...eventDestinationPresenter(created.eventDestination),
        secretIssuanceReceipt: created.secretIssuanceReceipt
      };
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string()
      })
    )
    .do(async ctx => {
      let eventDestination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });

      return eventDestinationPresenter(eventDestination);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await eventDestinationService.listEventDestinations({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i => eventDestinationPresenter(i));
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        eventTypes: v.optional(v.nullable(v.array(v.string()))),

        retry: v.optional(
          v.object({
            type: v.enumOf(['exponential', 'linear']),
            delaySeconds: v.number(),
            maxAttempts: v.number()
          })
        ),

        variant: v.optional(
          v.object({
            type: v.enumOf(['http_endpoint']),
            url: v.string(),
            method: v.enumOf(['POST', 'PUT', 'PATCH'])
          })
        )
      })
    )
    .do(async ctx => {
      let eventDestination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });

      eventDestination = await eventDestinationService.updateEventDestination({
        eventDestination,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          eventTypes: ctx.input.eventTypes ?? undefined,
          retry: ctx.input.retry,
          variant: ctx.input.variant
        }
      });

      return eventDestinationPresenter(eventDestination);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDestinationId: v.string()
      })
    )
    .do(async ctx => {
      let eventDestination = await eventDestinationService.getEventDestinationById({
        id: ctx.input.eventDestinationId,
        tenant: ctx.tenant
      });

      eventDestination = await eventDestinationService.deleteEventDestination({
        eventDestination
      });

      return eventDestinationPresenter(eventDestination);
    })
});
