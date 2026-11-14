import type { FunctionBayLayer } from '@function-bay/types';
import { tempDir } from '@function-bay/utils';
import { $ as _$ } from 'bun';
import fs from 'fs/promises';
import path from 'path';
import { functionBayNodeBuildToolchain } from './buildToolchain';
import {
  compileKnativeEntrypoint,
  prepareKnativeBundle,
  writeFunctionPackage
} from './knative';
import { getMetorialLauncher } from './launcher';
import { readBuildLayer } from './layer';
import { cleanup } from './lib/cleanup';
import { fileExistsSync, readJsonFileOptional } from './lib/fs';
import { commandExists } from './lib/runCommand';
import { sanitizeLambdaBundle } from './lib/sanitizeLambdaBundle';

let KNATIVE_NODE_VERSION = '24.x' as const;

let $ = (...args: Parameters<typeof _$>) => {
  let commandString = '';
  let [templateStrings, ...values] = args;
  for (let i = 0; i < templateStrings.length; i++) {
    commandString += templateStrings[i];
    if (i < values.length) {
      commandString += values[i];
    }
  }

  let bashPrefix = 'bash -c "';
  if (commandString.startsWith(bashPrefix)) {
    commandString = commandString.slice(bashPrefix.length, -1);
  }

  console.log(`\n$ ${commandString}`);

  return _$(...args);
};

type Spec = {
  entrypoint?: string;
  scripts?: {
    build?: string;
  };
  nodeJsVersion?: string;
};

type PackageJson = {
  main?: string;
  scripts?: { build?: string };
};

type Project = {
  packageJson: PackageJson | null;
  functionBayFile: Spec | null;
};

let differentJsTypes = ['.ts', '.js', '.cjs', '.mjs'];
let tryExtensions = (base: string) => differentJsTypes.map(ext => base + ext);

let potentialDirs = ['', 'dist/', 'build/', 'output/', 'out/'];
let tryDirs = (filenames: string[]) =>
  filenames.flatMap(name => potentialDirs.map(dir => dir + name));

let readProject = async (): Promise<Project> => {
  let packageJson = await readJsonFileOptional<PackageJson>('package.json');
  if (!packageJson) {
    console.log('No package.json found in the current directory. Exiting build.');
  }

  let functionBayFile =
    (await readJsonFileOptional<Spec>('function-bay.json')) ??
    (await readJsonFileOptional<Spec>('metorial.json'));

  return { packageJson, functionBayFile };
};

let runBuildScript = async (project: Project, env: Record<string, string>) => {
  if (project.functionBayFile?.scripts?.build) {
    let buildScript = project.functionBayFile.scripts.build;
    console.log(`Detected build script: "${buildScript}"`);
    await $`bash -c ${buildScript}`.env(env);
  } else if (project.packageJson?.scripts?.build) {
    console.log(
      `Detected build script in package.json: "${project.packageJson.scripts.build}"`
    );
    await $`bash -c "npm run build"`.env(env);
  } else {
    console.log('No build script detected, skipping build step.');
  }
};

let detectEntrypoint = (project: Project) => {
  let potentialEntrypoints = cleanup([
    project.functionBayFile?.entrypoint,
    project.packageJson?.main,

    ...tryDirs(tryExtensions('index')),
    ...tryDirs(tryExtensions('main')),
    ...tryDirs(tryExtensions('server')),
    ...tryDirs(tryExtensions('function'))
  ]).filter(fileExistsSync);

  if (potentialEntrypoints.length === 0) {
    throw new Error(
      'Could not find entrypoint for function. Please specify one in function-bay.json'
    );
  }

  let entrypoint = potentialEntrypoints[0]!;
  console.log(`Detected entrypoint: ${entrypoint}`);
  if (!project.functionBayFile?.entrypoint) {
    console.log(
      'You can specify this entrypoint in metorial.json to skip this detection step in the future.'
    );
  }

  return entrypoint;
};

