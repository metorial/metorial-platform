type DeploymentArchiveFile = {
  path: string;
  buffer: Buffer;
};

type SlatePackageJson = {
  [key: string]: any;
  main?: string;
  dependencies?: Record<string, any>;
  scripts?: Record<string, string | undefined>;
};

let logoFiles = ['png', 'jpg', 'jpeg', 'svg'].map(ext => `logo.${ext}`);
let wrapperDependencies = {
  '@slates/provider-handler': 'latest',
  '@slates/proto': 'latest',
  slates: 'latest',
  '@lowerdeck/serialize': 'latest'
};
let entrypointExtensions = ['.ts', '.js', '.cjs', '.mjs'];
let fallbackEntrypoints = [
  'src/index.ts',
  'src/index.js',
  'index.ts',
  'index.js',
  'dist/index.js'
];

let getArchiveFile = (files: DeploymentArchiveFile[], path: string) =>
  files.find(file => file.path === path);

let normalizeArchivePath = (value: string) => value.replace(/^\.\/+/, '').replace(/^\/+/, '');

let nccBuildPattern = /(^|\s)(?:@vercel\/)?ncc\s+build(\s|$)/;
let nccTranspileOnlyPattern = /(^|\s)--transpile-only(\s|$)/;

let ensureNccTranspileOnly = (buildScript: string | undefined) => {
  if (!buildScript) return buildScript;
  if (!nccBuildPattern.test(buildScript)) return buildScript;
  if (nccTranspileOnlyPattern.test(buildScript)) return buildScript;

  return `${buildScript} --transpile-only`;
};

let getEntrypointCandidates = (value: string) => {
  let normalized = normalizeArchivePath(value);
  let candidates = [normalized];

  if (!entrypointExtensions.some(ext => normalized.endsWith(ext))) {
    for (let ext of entrypointExtensions) {
      candidates.push(`${normalized}${ext}`);
    }

    for (let ext of entrypointExtensions) {
      candidates.push(`${normalized}/index${ext}`);
    }
  }

  return [...new Set(candidates)];
};

let getSlateEntrypoint = (
  files: DeploymentArchiveFile[],
  packageJson: Pick<SlatePackageJson, 'main'> | null
): string => {
  if (packageJson?.main) {
    for (let candidate of getEntrypointCandidates(packageJson.main)) {
      if (getArchiveFile(files, candidate)) return candidate;
    }
  }

  for (let candidate of fallbackEntrypoints) {
    if (getArchiveFile(files, candidate)) return candidate;
  }

  throw new Error(
    'Could not determine slate entrypoint - no main field in package.json and no common entry files found'
  );
};

let getMergedPackageJson = (packageJson: SlatePackageJson | null) => {
  let mergedPackageJson: SlatePackageJson = {
    ...(packageJson ?? {
      name: 'slate-version-function',
      version: '1.0.0'
    }),
    dependencies: {
      ...(packageJson?.dependencies ?? {}),
      ...wrapperDependencies
    }
  };

  let buildScript = ensureNccTranspileOnly(mergedPackageJson.scripts?.build);
  if (!buildScript) return mergedPackageJson;

  return {
    ...mergedPackageJson,
    scripts: {
      ...mergedPackageJson.scripts,
      build: buildScript
    }
  };
};

let getFunctionBayConfig = (slateEntrypoint: string) => ({
  entrypoint: 'slates_entry_point.js',
  ...(slateEntrypoint.startsWith('dist/')
    ? {
        scripts: {
          build: 'echo "Skipping slate build in favor of hub wrapper entrypoint"'
        }
      }
    : {})
});

export let buildSlateDeploymentFiles = (files: DeploymentArchiveFile[]) => {
  let packageJsonFile = getArchiveFile(files, 'package.json');
  let packageJson: SlatePackageJson | null = null;

  if (packageJsonFile) {
    try {
      packageJson = JSON.parse(packageJsonFile.buffer.toString('utf-8'));
    } catch (e) {
      console.warn(
        `[Deployment]: Failed to parse slate package.json, using fallback package`,
        e
      );
    }
  }

  let slateEntrypoint = getSlateEntrypoint(files, packageJson);
  console.log(`[Deployment]: Using slate entrypoint: ${slateEntrypoint}`);
  let generatedFiles = [
    {
      filename: 'package.json',
      content: JSON.stringify(getMergedPackageJson(packageJson), null, 2)
    },
    {
      filename: 'function-bay.json',
      content: JSON.stringify(getFunctionBayConfig(slateEntrypoint), null, 2)
    },
    {
      filename: 'slates_entry_point.js',
      content: `
          import { createRequire } from 'node:module';
          import { provider } from './${slateEntrypoint}';
          import { createProviderHandler } from '@slates/provider-handler';
          import { SlatesProviderProtoHandlerManager } from '@slates/proto';
          import { serialize } from '@lowerdeck/serialize';

          let handler = createProviderHandler(provider, [
            e => e.forEach(e => console.log(e.type.toUpperCase(), e.message))
          ]);

          let initialGlobals = {}
          for (let key of Object.getOwnPropertyNames(globalThis)) {
            initialGlobals[key] = globalThis[key]
          }

          let moduleRequire = typeof require == 'function' ? require : createRequire(import.meta.url)

          let reset = () => {
            for (let key of Object.getOwnPropertyNames(globalThis)) {
              if (!(key in initialGlobals)) {
                try {
                  delete globalThis[key];
                } catch {}
              }
            }

            for (let key in initialGlobals) {
              try {
                globalThis[key] = initialGlobals[key];
              } catch {}
            }

            for (let key in moduleRequire.cache) {
              try {
                delete moduleRequire.cache[key];
              } catch {}
            }
          }

          export default async (input) => {
            reset();

            if (input._encoded) {
              input = serialize.decode(input._encoded);
            }

            let manager = await handler.run();

            let messages = [];

            for (let m of input.messages) {
              console.log('[Metorial Runtime]: Processing input message', m.method + (m.id ? \`(\${m.id})\` : ''));
              let result = await SlatesProviderProtoHandlerManager.handleInput(manager, m);
              if (result) {
                if (m.id) result.id = m.id;
                messages.push(result);

                if (typeof result.error == 'object' && result.error) {
                  console.error('[Metorial Runtime]: Error in processing:', result.error);
                  break;
                }
              }
            }

            if (input._encoded) {
              return { _encoded: serialize.encode({ messages }) };
            }

            return { messages };
          };
        `
    }
  ];
  let generatedFilenames = new Set(generatedFiles.map(file => file.filename));

  return {
    slateEntrypoint,
    files: [
      ...generatedFiles,
      ...files
        .filter(file => file.path !== 'package.json')
        .filter(file => !logoFiles.some(logo => file.path.endsWith(logo)))
        .map(file => ({
          filename: generatedFilenames.has(file.path) ? `_${file.path}` : file.path,
          content: file.buffer.toString('base64'),
          encoding: 'base64' as const
        }))
    ]
  };
};
