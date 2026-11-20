import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseKeySet } from './keySet';
import {
  inClusterConfigMapApi,
  KubeApiError,
  type ConfigMap,
  type ConfigMapApi
} from './kube';
import { parseTrustTargets, publishTrustKey, startTrustPublisher } from './publisher';

let key = { kid: 'f1', publicKey: 'pub-f1' };
let target = { namespace: 'metorial', name: 'egress-trust' };

let fakeApi = (initial?: ConfigMap) => {
  let stored: ConfigMap | undefined = initial;
  let version = 1;
  let conflicts = 0;

  let api: ConfigMapApi & {
    stored: () => ConfigMap | undefined;
    conflictNext: (n: number) => void;
  } = {
    get: async (namespace, name) => {
      if (!stored) throw new KubeApiError(404, 'not found');
      return structuredClone({ ...stored, metadata: { ...stored.metadata, namespace, name } });
    },
    replace: async configMap => {
      if (conflicts > 0) {
        conflicts--;
        version++;
        if (stored) stored.metadata.resourceVersion = String(version);
        throw new KubeApiError(409, 'conflict');
      }
      if (configMap.metadata.resourceVersion != String(version))
        throw new KubeApiError(409, 'conflict');

      version++;
      stored = {
        ...configMap,
        metadata: { ...configMap.metadata, resourceVersion: String(version) }
      };
      return stored;
    },
    stored: () => stored,
    conflictNext: n => {
      conflicts = n;
    }
  };

  if (stored) stored.metadata.resourceVersion = '1';
  return api;
};

let emptyConfigMap = (): ConfigMap => ({
  metadata: { name: 'egress-trust', namespace: 'metorial' }
});

describe('parseTrustTargets', () => {
  it('parses namespace/name entries', () => {
    expect(parseTrustTargets(['fn/runtime-trust', ' metorial/egress-trust ', ''])).toEqual([
      { namespace: 'fn', name: 'runtime-trust' },
      { namespace: 'metorial', name: 'egress-trust' }
    ]);
  });

  it('rejects malformed entries', () => {
    expect(() => parseTrustTargets(['egress-trust'])).toThrow('namespace/name');
    expect(() => parseTrustTargets(['a/b/c'])).toThrow('namespace/name');
  });
});

describe('publishTrustKey', () => {
  it('writes the key and then reports it unchanged', async () => {
    let api = fakeApi(emptyConfigMap());

    expect(await publishTrustKey({ api, target, signer: 'functions', key })).toBe('updated');
    expect(parseKeySet(api.stored()!.data!['keys.json']).keys).toEqual({ f1: 'pub-f1' });
    expect(await publishTrustKey({ api, target, signer: 'functions', key })).toBe('unchanged');
  });

  it('retries on a conflicting write', async () => {
    let api = fakeApi(emptyConfigMap());
    api.conflictNext(2);

    expect(await publishTrustKey({ api, target, signer: 'functions', key })).toBe('updated');
  });

  it('gives up after repeated conflicts', async () => {
    let api = fakeApi(emptyConfigMap());
    api.conflictNext(10);

    await expect(publishTrustKey({ api, target, signer: 'functions', key })).rejects.toThrow(
      'conflict'
    );
  });
});

describe('startTrustPublisher', () => {
  let logger = () => ({ info: vi.fn(), warn: vi.fn() });

  it('publishes right away and reports the status', async () => {
    let api = fakeApi(emptyConfigMap());
    let publisher = startTrustPublisher({
      signer: 'functions',
      key,
      targets: [target],
      api,
      logger: logger()
    });

    expect(await publisher.publishNow()).toBe(true);
    let [status] = publisher.status();
    expect(status!.publishedAt).toBeInstanceOf(Date);
    expect(status!.lastError).toBeUndefined();
    expect(publisher.isStale(status!)).toBe(false);

    publisher.stop();
  });

  it('explains a missing ConfigMap and keeps retrying', async () => {
    let api = fakeApi();
    let log = logger();
    let publisher = startTrustPublisher({
      signer: 'functions',
      key,
      targets: [target],
      api,
      logger: log
    });

    expect(await publisher.publishNow()).toBe(false);
    let [status] = publisher.status();
    expect(status!.lastError).toContain('metorial/egress-trust does not exist');
    expect(publisher.isStale(status!)).toBe(true);
    expect(log.warn).toHaveBeenCalled();

    publisher.stop();
  });

  it('restores a key that was removed after publishing', async () => {
    let api = fakeApi(emptyConfigMap());
    let publisher = startTrustPublisher({
      signer: 'functions',
      key,
      targets: [target],
      api,
      logger: logger()
    });
    await publisher.publishNow();

    let stored = api.stored()!;
    await api.replace({ ...stored, data: { 'keys.json': '{"keys":{}}' } });
    await publisher.publishNow();

    expect(parseKeySet(api.stored()!.data!['keys.json']).keys).toEqual({ f1: 'pub-f1' });
    publisher.stop();
  });
});

describe('inClusterConfigMapApi', () => {
  it('sends the current service account token and maps errors', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'trust-publisher-'));
    await writeFile(join(dir, 'token'), 'token-1\n');
    await writeFile(join(dir, 'ca.crt'), 'ca');

    let requests: { url: string; init: any }[] = [];
    let api = inClusterConfigMapApi({
      serviceAccountDir: dir,
      host: '10.0.0.1',
      port: '443',
      fetch: (async (url: string, init: any) => {
        requests.push({ url, init });
        return requests.length == 1
          ? new Response(JSON.stringify(emptyConfigMap()), { status: 200 })
          : new Response('forbidden', { status: 403 });
      }) as unknown as typeof fetch
    });

    await api.get('metorial', 'egress-trust');
    expect(requests[0]!.url).toBe(
      'https://10.0.0.1:443/api/v1/namespaces/metorial/configmaps/egress-trust'
    );
    expect(requests[0]!.init.headers.authorization).toBe('Bearer token-1');
    expect(requests[0]!.init.tls).toEqual({ ca: 'ca' });

    await writeFile(join(dir, 'token'), 'token-2');
    let error = await api.replace(emptyConfigMap()).catch(err => err);
    expect(requests[1]!.init.method).toBe('PUT');
    expect(requests[1]!.init.headers.authorization).toBe('Bearer token-2');
    expect(error).toBeInstanceOf(KubeApiError);
    expect(error.status).toBe(403);
  });
});
