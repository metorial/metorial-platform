export let getSsoAuthCompletionRedirect = (input: {
  redirectUri: string;
  purpose: 'authentication' | 'connection_test';
  tenantId: string;
  authId: string;
  testSsoId?: string;
}) => {
  let redirectUri = new URL(input.redirectUri);

  if (input.purpose === 'connection_test') {
    if (!input.testSsoId) throw new Error('Missing SSO test ID.');
    redirectUri.searchParams.set('test_sso_id', input.testSsoId);
    return { url: redirectUri.toString() };
  }

  redirectUri.searchParams.set('tenant_id', input.tenantId);
  redirectUri.searchParams.set('auth_id', input.authId);
  return { url: redirectUri.toString() };
};
