import { v } from '@lowerdeck/validation';
import { destination } from '../destination';

export let datadogProviderDataSchema = v.object({
  apiKey: v.string({ modifiers: [v.minLength(1)] }),
  site: v.string({
    modifiers: [
      v.regex(/^[a-z0-9.-]+$/i, {
        message: 'Must be a Datadog site hostname.'
      })
    ]
  })
});

export let datadogDestination = destination({
  providerData: datadogProviderDataSchema,

  sanitizeProviderData(providerData) {
    return { site: providerData.site };
  },

  async deliver({ providerData, events }) {
    if (events.length == 0) return;

    let response = await fetch(`https://http-intake.logs.${providerData.site}/api/v2/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': providerData.apiKey
      },
      body: JSON.stringify(
        events.map(event => ({
          message: `${event.resource}.${event.action}`,
          service: 'metorial',
          ddsource: 'metorial-audit-log',
          status: 'info',
          timestamp: event.recordedAt,
          audit_log: event
        }))
      )
    });

    if (!response.ok) {
      throw new Error(
        `Datadog audit log delivery failed with HTTP ${response.status}${
          response.statusText ? ` ${response.statusText}` : ''
        }`
      );
    }
  }
});
