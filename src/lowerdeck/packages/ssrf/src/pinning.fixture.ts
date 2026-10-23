import { safeFetch } from './index';

// Self-signed for rebind.test and second.test, valid until 2126.
let cert = `-----BEGIN CERTIFICATE-----
MIIBqTCCAU6gAwIBAgIUdrhN+kLn8QhCvWHPrYHpRPEdGMQwCgYIKoZIzj0EAwIw
FjEUMBIGA1UEAwwLcmViaW5kLnRlc3QwIBcNMjYxMDIyMDYzNjU0WhgPMjEyNjA5
MjgwNjM2NTRaMBYxFDASBgNVBAMMC3JlYmluZC50ZXN0MFkwEwYHKoZIzj0CAQYI
KoZIzj0DAQcDQgAE+4U9KXfc7mU9OiBBeAcMqVoqrVuCf2TlRK3ju1itrJ4oOeXL
NpGJ0lV8WlB0Id+obyqF/8QOFgEmLwpPW1+bXaN4MHYwHQYDVR0OBBYEFLN3jel2
pBvHhpp0pTcjBF0OhaKbMB8GA1UdIwQYMBaAFLN3jel2pBvHhpp0pTcjBF0OhaKb
MA8GA1UdEwEB/wQFMAMBAf8wIwYDVR0RBBwwGoILcmViaW5kLnRlc3SCC3NlY29u
ZC50ZXN0MAoGCCqGSM49BAMCA0kAMEYCIQCLVsAKlRwqdSMVTi49DyfzElxYRRR9
JgCNMyB7kFLEUQIhANz5KOcu/x9v+3v2Ve0rk08UIze3i2o7YaPyXwrNFUAw
-----END CERTIFICATE-----`;

let key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgLxXFrJ9eznztbE8D
b8zfZxnWvXX+T4tL03fZVU8b3/ahRANCAAT7hT0pd9zuZT06IEF4BwypWiqtW4J/
ZOVEreO7WK2snig55cs2kYnSVXxaUHQh36hvKoX/xA4WASYvCk9bX5td
-----END PRIVATE KEY-----`;

let lookups: string[] = [];

// The first lookup of a name passes the guard; any later one would rebind it to a blocked address.
// The system resolver can't resolve these names at all, so only a pinned request reaches a server.
(Bun.dns as any).lookup = async (hostname: string) => {
  let seen = lookups.includes(hostname);
  lookups.push(hostname);

  let address = hostname == 'blocked.test' || seen ? '10.0.0.1' : '127.0.0.1';
  return [{ address, family: 4, ttl: 0 }];
};

let isIpAllowed = (ip: string) => ip == '127.0.0.1';

let respond = (request: Request) =>
  Response.json({
    host: request.headers.get('host'),
    path: new URL(request.url).pathname
  });

let ports = { http: 0, https: 0 };

let https = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  tls: { cert, key },
  fetch: respond
});

let http = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch: request => {
    let path = new URL(request.url).pathname;

    if (path == '/redirect') {
      return Response.redirect(`https://second.test:${ports.https}/final`, 302);
    }
    if (path == '/redirect-blocked') {
      return Response.redirect(`http://blocked.test:${ports.http}/`, 302);
    }

    return respond(request);
  }
});

ports = { http: http.port!, https: https.port! };

let run = async (fetcher: () => Promise<Response>) => {
  lookups = [];

  try {
    let response = await fetcher();
    let body = await response.json();

    return { status: response.status, url: response.url, body, lookups };
  } catch (error: any) {
    return { error: error?.name, code: error?.code, message: error?.message, lookups };
  }
};

let main = async () => {
  let results = {
    unpinned: await run(() => fetch(`http://rebind.test:${ports.http}/unpinned`)),

    http: await run(() =>
      safeFetch(`http://rebind.test:${ports.http}/plain`, { isIpAllowed })
    ),

    https: await run(() =>
      safeFetch(`https://rebind.test:${ports.https}/secure`, {
        isIpAllowed,
        tls: { ca: cert }
      })
    ),

    httpsWrongName: await run(() =>
      safeFetch(`https://wrong.test:${ports.https}/secure`, { isIpAllowed, tls: { ca: cert } })
    ),

    redirect: await run(() =>
      safeFetch(`http://rebind.test:${ports.http}/redirect`, {
        isIpAllowed,
        tls: { ca: cert }
      })
    ),

    redirectBlocked: await run(() =>
      safeFetch(`http://rebind.test:${ports.http}/redirect-blocked`, { isIpAllowed })
    ),

    ports
  };

  http.stop(true);
  https.stop(true);

  console.log(JSON.stringify(results));
};

main();
