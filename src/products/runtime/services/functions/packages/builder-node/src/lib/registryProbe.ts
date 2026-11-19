import fs from 'fs/promises';
import path from 'path';

export let publicNpmRegistry = 'https://registry.npmjs.org';

let probeTimeoutMs = 10_000;

let maxProbedPackages = 10;

// The egress gateway answers plain-HTTP requests it cannot or may not forward itself, with a 403 or
// 502 whose body starts with this, instead of passing a response through from the registry.
let gatewayMessagePrefix = 'Metorial Magic Network:';

export type RegistryProbe =
  | { status: 'blocked'; registry: string }
  | { status: 'reachable'; registry: string; notFound: string[] };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

let normalizeRegistry = (registry: string) => registry.trim().replace(/\/+$/, '');

let readNpmrcRegistry = async (cwd: string) => {
  let content = await fs.readFile(path.join(cwd, '.npmrc'), 'utf-8').catch(() => '');
  let match = content.match(/^\s*registry\s*=\s*(\S+)\s*$/m);

  return match?.[1];
};

// Same precedence as npm: the environment, then the project's .npmrc, then the public registry.
export let resolveNpmRegistry = async (d: {
  env: Record<string, string | undefined>;
  cwd?: string;
}) =>
  normalizeRegistry(
    d.env.NPM_CONFIG_REGISTRY ||
      d.env.npm_config_registry ||
      (await readNpmrcRegistry(d.cwd ?? process.cwd())) ||
      d.env.YARN_REGISTRY ||
      publicNpmRegistry
  );

let getPackageUrl = (registry: string, name: string) =>
  `${registry}/${name.startsWith('@') ? name.replace('/', '%2f') : encodeURIComponent(name)}`;

let probePackage = async (d: { registry: string; name: string; fetch: Fetch }) => {
  let response;
  try {
    response = await d.fetch(getPackageUrl(d.registry, d.name), {
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(probeTimeoutMs)
    });
  } catch {
    return 'blocked' as const;
  }

  let body = await response.text().catch(() => '');
  if (body.startsWith(gatewayMessagePrefix)) return 'blocked' as const;

  return response.status === 404 ? ('not_found' as const) : ('found' as const);
};

// Runs after a failed install: asks the registry the install used for the packages that are not
// preinstalled, through the same proxy settings, to tell a blocked network apart from packages the
// registry does not have.
export let probeRegistry = async (d: {
  registry: string;
  packages: string[];
  fetch?: Fetch;
}): Promise<RegistryProbe> => {
  let packages = d.packages.slice(0, maxProbedPackages);
  let results = await Promise.all(
    packages.map(name =>
      probePackage({ registry: d.registry, name, fetch: d.fetch ?? globalThis.fetch })
    )
  );

  if (results.every(result => result === 'blocked')) {
    return { status: 'blocked', registry: d.registry };
  }

  return {
    status: 'reachable',
    registry: d.registry,
    notFound: packages.filter((_, index) => results[index] === 'not_found')
  };
};

export let describeInstallFailure = (d: { probe: RegistryProbe; missing: string[] }) => {
  let missing = d.missing.join(', ');

  if (d.probe.status === 'reachable') {
    if (!d.probe.notFound.length) return null;

    return `These packages are not preinstalled and were not found on ${d.probe.registry}: ${d.probe.notFound.join(', ')}.`;
  }

  if (d.probe.registry === publicNpmRegistry) {
    return `Builds cannot reach ${publicNpmRegistry}, and these packages are not preinstalled: ${missing}. Air-gapped installations need an npm mirror (Helm value \`runtime.builds.npmRegistry.url\`).`;
  }

  return `Builds cannot reach the npm mirror at ${d.probe.registry}, and these packages are not preinstalled: ${missing}. Check that the mirror is up and that builds may reach it (Helm value \`runtime.builds.egress.hosts\`).`;
};
