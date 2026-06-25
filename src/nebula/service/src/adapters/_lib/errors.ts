export class KeyProviderAdapterError extends Error {
  readonly code: string;
  readonly safeMessage: string;
  override readonly cause: unknown;

  constructor(code: string, safeMessage: string, cause?: unknown) {
    super(safeMessage);
    this.name = 'KeyProviderAdapterError';
    this.code = code;
    this.safeMessage = safeMessage;
    this.cause = cause;
  }
}

export let normalizeAdapterError = (err: unknown) => {
  if (err instanceof KeyProviderAdapterError) return err;

  let anyErr = err as any;
  let code = String(anyErr?.name ?? anyErr?.code ?? 'provider_error');
  let message = String(anyErr?.message ?? 'Provider operation failed');

  return new KeyProviderAdapterError(code, message, err);
};
