import { getSentry } from '@lowerdeck/sentry';
import type { FunctionInvokeResponse } from '@metorial-platform-systems/function-bay-client';
import PQueue from 'p-queue';
import type { SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { invocationsBucketRecord, storage } from '../../storage';
import { deepClone } from '../deepClone';
import type {
  SlateInvocationBaseParams,
  SlatesRequest,
  SlatesResponse,
  StoredSlateInvocation
} from './types';
import { sanitizeScopedInvocationValue } from './types';

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

export let storeSlateInvocation = (
  d: SlateInvocationBaseParams & {
    record: SlateInvocation;
    requestMessages: SlatesRequest[];
    responseMessages?: SlatesResponse[];
    invocationResult: FunctionInvokeResponse;
  }
) => {
  storeQueue
    .add(async () => {
      let idToMethodMap = new Map<string, SlatesRequest['method']>();

      let sanitizedRequests = d.requestMessages.map(m => {
        if ('id' in m && m.id) idToMethodMap.set(m.id, m.method);

        if (m.method.startsWith('slates/auth.')) {
          let updatedParams: any = deepClone(m.params);

          for (let field of authFieldsToRedact) {
            if (field in updatedParams) {
              updatedParams[field] = '[REDACTED]';
            }
          }

          return { ...m, params: updatedParams };
        }

        return m;
      });
      sanitizedRequests = sanitizeScopedInvocationValue(
        sanitizedRequests,
        d.scopedSecurity ?? d.artifactSecurity
      );

      let hasResponseError = false;

      let sanitizedResponses = d.responseMessages?.map(m => {
        if (typeof m !== 'object' || m == null) console.log('Non-object response message:', m);

        let method = 'id' in m && m.id ? idToMethodMap.get(m.id) : null;

        if ('error' in m) hasResponseError = true;

        if (method && 'result' in m && method.startsWith('slates/auth.')) {
          let updatedResult: any = deepClone(m.result);

          for (let field of authFieldsToRedact) {
            if (field in updatedResult) {
              updatedResult[field] = '[REDACTED]';
            }
          }

          return { ...m, result: updatedResult };
        }

        return m;
      });
      sanitizedResponses = sanitizeScopedInvocationValue(
        sanitizedResponses,
        d.scopedSecurity ?? d.artifactSecurity
      );

      let extractRequestTraces = (source: unknown) => {
        if (!source || typeof source !== 'object') return [];
        if (!('requestTraces' in source)) return [];
        let traces = (source as { requestTraces?: unknown }).requestTraces;
        return Array.isArray(traces) ? traces : [];
      };

      let requestTraces = (d.responseMessages ?? []).flatMap(m => {
        let result = 'result' in m ? m.result : undefined;
        let error = 'error' in m ? (m as { error?: unknown }).error : undefined;
        return [...extractRequestTraces(result), ...extractRequestTraces(error)];
      });

      if (!d.invocationResult.id) {
        let storageKey = getStoredInvocationStorageKey(d.record);
        await storage.putObject(
          invocationsBucketRecord.bucket,
          storageKey,
          JSON.stringify({
            id: d.record.id,
            requests: sanitizedRequests as any,
            responses: (sanitizedResponses ?? []) as any,
            provider: { error: (d.invocationResult as any).error } as any,
            logs: [],
            requestTraces
          } satisfies StoredSlateInvocation)
        );

        await db.slateInvocation.update({
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

      let provider: SlateInvocationProviderMetadata = {
        id: d.invocationResult.id,
        status: d.invocationResult.status,
        functionVersionId: d.invocationResult.functionVersionId,
        billedTimeMs: d.invocationResult.billedTimeMs,
        computeTimeMs: d.invocationResult.computeTimeMs,
        error: d.invocationResult.type === 'error' ? d.invocationResult.error : null
      };

      let storageKey = getStoredInvocationStorageKey(d.record);
      await storage.putObject(
        invocationsBucketRecord.bucket,
        storageKey,
        JSON.stringify({
          id: d.record.id,
          requests: sanitizedRequests as any,
          responses: (sanitizedResponses ?? []) as any,
          provider,
          logs: sanitizeScopedInvocationValue(
            d.invocationResult.logs.map(log => [log.timestamp, log.message] as const),
            d.scopedSecurity ?? d.artifactSecurity
          ),
          requestTraces
        } satisfies StoredSlateInvocation)
      );

      await db.slateInvocation.update({
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
      Sentry.captureException(err, {
        extra: {
          slateInvocationOid: d.record.oid
        }
      });
      console.error('Error storing slate invocation:', err);
    });
};

export let getStoredInvocationStorageKey = (invocation: SlateInvocation) => {
  return `invocations/${invocation.id}/logs`;
};

export let getStoredAttachmentsStorageKey = (digest: string) => {
  return `attachments/${digest}`;
};
