export class RelayRegistrationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `The email sender is not registered with the relay service after ${timeoutMs}ms; check that the relay is reachable`
    );
    this.name = 'RelayRegistrationTimeoutError';
  }
}

export let whenRegistered = async <T>(promise: Promise<T>, timeoutMs = 15_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RelayRegistrationTimeoutError(timeoutMs)),
          timeoutMs
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};
