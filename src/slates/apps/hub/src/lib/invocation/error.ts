import type { InvocationError, InvocationResult } from './types';

export let getStackError = (results: InvocationResult[]) => {
  for (let result of results) {
    if (result.status === 'error') {
      return result.error;
    }
  }

  return null;
};

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export let getInvocationErrorCode = (error: InvocationError) => {
  if (typeof error.upstreamCode === 'string' && error.upstreamCode) return error.upstreamCode;

  let serviceErrorData = isRecord(error.baggage) ? error.baggage.serviceErrorData : undefined;
  let upstreamCode = isRecord(serviceErrorData) ? serviceErrorData.upstreamCode : undefined;

  return typeof upstreamCode === 'string' && upstreamCode ? upstreamCode : error.code;
};

type SuccessDataTuple<T extends readonly InvocationResult[]> = {
  [K in keyof T]: Extract<T[K], { status: 'success' }>['data'];
};

export let getStackResultsOrThrow = <Results extends readonly InvocationResult[]>(
  results: Results
): SuccessDataTuple<Results> =>
  results.map(result => {
    if (result.status === 'error') {
      throw new Error(`Invocation failed: [${result.error.code}] ${result.error.message}`);
    }

    return result.data;
  }) as SuccessDataTuple<Results>;
