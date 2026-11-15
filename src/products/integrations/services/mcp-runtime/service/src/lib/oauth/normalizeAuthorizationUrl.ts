export let normalizeAuthorizationUrl = (rawUrl: string) => {
  let authorizationUrl = rawUrl.trim();

  if (!authorizationUrl.startsWith('https://')) {
    authorizationUrl = authorizationUrl.replace(/^[a-z][a-z0-9+.-]*:\/*/i, '');
    authorizationUrl = authorizationUrl.replace(/^\/+/, '');
    authorizationUrl = `https://${authorizationUrl}`;
  }

  let url = new URL(authorizationUrl);
  url.protocol = 'https:';
  url.username = '';
  url.password = '';

  return url.toString();
};
