import { v } from '@lowerdeck/validation';
import {
  AuditLogDestinationError,
  destination,
  readAuditLogDestinationResponseBody
} from '../destination';

export let splunkProviderDataSchema = v.object({
  endpoint: v.string({ modifiers: [v.url()] }),
  token: v.string({ modifiers: [v.minLength(1)] }),
  index: v.optional(v.string()),
  source: v.optional(v.string()),
  sourcetype: v.optional(v.string())
});

export let splunkDestination = destination({
  providerData: splunkProviderDataSchema,

  sanitizeProviderData(providerData) {
    return {
      endpoint: providerData.endpoint,
      ...(providerData.index === undefined ? {} : { index: providerData.index }),
      ...(providerData.source === undefined ? {} : { source: providerData.source }),
      ...(providerData.sourcetype === undefined ? {} : { sourcetype: providerData.sourcetype })
    };
  },

  async deliver({ providerData, events }) {
    if (events.length == 0) return;

    let response = await fetch(providerData.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Splunk ${providerData.token}`
      },
      body: events
        .map(event =>
          JSON.stringify({
            time: event.recordedAt.getTime() / 1000,
            event,
            ...(providerData.index === undefined ? {} : { index: providerData.index }),
            ...(providerData.source === undefined ? {} : { source: providerData.source }),
            ...(providerData.sourcetype === undefined
              ? {}
              : { sourcetype: providerData.sourcetype })
          })
        )
        .join('\n')
    });

    if (!response.ok) {
      throw new AuditLogDestinationError(
        `Splunk audit log delivery failed with HTTP ${response.status}${
          response.statusText ? ` ${response.statusText}` : ''
        }`,
        {
          code: 'http_error',
          httpStatusCode: response.status,
          httpStatusText: response.statusText || null,
          providerErrorCode: null,
          responseBody: await readAuditLogDestinationResponseBody(response, [
            providerData.token
          ])
        }
      );
    }

    let responseBody = await readAuditLogDestinationResponseBody(response, [
      providerData.token
    ]);
    let responseData: unknown;
    try {
      responseData = responseBody ? JSON.parse(responseBody) : null;
    } catch {
      responseData = null;
    }

    if (
      typeof responseData != 'object' ||
      responseData === null ||
      !('code' in responseData) ||
      responseData.code !== 0
    ) {
      let code =
        typeof responseData == 'object' && responseData !== null && 'code' in responseData
          ? String(responseData.code)
          : 'unknown';
      throw new AuditLogDestinationError(
        `Splunk audit log delivery failed with response code ${code}`,
        {
          code: 'provider_error',
          httpStatusCode: response.status,
          httpStatusText: response.statusText || null,
          providerErrorCode: code,
          responseBody
        }
      );
    }
  }
});
