export interface IntrospectedType {
  examples: any[];
  items?: IntrospectedType[];
  properties?: Record<string, IntrospectedType>;
  type: string;
  name?: string;
  description?: string;
  optional: boolean;
  nullable: boolean;
}

export interface Endpoint {
  method: string;
  name: string;
  description: string;
  allPaths: { path: string; sdkPath: string }[];
  queryId?: string;
  bodyId?: string;
  outputId: string;
  controllerId: string;
}

export interface Controller {
  id: string;
  name: string;
  description: string;
}

export interface IntrospectionSnapshot {
  versions: {
    versions: { version: string; displayVersion: string; isCurrent: boolean }[];
  };
  endpoints: Record<
    string,
    {
      endpoints: Endpoint[];
      controllers: Controller[];
      types: { id: string; name: string; type: IntrospectedType }[];
    }
  >;
}

export let getEndpointVersions = async (url: string, snapshot?: IntrospectionSnapshot) => {
  if (snapshot) return snapshot.versions;

  return (await fetch(new URL('/metorial/introspect/versions', url)).then(res =>
    res.json()
  )) as IntrospectionSnapshot['versions'];
};

export let getEndpoints = async (
  url: string,
  version: string,
  snapshot?: IntrospectionSnapshot
) => {
  if (snapshot) {
    let endpoints = snapshot.endpoints[version];
    if (!endpoints) throw new Error(`Missing introspection snapshot for ${version}.`);

    return endpoints;
  }

  return (await fetch(new URL(`/metorial/introspect/endpoints?version=${version}`, url)).then(
    res => res.json()
  )) as IntrospectionSnapshot['endpoints'][string];
};
