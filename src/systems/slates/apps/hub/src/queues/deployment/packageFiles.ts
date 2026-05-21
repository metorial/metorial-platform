type DeploymentArchiveFile = {
  path: string;
  buffer: Buffer;
};

let logoFiles = ['png', 'jpg', 'jpeg', 'svg'].map(ext => `logo.${ext}`);
let wrapperDependencies = {
  '@slates/provider-handler': 'latest',
  '@slates/proto': 'latest',
  slates: 'latest',
  '@lowerdeck/serialize': 'latest'
};
let entrypointExtensions = ['.js', '.cjs', '.mjs'];

let getArchiveFile = (files: DeploymentArchiveFile[], path: string) =>
  files.find(file => file.path === path);

let normalizeArchivePath = (value: string) => value.replace(/^\.\/+/, '').replace(/^\/+/, '');

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

let getPackageJsonEntrypoint = (packageJson: Record<string, any> | null) => {
  let dotExport = packageJson?.exports?.['.'];

  if (typeof dotExport == 'string') return dotExport;

  if (dotExport && typeof dotExport == 'object' && !Array.isArray(dotExport)) {
    for (let key of ['import', 'default', 'require']) {
      if (typeof dotExport[key] == 'string') return dotExport[key];
    }
  }

  return packageJson?.main;
};

let getSlateEntrypoint = (
  files: DeploymentArchiveFile[],
  packageJson: Record<string, any> | null
): string => {
  let declaredEntrypoint = getPackageJsonEntrypoint(packageJson);

  if (typeof declaredEntrypoint != 'string') {
    throw new Error('Slate package.json must declare a runtime entrypoint in exports["."] or main');
  }

  let normalizedDeclaredEntrypoint = normalizeArchivePath(declaredEntrypoint);
  if (
    normalizedDeclaredEntrypoint.endsWith('.ts') ||
    normalizedDeclaredEntrypoint.startsWith('src/') ||
    normalizedDeclaredEntrypoint.includes('/src/')
  ) {
    throw new Error(
      `Slate runtime entrypoint must be a built JavaScript artifact, got ${declaredEntrypoint}`
    );
  }

  for (let candidate of getEntrypointCandidates(declaredEntrypoint)) {
    if (!entrypointExtensions.some(ext => candidate.endsWith(ext))) continue;
    if (getArchiveFile(files, candidate)) return candidate;
  }

  throw new Error(
    `Slate runtime entrypoint ${declaredEntrypoint} was declared in package.json but was not found in the archive`
  );
};

let getMergedPackageJson = (packageJson: Record<string, any> | null) => ({
  ...(packageJson ?? {
    name: 'slate-version-function',
    version: '1.0.0'
  }),
  dependencies: {
    ...(packageJson?.dependencies ?? {}),
    ...wrapperDependencies
  }
});

let getFunctionBayConfig = () => ({
  entrypoint: 'slates_entry_point.mjs',
  build: false
});

export let buildSlateDeploymentFiles = (files: DeploymentArchiveFile[]) => {
  let packageJsonFile = getArchiveFile(files, 'package.json');
  let packageJson: Record<string, any> | null = null;

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
  let generatedFiles = [
    {
      filename: 'package.json',
      content: JSON.stringify(getMergedPackageJson(packageJson), null, 2)
    },
    {
      filename: 'function-bay.json',
      content: JSON.stringify(getFunctionBayConfig(), null, 2)
    },
    {
      filename: 'slates_entry_point.mjs',
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
