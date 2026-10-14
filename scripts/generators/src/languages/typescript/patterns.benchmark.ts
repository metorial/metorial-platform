import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import ts from 'typescript';

let iterations = 10000;
let rounds = 5;

let repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

let workspace = path.resolve(process.argv[2] ?? '/tmp/metorial-mapper-patterns');

let runtime = path.join(repo, 'oss/clients/metorial-node/packages/util-resource-mapper/dist');

let variants = [
  'disabled',
  'dates',
  'date-filter',
  'pagination',
  'lists',
  'timestamps',
  'without-filters',
  'without-pagination',
  'without-lists',
  'without-timestamps',
  'all'
];

let clients = [
  ['dashboard', 'metorial-dashboard/src/gen', 'mt_2025_01_01_dashboard'],
  ['consumer', 'metorial-consumer/src/gen', 'mt_2026_04_01_consumer'],
  ['node', 'metorial-node/sdk/gen', 'mt_2026_01_01_magnetar']
];

let sizes = (data: Uint8Array) => ({
  raw: data.length,
  gzip: gzipSync(data).length,
  brotli: brotliCompressSync(data).length
});

let literal = (node: ts.Node): any =>
  ts.isArrayLiteralExpression(node)
    ? node.elements.map(literal)
    : ts.isStringLiteral(node)
      ? node.text
      : ts.isNumericLiteral(node)
        ? Number(node.text)
        : undefined;

let countPatterns = (descriptor: any, counts: Record<string, number>, flags = 0) => {
  if (descriptor === 5 || descriptor === 6 || descriptor === 8) {
    counts[descriptor] = (counts[descriptor] ?? 0) + 1;
  } else if (Array.isArray(descriptor)) {
    if (descriptor[0] === 1) {
      for (let field of descriptor[1]) {
        if ((flags & 1) !== 0 && typeof field === 'string' && field.endsWith('_at'))
          counts.dateDefaults = (counts.dateDefaults ?? 0) + 1;
        if (Array.isArray(field) && field.length === 3) countPatterns(field[2], counts, flags);
      }
    } else if (descriptor[0] === 2 || descriptor[0] === 7) {
      if (descriptor[0] === 7) counts[7] = (counts[7] ?? 0) + 1;
      countPatterns(descriptor[1], counts, flags);
    } else if (descriptor[0] === 3) {
      for (let branch of descriptor[1]) countPatterns(branch[1], counts, flags);
    }
  }
};

let inspect = async (
  directory: string
): Promise<{ source: number; patterns: Record<string, number> }> => {
  let source = 0;
  let patterns: Record<string, number> = {};

  for (let entry of await readdir(directory, { withFileTypes: true })) {
    let file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      let child = await inspect(file);
      source += child.source;
      for (let [key, count] of Object.entries(child.patterns))
        patterns[key] = (patterns[key] ?? 0) + count;
    } else if (entry.name.endsWith('.ts')) {
      let text = await readFile(file, 'utf8');
      source += Buffer.byteLength(text);
      let tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      let visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ['mapObject', 'createMapper'].includes(node.expression.text)
        ) {
          let descriptor = literal(node.arguments[0]);
          countPatterns(
            node.expression.text === 'mapObject' ? [1, descriptor] : descriptor,
            patterns,
            node.arguments[1] ? literal(node.arguments[1]) : 0
          );
        }

        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  }

  return { source, patterns };
};

let bundle = async (entry: string, runtimeDirectory: string) => {
  let result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    external: ['@metorial/util-endpoint', 'jose'],
    plugins: [
      {
        name: 'runtime',
        setup(builder) {
          builder.onResolve({ filter: /^@metorial\/util-resource-mapper\/compact$/ }, () => ({
            path: path.join(runtimeDirectory, 'compact.js')
          }));
        }
      }
    ]
  });

  return sizes(result.outputFiles[0].contents);
};

let time = (operation: () => unknown) => {
  let samples: number[] = [];
  let result: unknown;

  for (let index = 0; index < 1000; index++) result = operation();

  for (let round = 0; round < rounds; round++) {
    let start = performance.now();
    for (let index = 0; index < iterations; index++) result = operation();
    samples.push(((performance.now() - start) * 1000) / iterations);
  }

  if (result === undefined) throw new Error('Missing benchmark result.');

  return samples.sort((a, b) => a - b)[Math.floor(rounds / 2)];
};

