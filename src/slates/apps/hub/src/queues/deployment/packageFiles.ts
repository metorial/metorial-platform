type DeploymentArchiveFile = {
  path: string;
  buffer: Buffer;
};

type SlatePackageJson = {
  [key: string]: any;
  main?: string;
  dependencies?: Record<string, any>;
  scripts?: Record<string, string | undefined>;
  slatesRuntime?: {
    wrapper?: unknown;
  };
};

let logoFiles = ['png', 'jpg', 'jpeg', 'svg'].map(ext => `logo.${ext}`);
let baseWrapperDependencies = {
  '@lowerdeck/serialize': 'latest',
  '@lowerdeck/rpc-client': 'latest'
};
let wrapperDependencies = {
  '@slates/provider-handler': '1.0.0-rc.22',
  '@slates/proto': '1.0.0-rc.17',
  slates: '1.0.0-rc.19',
  ...baseWrapperDependencies
};
let entrypointExtensions = ['.ts', '.js', '.cjs', '.mjs'];
let fallbackEntrypoints = [
  'src/index.ts',
  'src/index.js',
  'index.ts',
  'index.js',
  'dist/index.js',
  'dist/index.cjs'
];
let sourceProviderImportCandidates = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];

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

let getProviderImportPath = (
  files: DeploymentArchiveFile[],
  slateEntrypoint: string,
  useBundledWrapper: boolean
): string => {
  if (useBundledWrapper) return slateEntrypoint;
  if (!slateEntrypoint.startsWith('dist/')) return slateEntrypoint;

  for (let candidate of sourceProviderImportCandidates) {
    if (getArchiveFile(files, candidate)) {
      console.log(
        `[Deployment]: Using source provider import ${candidate} instead of prebuilt ${slateEntrypoint}`
      );
      return candidate;
    }
  }

  return slateEntrypoint;
};

let isPrebuiltNccArtifact = (filePath: string) => {
  let normalized = normalizeArchivePath(filePath);
  if (!normalized.startsWith('dist/')) return false;

  if (normalized.endsWith('.map')) return true;
  if (normalized.includes('sourcemap-register')) return true;
  if (/^dist\/index\.(js|cjs|mjs)$/.test(normalized)) return true;
  if (/^dist\/[0-9a-f]{10,}\.js$/i.test(normalized)) return true;

  return false;
};

