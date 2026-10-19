export let withBrandingFallback = async <T>(
  attempt: (withBranding: boolean) => Promise<T>,
  onFallback?: (error: unknown) => void
): Promise<T> => {
  try {
    return await attempt(true);
  } catch (error) {
    onFallback?.(error);

    return await attempt(false);
  }
};