let main = async () => {
  let report: Record<string, any> = {};

  for (let variant of ['baseline', ...variants]) {
    let measurements: Record<string, any> = {};
    let total = { source: 0, raw: 0, gzip: 0, brotli: 0 };

    for (let [name, folder, version] of clients) {
      let root = path.join(
        workspace,
        variant === 'baseline' ? 'baseline' : `variants/${variant}`,
        'clients',
        folder,
        'src',
        version
      );
      let inspection = await inspect(root);
      let bytes = await bundle(
        path.join(root, 'index.ts'),
        variant === 'baseline' ? path.join(workspace, 'baseline-runtime') : runtime
      );
      measurements[name] = { ...inspection, ...bytes };
      total.source += inspection.source;
      for (let key of ['raw', 'gzip', 'brotli'] as const) total[key] += bytes[key];
    }

    report[variant] = { clients: measurements, total };
    console.log(variant, total);
  }

  let baselineApi = createRequire(import.meta.url)(
    path.join(workspace, 'baseline-runtime/compact.cjs')
  );
  let api = createRequire(import.meta.url)(path.join(runtime, 'compact.cjs'));
  let canonical = [
    1,
    [
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              ['created_at', 1, 4],
              ['updated_at', 1, 4]
            ]
          ]
        ]
      ],
      ['pagination', 0, [1, ['has_more_before', 'has_more_after']]]
    ]
  ];
  let special = [7, 8];
  let wire = {
    items: Array.from({ length: 100 }, (_, id) => ({
      id,
      created_at: '2026-10-14',
      updated_at: null,
      metadata: { raw_at: 'unchanged' }
    })),
    pagination: { has_more_before: false, has_more_after: true }
  };
  let oldMapper = baselineApi.createMapper(canonical);
  let mapper = api.createMapper(special, 1);
  let sdk = oldMapper.transformFrom(wire);

  if (
    !isDeepStrictEqual(sdk, mapper.transformFrom(wire)) ||
    !isDeepStrictEqual(oldMapper.transformTo(sdk), mapper.transformTo(sdk))
  )
    throw new Error('List equivalence failed.');

  report.performance = {
    unit: 'microseconds per operation; median of five warmed rounds',
    iterations,
    items: 100,
    initialization: {
      baseline: time(() => baselineApi.createMapper(canonical)),
      patterns: time(() => api.createMapper(special, 1))
    },
    transformFrom: {
      baseline: time(() => oldMapper.transformFrom(wire)),
      patterns: time(() => mapper.transformFrom(wire))
    },
    transformTo: {
      baseline: time(() => oldMapper.transformTo(sdk)),
      patterns: time(() => mapper.transformTo(sdk))
    }
  };

  if (
    report.all.total.gzip >= report.baseline.total.gzip ||
    report.all.total.brotli >= report.baseline.total.brotli
  )
    throw new Error('Combined patterns do not shrink compressed bundles.');

  let compressed = (variant: string) =>
    report[variant].total.gzip + report[variant].total.brotli;

  for (let variant of ['date-filter', 'pagination', 'lists', 'timestamps']) {
    for (let encoding of ['gzip', 'brotli']) {
      if (report[variant].total[encoding] >= report.disabled.total[encoding]) {
        throw new Error(`${variant} does not reduce aggregate ${encoding} bytes.`);
      }
    }
  }

  for (let variant of ['without-filters', 'without-lists', 'without-timestamps']) {
    if (compressed('all') >= compressed(variant))
      throw new Error(`${variant} improves the combined registry; reconsider that pattern.`);
  }

  for (let client of Object.keys(report.all.clients)) {
    for (let encoding of ['gzip', 'brotli']) {
      if (
        report.all.clients[client][encoding] >
        report.baseline.clients[client][encoding] + 256
      ) {
        throw new Error(
          `${client} ${encoding} regresses by more than the 256-byte per-client budget.`
        );
      }
    }
  }

  await writeFile(
    process.argv[3] ?? path.join(workspace, 'benchmark.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log('Performance', report.performance);
};

await main();
