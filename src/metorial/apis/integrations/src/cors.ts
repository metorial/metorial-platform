let localDevelopmentOrigin = (origin: string) => {
  try {
    let url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
};

let configuredOrigins = (domains: string | undefined) =>
  (domains ?? '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export let isIntegrationsCorsOriginAllowed = (d: {
  origin: string;
  integrationsUiUrl: string;
  corsDomains?: string;
  allowCors?: string;
  isDevelopment?: boolean;
}) => {
  if (d.allowCors === 'true' || d.allowCors === '*') return true;

  let normalizedOrigin = d.origin.replace(/\/+$/, '');
  let uiOrigin = new URL(d.integrationsUiUrl).origin;
  if (normalizedOrigin === uiOrigin) return true;

  if (configuredOrigins(d.corsDomains).includes(normalizedOrigin)) return true;
  return !!d.isDevelopment && localDevelopmentOrigin(normalizedOrigin);
};
