let withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export let integrationsUrl = (baseUrl: string, pathname: string, search = '') =>
  `${withoutTrailingSlash(baseUrl)}${pathname}${search}`;

export let integrationsRedirectUrl = (baseUrl: string, pathname: string, requestUrl: string) =>
  integrationsUrl(baseUrl, pathname, new URL(requestUrl).search);
