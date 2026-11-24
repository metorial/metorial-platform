// Node APIs such as dns.lookup cannot be cancelled, so the pending call is abandoned instead.
export let abortable = <T>(promise: Promise<T>, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      promise.catch(() => {});
      return reject(signal.reason);
    }

    let onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
