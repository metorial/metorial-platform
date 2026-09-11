export class TimeoutError extends Error {
  constructor(
    readonly label: string,
    readonly ms: number
  ) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export let withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};
