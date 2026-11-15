import { ServiceError, validationError } from '@lowerdeck/error';
import type { ValidationType } from '@lowerdeck/validation';
import { datadogDestination } from './datadog';
import type {
  AuditLogDestinationDefinition,
  AuditLogDestinationEvent,
  InferAuditLogDestinationProviderData
} from './destination';
import { splunkDestination } from './splunk';

export * from './datadog';
export * from './destination';
export * from './splunk';

export let auditLogStreamDestinations = {
  datadog: datadogDestination,
  splunk: splunkDestination
};

export type AuditLogStreamProvider = keyof typeof auditLogStreamDestinations;

export type AuditLogStreamProviderData = {
  [Provider in AuditLogStreamProvider]: InferAuditLogDestinationProviderData<
    (typeof auditLogStreamDestinations)[Provider]
  >;
};

let getAuditLogStreamDestination = <Provider extends AuditLogStreamProvider>(
  provider: Provider
) =>
  auditLogStreamDestinations[provider] as AuditLogDestinationDefinition<
    ValidationType<AuditLogStreamProviderData[Provider]>
  >;

export let validateAuditLogStreamProviderData = <Provider extends AuditLogStreamProvider>(
  provider: Provider,
  providerData: Record<string, unknown>
): AuditLogStreamProviderData[Provider] => {
  let validation = getAuditLogStreamDestination(provider).providerData.validate(providerData);
  if (!validation.success) {
    throw new ServiceError(
      validationError({
        entity: 'providerData',
        errors: validation.errors
      })
    );
  }

  return validation.value;
};

export let sanitizeAuditLogStreamProviderData = <Provider extends AuditLogStreamProvider>(
  provider: Provider,
  providerData: AuditLogStreamProviderData[Provider]
): Record<string, string> =>
  getAuditLogStreamDestination(provider).sanitizeProviderData(providerData);

export let deliverAuditLogStreamEvents = async <Provider extends AuditLogStreamProvider>(d: {
  provider: Provider;
  providerData: AuditLogStreamProviderData[Provider];
  events: AuditLogDestinationEvent[];
}) => {
  await getAuditLogStreamDestination(d.provider).deliver({
    providerData: d.providerData,
    events: d.events
  });
};
