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

export let getEndpoints = async (url: string) => {
  let versions = (await fetch(new URL('/metorial/introspect/versions', url)).then(res =>
    res.json()
  )) as {
    versions: { version: string; displayVersion: string; isCurrent: boolean }[];
  };

  let currentVersion = versions.versions.find(v => v.isCurrent)?.version;

  return (await fetch(
    new URL(`/metorial/introspect/endpoints?version=${currentVersion}`, url)
  ).then(res => res.json())) as {
    endpoints: Endpoint[];

    controllers: Controller[];

    types: {
      id: string;
      name: string;
      type: IntrospectedType;
    }[];
  };
};
