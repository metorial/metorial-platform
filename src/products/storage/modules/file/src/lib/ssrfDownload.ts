import { badRequestError, internalServerError, ServiceError } from '@lowerdeck/error';
import http from 'http';
import https from 'https';
import ipaddr from 'ipaddr.js';
import { Readable, Transform } from 'stream';

let checkIp = (ip: string) => {
  if (!ipaddr.isValid(ip)) return true;

  try {
    return ipaddr.parse(ip).range() === 'unicast';
  } catch {
    return false;
  }
};

let createSsrfGuardedAgent = (protocol: string) => {
  let AgentCtor = protocol === 'https:' ? https.Agent : http.Agent;
  let agent = new AgentCtor();
  let originalCreateConnection = (agent as any).createConnection;

  (agent as any).createConnection = function (options: any, callback: any) {
    let address = options.host;
    if (typeof address === 'string' && !checkIp(address)) {
      throw new Error(`Connection to ${address} is blocked`);
    }

    let socket = originalCreateConnection.call(this, options, callback);
    socket.on('lookup', (error: unknown, resolvedAddress: string) => {
      if (error) return;
      if (!checkIp(resolvedAddress)) {
        socket.destroy(new Error(`Connection to ${resolvedAddress} is blocked`));
      }
    });

    return socket;
  };

  return agent;
};

let validateUrl = (input: string) => {
  let url = new URL(input);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported protocol for delegated file content download');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in delegated file content URL are not allowed');
  }

  return url;
};

class DelegatedContentDownloadTooLargeError extends Error {
  constructor(message = 'Delegated file content exceeds the maximum download size') {
    super(message);
  }
}

let requestOnce = (url: URL) =>
  new Promise<http.IncomingMessage>((resolve, reject) => {
    let client = url.protocol === 'https:' ? https : http;
    let req = client.get(
      url,
      {
        agent: createSsrfGuardedAgent(url.protocol),
        headers: { 'User-Agent': 'Metorial-Files (https://metorial.com)' },
        timeout: 15_000
      },
      resolve
    );
    req.on('error', reject);
    req.on('timeout', () =>
      req.destroy(new Error('Delegated file content download timed out'))
    );
  });

let createSizeGuardTransform = (maxBytes: number) => {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new DelegatedContentDownloadTooLargeError());
        return;
      }
      callback(null, chunk);
    }
  });
};

let downloadUrlToStreamOrThrow = async (d: {
  url: string;
  maxBytes: number;
  maxRedirects?: number;
}) => {
  let currentUrl = validateUrl(d.url);
  let maxRedirects = d.maxRedirects ?? 5;

  for (let i = 0; i <= maxRedirects; i++) {
    let res = await requestOnce(currentUrl);
    let statusCode = res.statusCode ?? 0;

    if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
      res.resume();
      if (i === maxRedirects) {
        throw new Error('Too many redirects while downloading delegated file content');
      }
      currentUrl = validateUrl(new URL(res.headers.location, currentUrl).toString());
      continue;
    }

    if (statusCode < 200 || statusCode >= 300) {
      res.resume();
      throw new Error(`Delegated file content download failed with status ${statusCode}`);
    }

    let contentLength = Number(res.headers['content-length'] ?? 0);
    if (contentLength > d.maxBytes) {
      res.destroy();
      throw new DelegatedContentDownloadTooLargeError();
    }

    let mimeType = res.headers['content-type'];
    let sizeGuard = createSizeGuardTransform(d.maxBytes);

    res.on('error', err => sizeGuard.destroy(err));
    sizeGuard.on('error', () => res.destroy());
    res.pipe(sizeGuard);

    let stream = Readable.toWeb(sizeGuard) as unknown as ReadableStream;

    return { stream, mimeType };
  }

  throw new Error('Unreachable');
};

export let downloadDelegatedFileContent = async (d: { url: string; maxBytes: number }) => {
  try {
    return await downloadUrlToStreamOrThrow(d);
  } catch (error) {
    if (error instanceof DelegatedContentDownloadTooLargeError) {
      throw new ServiceError(badRequestError({ message: error.message }));
    }

    throw new ServiceError(
      internalServerError({
        message:
          error instanceof Error ? error.message : 'Delegated file content download failed'
      })
    );
  }
};
