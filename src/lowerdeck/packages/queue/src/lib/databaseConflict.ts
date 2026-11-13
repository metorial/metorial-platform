// Serialization failures and deadlocks, which the queue retries on its own.
export let getDatabaseConflictCode = (error: unknown) => {
  let seen = new Set<object>();

  let inspect = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object' || seen.has(value)) return undefined;
    seen.add(value);

    let candidate = value as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      meta?: unknown;
      driverAdapterError?: unknown;
    };

    if (
      candidate.code === 'P2034' ||
      candidate.code === '40P01' ||
      candidate.code === '40001'
    ) {
      return candidate.code;
    }

    if (candidate.message === 'deadlock detected') return '40P01';

    return (
      inspect(candidate.cause) ||
      inspect(candidate.meta) ||
      inspect(candidate.driverAdapterError)
    );
  };

  return inspect(error);
};
