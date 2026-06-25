import type { InvocationResult } from './types';

export let getStackError = (results: InvocationResult[]) => {
  for (let result of results) {
    if (result.status === 'error') {
      return result.error;
    }
  }

  return null;
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
