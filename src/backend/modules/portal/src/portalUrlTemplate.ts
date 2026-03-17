let portalTemplatePlaceholder = '__portal__';

let escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

let getUrlPort = (url: URL) => {
  if (url.port) {
    return url.port;
  }

  return url.protocol == 'https:' ? '443' : '80';
};

export let getPortalUrlTemplate = (template: string) => {
  let raw = template.replace(/\/+$/, '');
  if (raw.includes('{portalId}')) return raw;

  let url = new URL(raw);
  let pathname = `${url.pathname.replace(/\/+$/, '')}/p/{portalId}`.replace(/\/{2,}/g, '/');

  return `${url.origin}${pathname}${url.search}${url.hash}`.replace(/\/+$/, '');
};

export let buildPortalUrlFromTemplate = (template: string, portalId: string) => {
  return getPortalUrlTemplate(template).replace('{portalId}', portalId).replace(/\/+$/, '');
};

let getPortalUrlTemplateMatchRegex = (template: string) => {
  let normalizedTemplate = getPortalUrlTemplate(template);
  let [prefix, ...suffixParts] = normalizedTemplate.split('{portalId}');
  let suffix = suffixParts.join('{portalId}');

  return new RegExp(`^${escapeRegExp(prefix)}([^/]+)${escapeRegExp(suffix)}(?:/.*)?$`);
};

export let parsePortalIdFromTemplate = (d: { template: string; url: string }) => {
  let templateRegex = getPortalUrlTemplateMatchRegex(d.template);
  let parsedUrl = new URL(d.url);
  parsedUrl.search = '';
  parsedUrl.hash = '';

  let normalizedUrl = parsedUrl.toString().replace(/\/+$/, '');
  let match = normalizedUrl.match(templateRegex);
  if (!match) return undefined;

  let portalId = decodeURIComponent(match[1]);
  let portalUrl = buildPortalUrlFromTemplate(d.template, portalId);

  return {
    portalId,
    portalUrl
  };
};

export let isAllowedPortalOriginForTemplate = (d: { template: string; origin: string }) => {
  try {
    let template = new URL(
      getPortalUrlTemplate(d.template).replace('{portalId}', portalTemplatePlaceholder)
    );
    let parsedOrigin = new URL(d.origin);

    if (template.protocol != parsedOrigin.protocol) {
      return false;
    }

    if (getUrlPort(template) != getUrlPort(parsedOrigin)) {
      return false;
    }

    if (!template.hostname.includes(portalTemplatePlaceholder)) {
      return template.hostname == parsedOrigin.hostname;
    }

    let [prefix, suffix] = template.hostname.split(portalTemplatePlaceholder);
    return parsedOrigin.hostname.startsWith(prefix) && parsedOrigin.hostname.endsWith(suffix);
  } catch (err) {
    return false;
  }
};

export let isPathBasedPortalRoutingTemplate = (template: string) => {
  let normalized = new URL(
    getPortalUrlTemplate(template).replace('{portalId}', portalTemplatePlaceholder)
  );

  return !normalized.hostname.includes(portalTemplatePlaceholder);
};
