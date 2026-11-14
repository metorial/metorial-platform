let MAX_URL_LENGTH = 2048;
let MAX_QUERY_LENGTH = 256;
let MAX_COMPONENT_LENGTH = 160;
let REDACTED_DOMAIN = '[redacted]';
let TRACKING_PARAMETERS = /^(utm_.+|gclid|fbclid|msclkid)$/i;
let SENSITIVE_PARAMETERS =
  /token|secret|password|passwd|credential|authorization|signature|api.?key|session|code|email/i;
let PRIVATE_SUFFIXES = /\.(localhost|local|internal|lan|home|test|invalid|example)$/i;
let SECRET_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\b(?:gh[pousr]_|github_pat_|xox[baprs]-|sk-(?:proj-|ant-)?)[A-Za-z0-9_-]{16,}/,
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /\b(?:bearer|authorization|password|secret|api[_-]?key)\s*[:= ]\s*\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b\+?\d[\d ()-]{9,}\d\b/
];

export class WebAccessError extends Error {
  constructor(public reason: string) {
    super(`Web access unavailable: ${reason}`);
  }
}

export let isSensitiveWebText = (text: string) => {
  if (SECRET_PATTERNS.some(pattern => pattern.test(text))) return true;

  return (text.match(/[A-Za-z0-9_+/=-]{24,}/g) ?? []).some(token => {
    if (!/[A-Za-z]/.test(token) || !/[0-9]/.test(token)) return false;

    let counts = new Map<string, number>();
    for (let character of token) counts.set(character, (counts.get(character) ?? 0) + 1);

    let entropy = 0;
    for (let count of counts.values()) {
      let probability = count / token.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy >= 4;
  });
};

let decodedViews = (text: string) => {
  let views = [text];

  for (let i = 0; i < 2 && /%[\da-f]{2}/i.test(text); i++) {
    try {
      text = decodeURIComponent(text);
    } catch {
      throw new WebAccessError('invalid_encoding');
    }
    views.push(text);
  }

  if (/%[\da-f]{2}/i.test(text)) throw new WebAccessError('nested_encoding');
  return views;
};

export let webDomainForLog = (input: string) => {
  try {
    let domain = new URL(input).hostname.toLowerCase().replace(/\.$/, '');
    if (
      domain.length > 253 ||
      !/^[a-z0-9.-]+$/.test(domain) ||
      domain.split('.').some(label => label.length > 40) ||
      isSensitiveWebText(domain)
    )
      return REDACTED_DOMAIN;

    return domain || REDACTED_DOMAIN;
  } catch {
    return REDACTED_DOMAIN;
  }
};

export let screenWebUrl = (
  input: string,
  containsSensitiveText?: (text: string) => boolean
) => {
  if (input.length > MAX_URL_LENGTH || /[\u0000-\u0020\\]/.test(input)) {
    throw new WebAccessError('invalid_url');
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new WebAccessError('invalid_url');
  }

  if (url.protocol != 'https:' || (url.port && url.port != '443')) {
    throw new WebAccessError('https_required');
  }
  if (url.username || url.password) throw new WebAccessError('url_credentials');

  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !url.hostname.includes('.') ||
    !/^[a-z0-9.-]+$/.test(url.hostname) ||
    PRIVATE_SUFFIXES.test(url.hostname) ||
    /^\d+(?:\.\d+)*$/.test(url.hostname)
  )
    throw new WebAccessError('private_destination');

  let components = [url.hostname, url.pathname, url.search];
  for (let component of components) {
    for (let view of decodedViews(component)) {
      if (/[\u0000-\u001f\u007f]/.test(view)) throw new WebAccessError('invalid_url');
      if (isSensitiveWebText(view) || containsSensitiveText?.(view)) {
        throw new WebAccessError('sensitive_url');
      }
    }
  }

  if (
    url.hostname.split('.').some(label => label.length > 40) ||
    url.pathname.split('/').some(segment => segment.length > MAX_COMPONENT_LENGTH)
  ) {
    throw new WebAccessError('opaque_url');
  }

  for (let [key, value] of [...url.searchParams]) {
    if (SENSITIVE_PARAMETERS.test(key)) throw new WebAccessError('sensitive_url');
    if (TRACKING_PARAMETERS.test(key)) {
      url.searchParams.delete(key);
      continue;
    }

    let isPage = key == 'page' && /^[1-9]\d{0,2}$/.test(value);
    let isLanguage =
      ['lang', 'language', 'hl'].includes(key) && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value);
    if (!isPage && !isLanguage) throw new WebAccessError('unsupported_query');
  }

  return url;
};

export let screenWebQuery = (
  query: string,
  containsSensitiveText?: (text: string) => boolean
) => {
  if (!query.trim() || query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f]/.test(query)) {
    throw new WebAccessError('invalid_query');
  }

  for (let view of decodedViews(query)) {
    if (isSensitiveWebText(view) || containsSensitiveText?.(view)) {
      throw new WebAccessError('sensitive_query');
    }

    for (let embedded of view.match(/https?:\/\/[^\s"'<>]+/gi) ?? []) {
      screenWebUrl(embedded, containsSensitiveText);
    }
  }

  return query.trim();
};
