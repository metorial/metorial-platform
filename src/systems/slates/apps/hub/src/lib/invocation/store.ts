import { delay } from '@lowerdeck/delay';
import { getSentry } from '@lowerdeck/sentry';
import PQueue from 'p-queue';
import type { SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { functionBay, functionBayTenant } from '../../functionBay';
import { invocationsBucketRecord, storage } from '../../storage';
import type {
  SlateInvocationBaseParams,
  SlatesRequest,
  SlatesResponse,
  StoredSlateInvocation
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

let getFunctionBayInvocationResultWithRetry = async (
  d: SlateInvocationBaseParams & { invocationId: string }
) => {
  if (!d.invocationId) {
    throw new Error('invocationId is required for getFunctionBayInvocationResultWithRetry');
  }

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await functionBay.functionInvocation.get({
        tenantId: (await functionBayTenant).id,
        functionId: d.slateVersion.providerDeploymentInfo?.functionId!,
        functionInvocationId: d.invocationId
      });
    } catch (err) {
      if (attempt === 5) throw err;

      await delay(200 * attempt);
    }
  }
};

export type SlateInvocationResult = Awaited<
  ReturnType<typeof getFunctionBayInvocationResultWithRetry>
>;

export let storeSlateInvocation = (
  d: SlateInvocationBaseParams & {
    record: SlateInvocation;
    requestMessages: SlatesRequest[];
    responseMessages?: SlatesResponse[];
    invocationResult: Awaited<ReturnType<typeof functionBay.function.invoke>>;
  }
) => {
  storeQueue
    .add(async () => {
      await delay(1000); // Wait for function bay invocation logs to be available

      let idToMethodMap = new Map<string, SlatesRequest['method']>();

      let sanitizedRequests = d.requestMessages.map(m => {
        if ('id' in m && m.id) idToMethodMap.set(m.id, m.method);

        if (m.method.startsWith('slates/auth.')) {
          let updatedParams: any = m.params;

          for (let field of authFieldsToRedact) {
            if (field in m.params) {
              updatedParams[field] = '[REDACTED]';
            }
          }

          return { ...m, params: updatedParams };
        }

        return m;
      });

      let hasResponseError = false;

      let sanitizedResponses = d.responseMessages?.map(m => {
        if (typeof m !== 'object' || m == null) console.log('Non-object response message:', m);

        let method = 'id' in m && m.id ? idToMethodMap.get(m.id) : null;

        if ('error' in m) hasResponseError = true;

        if (method && 'result' in m && method.startsWith('slates/auth.')) {
          let updatedResult: any = m.result;

          for (let field of authFieldsToRedact) {
            if (field in m.result) {
              updatedResult[field] = '[REDACTED]';
            }
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

      let requestTraces = (d.responseMessages ?? []).flatMap(m => {
        let result = 'result' in m ? m.result : undefined;
        let error = 'error' in m ? (m as { error?: unknown }).error : undefined;
        return [...extractRequestTraces(result), ...extractRequestTraces(error)];
      });

      // Handle error case where invocationResult.id may be undefined
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

      let invocationResult = await getFunctionBayInvocationResultWithRetry({
        slateVersion: d.slateVersion,
        participants: d.participants,
        invocationId: d.invocationResult.id
      });

      let storageKey = getStoredInvocationStorageKey(d.record);
      await storage.putObject(
        invocationsBucketRecord.bucket,
        storageKey,
        JSON.stringify({
          id: d.record.id,
          requests: sanitizedRequests as any,
          responses: (sanitizedResponses ?? []) as any,
          provider: { ...invocationResult, logs: undefined } as any,
          // @ts-ignore
          logs: invocationResult.logs.map(log => [log.timestamp, log.message] as const),
          requestTraces
        } satisfies StoredSlateInvocation)
      );

      await db.slateInvocation.update({
        where: { oid: d.record.oid },
        data: {
          isPending: false,
          hasResponseError: hasResponseError,
          hasInvocationError: invocationResult.status === 'failed',

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