let stripSourcemapRegisterImport = (content: string) =>
  content.replace(/^import\s+['"]\.\/?sourcemap-register\.cjs['"];?\s*/m, '');

let hasBundledWrapper = (packageJson: SlatePackageJson | null) =>
  packageJson?.slatesRuntime?.wrapper === 'bundled';

let internalWrapperDependencyNames = [
  '@slates/provider-handler',
  '@slates/proto',
  'slates'
] as const;
let installableDependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const;

let withoutInternalWrapperDependencies = (packageJson: SlatePackageJson) => {
  let sanitized = { ...packageJson };

  for (let section of installableDependencySections) {
    let dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      continue;
    }

    let nextDependencies = { ...dependencies };
    for (let dependencyName of internalWrapperDependencyNames) {
      delete nextDependencies[dependencyName];
    }
    sanitized[section] = nextDependencies;
  }

  for (let section of ['bundledDependencies', 'bundleDependencies'] as const) {
    let dependencies = packageJson[section];
    if (!Array.isArray(dependencies)) continue;
    sanitized[section] = dependencies.filter(
      dependency => !internalWrapperDependencyNames.includes(dependency)
    );
  }

  return sanitized;
};

let getMergedPackageJson = (
  packageJson: SlatePackageJson | null,
  useBundledWrapper: boolean
) => {
  let sourcePackageJson =
    packageJson && useBundledWrapper
      ? withoutInternalWrapperDependencies(packageJson)
      : packageJson;
  let mergedPackageJson: SlatePackageJson = {
    ...(sourcePackageJson ?? {
      name: 'slate-version-function',
      version: '1.0.0'
    }),
    dependencies: {
      ...(sourcePackageJson?.dependencies ?? {}),
      ...(useBundledWrapper ? baseWrapperDependencies : wrapperDependencies)
    }
  };

  if (mergedPackageJson.type === 'module') {
    delete mergedPackageJson.type;
  }

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

let getFunctionBayConfig = (providerImportPath: string) => ({
  entrypoint: 'slates_entry_point.js',
  ...(providerImportPath.startsWith('dist/')
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

  let useBundledWrapper = hasBundledWrapper(packageJson);
  let slateEntrypoint = getSlateEntrypoint(files, packageJson);
  let providerImportPath = getProviderImportPath(files, slateEntrypoint, useBundledWrapper);
  let usePrebuiltDist = providerImportPath.startsWith('dist/');

  console.log(`[Deployment]: Using slate entrypoint: ${slateEntrypoint}`);
  if (providerImportPath !== slateEntrypoint) {
    console.log(`[Deployment]: Provider import path: ${providerImportPath}`);
  }

  let generatedFiles = [
    {
      filename: 'package.json',
      content: JSON.stringify(getMergedPackageJson(packageJson, useBundledWrapper), null, 2)
    },
    {
      filename: 'function-bay.json',
      content: JSON.stringify(getFunctionBayConfig(providerImportPath), null, 2)
    },
    {
      filename: 'slates_entry_point.js',
      content: `
          import { createRequire } from 'node:module';
          ${
            useBundledWrapper
              ? `import { provider, createProviderHandler, SlatesProviderProtoHandlerManager } from './${providerImportPath}';`
              : `import { provider } from './${providerImportPath}';
          import { createProviderHandler } from '@slates/provider-handler';
          import { SlatesProviderProtoHandlerManager } from '@slates/proto';`
          }
          import { serialize } from '@lowerdeck/serialize';
          import { createClient } from '@lowerdeck/rpc-client';

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

            let secretRpcEndpoint = process.env.SLATES_HUB_SECRET_RPC_URL;
            let secretRpcToken = process.env.SLATES_HUB_RUNTIME_IDENTITY_SECRET;
            let runtimeIdentityId = process.env.SLATES_HUB_RUNTIME_IDENTITY_ID;
            let runtimeIdentityGeneration = Number(process.env.SLATES_HUB_RUNTIME_IDENTITY_GENERATION);
            let deploymentId = process.env.SLATES_HUB_DEPLOYMENT_ID;
            let handler = createProviderHandler(provider, [
              e => e.forEach(e => console.log(e.type.toUpperCase(), e.message))
            ], {
              redeemScopedInvocationGrant: async ({ envelope, expected }) => {
                if (!secretRpcEndpoint || !secretRpcToken || !runtimeIdentityId || !deploymentId || !Number.isInteger(runtimeIdentityGeneration) || runtimeIdentityGeneration <= 0) {
                  throw new Error('Authenticated scoped invocation redemption is unavailable');
                }
                let secretRpc = createClient({
                  endpoint: secretRpcEndpoint,
                  disableBatching: true,
                  getSignatureToken: () => ({
                    secret: secretRpcToken,
                    headers: { 'x-slates-runtime-identity-id': runtimeIdentityId }
                  })
                });
                let redemption = await secretRpc.redeemScopedToolInvocationGrant({
                  caller: {
                    deploymentId,
                    runtimeIdentityId,
                    runtimeIdentityGeneration,
                    hubInvocationId: input.invocationId
                  },
                  envelope,
                  expected
                });
                let secrets = redemption.secrets;
                let clear = () => {
                  for (let secret of Object.values(secrets)) secret.value = '';
                  secrets = {};
                };
                return { bindings: redemption.bindings, secrets, clear };
              }
            });

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
    providerImportPath,
    files: [
      ...generatedFiles,
      ...files
        .filter(file => file.path !== 'package.json')
        .filter(file => !logoFiles.some(logo => file.path.endsWith(logo)))
        .filter(file => usePrebuiltDist || !isPrebuiltNccArtifact(file.path))
        .map(file => {
          let filename = generatedFilenames.has(file.path) ? `_${file.path}` : file.path;
          let content = file.buffer.toString('base64');

          if (
            usePrebuiltDist &&
            (filename === 'dist/index.js' ||
              filename === 'dist/index.cjs' ||
              filename === 'dist/index.mjs')
          ) {
            let sanitized = stripSourcemapRegisterImport(file.buffer.toString('utf-8'));
            if (sanitized !== file.buffer.toString('utf-8')) {
              content = Buffer.from(sanitized, 'utf-8').toString('base64');
            }
          }

          return {
            filename,
            content,
            encoding: 'base64' as const
          };
        })
    ]
  };
};
