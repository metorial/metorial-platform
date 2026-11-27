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

type BundledRuntime = {
  version: string;
  main: string;
  files: DeploymentArchiveFile[];
};

let logoFiles = ['png', 'jpg', 'jpeg', 'svg'].map(ext => `logo.${ext}`);
let runtimeDirectory = '_slates_runtime';
let runtimeDependencies = {
  '@slates/provider-handler': 'latest',
  '@slates/proto': 'latest',
  '@lowerdeck/serialize': 'latest'
};
let wrapperDependencies = {
  ...runtimeDependencies,
  slates: 'latest'
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
  slateEntrypoint: string
): string => {
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

let getPrebuiltPackageJson = (
  packageJson: SlatePackageJson | null,
  runtime: BundledRuntime | undefined
) => ({
  name: packageJson?.name ?? 'slate-version-function',
  version: packageJson?.version ?? '1.0.0',
  private: true,
  ...(runtime ? {} : { dependencies: runtimeDependencies })
});

let getRuntimeImports = (runtime: BundledRuntime | undefined) =>
  runtime
    ? `import { createProviderHandler, SlatesProviderProtoHandlerManager, serialize } from './${runtimeDirectory}/${normalizeArchivePath(runtime.main)}';`
    : `import { createProviderHandler } from '@slates/provider-handler';
          import { SlatesProviderProtoHandlerManager } from '@slates/proto';
          import { serialize } from '@lowerdeck/serialize';`;

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

export let buildSlateDeploymentFiles = (
  files: DeploymentArchiveFile[],
  opts: { npmRegistryUrl?: string; runtime?: BundledRuntime } = {}
) => {
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
  let providerImportPath = getProviderImportPath(files, slateEntrypoint);
  let usePrebuiltDist = providerImportPath.startsWith('dist/');
  // Source slates are compiled against their own declared packages, so only prebuilt slates
  // take the registry-delivered runtime.
  let runtime = usePrebuiltDist ? opts.runtime : undefined;

  console.log(`[Deployment]: Using slate entrypoint: ${slateEntrypoint}`);
  if (providerImportPath !== slateEntrypoint) {
    console.log(`[Deployment]: Provider import path: ${providerImportPath}`);
  }

  let generatedFiles = [
    {
      filename: 'package.json',
      content: JSON.stringify(
        usePrebuiltDist
          ? getPrebuiltPackageJson(packageJson, runtime)
          : getMergedPackageJson(packageJson),
        null,
        2
      )
    },
    {
      filename: 'function-bay.json',
      content: JSON.stringify(getFunctionBayConfig(providerImportPath), null, 2)
    },
    {
      filename: 'slates_entry_point.js',
      content: `
          import { provider } from './${providerImportPath}';
          ${getRuntimeImports(runtime)}

          let handler = createProviderHandler(provider, [
            e => e.forEach(e => console.log(e.type.toUpperCase(), e.message))
          ]);

          export default async (input) => {
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

                if (typeof result.error == 'object' && result.error) {
                  console.error('[Metorial Runtime]: Error in processing:', result.error);
                  if (!m.id) continue;
                  messages.push(result);
                  break;
                }

                messages.push(result);
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
  if (opts.npmRegistryUrl) {
    generatedFiles.push({ filename: '.npmrc', content: `registry=${opts.npmRegistryUrl}\n` });
  }
  let generatedFilenames = new Set(generatedFiles.map(file => file.filename));

  let runtimeFiles = (runtime?.files ?? []).map(file => ({
    filename: `${runtimeDirectory}/${normalizeArchivePath(file.path)}`,
    content: file.buffer.toString('base64'),
    encoding: 'base64' as const
  }));

  return {
    slateEntrypoint,
    providerImportPath,
    usesPrebuiltDist: usePrebuiltDist,
    runtimeVersion: runtime?.version ?? null,
    files: [
      ...generatedFiles,
      ...runtimeFiles,
      ...files
        .filter(file => file.path !== 'package.json')
        .filter(file => !normalizeArchivePath(file.path).startsWith(`${runtimeDirectory}/`))
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
