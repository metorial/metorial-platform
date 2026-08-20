import { getSentry } from '@lowerdeck/sentry';
import type { FunctionInvokeResponse } from '@metorial-platform-systems/function-bay-client';
import PQueue from 'p-queue';
import { createHash } from 'node:crypto';
import type { SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { invocationsBucketRecord, storage } from '../../storage';
import { deepClone } from '../deepClone';
import {
  collectCanonicalSlateConfigSecretStrings,
  redactWithCanonicalSlateConfigSchema
} from '../configPatch';
import { redactWebhookHeaders, redactWebhookUrl } from '../webhookRequestCapture';
import type {
  SlateInvocationBaseParams,
  SlatesRequest,
  SlatesResponse,
  StoredSlateInvocation
} from './types';
import {
  createScopedInvocationArtifactBoundary,
  sanitizeScopedInvocationValue
} from './types';

let Sentry = getSentry();

let storeQueue = new PQueue({ concurrency: 25 });

let authFieldsToRedact = [
  'output',
  'input',
  'previousInput',
  'newInput',
  'clientSecret',
  'state'
];

let sensitiveArtifactKeys = new Set([
  'suggestedsecrets',
  'capturedsecrets',
  'registrationdetails',
  'decryptedregistrationdata',
  'signingsecret'
]);

let isSensitiveInvocationMethod = (method: string | undefined) =>
  Boolean(method && method.startsWith('slates/action.trigger.webhook_'));

let bodyMetadata = (body: unknown) => {
  if (!body || typeof body !== 'object') return '[REDACTED]';
  let entry = body as Record<string, unknown>;
  let base64 =
    typeof entry.base64 === 'string'
      ? entry.base64
      : entry.encoding === 'base64' && typeof entry.content === 'string'
        ? entry.content
        : null;
  if (base64 === null) return { redacted: true };
  let bytes = Buffer.from(base64, 'base64');
  return {
    redacted: true,
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
};

/** Sanitizes every webhook/register/config artifact before persistence or reporting. */
export let sanitizeWebhookInvocationArtifact = <Value>(
  value: Value,
  method?: string,
  sentinels: readonly string[] = []
): Value => {
  let seen = new WeakMap<object, unknown>();
  let visit = (entry: unknown, key?: string, currentMethod = method): unknown => {
    if (typeof entry === 'string') {
      return sentinels
        .filter(sentinel => sentinel.length > 0)
        .reduce((result, sentinel) => result.split(sentinel).join('[REDACTED]'), entry);
    }
    if (entry === null || typeof entry !== 'object') return entry;
    let existing = seen.get(entry);
    if (existing) return existing;
    if (Array.isArray(entry)) {
      if (key?.toLowerCase() === 'headers') {
        return redactWebhookHeaders(entry as [string, string][]);
      }
      let result: unknown[] = [];
      seen.set(entry, result);
      for (let nested of entry) result.push(visit(nested, undefined, currentMethod));
      return result;
    }
    let source = entry as Record<string, unknown>;
    let entryMethod = typeof source.method === 'string' ? source.method : currentMethod;
    let result: Record<string, unknown> = {};
    seen.set(entry, result);
    for (let [nestedKey, nested] of Object.entries(source)) {
      let normalized = nestedKey.toLowerCase();
      if (sensitiveArtifactKeys.has(normalized)) {
        result[nestedKey] = '[REDACTED]';
      } else if (normalized === 'body' || normalized === 'rawbody' || normalized === 'bytes') {
        result[nestedKey] = bodyMetadata(nested);
      } else if (normalized === 'url' && typeof nested === 'string') {
        let pathParts = (() => {
          try {
            return new URL(nested).pathname.split('/').filter(Boolean);
          } catch {
            return [];
          }
        })();
        let webhookIndex = pathParts.findIndex(
          part => part === 'webhook' || part === 'receiver-webhook'
        );
        let pathSecret =
          webhookIndex >= 0 && pathParts.length > webhookIndex + 2
            ? decodeURIComponent(pathParts[webhookIndex + 2]!)
            : undefined;
        result[nestedKey] = redactWebhookUrl(nested, pathSecret);
      } else if (normalized === 'headers' && nested && typeof nested === 'object') {
        let tuples = Array.isArray(nested)
          ? (nested as [string, string][])
          : Object.entries(nested).flatMap(([name, headerValue]) =>
              typeof headerValue === 'string'
                ? ([[name, headerValue]] as [string, string][])
                : []
            );
        result[nestedKey] = redactWebhookHeaders(tuples);
      } else if (normalized === 'config' && isSensitiveInvocationMethod(entryMethod)) {
        result[nestedKey] = '[REDACTED]';
      } else {
        result[nestedKey] = visit(nested, nestedKey, entryMethod);
      }
    }
    return result;
  };
  return visit(value) as Value;
};

export let sanitizeStoredWebhookInvocationArtifact = <Value>(
  value: Value,
  sentinels = collectWebhookInvocationSentinels(value)
): Value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return sanitizeWebhookInvocationArtifact(value, undefined, sentinels);
  }
  let source = value as Record<string, unknown>;
  let requests = Array.isArray(source.requests) ? source.requests : [];
  let combinedSentinels = new Set(sentinels);
  let methodById = new Map<string, string>();
  let responses = Array.isArray(source.responses) ? source.responses : [];
  let finalSentinels = [...combinedSentinels];
  let sanitizedRequests = requests.map(request => {
    if (request && typeof request === 'object') {
      let record = request as Record<string, unknown>;
      if (typeof record.id === 'string' && typeof record.method === 'string') {
        methodById.set(record.id, record.method);
      }
      return sanitizeWebhookInvocationArtifact(
        request,
        typeof record.method === 'string' ? record.method : undefined,
        finalSentinels
      );
    }
    return request;
  });
  let sanitizedResponses = responses.map(response => {
    let id =
      response && typeof response === 'object' && typeof (response as any).id === 'string'
        ? (response as any).id
        : undefined;
    return sanitizeWebhookInvocationArtifact(
      response,
      id ? methodById.get(id) : undefined,
      finalSentinels
    );
  });
  return sanitizeWebhookInvocationArtifact(
    { ...source, requests: sanitizedRequests, responses: sanitizedResponses },
    undefined,
    finalSentinels
  ) as Value;
};

