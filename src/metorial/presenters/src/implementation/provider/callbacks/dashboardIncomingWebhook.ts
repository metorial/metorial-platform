import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { incomingWebhookType } from '../../../types';
import { v1IncomingWebhookPresenter } from './incomingWebhook';

export let dashboardIncomingWebhookPresenter = Presenter.create(incomingWebhookType)
  .presenter(async ({ incomingWebhook }, opts) => {
    let inner = await v1IncomingWebhookPresenter.present({ incomingWebhook }, opts).run();

    return {
      ...inner,
      details: incomingWebhook.request
        ? {
            object: 'incoming_webhook.details' as const,
            method: incomingWebhook.request.method,
            url: incomingWebhook.request.url,
            headers: incomingWebhook.request.headers,
            body: incomingWebhook.request.body
          }
        : null
    };
  })
  .schema(
    v.object({
      ...v1IncomingWebhookPresenter.schema.properties,

      details: v.nullable(
        v.object(
          {
            object: v.literal('incoming_webhook.details', {
              description: "String representing the object's type"
            }),

            method: v.string({
              name: 'method',
              description: 'HTTP method of the inbound request',
              examples: ['POST']
            }),

            url: v.string({
              name: 'url',
              description: 'URL the inbound request was sent to',
              examples: ['https://callbacks.metorial.com/w/whk_7dEfGhJkLmNpQrSt']
            }),

            headers: v.record(v.string(), {
              name: 'headers',
              description: 'Headers of the inbound request',
              examples: [{ 'content-type': 'application/json' }]
            }),

            body: v.nullable(
              v.object(
                {
                  encoding: v.literal('base64', {
                    description: 'Encoding used for the request body'
                  }),
                  content: v.string({
                    name: 'content',
                    description: 'Base64-encoded request body',
                    examples: ['eyJhY3Rpb24iOiJvcGVuZWQifQ==']
                  })
                },
                {
                  name: 'body',
                  description: 'Raw body of the inbound request'
                }
              )
            )
          },
          {
            name: 'details',
            description:
              'The inbound HTTP request as it was received. Only available in the dashboard API.'
          }
        )
      )
    }) as any
  )
  .build();
