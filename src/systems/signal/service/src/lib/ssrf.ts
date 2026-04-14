// Source: https://github.com/y-mehta/ssrf-req-filter/blob/master/lib/index.js

import http from 'http';
import https from 'https';
import ipaddr from 'ipaddr.js';

export let checkIp = (ip: string) => {
  if (!ipaddr.isValid(ip)) return true;

  try {
    let addr = ipaddr.parse(ip);
    let range = addr.range();
    if (range !== 'unicast') return false; // Private IP Range
  } catch (err) {
    return false;
  }

  return true;
};

export let ssrfFilter = (url: URL) => {
  let agent = url.protocol === 'https:' ? new https.Agent() : new http.Agent();
  let oldCreateConnection = (agent as any).createConnection;

  (agent as any).createConnection = function (options: any, func: any): any {
    let { host: address } = options;
    if (!checkIp(address)) {
      throw new Error(`Call to ${address} is blocked.`);
    }

    let socket = oldCreateConnection.call(this, options, func);
    socket.on('lookup', (error: any, address: string) => {
      if (error || checkIp(address)) return false;
      return socket.destroy(new Error(`Call to ${address} is blocked.`));
    });

    return socket;
  };

  return agent;
};

export let getAxiosSsrfFilter = (url: string) => {
  let u = new URL(url);
  return {
    httpAgent: ssrfFilter(u),
    httpsAgent: ssrfFilter(u)
  };
};
