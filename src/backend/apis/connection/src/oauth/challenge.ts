export let base64UrlEncode = (input: Uint8Array) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export let createOpaqueToken = () =>
  base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));

export let createCodeChallenge = async (codeVerifier: string) => {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
};
