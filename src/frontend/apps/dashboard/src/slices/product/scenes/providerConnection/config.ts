export let getDefaultOAuthConfig = (d: { providerUrl: string }) => `{
  // Adapt these values to match your OAuth provider
  "issuer": "${d.providerUrl}",
  "token_endpoint": "${d.providerUrl}/token",
  "authorization_endpoint": "${d.providerUrl}/authorize",

  // Ensure that these values are correct for your OAuth provider
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["plain"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
}`;

export let parseConfig = (config: string) => {
  let input = config
    .trim()
    .split('\n')
    .map(l => {
      let [data] = l.split('//');
      if (data.trim() == '') return '';
      return l;
    })
    .join('\n');

  return JSON.parse(input);
};