export let collectWebhookInvocationSentinels = (value: unknown) => {
  let sentinels = new Set<string>();
  let seen = new WeakSet<object>();
  let visit = (entry: unknown, key?: string) => {
    if (!entry || typeof entry !== 'object') return;
    if (seen.has(entry)) return;
    seen.add(entry);
    if (Array.isArray(entry)) {
      if (key?.toLowerCase() === 'headers') {
        for (let header of entry) {
          if (
            Array.isArray(header) &&
            header.length === 2 &&
            typeof header[0] === 'string' &&
            typeof header[1] === 'string' &&
            /(?:token|secret|signature|authorization|api[-_]?key)/i.test(header[0])
          ) {
            sentinels.add(header[1]);
          }
        }
      }
      for (let nested of entry) visit(nested);
      return;
    }
    for (let [nestedKey, nested] of Object.entries(entry as Record<string, unknown>)) {
      let normalized = nestedKey.toLowerCase();
      if (typeof nested === 'string' && sensitiveArtifactKeys.has(normalized)) {
        sentinels.add(nested);
      }
      if (normalized === 'url' && typeof nested === 'string') {
        try {
          let url = new URL(nested);
          for (let value of url.searchParams.values()) sentinels.add(value);
          let parts = url.pathname.split('/').filter(Boolean);
          if (parts.length > 0) sentinels.add(decodeURIComponent(parts.at(-1)!));
        } catch {}
      }
      if (
        (normalized === 'body' || normalized === 'rawbody') &&
        nested &&
        typeof nested === 'object'
      ) {
        let body = nested as Record<string, unknown>;
        let base64 =
          typeof body.base64 === 'string'
            ? body.base64
            : body.encoding === 'base64' && typeof body.content === 'string'
              ? body.content
              : null;
        if (base64) {
          sentinels.add(base64);
          let decoded = Buffer.from(base64, 'base64').toString('utf8');
          if (decoded.length > 0) sentinels.add(decoded);
        }
      }
      visit(nested, nestedKey);
    }
  };
  visit(value);
  return [...sentinels].filter(sentinel => sentinel.length > 0);
};

export let sanitizeInvocationRequestMessages = (requestMessages: SlatesRequest[]) =>
  requestMessages.map(message => {
    let { invocation: _invocation, ...messageWithoutInvocation } =
      message as typeof message & {
        invocation?: unknown;
      };
    if (isSensitiveInvocationMethod(message.method)) {
      return sanitizeWebhookInvocationArtifact(messageWithoutInvocation, message.method);
    }
    if (!message.method.startsWith('slates/auth.')) return messageWithoutInvocation;

    let updatedParams: any = deepClone(message.params);
    for (let field of authFieldsToRedact) {
      if (field in updatedParams) updatedParams[field] = '[REDACTED]';
    }
    return { ...messageWithoutInvocation, params: updatedParams };
  });

