export let isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'P2002';

export let withUniqueConstraintRecovery = async <T>(
  write: () => Promise<T>,
  recover: () => Promise<T | null>
): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    let existing = await recover();
    if (!existing) throw error;

    return existing;
  }
};
