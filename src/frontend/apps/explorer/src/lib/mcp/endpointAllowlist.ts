let parseAllowlistFromEnv = (): string[] => {
  let raw = import.meta.env.VITE_MCP_ENDPOINT_HOST_ALLOWLIST;
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

let cachedPatterns: string[] | null = null;

export let getMcpEndpointHostAllowlistPatterns = (): string[] => {
  if (cachedPatterns === null) {
    cachedPatterns = parseAllowlistFromEnv();
  }
  return cachedPatterns;
};

let matchesHostPattern = (hostnameLower: string, pattern: string): boolean => {
  let p = pattern.toLowerCase().trim();
  if (!p) return false;
  if (p.startsWith('*.')) {
    let suffix = p.slice(2);
    if (!suffix) return false;
    return hostnameLower === suffix || hostnameLower.endsWith('.' + suffix);
  }
  return hostnameLower === p;
};

export let isMcpEndpointHostnameAllowed = (hostname: string): boolean => {
  let patterns = getMcpEndpointHostAllowlistPatterns();
  if (patterns.length === 0) return true;
  let h = hostname.toLowerCase();
  return patterns.some(pat => matchesHostPattern(h, pat));
};

/** When allowlist is empty, returns undefined (no restriction). */
export let getMcpEndpointUrlAllowlistViolation = (urlString: string): string | undefined => {
  let patterns = getMcpEndpointHostAllowlistPatterns();
  if (patterns.length === 0) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'The MCP endpoint URL must use http or https.';
  }

  if (!isMcpEndpointHostnameAllowed(parsed.hostname)) {
    return 'This MCP endpoint host is not allowed by this deployment.';
  }

  return undefined;
};