export type SlateInvocationProviderMetadata = {
  id: string;
  status: 'succeeded' | 'failed';
  functionVersionId: string;
  billedTimeMs: number;
  computeTimeMs: number;
  error: unknown;
};

export type SlateInvocationResult = SlateInvocationProviderMetadata & {
  logs: { timestamp: number; message: string }[];
  createdAt: Date;
};

export interface ScopedInvocationStoreDependencies {
  putObject(bucket: string, key: string, value: string): Promise<unknown>;
  updateInvocation(input: unknown): Promise<unknown>;
  captureException(error: unknown, context: unknown): void;
  logError(message: string, error: unknown): void;
}

export let storeSlateInvocation = (
  d: SlateInvocationBaseParams & {
    record: SlateInvocation;
    requestMessages: SlatesRequest[];
    responseMessages?: SlatesResponse[];
    invocationResult: FunctionInvokeResponse;
    storeDependencies?: Partial<ScopedInvocationStoreDependencies>;
  }
) => {
  let baseRedactionSecurity = d.scopedSecurity ?? d.artifactSecurity;
  let canonicalSentinels = d.canonicalConfigSchema
    ? collectCanonicalSlateConfigSecretStrings(
        [d.requestMessages, d.responseMessages],
        d.canonicalConfigSchema
      )
    : [];
  let redactionSecurity =
    baseRedactionSecurity || canonicalSentinels.length > 0
      ? {
          ...baseRedactionSecurity,
          redactionSentinels: [
            ...(baseRedactionSecurity?.redactionSentinels ?? []),
            ...canonicalSentinels
          ],
          forbiddenValues: baseRedactionSecurity?.forbiddenValues ?? []
        }
      : undefined;
  let artifacts = createScopedInvocationArtifactBoundary(redactionSecurity);
  let redactCanonical = <Value>(value: Value) =>
    d.canonicalConfigSchema
      ? redactWithCanonicalSlateConfigSchema(value, d.canonicalConfigSchema)
      : value;
  let dependencies: ScopedInvocationStoreDependencies = {
    putObject: (bucket, key, value) => storage.putObject(bucket, key, value),
    updateInvocation: input => db.slateInvocation.update(input as any),
    captureException: (error, context) => Sentry.captureException(error, context as any),
    logError: (message, error) => console.error(message, error),
    ...d.storeDependencies
  };
  return storeQueue
    .add(async () => {
      let webhookSentinels = collectWebhookInvocationSentinels([
        d.requestMessages,
        d.responseMessages
      ]);
      let hasSensitiveInvocation = d.requestMessages.some(message =>
        isSensitiveInvocationMethod(message.method)
      );
      let commonWebhookArtifacts = sanitizeStoredWebhookInvocationArtifact(
        redactCanonical({
          requests: d.requestMessages,
          responses: d.responseMessages ?? [],
          logs: d.invocationResult.logs.map(
            log => [log.timestamp, log.message] as [number, string]
          ),
          providerError: (d.invocationResult as any).error
        })
      );
      let idToMethodMap = new Map<string, SlatesRequest['method']>();

      let sanitizedRequests = sanitizeScopedInvocationValue(
        redactCanonical(sanitizeInvocationRequestMessages(d.requestMessages)),
        redactionSecurity
      ).map(m => {
        if ('id' in m && m.id) idToMethodMap.set(m.id, m.method);
        return m;
      });

      let hasResponseError = false;

      let sanitizedResponses = sanitizeScopedInvocationValue(
        redactCanonical(d.responseMessages),
        redactionSecurity
      )?.map(m => {
        if (typeof m !== 'object' || m == null) {
          console.log('Provider returned a non-object response message');
        }

        let method = 'id' in m && m.id ? idToMethodMap.get(m.id) : null;

        if ('error' in m) hasResponseError = true;

        if (isSensitiveInvocationMethod(method ?? undefined)) {
          return sanitizeWebhookInvocationArtifact(m, method ?? undefined, webhookSentinels);
        }

        if (method && 'result' in m && method.startsWith('slates/auth.')) {
          let updatedResult: any = deepClone(m.result);

          for (let field of authFieldsToRedact) {
            if (field in updatedResult) {
              updatedResult[field] = '[REDACTED]';
            }
          }

          return { ...m, result: updatedResult };
        }

        if (
          method &&
          'result' in m &&
          (method === 'slates/action.trigger.webhook_register' ||
            (method as string) === 'slates/action.trigger.webhook_bootstrap_capture')
        ) {
          let updatedResult: any = deepClone(m.result);
          if ('capturedSecrets' in updatedResult) {
            updatedResult.capturedSecrets = '[REDACTED]';
          }
          return { ...m, result: updatedResult };
        }

        return m;
      });

      let extractRequestTraces = (source: unknown) => {
        if (!source || typeof source !== 'object') return [];
        if (!('requestTraces' in source)) return [];
        let traces = (source as { requestTraces?: unknown }).requestTraces;
        return Array.isArray(traces) ? traces : [];
      };

      let requestTraces = (sanitizedResponses ?? []).flatMap(m => {
        let result = 'result' in m ? m.result : undefined;
        let error = 'error' in m ? (m as { error?: unknown }).error : undefined;
        return [...extractRequestTraces(result), ...extractRequestTraces(error)];
      });

      if (!d.invocationResult.id) {
        let storageKey = getStoredInvocationStorageKey(d.record);
        let stored = sanitizeWebhookInvocationArtifact(
          artifacts.persistence(
            redactCanonical({
              id: d.record.id,
              requests: sanitizedRequests as any,
              responses: (sanitizedResponses ?? []) as any,
              provider: sanitizeScopedInvocationValue(
                { error: commonWebhookArtifacts.providerError },
                redactionSecurity
              ) as any,
              logs: sanitizeWebhookInvocationArtifact(artifacts.logging([])),
              requestTraces: artifacts.tracing(requestTraces)
            } satisfies StoredSlateInvocation)
          ),
          undefined,
          webhookSentinels
        );
        await dependencies.putObject(
          invocationsBucketRecord.bucket,
          storageKey,
          JSON.stringify(stored)
        );

        await dependencies.updateInvocation({
          where: { oid: d.record.oid },
          data: {
            isPending: false,
            hasResponseError: hasResponseError,
            hasInvocationError: true,
            providerInvocationId: '',
            bucketOid: invocationsBucketRecord.oid
          }
        });
        return;
      }

      let provider: SlateInvocationProviderMetadata = sanitizeScopedInvocationValue(
        {
          id: d.invocationResult.id,
          status: d.invocationResult.status,
          functionVersionId: d.invocationResult.functionVersionId,
          billedTimeMs: d.invocationResult.billedTimeMs,
          computeTimeMs: d.invocationResult.computeTimeMs,
          error:
            d.invocationResult.type === 'error' ? commonWebhookArtifacts.providerError : null
        },
        redactionSecurity
      );

      let storageKey = getStoredInvocationStorageKey(d.record);
      let stored = sanitizeWebhookInvocationArtifact(
        artifacts.persistence(
          redactCanonical({
            id: d.record.id,
            requests: sanitizedRequests as any,
            responses: (sanitizedResponses ?? []) as any,
            provider,
            logs: artifacts.logging(hasSensitiveInvocation ? [] : commonWebhookArtifacts.logs),
            requestTraces: artifacts.tracing(requestTraces)
          } satisfies StoredSlateInvocation)
        ),
        undefined,
        webhookSentinels
      );
      await dependencies.putObject(
        invocationsBucketRecord.bucket,
        storageKey,
        JSON.stringify(stored)
      );

      await dependencies.updateInvocation({
        where: { oid: d.record.oid },
        data: {
          isPending: false,
          hasResponseError: hasResponseError,
          hasInvocationError: d.invocationResult.status === 'failed',
          providerInvocationId: d.invocationResult.id,
          bucketOid: invocationsBucketRecord.oid
        }
      });
    })
    .catch(err => {
      dependencies.captureException(artifacts.reporting(err), {
        extra: {
          slateInvocationOid: d.record.oid
        }
      });
      dependencies.logError('Error storing slate invocation:', artifacts.logging(err));
    });
};

export let getStoredInvocationStorageKey = (invocation: SlateInvocation) => {
  return `invocations/${invocation.id}/logs`;
};

export let getStoredAttachmentsStorageKey = (digest: string) => {
  return `attachments/${digest}`;
};
