export let oauthErrorDescriptions = {
  invalid_request: 'The request is missing a required parameter or is malformed.',
  unauthorized_client: 'This client is not authorized to use the requested grant type.',
  access_denied: 'The user denied the request or access is not allowed.',
  unsupported_response_type: 'The server does not support the response type in the request.',
  invalid_scope: 'The requested scope is invalid, unknown, or malformed.',
  server_error: 'An internal server error occurred. Try again later.',
  temporarily_unavailable:
    'The authorization server is currently unavailable. Try again later.',
  invalid_client: 'Client authentication failed. Check the client ID and secret.',
  invalid_grant:
    'The authorization code, refresh token, or credentials are invalid or expired.',
  unsupported_grant_type: 'The server does not support the requested grant type.',
  interaction_required: 'User interaction is required to complete the request.',
  login_required: 'User must log in before the request can be completed.',
  consent_required: 'User consent is required before access can be granted.',
  account_selection_required: 'User needs to select an account before proceeding.',
  bad_verification_code: 'The authorization code is incorrect or expired (GitHub-specific).',
  incorrect_client_credentials: 'Client credentials are incorrect (GitHub-specific).'
} as Record<string, string>;
