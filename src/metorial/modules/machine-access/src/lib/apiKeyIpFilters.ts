import { badRequestError, ServiceError } from '@lowerdeck/error';
import * as ipaddr from 'ipaddr.js';

let normalizeIpFilter = (value: string) => value.trim();

export let isValidApiKeyIpFilter = (input: string) => {
  try {
    let value = normalizeIpFilter(input);
    if (!value) return false;

    if (value.includes('/')) {
      let [ip, prefix, ...rest] = value.split('/');
      if (!ip || !prefix || rest.length > 0) return false;

      let parsedIp = ipaddr.process(ip);
      let prefixNum = parseInt(prefix, 10);
      if (!Number.isInteger(prefixNum)) return false;

      if (parsedIp.kind() === 'ipv4') {
        return prefixNum >= 0 && prefixNum <= 32;
      } else {
        return prefixNum >= 0 && prefixNum <= 128;
      }
    }

    ipaddr.process(value);
    return true;
  } catch {
    return false;
  }
};

export let normalizeApiKeyIpFilters = (ipFilters: string[] | null | undefined) => {
  return (ipFilters ?? []).map(normalizeIpFilter).filter(Boolean);
};

export let assertValidApiKeyIpFilters = (ipFilters: string[] | null | undefined) => {
  let normalized = normalizeApiKeyIpFilters(ipFilters);

  for (let ipFilter of normalized) {
    if (!isValidApiKeyIpFilter(ipFilter)) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid API key IP filter: ${ipFilter}`
        })
      );
    }
  }

  return Array.from(new Set(normalized));
};

export let isIpAllowedByApiKeyFilters = (d: {
  ip: string;
  ipFilters: string[] | null | undefined;
}) => {
  let normalizedFilters = normalizeApiKeyIpFilters(d.ipFilters);
  if (normalizedFilters.length === 0) return true;

  try {
    let testIp = ipaddr.process(d.ip);

    for (let rule of normalizedFilters) {
      try {
        if (rule.includes('/')) {
          let [rangeIp, prefixLength] = rule.split('/');
          let parsedRange = ipaddr.process(rangeIp);
          let prefix = parseInt(prefixLength, 10);

          if (testIp.kind() !== parsedRange.kind()) continue;
          if (testIp.kind() === 'ipv4') {
            if ((testIp as ipaddr.IPv4).match(parsedRange as ipaddr.IPv4, prefix)) return true;
          } else {
            if ((testIp as ipaddr.IPv6).match(parsedRange as ipaddr.IPv6, prefix)) return true;
          }
        } else {
          let parsedRule = ipaddr.process(rule);

          if (
            testIp.kind() === parsedRule.kind() &&
            testIp.toString() === parsedRule.toString()
          ) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  } catch {
    return false;
  }
};
