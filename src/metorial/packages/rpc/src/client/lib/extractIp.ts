export let parseForwardedFor = (xForwardedForHeader?: string | null | undefined) => {
  if (typeof xForwardedForHeader != 'string') return undefined;

  let ips = xForwardedForHeader
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
  return ips.length > 0 ? ips[0] : undefined;
};

export let extractIp = (headers: Record<string, string>) => {
  let ipHeader =
    headers['metorial-connecting-ip'] ||
    headers['cf-connecting-ip'] ||
    headers['x-forwarded-for'] ||
    headers['x-real-ip'];

  return parseForwardedFor(ipHeader);
};
