import type { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';
import type { AuditLog } from '@metorial/module-audit-log';

export type AuditLogDestinationEvent = AuditLog;

export type AuditLogDestinationErrorDetails = {
  code: 'http_error' | 'provider_error';
  httpStatusCode: number | null;
  httpStatusText: string | null;
  providerErrorCode: string | null;
  responseBody: string | null;
};

export class AuditLogDestinationError extends Error {
  constructor(
    message: string,
    readonly details: AuditLogDestinationErrorDetails
  ) {
    super(message);
    this.name = 'AuditLogDestinationError';
  }
}

export let readAuditLogDestinationResponseBody = async (
  response: Response,
  sensitiveValues: string[]
) => {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return null;
  }

  let sanitizedBody = sensitiveValues
    .filter(value => value.length > 0)
    .reduce((value, sensitiveValue) => value.replaceAll(sensitiveValue, '[REDACTED]'), body)
    .trim();

  return sanitizedBody ? sanitizedBody.slice(0, 4000) : null;
};

export type AuditLogDestinationDefinition<ProviderData extends ValidationType<any>> = {
  providerData: ProviderData;
  sanitizeProviderData: (
    providerData: ValidationTypeValue<ProviderData>
  ) => Record<string, string>;
  deliver: (d: {
    providerData: ValidationTypeValue<ProviderData>;
    events: AuditLogDestinationEvent[];
  }) => Promise<void>;
};

export type InferAuditLogDestinationProviderData<Destination> =
  Destination extends AuditLogDestinationDefinition<infer ProviderData>
    ? ValidationTypeValue<ProviderData>
    : never;

export let destination = <ProviderData extends ValidationType<any>>(
  definition: AuditLogDestinationDefinition<ProviderData>
) => definition;
