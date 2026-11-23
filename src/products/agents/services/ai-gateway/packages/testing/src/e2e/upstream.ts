import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createFakeUpstream, type RecordedRequest, type UpstreamResponder } from '../upstream';
import type { Script } from '../script';
import { closeServer } from './catalog';

export let defaultUpstreamPort = 52198;

export let defaultScript: Script = {
  steps: [{ type: 'text', text: 'Hello from the fake upstream.' }]
};

export let apiKeyOf = (request: { headers: Record<string, string> }) =>
  request.headers['x-api-key'] ??
  request.headers['api-key'] ??
  request.headers['x-goog-api-key'] ??
  request.headers['authorization']?.replace(/^Bearer /, '');

export type UpstreamModelListRequest = { url: string; apiKey: string | undefined };

// Stands in for every provider the gateway can reach. The gateway is started with
// AI_GATEWAY_UPSTREAM_PROXY_URL pointing here, so `https://api.openai.com/v1/responses` arrives as
// `/api.openai.com/v1/responses`. Model lists, which connection checks use, answer 401 for keys
// containing "invalid" and 200 otherwise, unless `failModelLists` forces a status.
export let startUpstream = async (d: { port?: number } = {}) => {
  let responder: UpstreamResponder = () => defaultScript;
  let fake = createFakeUpstream(request => responder(request));
  let modelLists: UpstreamModelListRequest[] = [];
  let aborted = 0;
  let modelListStatus: number | null = null;

  let handle = async (request: Request) => {
    let url = new URL(request.url);

    if (request.method == 'GET' && /\/models\/?$/.test(url.pathname)) {
      let apiKey = apiKeyOf({
        headers: Object.fromEntries(request.headers.entries())
      });
      modelLists.push({ url: request.url, apiKey });

      if (modelListStatus) {
        return Response.json(
          { error: { message: 'Model list failure.' } },
          { status: modelListStatus }
        );
      }

      if (apiKey?.includes('invalid')) {
        return Response.json(
          { error: { message: 'Incorrect API key provided.' } },
          { status: 401 }
        );
      }

      return Response.json({ data: [{ id: 'fake-model' }] });
    }

    return await fake.fetch(request);
  };

  let server = createServer(async (incoming, outgoing) => {
    let closed = false;
    outgoing.on('close', () => {
      if (!outgoing.writableFinished) aborted++;
      closed = true;
    });

    try {
      let chunks: Buffer[] = [];
      for await (let chunk of incoming) chunks.push(chunk as Buffer);
      let body = Buffer.concat(chunks);

      let [, host, ...path] = incoming.url!.split('/');
      let headers = new Headers();
      for (let [key, value] of Object.entries(incoming.headers)) {
        if (typeof value == 'string') headers.set(key, value);
      }

      let response = await handle(
        new Request(`https://${host}/${path.join('/')}`, {
          method: incoming.method,
          headers,
          body: body.length ? body : undefined
        })
      );

      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (!response.body) return outgoing.end();

      for await (let chunk of Readable.fromWeb(response.body as any)) {
        if (closed) break;
        outgoing.write(chunk);
      }
      outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(d.port ?? defaultUpstreamPort, '127.0.0.1', resolve);
  });

  return {
    respond: (next: UpstreamResponder | Script) => {
      responder = typeof next == 'function' ? next : () => next;
    },
    failModelLists: (status: number | null) => {
      modelListStatus = status;
    },
    reset: () => {
      responder = () => defaultScript;
      modelListStatus = null;
      fake.requests.length = 0;
      modelLists.length = 0;
      aborted = 0;
    },
    requests: fake.requests as RecordedRequest[],
    modelLists,
    abortedCount: () => aborted,
    close: () => closeServer(server)
  };
};

export type Upstream = Awaited<ReturnType<typeof startUpstream>>;
