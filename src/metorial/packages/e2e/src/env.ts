export type E2EEndpoints = Record<string, Record<string, string>>;

export let isE2EEnvironment = () => process.env.CONTROL_E2E === '1';

/**
 * Remote mode runs the suites against an already running stack (for example the on-prem
 * images) addressed by its public URL. Nothing in the stack's databases or code is reachable
 * from the test process, so only suites that stay on the HTTP contract can run.
 */
export let remoteTargetUrl = () => process.env.METORIAL_E2E_REMOTE_URL?.replace(/\/+$/, '');

export let isRemoteE2E = () => !!remoteTargetUrl();

export let isBuiltE2EStack = () => process.env.CONTROL_E2E_BUILT === '1' || isRemoteE2E();

export let remoteProvisioning = () => {
  let url = remoteTargetUrl();
  let token = process.env.METORIAL_E2E_PROVISION_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Remote e2e needs METORIAL_E2E_REMOTE_URL and METORIAL_E2E_PROVISION_TOKEN to be set.'
    );
  }

  return {
    url: `${process.env.METORIAL_E2E_PROVISION_URL ?? `${url}/v1`}/.metorial/test/e2e-organization`,
    token
  };
};

export let assertLocalStack = (what: string) => {
  if (isRemoteE2E()) {
    throw new Error(
      `${what} needs in-process access to the stack and is not available when running against a remote stack (METORIAL_E2E_REMOTE_URL).`
    );
  }
};

/**
 * Guards against pointing destructive e2e fixtures at a developer database: `control test:e2e`
 * sets `CONTROL_E2E=1` and only resolves databases on its own disposable Postgres/Mongo.
 */
export let assertE2EEnvironment = () => {
  if (!isE2EEnvironment()) {
    throw new Error(
      'E2E tests must run through `bun run control test:e2e` (CONTROL_E2E=1 is not set).'
    );
  }
};

export let e2eEndpoints = (): E2EEndpoints => {
  let raw = process.env.CONTROL_E2E_ENDPOINTS;
  if (!raw) return {};
  return JSON.parse(raw) as E2EEndpoints;
};

export let e2eEndpoint = (pkg: string, name: string) => {
  let url = e2eEndpoints()[pkg]?.[name];
  if (!url) {
    throw new Error(
      `No e2e endpoint "${name}" for ${pkg}. Is the package part of this e2e stack and does its control/index.ts declare endpoints.${name}?`
    );
  }
  return url;
};

export let hasE2EEndpoint = (pkg: string, name: string) => !!e2eEndpoints()[pkg]?.[name];

/** The OSS app-api and the enterprise core-api expose their shared endpoints under one name. */
export let METORIAL_SUT_PACKAGES = ['@metorial/app-api', '@metorial/mte-core-api'] as const;

export let metorialSutPackage = () => {
  let endpoints = e2eEndpoints();
  let sut = METORIAL_SUT_PACKAGES.find(pkg => endpoints[pkg]);
  if (!sut) {
    throw new Error(
      `Neither ${METORIAL_SUT_PACKAGES.join(' nor ')} is part of this e2e stack.`
    );
  }
  return sut;
};

let remoteOnly = (name: string): string => {
  throw new Error(`The ${name} endpoint is not reachable when running against a remote stack.`);
};

export let metorialEndpoints = () => {
  let remote = remoteTargetUrl();
  if (remote) {
    return {
      api: `${remote}/v1`,
      files: remote,
      get integrations() {
        return remoteOnly('integrations');
      },
      get subspaceInternal() {
        return remoteOnly('subspaceInternal');
      },
      mcp: undefined as string | undefined,
      portal: undefined as string | undefined
    };
  }

  let sut = metorialSutPackage();
  let optional = (name: string) =>
    hasE2EEndpoint(sut, name) ? e2eEndpoint(sut, name) : undefined;

  return {
    api: e2eEndpoint(sut, 'api'),
    files: e2eEndpoint(sut, 'files'),
    integrations: e2eEndpoint(sut, 'integrations'),
    subspaceInternal: e2eEndpoint(sut, 'subspaceInternal'),
    mcp: optional('mcp'),
    portal: optional('portal')
  };
};
