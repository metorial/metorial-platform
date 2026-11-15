let portalIdPlaceholder = '{portalId}';
let legacyPortalPlaceholder = '{portal}';
let portalIdToken = '__metorial_portal_id__';

type TemplateMatch =
  | {
      matched: false;
    }
  | {
      matched: true;
      portalId?: string;
    };

let escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

let normalizePortalTemplatePlaceholders = (template: string) => {
  return template.replaceAll(legacyPortalPlaceholder, portalIdPlaceholder);
};

export let getPortalUrlTemplate = (template: string) => {
  let raw = normalizePortalTemplatePlaceholders(template).replace(/\/+$/, '');

  if (!raw.includes(portalIdPlaceholder)) {
    let url = new URL(raw);
    let pathname = `${url.pathname.replace(/\/+$/, '')}/p/${portalIdPlaceholder}`.replace(
      /\/{2,}/g,
      '/'
    );

    raw = `${url.origin}${pathname}${url.search}${url.hash}`.replace(/\/+$/, '');
  }

  return raw;
};

let getTemplateUrl = (template: string) => {
  let normalizedTemplate = getPortalUrlTemplate(template);

  return new URL(normalizedTemplate.replace(portalIdPlaceholder, portalIdToken));
};

let matchTemplateValue = (d: {
  templateValue: string;
  requestValue: string;
  portalIdPattern: string;
  mode: 'exact' | 'path_prefix';
}): TemplateMatch => {
  let escapedTemplate = escapeRegex(d.templateValue).replace(
    portalIdToken,
    `(?<portalId>${d.portalIdPattern})`
  );
  let pattern =
    d.mode == 'exact'
      ? new RegExp(`^${escapedTemplate}$`)
      : d.templateValue == '/'
        ? /^\/.*$/
        : new RegExp(`^${escapedTemplate}(?:$|/.*)`);
  let match = d.requestValue.match(pattern);

  if (!match) {
    return {
      matched: false
    };
  }

  return {
    matched: true,
    portalId: match.groups?.portalId
  };
};

let extractPortalIdFromTemplate = (d: { template: string; url: string }) => {
  let requestUrl = new URL(d.url);
  let templateUrl = getTemplateUrl(d.template);

  if (
    requestUrl.protocol != templateUrl.protocol ||
    requestUrl.username != templateUrl.username ||
    requestUrl.password != templateUrl.password ||
    requestUrl.port != templateUrl.port
  ) {
    return null;
  }

  let hostnameMatch = matchTemplateValue({
    templateValue: templateUrl.hostname,
    requestValue: requestUrl.hostname,
    portalIdPattern: '[^.]+',
    mode: 'exact'
  });

  if (!hostnameMatch.matched) {
    return null;
  }

  let pathnameMatch = matchTemplateValue({
    templateValue: templateUrl.pathname,
    requestValue: requestUrl.pathname,
    portalIdPattern: '[^/]+',
    mode: 'path_prefix'
  });

  if (!pathnameMatch.matched) {
    return null;
  }

  if (
    hostnameMatch.portalId &&
    pathnameMatch.portalId &&
    hostnameMatch.portalId != pathnameMatch.portalId
  ) {
    return null;
  }

  return hostnameMatch.portalId ?? pathnameMatch.portalId ?? null;
};

export let buildPortalUrlFromTemplate = (template: string, portalId: string) => {
  return getPortalUrlTemplate(template)
    .replace(portalIdPlaceholder, portalId)
    .replace(/\/+$/, '');
};

export let parsePortalIdFromTemplate = (d: { template: string; url: string }) => {
  let portalId = extractPortalIdFromTemplate(d);

  if (!portalId) {
    return null;
  }

  return {
    portalId,
    portalUrl: buildPortalUrlFromTemplate(d.template, portalId)
  };
};

export let isPathBasedPortalRoutingTemplate = (template: string) => {
  return !getTemplateUrl(template).hostname.includes(portalIdToken);
};

export let isAllowedPortalOriginForTemplate = (d: { template: string; origin: string }) => {
  try {
    let originUrl = new URL(d.origin);
    let templateUrl = getTemplateUrl(d.template);
    let hostnameMatch = matchTemplateValue({
      templateValue: templateUrl.hostname,
      requestValue: originUrl.hostname,
      portalIdPattern: '[^.]+',
      mode: 'exact'
    });

    return (
      hostnameMatch.matched &&
      originUrl.protocol == templateUrl.protocol &&
      originUrl.username == templateUrl.username &&
      originUrl.password == templateUrl.password &&
      originUrl.port == templateUrl.port
    );
  } catch {
    return false;
  }
};
