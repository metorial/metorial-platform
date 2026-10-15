import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import {
  createMapper,
  mapObject
} from '../../../../../clients/metorial-node/packages/util-resource-mapper/src/compact';
import { createRequire } from 'node:module';

let iterations = 3000;
let rounds = 5;

let repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

let runtime = path.join(repo, 'oss/clients/metorial-node/packages/util-resource-mapper');

let { mtMap } = createRequire(import.meta.url)(path.join(runtime, 'dist/index.cjs'));

let baseline = process.argv[2];

let outputFile = process.argv[3];

let sizes = (data: Uint8Array) => ({
  raw: data.length,
  gzip: gzipSync(data).length,
  brotli: brotliCompressSync(data).length
});

let sourceSize = async (directory: string): Promise<number> => {
  let total = 0;

  for (let entry of await readdir(directory, { withFileTypes: true })) {
    let file = path.join(directory, entry.name);
    total += entry.isDirectory()
      ? await sourceSize(file)
      : entry.name.endsWith('.ts')
        ? (await readFile(file)).length
        : 0;
  }

  return total;
};

let bundle = async (file: string, minify: boolean) => {
  let result = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    minify,
    external: ['@metorial/util-endpoint', 'jose'],
    plugins: [
      {
        name: 'local-mappers',
        setup(builder) {
          builder.onResolve(
            { filter: /^@metorial\/util-resource-mapper(\/compact)?$/ },
            args => ({
              path: path.join(
                runtime,
                'dist',
                args.path.endsWith('/compact') ? 'compact.js' : 'index.js'
              )
            })
          );
        }
      }
    ]
  });

  return result.outputFiles[0].contents;
};

let factory = async (
  file: string,
  mapperName: string
): Promise<() => ReturnType<typeof createMapper>> => {
  let source = (await readFile(file, 'utf8')).replace(/^import .*;$/gm, '');
  let javascript = new Bun.Transpiler({ loader: 'ts' })
    .transformSync(source)
    .replace(/export /g, '');
  let construct = new Function(
    'mtMap',
    'createMapper',
    'mapObject',
    `${javascript}; return ${mapperName};`
  );

  return () => construct(mtMap, createMapper, mapObject);
};

let time = (operation: () => unknown) => {
  let samples: number[] = [];
  let sink: unknown;

  for (let index = 0; index < 1000; index++) sink = operation();

  for (let round = 0; round < rounds; round++) {
    let start = performance.now();
    for (let index = 0; index < iterations; index++) sink = operation();
    samples.push(((performance.now() - start) * 1000) / iterations);
  }

  if (sink === undefined) throw new Error('Benchmark operation did not produce a value.');

  return samples.sort((a, b) => a - b)[Math.floor(rounds / 2)];
};

let main = async () => {
  if (!baseline)
    throw new Error(
      'Usage: bun run benchmark:mappers <baseline-clients-directory> [report.json]'
    );

  let report = {
    bundles: {} as Record<string, unknown>,
    detach: {} as Record<string, unknown>,
    performance: {} as Record<string, unknown>
  };
  let dashboardVersion: string | undefined;

  for (let folder of [
    'metorial-dashboard/src/gen',
    'metorial-consumer/src/gen',
    'metorial-node/sdk/gen'
  ]) {
    let currentRoot = path.join(repo, 'oss/clients', folder, 'src');
    let oldRoot = path.resolve(baseline, folder, 'src');
    let versions = (await readdir(currentRoot, { withFileTypes: true })).filter(
      entry => entry.isDirectory() && entry.name.startsWith('mt_')
    );

    for (let version of versions) {
      let before = path.join(oldRoot, version.name);
      let after = path.join(currentRoot, version.name);
      let oldMin = await bundle(path.join(before, 'index.ts'), true);
      let compactMin = await bundle(path.join(after, 'index.ts'), true);

      if (compactMin.length >= oldMin.length)
        throw new Error(`${version.name} did not shrink.`);

      report.bundles[version.name] = {
        source: { old: await sourceSize(before), compact: await sourceSize(after) },
        bundle: {
          old: sizes(await bundle(path.join(before, 'index.ts'), false)),
          compact: sizes(await bundle(path.join(after, 'index.ts'), false))
        },
        minified: { old: sizes(oldMin), compact: sizes(compactMin) }
      };

      if (folder.startsWith('metorial-dashboard')) dashboardVersion = version.name;
    }
  }

  if (!dashboardVersion) throw new Error('Dashboard version missing.');

  let resource = `${dashboardVersion}/resources/dashboard/instance/firewalls/network-policies/detach.ts`;
  let before = path.resolve(baseline, 'metorial-dashboard/src/gen/src', resource);
  let after = path.join(repo, 'oss/clients/metorial-dashboard/src/gen/src', resource);
  let mapperName = 'mapDashboardInstanceFirewallsNetworkPoliciesDetachOutput';
  let oldFactory = await factory(before, mapperName);
  let compactFactory = await factory(after, mapperName);

  let wire = {
    object: 'networking.firewall',
    id: 'firewall',
    slug: 'firewall',
    name: 'Firewall',
    description: null,
    status: 'active',
    network_policies: Array.from({ length: 2 }, () => ({
      object: 'networking.network_policy#preview',
      id: 'policy',
      name: 'Policy',
      version: 1,
      rules: Array.from({ length: 20 }, () => ({
        object: 'networking.network_policy.rule',
        id: 'rule',
        effect: 'allow',
        direction: 'ingress',
        cidrs: ['10.0.0.0/8'],
        description: null,
        enabled: true,
        priority: 1,
        ports: [{ object: 'networking.network_policy.port_range', from: 80, to: 80 }]
      }))
    })),
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
    archived_at: null
  };
  let oldMapper = oldFactory();
  let compactMapper = compactFactory();
  let sdk = oldMapper.transformFrom(wire);

  if (!isDeepStrictEqual(sdk, compactMapper.transformFrom(wire)))
    throw new Error('Detach output mismatch.');
  if (!isDeepStrictEqual(oldMapper.transformTo(sdk), compactMapper.transformTo(sdk)))
    throw new Error('Detach input mismatch.');

  report.detach = {
    old: sizes(await bundle(before, true)),
    compact: sizes(await bundle(after, true))
  };
  report.performance = {
    unit: 'microseconds per operation, median of five rounds after warmup',
    iterations,
    rulesPerResponse: 40,
    initialization: { old: time(oldFactory), compact: time(compactFactory) },
    transformFrom: {
      old: time(() => oldMapper.transformFrom(wire)),
      compact: time(() => compactMapper.transformFrom(wire))
    },
    transformTo: {
      old: time(() => oldMapper.transformTo(sdk)),
      compact: time(() => compactMapper.transformTo(sdk))
    }
  };

  let json = JSON.stringify(report, null, 2) + '\n';
  if (outputFile) await writeFile(outputFile, json);

  console.log(json);
};

await main();
