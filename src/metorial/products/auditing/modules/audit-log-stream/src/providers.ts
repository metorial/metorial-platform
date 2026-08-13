import { ServiceError, validationError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';

export let datadogProviderDataSchema = v.object({
  apiKey: v.string(),
  site: v.string()
});

export let splunkProviderDataSchema = v.object({
  endpoint: v.string({ modifiers: [v.url()] }),
  token: v.string(),
  index: v.optional(v.string()),
  source: v.optional(v.string()),
  sourcetype: v.optional(v.string())
});

export type DatadogProviderData = {
  apiKey: string;
  site: string;
};

export type SplunkProviderData = {
  endpoint: string;
  token: string;
  index?: string;
  source?: string;
  sourcetype?: string;
};

export type AuditLogStreamProviderData = {
  datadog: DatadogProviderData;
  splunk: SplunkProviderData;
};

export type AuditLogStreamProvider = keyof AuditLogStreamProviderData;

type ProviderAdapter<Provider extends AuditLogStreamProvider> = {
  schema: Provider extends 'datadog'
    ? typeof datadogProviderDataSchema
    : typeof splunkProviderDataSchema;
};

export let auditLogStreamProviderAdapters: {
  [Provider in AuditLogStreamProvider]: ProviderAdapter<Provider>;
} = {
  datadog: {
    schema: datadogProviderDataSchema
  },
  splunk: {
    schema: splunkProviderDataSchema
  }
};

export let validateAuditLogStreamProviderData = <Provider extends AuditLogStreamProvider>(
  provider: Provider,
  providerData: Record<string, unknown>
): AuditLogStreamProviderData[Provider] => {
  let validation = auditLogStreamProviderAdapters[provider].schema.validate(providerData);
  if (!validation.success) {
    throw new ServiceError(
      validationError({
        entity: 'providerData',
        errors: validation.errors
      })
    );
  }

  return validation.value as AuditLogStreamProviderData[Provider];
};

export let sanitizeAuditLogStreamProviderData = <Provider extends AuditLogStreamProvider>(
  provider: Provider,
  providerData: AuditLogStreamProviderData[Provider]
): Record<string, string> => {
  if (provider === 'datadog') {
    let data = providerData as DatadogProviderData;
    return { site: data.site };
  }

  let data = providerData as SplunkProviderData;
  return {
    endpoint: data.endpoint,
    ...(data.index === undefined ? {} : { index: data.index }),
    ...(data.source === undefined ? {} : { source: data.source }),
    ...(data.sourcetype === undefined ? {} : { sourcetype: data.sourcetype })
  };
};
