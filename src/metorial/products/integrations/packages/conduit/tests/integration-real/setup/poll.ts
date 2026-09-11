export let sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export let waitFor = async <T>(
  fn: () => Promise<T> | T,
  opts: WaitForOptions = {}
): Promise<T> => {
  let timeout = opts.timeout ?? 10000;
  let interval = opts.interval ?? 100;
  let deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      let result = await fn();
      if (result) return result;
    } catch (err) {
      lastError = err;
    }
    await sleep(interval);
  }

  let suffix = opts.message ? `: ${opts.message}` : '';
  let errInfo = lastError
    ? ` (last error: ${lastError instanceof Error ? lastError.message : String(lastError)})`
    : '';
  throw new Error(`waitFor timed out after ${timeout}ms${suffix}${errInfo}`);
};
