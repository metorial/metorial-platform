export let parseForwardedFor = (xForwardedForHeader?: string | null | undefined) => {
  if (typeof xForwardedForHeader != 'string') return undefined;

  let ips = xForwardedForHeader
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
  return ips.length > 0 ? ips[0] : undefined;
};

export let extractIp = (headers: Record<string, string> | Headers) => {
  let headerObject = (
    'entries' in headers && typeof headers.entries == 'function'
      ? // @ts-ignore
        Object.fromEntries(headers.entries())
      : headers
  ) as Record<string, string>;

  let ipHeader =
    headerObject['metorial-connecting-ip'] ||
    headerObject['cf-connecting-ip'] ||
    headerObject['x-forwarded-for'] ||
    headerObject['x-real-ip'];

  return parseForwardedFor(ipHeader);
};
