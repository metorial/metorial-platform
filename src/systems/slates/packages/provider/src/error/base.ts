export class SlateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlateError';
  }

  static is(error: unknown): error is SlateError {
    return error instanceof SlateError;
  }
}
