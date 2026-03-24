import { SlateError } from './base';

export class SlateDeclarationError extends SlateError {
  constructor(message: string) {
    super(`[Declaration Error]: ${message}`);
    this.name = 'SlateError.DeclarationError';
  }

  static is(error: unknown): error is SlateDeclarationError {
    return error instanceof SlateDeclarationError;
  }
}
