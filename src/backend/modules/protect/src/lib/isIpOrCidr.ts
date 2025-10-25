import * as ipaddr from 'ipaddr.js';

export let isIpOrCidr = (input: string) => {
  try {
    if (input.includes('/')) {
      let [ip, prefix] = input.split('/');
      let parsedIp = ipaddr.process(ip);
      let prefixNum = parseInt(prefix, 10);

      if (parsedIp.kind() === 'ipv4') {
        return prefixNum >= 0 && prefixNum <= 32;
      } else {
        return prefixNum >= 0 && prefixNum <= 128;
      }
    }

    ipaddr.process(input);

    return true;
  } catch {
    return false;
  }
};
