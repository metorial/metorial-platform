export type PublicMcpOAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_token'
  | 'invalid_scope'
  | 'invalid_target'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'access_denied'
  | 'temporarily_unavailable'
  | 'server_error'
  | 'slow_down';

export class PublicMcpOAuthError extends Error {
  readonly object = 'PublicMcpOAuthError' as const;

  constructor(
    readonly error: PublicMcpOAuthErrorCode,
    readonly description: string,
    readonly opts: {
      status?: number;
      // Only set once the redirect_uri has been validated against the client registration.
      redirectUri?: string;
      state?: string | null;
    } = {}
  ) {
    super(description);
  }

  get status() {
    return (
      this.opts.status ??
      (this.error === 'invalid_client' || this.error === 'invalid_token' ? 401 : 400)
    );
  }

  toJSON() {
    return { error: this.error, error_description: this.description };
  }

  toRedirectUrl() {
    if (!this.opts.redirectUri) return null;

    let url = new URL(this.opts.redirectUri);
    url.searchParams.set('error', this.error);
    url.searchParams.set('error_description', this.description);
    if (this.opts.state) url.searchParams.set('state', this.opts.state);

    return url.toString();
  }
}

export let isPublicMcpOAuthError = (err: unknown): err is PublicMcpOAuthError =>
  err instanceof PublicMcpOAuthError ||
  (!!err && typeof err === 'object' && (err as any).object === 'PublicMcpOAuthError');
