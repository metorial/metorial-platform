let extension = ['.js', '.ts', '.cjs', '.mjs'];
let commonNames = ['index', 'main', 'app', 'server', 'function'];
let commonDirs = ['', 'src/', 'dist/'];

let entrypointRuntimeDependencies = { '@metorial/mcp-server': 'latest' };

let removeExtension = (filename: string) => {
  for (let ext of extension) {
    if (filename.endsWith(ext)) {
      return filename.slice(0, -ext.length);
    }
  }
  return filename;
};

let commonEntrypoints = commonDirs.flatMap(dir =>
  commonNames.flatMap(name => extension.map(ext => dir + name + ext))
);

type FunctionFile = McpRuntimePrismaJson.UpcomingFunctionServerPayload['files'][number];

let decodeFileContent = (file: FunctionFile) =>
  file.encoding === 'base64'
    ? Buffer.from(file.content, 'base64').toString('utf-8')
    : file.content;

let encodeFileContent = (file: FunctionFile, content: string) =>
  file.encoding === 'base64' ? Buffer.from(content, 'utf-8').toString('base64') : content;

let getMissingRuntimeDependencies = (pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}) => {
  let declared = { ...pkg.devDependencies, ...pkg.dependencies };
  let missing = Object.entries(entrypointRuntimeDependencies).filter(
    ([name]) => !(name in declared)
  );

  return missing.length ? Object.fromEntries(missing) : null;
};

export let getFunctionFs = (d: {
  payload: McpRuntimePrismaJson.UpcomingFunctionServerPayload;
}) => {
  let files = d.payload.files;
  let functionEntrypoint: string | undefined;
  let packageJson = files.find(
    f => f.filename === 'package.json' || f.filename === './package.json'
  );

  let logs: string[] = [];

  if (packageJson?.content) {
    let stringContents = decodeFileContent(packageJson);

    try {
      let pkg = JSON.parse(stringContents);
      if (pkg.main) {
        functionEntrypoint = './' + pkg.main;
      }
    } catch {
      logs.push('Could not parse package.json to determine function entrypoint.');
    }
  }

  if (!functionEntrypoint) {
    for (let entry of commonEntrypoints) {
      if (files.some(f => f.filename === entry)) {
        functionEntrypoint = './' + entry;
        break;
      }
    }
  }

  if (!functionEntrypoint) {
    logs.push(
      'Could not determine function entrypoint. Please create a package.json with a "main" field or add an index.js/index.ts file.'
    );
    return {
      ok: false,
      logs
    };
  }

  logs.push(`Using function entrypoint: ${functionEntrypoint}`);

  let initialFiles = [
    {
      filename: 'function-bay.json',
      content: JSON.stringify(
        {
          entrypoint: 'shuttle_entry_point.js'
        },
        null,
        2
      )
    },
    {
      filename: 'shuttle_entry_point.js',
      content: `
        import instance from '${functionEntrypoint}';
        import { serverAdapter } from '@metorial/mcp-server';

        export default async (input) => {
          try {
            return await serverAdapter(instance, input.messages);
          } finally {
            if (instance && typeof instance.close === 'function') {
              try { await instance.close(); } catch {}
            }
          }
        };
        `
    }
  ];
  let initialFilenames = new Set(initialFiles.map(f => f.filename));
  let packagedFiles = files.map(file => {
    if (file !== packageJson || !packageJson.content) return file;

    try {
      let pkg = JSON.parse(decodeFileContent(packageJson));
      let missingDependencies = getMissingRuntimeDependencies(pkg);
      if (pkg.type !== 'module' && !missingDependencies) return file;

      delete pkg.type;
      if (missingDependencies) {
        pkg.dependencies = { ...pkg.dependencies, ...missingDependencies };
      }

      return {
        ...file,
        content: encodeFileContent(file, JSON.stringify(pkg, null, 2))
      };
    } catch {
      return file;
    }
  });

  if (!packageJson) {
    packagedFiles.push({
      filename: 'package.json',
      content: JSON.stringify(
        {
          name: 'function-server',
          version: '1.0.0',
          private: true,
          dependencies: entrypointRuntimeDependencies
        },
        null,
        2
      )
    });
  }

  return {
    ok: true as const,
    logs,
    files: [...initialFiles, ...packagedFiles.filter(f => !initialFilenames.has(f.filename))]
  };
};
