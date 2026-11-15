export let parseForwardedFor = (xForwardedForHeader?: string | null | undefined) => {
  if (typeof xForwardedForHeader != 'string') return undefined;

  let ips = xForwardedForHeader
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
  return ips.length > 0 ? ips[0] : undefined;
};
