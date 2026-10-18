let isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'P2002';

export let retryOnOidCollision = async <T>(
  write: () => Promise<T>,
  opts: { maxAttempts?: number } = {}
): Promise<T> => {
  let maxAttempts = opts.maxAttempts ?? 3;
  let attempt = 0;

  while (true) {
    attempt++;

    try {
      return await write();
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt >= maxAttempts) throw error;
    }
  }
};
