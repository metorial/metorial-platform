import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  describeInstallFailure,
  probeRegistry,
  publicNpmRegistry,
  resolveNpmRegistry
} from './registryProbe';

let mirror = 'https://npm.internal.example';

let gatewayDenial = () =>
  new Response('Metorial Magic Network: policy denied outgoing request', { status: 403 });

let createFetch = (respond: (url: string) => Response | Promise<Response>) => {
  let urls: string[] = [];
  let fetch = async (url: string) => {
    urls.push(url);
    return respond(url);
  };

  return { fetch, urls };
};

describe('resolveNpmRegistry', () => {
  it('prefers the environment, then .npmrc, then the yarn registry', async () => {
    let cwd = await fs.mkdtemp(path.join(tmpdir(), 'registry-probe-'));
    await fs.writeFile(
      path.join(cwd, '.npmrc'),
      'save-exact=true\nregistry = https://npmrc.example/\n'
    );

    expect(await resolveNpmRegistry({ env: { NPM_CONFIG_REGISTRY: `${mirror}/` }, cwd })).toBe(
      mirror
    );
    expect(await resolveNpmRegistry({ env: { YARN_REGISTRY: mirror }, cwd })).toBe(
      'https://npmrc.example'
    );

    await fs.rm(cwd, { recursive: true });
  });

  it('falls back to the public registry', async () => {
    let cwd = await fs.mkdtemp(path.join(tmpdir(), 'registry-probe-'));

    expect(await resolveNpmRegistry({ env: {}, cwd })).toBe(publicNpmRegistry);
    expect(await resolveNpmRegistry({ env: { YARN_REGISTRY: mirror }, cwd })).toBe(mirror);

    await fs.rm(cwd, { recursive: true });
  });
});

describe('probeRegistry', () => {
  it('requests packument metadata with scoped names escaped', async () => {
    let { fetch, urls } = createFetch(() => new Response('{}'));

    await probeRegistry({ registry: mirror, packages: ['left-pad', '@scope/pkg'], fetch });

    expect(urls).toEqual([`${mirror}/left-pad`, `${mirror}/@scope%2fpkg`]);
  });

  it('reports blocked when every request fails or is denied by the gateway', async () => {
    let { fetch } = createFetch(url => {
      if (url.endsWith('left-pad')) throw new TypeError('fetch failed');
      return gatewayDenial();
    });

    expect(
      await probeRegistry({ registry: mirror, packages: ['left-pad', 'lodash'], fetch })
    ).toEqual({
      status: 'blocked',
      registry: mirror
    });
  });

  it('reports the packages the registry does not have', async () => {
    let { fetch } = createFetch(url =>
      url.endsWith('left-pad')
        ? new Response('{}')
        : new Response('{"error":"Not found"}', { status: 404 })
    );

    expect(
      await probeRegistry({ registry: mirror, packages: ['left-pad', 'lfet-pad'], fetch })
    ).toEqual({
      status: 'reachable',
      registry: mirror,
      notFound: ['lfet-pad']
    });
  });

  it('treats a registry 403 without the gateway message as reachable', async () => {
    let { fetch } = createFetch(() => new Response('Forbidden', { status: 403 }));

    expect(
      await probeRegistry({ registry: mirror, packages: ['private-pkg'], fetch })
    ).toEqual({
      status: 'reachable',
      registry: mirror,
      notFound: []
    });
  });

  it('probes at most ten packages', async () => {
    let { fetch, urls } = createFetch(() => new Response('{}'));
    let packages = Array.from({ length: 15 }, (_, index) => `pkg-${index}`);

    await probeRegistry({ registry: mirror, packages, fetch });

    expect(urls).toHaveLength(10);
  });
});

describe('describeInstallFailure', () => {
  it('points at the npm mirror setting when the public registry is blocked', () => {
    expect(
      describeInstallFailure({
        probe: { status: 'blocked', registry: publicNpmRegistry },
        missing: ['lodash', 'axios']
      })
    ).toBe(
      'Builds cannot reach https://registry.npmjs.org, and these packages are not preinstalled: lodash, axios. Air-gapped installations need an npm mirror (Helm value `runtime.builds.npmRegistry.url`).'
    );
  });

  it('points at the egress hosts when a mirror is blocked', () => {
    expect(
      describeInstallFailure({
        probe: { status: 'blocked', registry: mirror },
        missing: ['lodash']
      })
    ).toContain(`Builds cannot reach the npm mirror at ${mirror}`);
  });

  it('names packages the registry does not have', () => {
    expect(
      describeInstallFailure({
        probe: { status: 'reachable', registry: mirror, notFound: ['lfet-pad'] },
        missing: ['lfet-pad', 'lodash']
      })
    ).toBe(`These packages are not preinstalled and were not found on ${mirror}: lfet-pad.`);
  });

  it('leaves the original error alone when the registry has every package', () => {
    expect(
      describeInstallFailure({
        probe: { status: 'reachable', registry: mirror, notFound: [] },
        missing: ['lodash']
      })
    ).toBeNull();
  });
});
