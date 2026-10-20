export let testContext = () => ({ ip: '127.0.0.1', ua: 'metorial-e2e' });

export let firstPage = async <T>(
  paginator: { run: (input: { limit?: number }) => Promise<{ items: T[] }> },
  limit = 100
) => (await paginator.run({ limit })).items;

/** Resolves with the error a promise rejects with (e.g. a `ServiceError` from an RPC client). */
export let rejectionOf = async (promise: Promise<unknown>): Promise<any> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
};

export let uniqueEmail = (prefix = 'e2e') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@e2e.metorial.test`;
