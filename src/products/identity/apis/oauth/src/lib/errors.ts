export class OAuthError extends Error {
  status: number;
  error: string;
  errorMessage: string;

  constructor(d: { error: string; errorMessage: string; status?: number }) {
    super(d.errorMessage);

    this.name = 'OAuthError';
    this.status = d.status ?? 400;
    this.error = d.error;
    this.errorMessage = d.errorMessage;
  }
}
