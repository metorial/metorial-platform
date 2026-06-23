import * as ipaddr from 'ipaddr.js';

export let isIpInList = (ip: string, allowList: string[]) => {
  try {
    let testIp = ipaddr.process(ip);

    for (let rule of allowList) {
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
          )
            return true;
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
