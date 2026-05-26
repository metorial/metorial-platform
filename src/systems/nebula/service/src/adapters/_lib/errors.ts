export class NebulaAdapterError extends Error {
  readonly code: string;
  readonly safeMessage: string;
  override readonly cause: unknown;

  constructor(code: string, safeMessage: string, cause?: unknown) {
    super(safeMessage);
    this.name = 'NebulaAdapterError';
    this.code = code;
    this.safeMessage = safeMessage;
    this.cause = cause;
  }
}

export let normalizeAdapterError = (err: unknown) => {
  if (err instanceof NebulaAdapterError) return err;

  let anyErr = err as any;
  let code = String(anyErr?.name ?? anyErr?.code ?? 'provider_error');
  let message = String(anyErr?.message ?? 'Provider operation failed');

  return new NebulaAdapterError(code, message, err);
};
