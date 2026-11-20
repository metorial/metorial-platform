import { readFile } from 'node:fs/promises';

export let DEFAULT_SERVICE_ACCOUNT_DIR = '/var/run/secrets/kubernetes.io/serviceaccount';

export type ConfigMap = {
  metadata: {
    name: string;
    namespace: string;
    resourceVersion?: string;
    [key: string]: unknown;
  };
  data?: Record<string, string>;
  [key: string]: unknown;
};

export class KubeApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type ConfigMapApi = {
  get: (namespace: string, name: string) => Promise<ConfigMap>;
  replace: (configMap: ConfigMap) => Promise<ConfigMap>;
};

// The token is re-read on every request: kubelet rotates projected tokens in place.
export let inClusterConfigMapApi = (d: {
  serviceAccountDir?: string;
  host?: string;
  port?: string;
  fetch?: typeof fetch;
}): ConfigMapApi => {
  let dir = d.serviceAccountDir ?? DEFAULT_SERVICE_ACCOUNT_DIR;
  let host = d.host ?? process.env.KUBERNETES_SERVICE_HOST;
  let port = d.port ?? process.env.KUBERNETES_SERVICE_PORT ?? '443';
  let doFetch = d.fetch ?? fetch;

  let request = async (method: 'GET' | 'PUT', path: string, body?: ConfigMap) => {
    if (!host) throw new Error('KUBERNETES_SERVICE_HOST is not set; not running in a cluster');

    let [token, ca] = await Promise.all([
      readFile(`${dir}/token`, 'utf8'),
      readFile(`${dir}/ca.crt`, 'utf8')
    ]);
    let base = `https://${host.includes(':') ? `[${host}]` : host}:${port}`;

    let response = await doFetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token.trim()}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      tls: { ca }
    } as RequestInit);

    if (!response.ok) {
      let text = await response.text().catch(() => '');
      throw new KubeApiError(
        response.status,
        `${method} ${path}: ${response.status} ${text}`.trim()
      );
    }
    return (await response.json()) as ConfigMap;
  };

  let path = (namespace: string, name: string) =>
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/configmaps/${encodeURIComponent(name)}`;

  return {
    get: (namespace, name) => request('GET', path(namespace, name)),
    replace: configMap =>
      request('PUT', path(configMap.metadata.namespace, configMap.metadata.name), configMap)
  };
};
