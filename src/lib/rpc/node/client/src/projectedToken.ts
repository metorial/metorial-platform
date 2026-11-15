import type { HeadersProvider } from './shared/clientBuilder';

// Kubernetes rotates projected ServiceAccount tokens in place, so the file is re-read whenever
// its modification time changes. The fs import is lazy to keep the package browser-safe.
export let projectedTokenHeaders = (path: string): HeadersProvider => {
  let cached: { mtimeMs: number; token: string } | undefined;
  let lastSent: string | undefined;

  let read = async () => {
    let { readFile, stat } = await import('node:fs/promises');
    let { mtimeMs } = await stat(path);
    let token = (await readFile(path, 'utf8')).trim();
    if (!token) throw new Error(`Token file ${path} is empty`);

    cached = { mtimeMs, token };
    return token;
  };

  let getHeaders: HeadersProvider = async () => {
    let { stat } = await import('node:fs/promises');
    let { mtimeMs } = await stat(path);

    let token = cached && cached.mtimeMs == mtimeMs ? cached.token : await read();
    lastSent = token;
    return { authorization: `Bearer ${token}` };
  };

  getHeaders.onUnauthorized = async () => {
    let previous = lastSent;
    return (await read()) != previous;
  };

  return getHeaders;
};