let buildForLambda = async (layer: FunctionBayLayer) => {
  let { ncc, typescript, nodeTypes } = functionBayNodeBuildToolchain;

  await $`bun i -g ${ncc} ${typescript} ${nodeTypes}`;
  await $`curl https://get.volta.sh | bash`;

  console.log('Setting up Node.js build environment...');

  let project = await readProject();
  let { packageJson, functionBayFile } = project;

  let nodeJsVersionIdentifierRaw =
    functionBayFile?.nodeJsVersion ?? process.env.NODE_VERSION ?? '24.x';
  let nodeJsVersionIdentifier = nodeJsVersionIdentifierRaw.split('.')[0] + '.x';

  console.log(`Using Node.js version identifier: ${nodeJsVersionIdentifier}`);

  let env = {
    ...process.env,
    PATH: `${process.env.HOME}/.volta/bin:${process.env.PATH}`
  } as Record<string, string>;

  await $`bash -c "volta install node@${nodeJsVersionIdentifier}"`.env(env);

  if (packageJson) {
    if (fileExistsSync('yarn.lock')) {
      console.log('Detected yarn.lock, installing dependencies with Yarn...');
      await $`bash -c "volta install yarn@1"`.env(env);
      await $`bash -c "yarn install"`.env(env);
      await $`bash -c "yarn add ${ncc} ${typescript} ${nodeTypes}"`.env(env);
    } else if (fileExistsSync('pnpm-lock.yaml')) {
      console.log('Detected pnpm-lock.yaml, installing dependencies with pnpm...');
      await $`bash -c "volta install pnpm"`.env(env);
      await $`bash -c "pnpm install"`.env(env);
      await $`bash -c "pnpm add ${ncc} ${typescript} ${nodeTypes}"`.env(env);
    } else if (fileExistsSync('bun.lock')) {
      console.log('Detected bun.lock, installing dependencies with Bun...');
      await $`bash -c "volta install bun"`.env(env);
      await $`bash -c "bun install"`.env(env);
      await $`bash -c "bun add ${ncc} ${typescript} ${nodeTypes}"`.env(env);
    } else {
      console.log('Installing dependencies with npm...');
      await $`bash -c "npm install"`.env(env);
      await $`bash -c "npm install ${ncc} ${typescript} ${nodeTypes}"`.env(env);
    }
  } else {
    console.log('No package.json found, skipping dependency installation.');
  }

  await runBuildScript(project, env);

  let entrypoint = detectEntrypoint(project);

  console.log('Bundling function to Metorial Function Bay format...');

  let launcher = await getMetorialLauncher({ bundledEntrypoint: entrypoint, layer });
  for (let file of launcher.files) {
    await fs.writeFile(path.join(process.cwd(), file.filename), file.content, 'utf-8');
  }

  let outputTempDir = await tempDir();
  await $`ncc build ${launcher.entrypoint} -o ${outputTempDir} --minify --source-map --no-source-map-register --target es2020 --transpile-only`.env(
    env
  );

  await sanitizeLambdaBundle(outputTempDir);

  console.log('\nCreating function package...');

  let { Function } = await import('@function-bay/build');
  await Function.create({
    runtime: {
      identifier: '@function-bay/nodejs',
      layer: layer as any,
      handler: 'index.handler',
      runtime: {
        identifier: 'nodejs',
        version: nodeJsVersionIdentifier as '24.x'
      }
    },
    directory: outputTempDir
  });
};

let buildForKnative = async (layer: FunctionBayLayer) => {
  // `.env()` replaces the environment; package managers need the egress proxy settings.
  let env = { ...process.env } as Record<string, string>;

  if (!(await commandExists('ncc'))) {
    let { ncc, typescript, nodeTypes } = functionBayNodeBuildToolchain;
    await $`bun i -g ${ncc} ${typescript} ${nodeTypes}`;
  }

  let project = await readProject();
  let { packageJson, functionBayFile } = project;

  if (functionBayFile?.nodeJsVersion && !functionBayFile.nodeJsVersion.startsWith('24')) {
    console.log(
      `Node.js ${functionBayFile.nodeJsVersion} was requested, Kubernetes functions run on Node.js ${KNATIVE_NODE_VERSION}.`
    );
  }

  if (packageJson) {
    if (fileExistsSync('yarn.lock')) {
      console.log('Detected yarn.lock, installing dependencies with Yarn...');
      await $`bash -c "npx -y yarn@1 install"`.env(env);
    } else if (fileExistsSync('pnpm-lock.yaml')) {
      console.log('Detected pnpm-lock.yaml, installing dependencies with pnpm...');
      await $`bash -c "npx -y pnpm install"`.env(env);
    } else if (fileExistsSync('bun.lock')) {
      console.log('Detected bun.lock, installing dependencies with Bun...');
      await $`bash -c "bun install"`.env(env);
    } else {
      console.log('Installing dependencies with npm...');
      await $`bash -c "npm install"`.env(env);
    }
  } else {
    console.log('No package.json found, skipping dependency installation.');
  }

  await runBuildScript(project, env);

  let entrypoint = detectEntrypoint(project);

  console.log('Bundling function to Metorial Function Bay format...');

  let outputTempDir = await tempDir();
  await compileKnativeEntrypoint({ entrypoint, outDir: outputTempDir, env });
  let { handler } = await prepareKnativeBundle(outputTempDir);

  console.log('\nCreating function package...');

  await writeFunctionPackage({
    runtime: {
      identifier: '@function-bay/nodejs',
      layer,
      handler,
      runtime: { identifier: 'nodejs', version: KNATIVE_NODE_VERSION }
    },
    directory: outputTempDir
  });
};

export let build = async (): Promise<void> => {
  console.log('Building Node.js function...');

  let layer = readBuildLayer();
  if (layer.provider === 'knative') await buildForKnative(layer);
  else await buildForLambda(layer);

  console.log('Function package created successfully.');
};
